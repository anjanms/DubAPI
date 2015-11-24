
var MediaModel = require('./models/mediaModel.js'),
    PlayModel = require('./models/playModel.js'),
    UserModel = require('./models/userModel.js');

var DubAPIError = require('./errors/error.js');

var utils = require('./utils.js'),
    events = require('./data/events.js');

function EventHandler(message, env, channel) {
    this.emit('pubnub:message', message, env, channel);

    if (!this._.connected || channel !== this._.room.realTimeChannel) return;

    var userUpdateID, data, raw;

    if (/user_update_[0-9a-f]+/.test(message.type)) {
        userUpdateID = message.type.match(/user_update_([0-9a-f]+)/)[1];
        message.type = 'user-update';
    }

    raw = utils.clone(message, {deep: true});

    switch (message.type) {
    case events.userJoin:
        message.roomUser._user = message.user;
        message.user = new UserModel(message.roomUser);
        delete message.roomUser;

        if (this._.room.play) message.user.dub = this._.room.play.dubs[message.user.id];

        if (!this._.room.users.add(message.user)) return;
        break;
    case events.userLeave:
        message.user = this._.room.users.findWhere({id: message.user._id});
        delete message.room;

        if (!this._.room.users.remove(message.user)) return;
        break;
    case events.userSetRole:
        message.mod = this._.room.users.findWhere({id: message.user._id});
        message.user = this._.room.users.findWhere({id: message.modUser._id});
        delete message.modUser;

        if (message.user) message.user.role = message.role_object._id;
        delete message.role_object;
        break;
    case events.userUnsetRole:
        message.mod = this._.room.users.findWhere({id: message.user._id});
        message.user = this._.room.users.findWhere({id: message.modUser._id});
        delete message.modUser;

        if (message.user) message.user.role = null;
        delete message.role_object;
        break;
    case events.userBan:
        message.mod = this._.room.users.findWhere({id: message.user._id});
        message.user = this._.room.users.findWhere({id: message.kickedUser._id});
        delete message.kickedUser;

        if (message.user && message.user.id === this._.self.id) {
            setImmediate(function() {
                this.emit('error', new DubAPIError('Banned from ' + this._.room.name));
                this.disconnect();
            }.bind(this));
        }
        break;
    case events.userUnban:
        message.mod = this._.room.users.findWhere({id: message.user._id});
        message.user = this._.room.users.findWhere({id: message.kickedUser._id});
        delete message.kickedUser;
        break;
    case events.userKick:
        if (message.message) message.message = utils.decodeHTMLEntities(message.message.trim());
        message.mod = this._.room.users.findWhere({id: message.user._id});
        message.user = this._.room.users.findWhere({id: message.kickedUser._id});
        delete message.kickedUser;

        if (message.user && message.user.id === this._.self.id) {
            setImmediate(function() {
                this.emit('error', new DubAPIError('Kicked from ' + this._.room.name));
                this.disconnect();
            }.bind(this));
        }
        break;
    case events.userMute:
        message.mod = this._.room.users.findWhere({id: message.user._id});
        message.user = this._.room.users.findWhere({id: message.mutedUser._id});
        delete message.mutedUser;

        if (message.user) message.user.muted = true;
        break;
    case events.userUnmute:
        message.mod = this._.room.users.findWhere({id: message.user._id});
        message.user = this._.room.users.findWhere({id: message.mutedUser._id});
        delete message.mutedUser;

        if (message.user) message.user.muted = false;
        break;
    case events.userUpdate:
        data = message.user;

        message.user = this._.room.users.findWhere({id: userUpdateID});

        if (message.user) message.user.set(data);
        break;
    case events.chatMessage:
        message.id = message.chatid;
        message.message = utils.decodeHTMLEntities(message.message.trim());
        message.user = this._.room.users.findWhere({id: message.user._id});

        delete message.chatid;
        delete message.queue_object;

        if (message.user && message.user.muted && !this.mutedTriggerEvents) return;
        this._.room.chat.add(utils.clone(message, {deep: true}));
        break;
    case events.deleteChatMessage:
        message.id = message.chatid;
        message.user = this._.room.users.findWhere({id: message.user._id});

        this._.room.chat.remove(this._.room.chat.findWhere({id: message.id}));
        break;
    case events.chatSkip:
        message.user = this._.room.users.findWhere({username: message.username});
        delete message.username;

        if (this._.room.play) this._.room.play.skipped = true;
        break;
    case events.roomUpdate:
        if (this._.room && this._.room.id !== message.room._id) return;

        this._.room.set(message.room);
        message.room = this._.room.getMeta();
        break;
    case events.roomPlaylistUpdate:
        message.song = new PlayModel(message.song);
        message.song.media = new MediaModel(message.songInfo);
        delete message.songInfo;

        if (this._.room.play && message.song.id === this._.room.play.id) return;

        this._.actHandler.updateQueueDebounce();

        if (this._.room.play) {
            message.lastPlay = {
                id: this._.room.play.id,
                media: utils.clone(this._.room.play.media),
                user: utils.clone(this._.room.users.findWhere({id: this._.room.play.user})),
                score: this._.room.play.getScore()
            };
        }

        this._.room.play = message.song;
        delete message.song;

        clearTimeout(this._.room.playTimeout);
        this._.room.playTimeout = setTimeout(this._.actHandler.updatePlay, this._.room.play.getTimeRemaining() + 15000);

        this._.room.users.set({dub: undefined});

        message.media = this._.room.play.media;
        message.user = this._.room.users.findWhere({id: this._.room.play.user});
        message.id = this._.room.play.id;
        break;
    case events.roomPlaylistDub:
        message.song = new PlayModel(message.playlist);
        delete message.playlist;

        if (!this._.room.play || message.song.id !== this._.room.play.id) return;

        this._.room.play.updubs = message.song.updubs;
        this._.room.play.downdubs = message.song.downdubs;

        delete message.song;

        message.user = this._.room.users.findWhere({id: message.user._id});

        if (message.user) {
            this._.room.play.dubs[message.user.id] = message.dubtype;
            message.user.set({dub: message.dubtype});
        }
        break;
    case events.roomPlaylistQueueUpdate:
        this._.actHandler.updateQueueDebounce();
        return;
    }

    message.raw = raw;

    if (Object.keys(events).some(function(event) {return message.type === event;})) {
        if (message.mod instanceof UserModel) message.mod = utils.clone(message.mod);
        if (message.user instanceof UserModel) message.user = utils.clone(message.user);
        if (message.media instanceof MediaModel) message.media = utils.clone(message.media);
    }

    this.emit('*', message);
    this.emit(message.type, message);
}

module.exports = EventHandler;
