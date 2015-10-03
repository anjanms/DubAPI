
var util = require('util'),
    eventEmitter = require('events').EventEmitter,
    pubnub = require('pubnub'),
    deepAssign = require('deep-assign');

var MediaModel = require('./lib/models/mediaModel.js'),
    PlayModel = require('./lib/models/playModel.js'),
    RoomModel = require('./lib/models/roomModel.js'),
    UserModel = require('./lib/models/userModel.js');

var RequestHandler = require('./lib/requestHandler.js'),
    EventHandler = require('./lib/eventHandler.js');

var DubAPIError = require('./lib/errors/error.js'),
    DubAPIRequestError = require('./lib/errors/requestError.js');

var utils = require('./lib/utils.js'),
    events = require('./lib/data/events.js'),
    package = require('./package.json'),
    endpoints = require('./lib/data/endpoints.js');

function formatSelf(data) {
    data.id = data.userInfo.userid;

    delete data.__v;
    delete data._id;
    delete data.userInfo;

    return data;
}

function DubAPI(auth, callback) {

    if (typeof auth !== 'object') throw new TypeError('auth must be an object');

    if (typeof auth.username !== 'string') throw new TypeError('auth.username must be a string');
    if (typeof auth.password !== 'string') throw new TypeError('auth.password must be a string');

    if (typeof callback !== 'function') throw new TypeError('callback must be a function');

    var that = this;

    eventEmitter.call(this);

    this._ = {};

    this._.connected = false;
    this._.reqHandler = new RequestHandler(this);
    this._.pubNub = undefined;

    this._.slug = undefined;
    this._.self = undefined;
    this._.room = undefined;

    this.reconnectOnKick = true;
    this.preventSelfMute = true;
    this.mutedTriggerEvents = false;

    this._.reqHandler.queue({method: 'POST', url: endpoints.authDubtrack, form: auth}, function(code, body) {
        if ([200, 400].indexOf(code) === -1) {
            return callback(new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.authDubtrack)));
        } else if (code === 400) {
            return callback(new DubAPIError('Authentication Failed: ' + body.data.details.message));
        }

        that._.reqHandler.queue({method: 'GET', url: endpoints.authSession}, function(code, body) {
            if (code !== 200) return callback(new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.authSession)));

            that._.self = formatSelf(body.data);

            that._.pubNub = pubnub({
                backfill: false,
                publish_key: '',
                subscribe_key: 'sub-c-2b40f72a-6b59-11e3-ab46-02ee2ddab7fe',
                ssl: true,
                uuid: that._.self.id
            });

            callback(undefined, that);
        });
    });
}

util.inherits(DubAPI, eventEmitter);

DubAPI.prototype.events = deepAssign({}, events);
DubAPI.prototype.version = package.version;

DubAPI.prototype._fetchMedia = function() {
    var that = this;

    that._.reqHandler.queue({method: 'GET', url: endpoints.roomPlaylistActive}, function(code, body) {
        if ([200, 404].indexOf(code) === -1) {
            return that.emit('error', new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.roomPlaylistActive)));
        } else if (code === 404) {
            that._.room.play = undefined;

            that.emit('*', {type: events.roomPlaylistUpdate});
            that.emit(events.roomPlaylistUpdate, {type: events.roomPlaylistUpdate});
            return;
        }

        var raw = body.data;

        that._.room.play = new PlayModel(body.data.song);
        that._.room.play.media = new MediaModel(body.data.songInfo);

        if (body.data.startTime * 1000 > that._.room.play.songLength) {
            that._.room.play = undefined;

            that.emit('*', {type: events.roomPlaylistUpdate});
            that.emit(events.roomPlaylistUpdate, {type: events.roomPlaylistUpdate});
            return;
        }

        clearTimeout(that._.room.playTimeout);
        that._.room.playTimeout = setTimeout(that._fetchMedia.bind(that), that._.room.play.getTimeRemaining() + 5000);

        that._.reqHandler.queue({method: 'GET', url: endpoints.roomPlaylistActiveDubs}, function(code, body) {
            if (code !== 200) {
                that.emit('error', new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.roomPlaylistActiveDubs)));
                return that.disconnect();
            }

            body.data.currentSong = new PlayModel(body.data.currentSong);

            if (that._.room.play.id !== body.data.currentSong.id) return;

            for (var i = 0; i < body.data.upDubs.length; i++) {
                that._.room.play.dubs[body.data.upDubs[i].userid] = 'updub';
            }

            for (var j = 0; j < body.data.downDubs.length; j++) {
                that._.room.play.dubs[body.data.downDubs[j].userid] = 'downdub';
            }

            that._.room.play.updubs = body.data.currentSong.updubs;
            that._.room.play.downdubs = body.data.currentSong.downdubs;

            var event = {};

            event.raw = raw;
            event.media = that._.room.play.media.toNewObject();
            event.user = that._.room.getDJ().toNewObject();
            event.id = that._.room.play.id;
            event.type = events.roomPlaylistUpdate;

            that.emit('*', event);
            that.emit(events.roomPlaylistUpdate, event);
        });
    });
};

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

        that._.pubNub.subscribe({
            channel: that._.room.realTimeChannel,
            callback: EventHandler.bind(that),
            connect: that.emit.bind(that, 'pubnub:connect'),
            reconnect: that.emit.bind(that, 'pubnub:reconnect'),
            disconnect: that.emit.bind(that, 'pubnub:disconnect'),
            error: that.emit.bind(that, 'error')
        });

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

                that._.room.addUsers(body.data.map(function(data) {return new UserModel(data);}));

                that._fetchMedia();

                that._.connected = true;
                that.emit('connected', that._.room.name);
            });
        });
    });
};

DubAPI.prototype.disconnect = function() {
    if (this._.slug === undefined) return;

    var name = this._.room ? this._.room.name : undefined;

    if (this._.room) {
        this._.pubNub.unsubscribe({
            channel: this._.room.realTimeChannel,
        });
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

DubAPI.prototype.sendChat = function(message) {
    if (!this._.connected) return;

    if (typeof message !== 'string') throw new TypeError('message must be a string');

    message = message.trim();

    if (message.length === 0) throw new Error('message cannot be empty');

    message = utils.encodeHTMLEntities(message);

    message = message.match(/(.{1,140})(?:\s|$)|(.{1,140})/g);

    var i = 0;

    var that = this;

    function sendNext() {
        if (i >= message.length) return;

        var body = {
            message: message[i],
            realTimeChannel: that._.room.realTimeChannel,
            time: Date.now(),
            type: 'chat-message'
        };

        i++;

        that._.reqHandler.queue({method: 'POST', url: endpoints.chat, body: body, sync: true}, sendNext);
    }

    sendNext();
};

/*
 * Moderation Functions
 */

DubAPI.prototype.moderateSkip = function(callback) {
    if (!this._.connected || !this._.room.play) return;
    if (!this._.room.isStaff(this._.room.getUser(this._.self.id))) return;

    if (this._.room.play.skipped) return;

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'POST', url: endpoints.chatSkip, form: form}, callback);
};

DubAPI.prototype.moderateBanUser = function(id, time, callback) {
    if (!this._.connected) return;
    if (!this._.room.isStaff(this._.room.getUser(this._.self.id))) return;

    if (this._.room.isStaff(this._.room.getUser(id))) return;

    if (typeof time === 'function') {
        callback = time;
        time = undefined;
    }

    if (typeof id !== 'string') throw new TypeError('id must be a string');
    if (['number', 'undefined'].indexOf(typeof time) === -1) throw new TypeError('time must be undefined or a number');
    if (time && time < 0) throw new RangeError('time must be zero or greater');

    var form = {realTimeChannel: this._.room.realTimeChannel, time: time ? time : 0};

    this._.reqHandler.queue({method: 'POST', url: endpoints.chatBan, user: id, form: form}, callback);
};

DubAPI.prototype.moderateUnbanUser = function(id, callback) {
    if (!this._.connected) return;
    if (!this._.room.isStaff(this._.room.getUser(this._.self.id))) return;

    if (typeof id !== 'string') throw new TypeError('id must be a string');

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.chatBan, user: id, form: form}, callback);
};

DubAPI.prototype.moderateKickUser = function(id, callback) {
    if (!this._.connected) return;
    if (!this._.room.isStaff(this._.room.getUser(this._.self.id))) return;

    if (typeof id !== 'string') throw new TypeError('id must be a string');

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'POST', url: endpoints.chatKick, user: id, form: form}, callback);
};

DubAPI.prototype.moderateMuteUser = function(id, callback) {
    if (!this._.connected) return;
    if (!this._.room.isStaff(this._.room.getUser(this._.self.id))) return;

    if (this._.room.isStaff(this._.room.getUser(id))) return;

    if (typeof id !== 'string') throw new TypeError('id must be a string');

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'POST', url: endpoints.chatMute, user: id, form: form}, callback);
};

DubAPI.prototype.moderateUnmuteUser = function(id, callback) {
    if (!this._.connected) return;
    if (!this._.room.isStaff(this._.room.getUser(this._.self.id))) return;

    if (typeof id !== 'string') throw new TypeError('id must be a string');

    var form = {realTimeChannel: this._.room.realTimeChannel};

    this._.reqHandler.queue({method: 'DELETE', url: endpoints.chatMute, user: id, form: form}, callback);
};

/*
 * Media Functions
 */

DubAPI.prototype.updub = function(callback) {
    if (!this._.connected || !this._.room.play || this._.room.play.dubs[this._.self.id] === 'updub') return;

    this._.reqHandler.queue({method: 'POST', url: endpoints.roomPlaylistActiveDubs, form: {type: 'updub'}}, callback);
};

DubAPI.prototype.downdub = function(callback) {
    if (!this._.connected || !this._.room.play || this._.room.play.dubs[this._.self.id] === 'downdub') return;

    this._.reqHandler.queue({method: 'POST', url: endpoints.roomPlaylistActiveDubs, form: {type: 'downdub'}}, callback);
};

DubAPI.prototype.getMedia = function() {
    if (!this._.connected || !this._.room.play) return;

    return this._.room.play.media.toNewObject();
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
    if (!this._.connected || !this._.room.play) return;

    return this._.room.play.getTimeRemaining();
};

DubAPI.prototype.getTimeElapsed = function() {
    if (!this._.connected || !this._.room.play) return;

    return this._.room.play.getTimeElapsed();
};

/*
 * User Functions
 */

DubAPI.prototype.getUser = function(id) {
    if (!this._.connected) return;

    var user = this._.room.getUser(id);

    return user ? user.toNewObject() : user;
};

DubAPI.prototype.getUserByName = function(username) {
    if (!this._.connected) return;

    var user = this._.room.getUserByName(username);

    return user ? user.toNewObject() : user;
};

DubAPI.prototype.getSelf = function() {
    if (!this._.connected) return;

    var user = this._.room.getUser(this._.self.id);

    return user ? user.toNewObject() : user;
};

DubAPI.prototype.getCreator = function() {
    if (!this._.connected) return;

    var user = this._.room.getCreator();

    return user ? user.toNewObject() : user;
};

DubAPI.prototype.getDJ = function() {
    if (!this._.connected || !this._.room.play) return;

    var user = this._.room.getDJ();

    return user ? user.toNewObject() : user;
};

DubAPI.prototype.getUsers = function() {
    if (!this._.connected) return;

    return this._.room.getUsers().map(function(userModel) {return userModel.toNewObject();});
};

DubAPI.prototype.getMods = function() {
    if (!this._.connected) return;

    return this._.room.getMods().map(function(userModel) {return userModel.toNewObject();});
};

DubAPI.prototype.getStaff = function() {
    if (!this._.connected) return;

    return this._.room.getStaff().map(function(userModel) {return userModel.toNewObject();});
};

/*
 * Role Comparator Functions
 */

DubAPI.prototype.isMod = function(user) {
    if (!this._.connected) return false;
    return this._.room.isMod(user);
};

DubAPI.prototype.isCreator = function(user) {
    if (!this._.connected) return false;
    return this._.room.isCreator(user);
};

DubAPI.prototype.isStaff = function(user) {
    if (!this._.connected) return false;
    return this._.room.isStaff(user);
};

module.exports = DubAPI;
