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
    roles = require('./lib/data/roles.js'),
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
DubAPI.prototype.roles = roles;
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

        that._.room = new RoomModel(body.data);

        that._.sokHandler.attachChannel('room:' + that._.room.id, utils.bind(EventHandler, that));

        that._.reqHandler.queue({method: 'POST', url: endpoints.roomUsers}, function(code, body) {
            if ([200, 401].indexOf(code) === -1) {
                that.emit('error', new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.roomUsers)));
                return that.disconnect();
            } else if (code === 401) {
                that.emit('error', new DubAPIError(that._.self.username + ' is banned from ' + that._.room.name));
                return that.disconnect();
            }

            that._.reqHandler.queue({method: 'GET', url: endpoints.roomUsers}, function(code, body) {
                if (code !== 200) {
                    that.emit('error', new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.roomUsers)));
                    return that.disconnect();
                }

                body.data.map(function(data) {return new UserModel(data);}).forEach(function(userModel) {
                    that._.room.users.add(userModel);
                });

                that._.actHandler.updatePlay();
                that._.actHandler.updateQueue();

                that._.connected = true;
                that.emit('connected', that._.room.name);
            });
        });
    });
};

DubAPI.prototype.disconnect = function() {
    if (this._.slug === undefined) return;

    var name = this._.room ? this._.room.name : undefined;

    this._.reqHandler.clear();

    this._.sokHandler.detachChannel('room:' + this._.room.id);

    if (this._.room) {
        clearTimeout(this._.room.playTimeout);
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

        this._.reqHandler.queue({method: 'POST', url: endpoints.chat, body: utils.clone(body), isChat: true}, callback);

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
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('skip')) return false;

    if (this._.room.play.skipped) return false;

    var form = {realTimeChannel: this._.room.realTimeChannel},
        uri = endpoints.chatSkip.replace('%PID%', this._.room.play.id);

    this._.reqHandler.queue({method: 'POST', url: uri, form: form}, callback);

    return true;
};

DubAPI.prototype.moderateDeleteChat = function(cid, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('delete-chat')) return false;

    if (typeof cid !== 'string') throw new TypeError('cid must be a string');

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.chatDelete.replace('%CID%', cid)}, callback);

    return true;
};

DubAPI.prototype.moderateBanUser = function(uid, time, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('ban')) return false;

    if (typeof time === 'function') {
        callback = time;
        time = undefined;
    }

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');
    if (time !== undefined && !utils.isInteger(time)) throw new TypeError('time must be undefined or an integer');
    if (time && time < 0) throw new RangeError('time must be zero or greater');

    var user = this._.room.users.findWhere({id: uid});
    if (user && user.role !== null) return false;

    var form = {realTimeChannel: this._.room.realTimeChannel, time: time ? time : 0};

    this._.reqHandler.queue({method: 'POST', url: endpoints.chatBan.replace('%UID%', uid), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateUnbanUser = function(uid, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('ban')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.chatBan.replace('%UID%', uid), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateKickUser = function(uid, msg, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('kick')) return false;

    if (typeof msg === 'function') {
        callback = msg;
        msg = undefined;
    }

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');
    if (['string', 'undefined'].indexOf(typeof msg) === -1) throw new TypeError('msg must be a string or undefined');

    var user = this._.room.users.findWhere({id: uid});
    if (user && user.role !== null) return false;

    var form = {realTimeChannel: this._.room.realTimeChannel, message: msg ? utils.encodeHTMLEntities(msg) : ''};

    this._.reqHandler.queue({method: 'POST', url: endpoints.chatKick.replace('%UID%', uid), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateMuteUser = function(uid, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('mute')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    var user = this._.room.users.findWhere({id: uid});
    if (user && user.role !== null) return false;

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'POST', url: endpoints.chatMute.replace('%UID%', uid), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateUnmuteUser = function(uid, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('mute')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.chatMute.replace('%UID%', uid), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateMoveDJ = function(uid, position, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('queue-order')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');
    if (!utils.isInteger(position)) throw new TypeError('position must be an integer');

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
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('queue-order')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    if (this._.room.queue.indexWhere({uid: uid}) === -1) return false;

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.roomQueueRemoveUser.replace('%UID%', uid)}, callback);

    return true;
};

DubAPI.prototype.moderateRemoveSong = function(uid, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('queue-order')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    if (this._.room.queue.indexWhere({uid: uid}) === -1) return false;

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.roomQueueRemoveSong.replace('%UID%', uid)}, callback);

    return true;
};

DubAPI.prototype.moderatePauseDJ = function(uid, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('queue-order')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');

    if (this._.room.queue.indexWhere({uid: uid}) === -1) return false;

    this._.reqHandler.queue({method: 'PUT', url: endpoints.roomQueuePauseUser.replace('%UID%', uid)}, callback);

    return true;
};

DubAPI.prototype.moderateSetRole = function(uid, role, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('set-roles')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');
    if (typeof role !== 'string') throw new TypeError('role must be a string');
    if (roles[role] === undefined) throw new DubAPIError('role not found');

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'POST', url: endpoints.setRole.replace('%UID%', uid).replace('%ROLEID%', roles[role].id), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateUnsetRole = function(uid, role, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('set-roles')) return false;

    if (typeof uid !== 'string') throw new TypeError('uid must be a string');
    if (typeof role !== 'string') throw new TypeError('role must be a string');
    if (roles[role] === undefined) throw new DubAPIError('role not found');

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.setRole.replace('%UID%', uid).replace('%ROLEID%', role), form: form}, callback);

    return true;
};

DubAPI.prototype.moderateLockQueue = function(locked, callback) {
    if (!this._.connected) return false;
    if (!this._.room.users.findWhere({id: this._.self.id}).hasPermission('lock-queue')) return false;

    if (this._.room.lockQueue === locked) return false;

    if (typeof locked !== 'boolean') throw new TypeError('locked must be a boolean');

    var form = {lockQueue: 0};
    if (locked) form.lockQueue = 1;

    this._.reqHandler.queue({method: 'PUT', url: endpoints.lockQueue, form: form}, callback);

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

DubAPI.prototype.isCreator = function(user) {
    if (!this._.connected || user === undefined) return false;
    return user.id === this._.room.user;
};

DubAPI.prototype.isOwner = function(user) {
    if (!this._.connected || user === undefined) return false;
    return user.role === roles['co-owner'].id;
};

DubAPI.prototype.isManager = function(user) {
    if (!this._.connected || user === undefined) return false;
    return user.role === roles['manager'].id;
};

DubAPI.prototype.isMod = function(user) {
    if (!this._.connected || user === undefined) return false;
    return user.role === roles['mod'].id;
};

DubAPI.prototype.isVIP = function(user) {
    if (!this._.connected || user === undefined) return false;
    return user.role === roles['vip'].id;
};

DubAPI.prototype.isResidentDJ = function(user) {
    if (!this._.connected || user === undefined) return false;
    return user.role === roles['resident-dj'].id;
};

DubAPI.prototype.isStaff = function(user) {
    if (!this._.connected || user === undefined) return false;
    return user.role !== null;
};

/*
 * Permission Functions
 */

DubAPI.prototype.hasPermission = function(user, permission) {
    if (!this._.connected || user === undefined) return false;
    return this._.room.users.findWhere({id: user.id}).hasPermission(permission);
};

module.exports = DubAPI;
