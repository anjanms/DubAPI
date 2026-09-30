'use strict';

var util = require('util'),
    eventEmitter = require('events').EventEmitter;

var RoomModel = require('./lib/models/roomModel.js'),
    SelfModel = require('./lib/models/selfModel.js'),
    UserModel = require('./lib/models/userModel.js');

var RequestHandler = require('./lib/requestHandler.js'),
    ActionHandler = require('./lib/actionHandler.js'),
    SocketHandler = require('./lib/socketHandler.js'),
    EventHandler = require('./lib/eventHandler.js');

var DubAPIError = require('./lib/errors/error.js'),
    DubAPIRequestError = require('./lib/errors/requestError.js');

var pkg = require('./package.json'),
    utils = require('./lib/utils.js'),
    events = require('./lib/data/events.js'),
    endpoints = require('./lib/data/endpoints.js');

function DubAPI(auth, callback) {
    if (typeof auth !== 'object') throw new TypeError('auth must be an object');

    if (typeof auth.username !== 'string') throw new TypeError('auth.username must be a string');
    if (typeof auth.password !== 'string') throw new TypeError('auth.password must be a string');

    if (typeof callback !== 'function') throw new TypeError('callback must be a function');

    var that = this;

    eventEmitter.call(this);

    this._ = {};

    this._.connected = false;
    this._.actHandler = new ActionHandler(this, auth);
    this._.reqHandler = new RequestHandler(this);
    this._.sokHandler = new SocketHandler(this);

    this._.slug = undefined;
    this._.self = undefined;
    this._.room = undefined;

    this.mutedTriggerEvents = false;
    this.maxChatMessageSplits = 1;

    this._.actHandler.doLogin(function(err) {
        if (err) return callback(err);

        that._.reqHandler.queue({method: 'GET', url: endpoints.authSession}, function(code, body) {
            if (code !== 200) return callback(new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.authSession)));

            that._.self = new SelfModel(body.data);

            that._.sokHandler.connect();

            callback(undefined, that);
        });
    });
}

util.inherits(DubAPI, eventEmitter);

DubAPI.prototype.events = events;
DubAPI.prototype.version = pkg.version;

/*
 * External Functions
 */

DubAPI.prototype.connect = function(slug) {
    if (this._.slug !== undefined) return;

    this._.slug = slug;

    var that = this;

    that._.reqHandler.queue({method: 'GET', url: endpoints.room}, function(code, body) {
        if (code !== 200) {
            that.emit('error', new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.room)));
            return that.disconnect();
        }

        var roomJoinEndpoint = endpoints.roomUsers.replace('%RID%', body.data._id);

        that._.reqHandler.queue({method: 'POST', url: roomJoinEndpoint}, function(code, body) {
            if ([200, 401].indexOf(code) === -1) {
                that.emit('error', new DubAPIRequestError(code, roomJoinEndpoint));
                return that.disconnect();
            } else if (code === 401) {
                that.emit('error', new DubAPIError(that._.self.username + ' is banned from ' + that._.slug));
                return that.disconnect();
            }

            that._.room = new RoomModel(body.data.room);

            body.data.user._user = utils.clone(that._.self);

            that._.room.users.add(new UserModel(body.data.user));

            that._.sokHandler.attachChannel('room:' + that._.room.id, utils.bind(EventHandler, that));

            that._.reqHandler.queue({method: 'GET', url: endpoints.roomUsers}, function(code, body) {
                if (code !== 200) {
                    that.emit('error', new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.roomUsers)));
                    return that.disconnect();
                }

                body.data.map(function(data) {return new UserModel(data);}).forEach(function(userModel) {
                    that._.room.users.add(userModel);
                });

                //Without roles only the room owner has permissions, so keep connecting either way
                that._.actHandler.updateRoles(function() {
                    that._.actHandler.updatePlay();
                    that._.actHandler.updateQueue();

                    that._.connected = true;
                    that.emit('connected', that._.room.name);
                });
            });
        });
    });
};

DubAPI.prototype.disconnect = function() {
    if (this._.slug === undefined) return;

    var name = this._.room ? this._.room.name : undefined;

    this._.reqHandler.clear();

    if (this._.room) {
        clearTimeout(this._.room.playTimeout);
        this._.sokHandler.detachChannel('room:' + this._.room.id);
        this._.reqHandler.queue({method: 'DELETE', url: endpoints.roomUsers});
    }

    this._.slug = undefined;
    this._.room = undefined;

    if (this._.connected) {
        this.emit('disconnected', name);
        this._.connected = false;
    }
};

DubAPI.prototype.reconnect = function() {
    if (this._.slug === undefined) return;

    var slug = this._.slug;

    this.disconnect();
    this.connect(slug);
};

DubAPI.prototype.sendChat = function(message, callback) {
    if (!this._.connected) return;

    if (typeof message !== 'string') throw new TypeError('message must be a string');

    message = message.trim();

    if (message.length === 0) throw new Error('message cannot be empty');

    message = utils.encodeHTMLEntities(message);

    message = message.match(/(.{1,255})(?:\s|$)|(.{1,255})/g);

    var body = {};

    body.type = 'chat-message';
    body.realTimeChannel = this._.room.realTimeChannel;

    for (var i = 0; i < message.length; i++) {
        body.time = Date.now();
        body.message = message[i];

        this._.reqHandler.queue({method: 'POST', url: endpoints.chat, json: utils.clone(body), isChat: true}, callback);

        callback = undefined;

        if (i >= this.maxChatMessageSplits) break;
    }
};

DubAPI.prototype.getChatHistory = function() {
    if (!this._.connected) return [];

    return utils.clone(this._.room.chat, {deep: true});
};

DubAPI.prototype.getRoomMeta = function() {
    if (!this._.connected) return;

    return this._.room.getMeta();
};

DubAPI.prototype.getQueue = function() {
    if (!this._.connected) return [];

    return utils.clone(this._.room.queue, {deep: true});
};

DubAPI.prototype.getQueuePosition = function(uid) {
    if (!this._.connected) return -1;

    return this._.room.queue.indexWhere({uid: uid});
};

/*
 * User Queue Functions
 */

DubAPI.prototype.queueMedia = function(type, fkid, callback) {
    if (!this._.connected) return false;

    if (typeof type !== 'string') throw new TypeError('type must be a string');
    if (typeof fkid !== 'string') throw new TypeError('fkid must be a string');

    var form = {songType: type, songId: fkid};

    this._.reqHandler.queue({method: 'POST', url: endpoints.roomPlaylist, form: form}, callback);

    return true;
};

DubAPI.prototype.queuePlaylist = function(playlistid, callback) {
    if (!this._.connected) return false;

    if (typeof playlistid !== 'string') throw new TypeError('playlistid must be a string');

    this._.reqHandler.queue({method: 'POST', url: endpoints.queuePlaylist.replace('%PID%', playlistid)}, callback);

    return true;
};

DubAPI.prototype.clearQueue = function(callback) {
    if (!this._.connected) return false;

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.roomPlaylist}, callback);

    return true;
};

DubAPI.prototype.pauseQueue = function(pause, callback) {
    if (!this._.connected) return false;

    if (typeof pause !== 'boolean') throw new TypeError('pause must be a boolean');

    var form = {queuePaused: pause ? 1 : 0};

    this._.reqHandler.queue({method: 'PUT', url: endpoints.queuePause, form: form}, callback);

    return true;
};

/*
 * Moderation Functions
 */

DubAPI.prototype.moderateSkip = function(callback) {
    if (!this._.connected || !this._.room.play) return false;
    if (!this.hasPermission(this._.self, 'skip')) return false;

    if (this._.room.play.skipped) return false;

    var form = {realTimeChannel: this._.room.realTimeChannel},
        uri = endpoints.chatSkip.replace('%PID%', this._.room.play.id);

    this._.reqHandler.queue({method: 'POST', url: uri, form: form}, callback);

    return true;
};

DubAPI.prototype.moderateDeleteChat = function(cid, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'delete-chat')) return false;

    if (typeof cid !== 'string') throw new TypeError('cid must be a string');

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.chatDelete.replace('%CID%', cid)}, callback);

    return true;
};

DubAPI.prototype.moderateBanUser = function(uid, time, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'ban')) return false;

    if (typeof time === 'function') {
        callback = time;
        time = undefined;
    }

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');
    if (time !== undefined && !Number.isInteger(time)) throw new TypeError('time must be undefined or an integer');
    if (time && time < 0) throw new RangeError('time must be zero or greater');

    if (!this._outranks(uid)) return false;

    var form = {realTimeChannel: this._.room.realTimeChannel, time: time ? time : 0};

    this._.reqHandler.queue({method: 'POST', url: endpoints.chatBan.replace('%UID%', uid), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateUnbanUser = function(uid, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'ban')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.chatBan.replace('%UID%', uid), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateKickUser = function(uid, msg, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'kick')) return false;

    if (typeof msg === 'function') {
        callback = msg;
        msg = undefined;
    }

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');
    if (['string', 'undefined'].indexOf(typeof msg) === -1) throw new TypeError('msg must be a string or undefined');

    if (!this._outranks(uid)) return false;

    var form = {realTimeChannel: this._.room.realTimeChannel, message: msg ? utils.encodeHTMLEntities(msg) : ''};

    this._.reqHandler.queue({method: 'POST', url: endpoints.chatKick.replace('%UID%', uid), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateMuteUser = function(uid, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'mute')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    //Only members without a role can be muted, and never the room owner or the bot itself
    var user = this._.room.users.findWhere({id: uid});
    if (uid === this._.self.id || uid === this._.room.user || user && user.role !== null) return false;

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'POST', url: endpoints.chatMute.replace('%UID%', uid), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateUnmuteUser = function(uid, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'mute')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.chatMute.replace('%UID%', uid), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateMoveDJ = function(uid, position, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'queue-order')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');
    if (!Number.isInteger(position)) throw new TypeError('position must be an integer');

    var index = this._.room.queue.indexWhere({uid: uid});

    if (position < 0) position = 0;
    else if (position >= this._.room.queue.length) position = this._.room.queue.length - 1;

    if (index === position || index === -1) return false;

    var queue = this._.room.queue.map(function(queueItem) {return queueItem.uid;});

    queue.splice(position, 0, queue.splice(index, 1)[0]);

    this._.reqHandler.queue({method: 'POST', url: endpoints.roomQueueOrder, form: {order: queue}}, callback);

    return true;
};

DubAPI.prototype.moderateRemoveDJ = function(uid, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'queue.dj.remove')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    if (this._.room.queue.indexWhere({uid: uid}) === -1) return false;

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.roomQueueRemoveUser.replace('%UID%', uid)}, callback);

    return true;
};

DubAPI.prototype.moderateRemoveSong = function(uid, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'queue.remove')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    if (this._.room.queue.indexWhere({uid: uid}) === -1) return false;

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.roomQueueRemoveSong.replace('%UID%', uid)}, callback);

    return true;
};

DubAPI.prototype.moderatePauseDJ = function(uid, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'queue.dj.remove')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    if (this._.room.queue.indexWhere({uid: uid}) === -1) return false;

    this._.reqHandler.queue({method: 'PUT', url: endpoints.roomQueuePauseUser.replace('%UID%', uid)}, callback);

    return true;
};

/**
 * Give a member a role, a member can hold several roles.
 * @param {string} uid - Id of the member
 * @param {string} role - Role id, label (any case) or starter role templateKey, e.g. 'mod'
 * @param {function} [callback] - Called with the HTTP status code and response body
 * @returns {boolean} true if the request was queued, false if the bot is not allowed and nothing was sent
 */
DubAPI.prototype.moderateSetRole = function(uid, role, callback) {
    return this._changeRole('PUT', uid, role, callback);
};

/**
 * Take a role away from a member.
 * @param {string} uid - Id of the member
 * @param {string} role - Role id, label (any case) or starter role templateKey, e.g. 'mod'
 * @param {function} [callback] - Called with the HTTP status code and response body
 * @returns {boolean} true if the request was queued, false if the bot is not allowed and nothing was sent
 */
DubAPI.prototype.moderateUnsetRole = function(uid, role, callback) {
    return this._changeRole('DELETE', uid, role, callback);
};

/**
 * Assign or remove a role, the bot needs roles.manage and must outrank both the role and the member.
 * @param {string} method - PUT to assign, DELETE to remove
 * @param {string} uid - Id of the member
 * @param {string} role - Role id, label (any case) or starter role templateKey, e.g. 'mod'
 * @param {function} [callback] - Called with the HTTP status code and response body
 * @returns {boolean} true if the request was queued, false if the bot is not allowed and nothing was sent
 */
DubAPI.prototype._changeRole = function(method, uid, role, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'roles.manage')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');
    if (typeof role !== 'string') throw new TypeError('role must be a string');

    var roleData = this._.room.findRole(role);
    if (roleData === undefined) throw new DubAPIError('role not found');

    //The bot can only manage roles, and members, ranked below itself
    if (roleData.isDefault || roleData.position >= this._.room.rank(this._.self, true)) return false;
    if (!this._outranks(uid)) return false;

    var url = endpoints.roomUserRole.replace('%UID%', uid).replace('%ROLEID%', roleData.id);

    this._.reqHandler.queue({method: method, url: url}, callback);

    return true;
};

/**
 * Whether the bot ranks above a member, kicking, banning and role changes only work on members below it.
 * @param {string} uid - Id of the member
 * @returns {boolean} true if the bot outranks the member, or the member is not in the room and is not the owner
 */
DubAPI.prototype._outranks = function(uid) {
    if (uid === this._.self.id) return false;

    var user = this._.room.users.findWhere({id: uid});

    //Not in the room, so let the server decide
    if (!user) return uid !== this._.room.user;

    return this._.room.rank(user) < this._.room.rank(this._.self, true);
};

/**
 * Whether the bot can manage a role: it needs roles.manage, must outrank the role and hold every permission it grants.
 * @param {object} [roleData] - The role being changed, omit when creating or reordering
 * @param {string[]} [permissions] - Permission keys the bot would put on the role
 * @returns {boolean} true if the bot is allowed
 */
DubAPI.prototype._canManageRole = function(roleData, permissions) {
    if (!this.hasPermission(this._.self, 'roles.manage')) return false;
    if (roleData && roleData.position >= this._.room.rank(this._.self, true)) return false;

    return (permissions || []).every(function(permission) {
        return this.hasPermission(this._.self, permission);
    }, this);
};

/**
 * Create a role in the room, new roles are placed just above the default role.
 * @param {object} data - The new role
 * @param {string} data.label - Display name, 1 to 32 characters
 * @param {string} [data.color] - Hex colour, e.g. '#00aeff'
 * @param {string[]} [data.permissions] - Permission keys, the bot must hold each one
 * @param {boolean} [data.mentionable] - Whether anyone can @mention the role
 * @param {boolean} [data.displaySeparately] - Whether holders get their own heading in the user list
 * @param {function} [callback] - Called with the HTTP status code and response body
 * @returns {boolean} true if the request was queued, false if the bot is not allowed and nothing was sent
 */
DubAPI.prototype.createRole = function(data, callback) {
    if (!this._.connected) return false;

    if (typeof data !== 'object' || data === null) throw new TypeError('data must be an object');
    if (typeof data.label !== 'string') throw new TypeError('data.label must be a string');

    if (!this._canManageRole(undefined, data.permissions)) return false;

    this._.reqHandler.queue({method: 'POST', url: endpoints.createRole, json: utils.clone(data)}, callback);

    return true;
};

/**
 * Change a role, fields not in changes keep their current value.
 * @param {string} role - Role id, label (any case) or starter role templateKey, e.g. 'mod'
 * @param {object} changes - Any of label, color, permissions, mentionable, displaySeparately
 * @param {function} [callback] - Called with the HTTP status code and response body
 * @returns {boolean} true if the request was queued, false if the bot is not allowed and nothing was sent
 */
DubAPI.prototype.updateRole = function(role, changes, callback) {
    if (!this._.connected) return false;

    if (typeof role !== 'string') throw new TypeError('role must be a string');
    if (typeof changes !== 'object' || changes === null) throw new TypeError('changes must be an object');

    var roleData = this._.room.findRole(role);
    if (roleData === undefined) throw new DubAPIError('role not found');

    //The API replaces the whole role, fields left out are cleared
    var body = {
        label: roleData.label,
        color: roleData.color,
        permissions: roleData.permissions,
        mentionable: roleData.mentionable,
        displaySeparately: roleData.displaySeparately
    };

    for (var key in body) {
        if (changes.hasOwnProperty(key)) body[key] = changes[key];
    }

    if (!this._canManageRole(roleData, body.permissions)) return false;

    var url = endpoints.updateRole.replace('%ROLEID%', roleData.id);

    this._.reqHandler.queue({method: 'PUT', url: url, json: utils.clone(body, {deep: true})}, callback);

    return true;
};

/**
 * Delete a role, everyone holding it loses it. The default role cannot be deleted.
 * @param {string} role - Role id, label (any case) or starter role templateKey, e.g. 'mod'
 * @param {function} [callback] - Called with the HTTP status code and response body
 * @returns {boolean} true if the request was queued, false if the bot is not allowed and nothing was sent
 */
DubAPI.prototype.deleteRole = function(role, callback) {
    if (!this._.connected) return false;

    if (typeof role !== 'string') throw new TypeError('role must be a string');

    var roleData = this._.room.findRole(role);
    if (roleData === undefined) throw new DubAPIError('role not found');

    if (roleData.isDefault || !this._canManageRole(roleData)) return false;

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.deleteRole.replace('%ROLEID%', roleData.id)}, callback);

    return true;
};

/**
 * Reorder the room's roles, roles the bot does not outrank must keep their place.
 * @param {string[]} order - Every role in the room exactly once, highest first, with the default role last.
 * Each entry is a role id, label or starter role templateKey
 * @param {function} [callback] - Called with the HTTP status code and response body
 * @returns {boolean} true if the request was queued, false if the bot is not allowed and nothing was sent
 */
DubAPI.prototype.reorderRoles = function(order, callback) {
    if (!this._.connected) return false;

    if (!Array.isArray(order)) throw new TypeError('order must be an array');

    var room = this._.room,
        ids = order.map(function(role) {
            var roleData = typeof role === 'string' ? room.findRole(role) : undefined;
            if (roleData === undefined) throw new DubAPIError('role not found: ' + role);
            return roleData.id;
        });

    var listsEveryRole = ids.length === room.roles.length && room.roles.every(function(role) {
        return ids.indexOf(role.id) !== -1;
    });

    if (!listsEveryRole) throw new DubAPIError('order must list every role in the room exactly once');
    if (!room.findRole(ids[ids.length - 1]).isDefault) throw new DubAPIError('the default role must be last');

    if (!this._canManageRole()) return false;

    //Roles the bot does not outrank must keep their index
    var rank = room.rank(this._.self, true),
        movesHigherRole = room.roles.some(function(role, index) {
            return role.position >= rank && ids[index] !== role.id;
        });

    if (movesHigherRole) return false;

    this._.reqHandler.queue({method: 'PUT', url: endpoints.reorderRoles, json: {order: ids}}, callback);

    return true;
};

DubAPI.prototype.moderateLockQueue = function(locked, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'lock-queue')) return false;

    if (this._.room.lockQueue === locked) return false;

    if (typeof locked !== 'boolean') throw new TypeError('locked must be a boolean');

    var form = {lockQueue: 0};
    if (locked) form.lockQueue = 1;

    this._.reqHandler.queue({method: 'PUT', url: endpoints.lockQueue, form: form}, callback);

    return true;
};

DubAPI.prototype.moderateSetOption = function(option, value, callback) {
    if (!this._.connected) return false;
    if (!this.hasPermission(this._.self, 'mod-settings')) return false;

    if (this._.room[option] === value) return false;

    if (option === 'allowGuestsToChat' && typeof value !== 'boolean') {
        throw new TypeError('allowGuestsToChat must be a boolean');
    }

    if (option === 'allowGuestsToEmbed' && typeof value !== 'boolean') {
        throw new TypeError('allowGuestsToEmbed must be a boolean');
    }

    if (option === 'slowMode' && typeof value !== 'boolean') {
        throw new TypeError('slowMode must be a boolean');
    }

    var form = {action: option, value: value};

    this._.reqHandler.queue({method: 'POST', url: endpoints.roomModSettings, form: form}, callback);

    return true;
};

/*
 * Media Functions
 */

DubAPI.prototype.updub = function(callback) {
    if (!this._.connected || !this._.room.play || this._.room.play.dubs[this._.self.id] === 'updub') return;

    this._.reqHandler.queue({method: 'POST', url: endpoints.roomPlaylistVote.replace('%PLAYLISTID%', this._.room.play.id), form: {type: 'updub'}}, callback);
};

DubAPI.prototype.downdub = function(callback) {
    if (!this._.connected || !this._.room.play || this._.room.play.dubs[this._.self.id] === 'downdub') return;

    this._.reqHandler.queue({method: 'POST', url: endpoints.roomPlaylistVote.replace('%PLAYLISTID%', this._.room.play.id), form: {type: 'downdub'}}, callback);
};

DubAPI.prototype.getMedia = function() {
    if (!this._.connected || !this._.room.play) return;

    return utils.clone(this._.room.play.media);
};

DubAPI.prototype.getScore = function() {
    if (!this._.connected || !this._.room.play) return;

    return this._.room.play.getScore();
};

DubAPI.prototype.getPlayID = function() {
    if (!this._.connected || !this._.room.play) return;

    return this._.room.play.id;
};

DubAPI.prototype.getTimeRemaining = function() {
    if (!this._.connected || !this._.room.play) return -1;

    return this._.room.play.getTimeRemaining();
};

DubAPI.prototype.getTimeElapsed = function() {
    if (!this._.connected || !this._.room.play) return -1;

    return this._.room.play.getTimeElapsed();
};

/*
 * User Functions
 */

DubAPI.prototype.getUser = function(uid) {
    if (!this._.connected) return;

    return utils.clone(this._.room.users.findWhere({id: uid}));
};

DubAPI.prototype.getUserByName = function(username, ignoreCase) {
    if (!this._.connected) return;

    return utils.clone(this._.room.users.findWhere({username: username}, {ignoreCase: ignoreCase}));
};

DubAPI.prototype.getSelf = function() {
    if (!this._.connected) return;

    return utils.clone(this._.room.users.findWhere({id: this._.self.id}));
};

DubAPI.prototype.getCreator = function() {
    if (!this._.connected) return;

    return utils.clone(this._.room.users.findWhere({id: this._.room.user}));
};

DubAPI.prototype.getDJ = function() {
    if (!this._.connected || !this._.room.play) return;

    return utils.clone(this._.room.users.findWhere({id: this._.room.play.user}));
};

DubAPI.prototype.getUsers = function() {
    if (!this._.connected) return [];

    return utils.clone(this._.room.users);
};

DubAPI.prototype.getStaff = function() {
    if (!this._.connected) return [];

    return utils.clone(this._.room.users.filter(function(user) {return user.role !== null;}));
};

/*
 * Role Functions
 */

/**
 * The room's roles, highest position first.
 * @returns {object[]} A copy of the roles, empty when not connected
 */
DubAPI.prototype.getRoles = function() {
    if (!this._.connected) return [];

    return utils.clone(this._.room.roles, {deep: true});
};

/**
 * Whether a user holds one of the room's starter roles. Rooms can rename or delete their starter roles, so this
 * only finds roles still carrying the templateKey.
 * @param {object} user - The user, only its id is used
 * @param {string} templateKey - Starter role key, e.g. 'mod' or 'resident-dj'
 * @returns {boolean} true if the user holds that role
 */
DubAPI.prototype._holdsStarterRole = function(user, templateKey) {
    if (!this._.connected || user === undefined) return false;

    var userModel = this._.room.users.findWhere({id: user.id}),
        role = this._.room.roles.find(function(r) {return r.templateKey === templateKey;});

    return Boolean(userModel && role && userModel.roles.indexOf(role.id) !== -1);
};

DubAPI.prototype.isCreator = function(user) {
    if (!this._.connected || user === undefined) return false;
    return user.id === this._.room.user;
};

DubAPI.prototype.isOwner = function(user) {
    return this._holdsStarterRole(user, 'co-owner');
};

DubAPI.prototype.isManager = function(user) {
    return this._holdsStarterRole(user, 'manager');
};

DubAPI.prototype.isMod = function(user) {
    return this._holdsStarterRole(user, 'mod');
};

DubAPI.prototype.isVIP = function(user) {
    return this._holdsStarterRole(user, 'vip');
};

DubAPI.prototype.isResidentDJ = function(user) {
    return this._holdsStarterRole(user, 'resident-dj');
};

DubAPI.prototype.isDJ = function(user) {
    return this._holdsStarterRole(user, 'dj');
};

//An ordinary member, holding no role besides the room's default one
DubAPI.prototype.isMember = function(user) {
    if (!this._.connected || user === undefined) return false;

    var userModel = this._.room.users.findWhere({id: user.id});
    return Boolean(userModel && userModel.role === null);
};

DubAPI.prototype.isStaff = function(user) {
    if (!this._.connected || user === undefined) return false;

    var userModel = this._.room.users.findWhere({id: user.id});
    return Boolean(userModel && userModel.role !== null);
};

/*
 * Permission Functions
 */

DubAPI.prototype.hasPermission = function(user, permission) {
    if (!this._.room || user === undefined) return false;

    var userModel = this._.room.users.findWhere({id: user.id});
    if (!userModel) return false;

    return this._.room.hasPermission(userModel, permission, user.id === this._.self.id);
};

module.exports = DubAPI;
