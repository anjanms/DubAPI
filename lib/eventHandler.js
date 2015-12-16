'use strict';

var MediaModel = require('./models/mediaModel.js'),
    PlayModel = require('./models/playModel.js'),
    UserModel = require('./models/userModel.js');

var DubAPIError = require('./errors/error.js');

var utils = require('./utils.js'),
    events = require('./data/events.js'),
    endpoints = require('./data/endpoints.js');

function EventHandler(msg, env, channel) {
    this.emit('pubnub:message', msg, env, channel);

    if (!this._.connected || channel !== this._.room.realTimeChannel) return;

    var userUpdateID, data, raw;

    if (/user_update_[0-9a-f]+/.test(msg.type)) {
        userUpdateID = msg.type.match(/user_update_([0-9a-f]+)/)[1];
        msg.type = 'user-update';
    }

    raw = utils.clone(msg, {deep: true});

    switch (msg.type) {
    case events.userJoin:
        msg.roomUser._user = msg.user;
        msg.user = new UserModel(msg.roomUser);
        delete msg.roomUser;

        if (this._.room.play) msg.user.dub = this._.room.play.dubs[msg.user.id];

        if (!this._.room.users.add(msg.user)) return;
        break;
    case events.userLeave:
        msg.user = this._.room.users.findWhere({id: msg.user._id});
        delete msg.room;

        //Handle erroneous leave events for the bot
        if (msg.user && msg.user.id === this._.self.id) {
            //Delay queuing the join request so ban and kick events have a chance to stop it
            setTimeout(function() {
                if (this._.connected) this._.reqHandler.queue({method: 'POST', url: endpoints.roomUsers});
            }.bind(this), 5000);
        }

        if (!this._.room.users.remove(msg.user)) return;
        break;
    case events.userSetRole:
        msg.mod = this._.room.users.findWhere({id: msg.user._id});
        msg.user = this._.room.users.findWhere({id: msg.modUser._id});
        delete msg.modUser;

        if (msg.user) msg.user.role = msg.role_object._id;
        delete msg.role_object;
        break;
    case events.userUnsetRole:
        msg.mod = this._.room.users.findWhere({id: msg.user._id});
        msg.user = this._.room.users.findWhere({id: msg.modUser._id});
        delete msg.modUser;

        if (msg.user) msg.user.role = null;
        delete msg.role_object;
        break;
    case events.userBan:
        msg.mod = this._.room.users.findWhere({id: msg.user._id});
        msg.user = this._.room.users.findWhere({id: msg.kickedUser._id});
        delete msg.kickedUser;

        if (msg.user && msg.user.id === this._.self.id) {
            setImmediate(function() {
                this.emit('error', new DubAPIError('Banned from ' + this._.room.name));
                this.disconnect();
            }.bind(this));
        }
        break;
    case events.userUnban:
        msg.mod = this._.room.users.findWhere({id: msg.user._id});
        msg.user = this._.room.users.findWhere({id: msg.kickedUser._id});
        delete msg.kickedUser;
        break;
    case events.userKick:
        if (msg.message) msg.message = utils.decodeHTMLEntities(msg.message.trim());
        msg.mod = this._.room.users.findWhere({id: msg.user._id});
        msg.user = this._.room.users.findWhere({id: msg.kickedUser._id});
        delete msg.kickedUser;

        if (msg.user && msg.user.id === this._.self.id) {
            setImmediate(function() {
                this.emit('error', new DubAPIError('Kicked from ' + this._.room.name));
                this.disconnect();
            }.bind(this));
        }
        break;
    case events.userMute:
        msg.mod = this._.room.users.findWhere({id: msg.user._id});
        msg.user = this._.room.users.findWhere({id: msg.mutedUser._id});
        delete msg.mutedUser;

        if (msg.user) msg.user.muted = true;
        break;
    case events.userUnmute:
        msg.mod = this._.room.users.findWhere({id: msg.user._id});
        msg.user = this._.room.users.findWhere({id: msg.mutedUser._id});
        delete msg.mutedUser;

        if (msg.user) msg.user.muted = false;
        break;
    case events.userUpdate:
        data = msg.user;

        msg.user = this._.room.users.findWhere({id: userUpdateID});

        if (msg.user) msg.user.set(data);
        break;
    case events.chatMessage:
        data = msg.user;

        msg.id = msg.chatid;
        msg.message = utils.decodeHTMLEntities(msg.message.trim());
        msg.user = this._.room.users.findWhere({id: msg.user._id});

        delete msg.chatid;
        delete msg.queue_object;

        //Update usernames, since user-update doesn't handle username changes
        if (msg.user && data.username !== msg.user.username && typeof data.username === 'string') {
            msg.user.username = data.username;
        }

        if (msg.user && msg.user.muted && !this.mutedTriggerEvents) return;
        if (!this._.room.chat.add(utils.clone(msg, {deep: true}))) return;
        break;
    case events.deleteChatMessage:
        msg.id = msg.chatid;
        msg.user = this._.room.users.findWhere({id: msg.user._id});

        delete msg.chatid;

        this._.room.chat.remove(this._.room.chat.findWhere({id: msg.id}));
        break;
    case events.chatSkip:
        msg.user = this._.room.users.findWhere({username: msg.username});
        delete msg.username;

        if (this._.room.play) this._.room.play.skipped = true;
        break;
    case events.roomUpdate:
        if (this._.room && this._.room.id !== msg.room._id) return;

        this._.room.set(msg.room);
        msg.room = this._.room.getMeta();
        break;
    case events.roomPlaylistUpdate:
        msg.song = new PlayModel(msg.song);
        msg.song.media = new MediaModel(msg.songInfo);
        delete msg.songInfo;

        if (this._.room.play && msg.song.id === this._.room.play.id) return;

        this._.actHandler.updateQueueDebounce();

        if (this._.room.play) {
            msg.lastPlay = {
                id: this._.room.play.id,
                media: utils.clone(this._.room.play.media),
                user: utils.clone(this._.room.users.findWhere({id: this._.room.play.user})),
                score: this._.room.play.getScore()
            };
        }

        this._.room.play = msg.song;
        delete msg.song;

        clearTimeout(this._.room.playTimeout);
        this._.room.playTimeout = setTimeout(this._.actHandler.updatePlay, this._.room.play.getTimeRemaining() + 15000);

        this._.room.users.set({dub: undefined});

        msg.media = this._.room.play.media;
        msg.user = this._.room.users.findWhere({id: this._.room.play.user});
        msg.id = this._.room.play.id;
        break;
    case events.roomPlaylistDub:
        msg.song = new PlayModel(msg.playlist);
        delete msg.playlist;

        if (!this._.room.play || msg.song.id !== this._.room.play.id) return;

        this._.room.play.updubs = msg.song.updubs;
        this._.room.play.downdubs = msg.song.downdubs;

        delete msg.song;

        msg.user = this._.room.users.findWhere({id: msg.user._id});

        if (msg.user) {
            this._.room.play.dubs[msg.user.id] = msg.dubtype;
            msg.user.set({dub: msg.dubtype});
        }
        break;
    case events.roomPlaylistQueueUpdate:
        this._.actHandler.updateQueueDebounce();
        return;
    //no default
    }

    msg.raw = raw;

    if (msg.mod instanceof UserModel) msg.mod = utils.clone(msg.mod);
    if (msg.user instanceof UserModel) msg.user = utils.clone(msg.user);
    if (msg.media instanceof MediaModel) msg.media = utils.clone(msg.media);

    this.emit('*', msg);
    this.emit(msg.type, msg);
}

module.exports = EventHandler;
