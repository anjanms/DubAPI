
var deepAssign = require('deep-assign');

var MediaModel = require('./models/mediaModel.js'),
    PlayModel = require('./models/playModel.js'),
    UserModel = require('./models/userModel.js');

var DubAPIError = require('./errors/error.js');

var utils = require('./utils.js'),
    events = require('./data/events.js');

function EventHandler(message, env, channel) {
    this.emit('pubnub:message', message, env, channel);

    if (!this._.connected || channel !== this._.room.realTimeChannel) return;

    var userUpdateID, data;

    if (/user_update_[0-9a-f]+/.test(message.type)) {
        userUpdateID = message.type.match(/user_update_([0-9a-f]+)/)[1];
        message.type = 'user-update';
    }

    message.raw = deepAssign({}, message);

    switch (message.type) {
    case events.userJoin:
        message.roomUser._user = message.user;
        message.user = new UserModel(message.roomUser);
        delete message.roomUser;

        message.user.setDub(this._.room.play);

        if (!this._.room.addUser(message.user)) return;
        break;
    case events.userLeave:
        message.user = this._.room.getUser(message.user._id);
        delete message.room;

        if (!message.user) return;
        this._.room.removeUser(message.user.id);
        break;
    case events.userSetMod:
        message.user = this._.room.getUser(message.modUser._id);
        delete message.modUser;

        if (message.user) message.user.role = '52d1ce33c38a06510c000001';
        break;
    case events.userUnsetMod:
        message.user = this._.room.getUser(message.modUser._id);
        delete message.modUser;

        if (message.user) message.user.role = 1; //TODO: undefined? I dunno
        break;
    case events.userBan:
        message.user = this._.room.getUser(message.kickedUser._id);
        delete message.kickedUser;

        if (message.user && message.user.id === this._.self.id) {
            setImmediate(function() {
                this.emit('error', new DubAPIError('Banned from ' + this._.room.name));
                this.disconnect();
            }.bind(this));
        }
        break;
    case events.userUnban:
        message.user = this._.room.getUser(message.kickedUser._id);
        delete message.kickedUser;
        break;
    case events.userKick:
        message.user = this._.room.getUser(message.kickedUser._id);
        delete message.kickedUser;

        if (message.user && message.user.id === this._.self.id) {
            setImmediate(function() {
                var slug = this._.slug;
                this.emit('error', new DubAPIError('Kicked from ' + this._.room.name));
                this.disconnect();
                if (this.reconnectOnKick) this.connect(slug);
            }.bind(this));
        }
        break;
    case events.userMute:
        message.user = this._.room.getUser(message.mutedUser._id);
        delete message.mutedUser;

        if (message.user) message.user.muted = true;

        if (message.user && message.user.id === this._.self.id && this.preventSelfMute) {
            setImmediate(function() {
                this.moderateUnmuteUser(this._.self.id);
            }.bind(this));
        }
        break;
    case events.userUnmute:
        message.user = this._.room.getUser(message.mutedUser._id);
        delete message.mutedUser;

        if (message.user) message.user.muted = false;
        break;
    case events.userUpdate:
        data = message.user;

        message.user = this._.room.getUser(userUpdateID);

        if (message.user) message.user.update(data);
        break;
    case events.chatMessage:
        message.message = message.message.trim();
        message.message = utils.decodeHTMLEntities(message.message);

        message.user = this._.room.getUser(message.user._id);

        if (message.user && message.user.muted && !this.mutedTriggerEvents) return;
        break;
    case events.chatSkip:
        message.user = this._.room.getUserByName(message.username);
        delete message.username;

        if (this._.room.play) this._.room.play.skipped = true;
        break;
    case events.roomPlaylistUpdate:
        message.song = new PlayModel(message.song);
        message.song.media = new MediaModel(message.songInfo);
        delete message.songInfo;

        if (this._.room.play && message.song.id === this._.room.play.id) return;

        if (this._.room.play) {
            message.lastPlay = {
                media: this._.room.play.media.toNewObject(),
                user: this._.room.getDJ().toNewObject(),
                score: this._.room.play.getScore()
            };
        }

        this._.room.play = message.song;
        delete message.song;

        clearTimeout(this._.room.playTimeout);
        this._.room.playTimeout = setTimeout(this._fetchMedia.bind(this), this._.room.play.getTimeRemaining() + 5000);

        message.media = this._.room.play.media;
        message.user = this._.room.getDJ();
        message.id = this._.room.play.id;
        break;
    case events.roomPlaylistDub:
        message.song = new PlayModel(message.playlist);
        delete message.playlist;

        if (!this._.room.play || message.song.id !== this._.room.play.id) return;

        this._.room.play.updubs = message.song.updubs;
        this._.room.play.downdubs = message.song.downdubs;

        delete message.song;

        message.user = this._.room.getUser(message.user._id);

        if (message.user) {
            this._.room.play.dubs[message.user.id] = message.dubtype;
            message.user.setDub(this._.room.play);
        }
        break;
    }

    if (Object.keys(events).some(function(event) {return message.type === event;})) {
        if (message.mod) message.mod = message.mod.toNewObject();
        if (message.user) message.user = message.user.toNewObject();
        if (message.song) message.song = message.song.toNewObject();
    }

    this.emit('*', message);
    this.emit(message.type, message);
}

module.exports = EventHandler;
