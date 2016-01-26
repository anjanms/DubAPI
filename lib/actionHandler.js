'use strict';

var MediaModel = require('./models/mediaModel.js'),
    PlayModel = require('./models/playModel.js');

var DubAPIError = require('./errors/error.js'),
    DubAPIRequestError = require('./errors/requestError.js');

var endpoints = require('./data/endpoints.js'),
    events = require('./data/events.js'),
    utils = require('./utils.js');

function ActionHandler(dubAPI, auth) {
    this.doLogin = doLogin.bind(dubAPI, auth);
    this.clearPlay = clearPlay.bind(dubAPI);
    this.updatePlay = updatePlay.bind(dubAPI);
    this.updateQueue = updateQueue.bind(dubAPI);
    this.updateQueueDebounce = utils.debounce(this.updateQueue, 5000);
}

function doLogin(auth, callback) {
    var that = this;

    this._.reqHandler.send({method: 'POST', url: endpoints.authDubtrack, form: auth}, function(code, body) {
        if ([200, 400].indexOf(code) === -1) {
            return callback(new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.authDubtrack)));
        } else if (code === 400) {
            return callback(new DubAPIError('Authentication Failed: ' + body.data.details.message));
        }

        callback(undefined);
    });
}

function clearPlay() {
    clearTimeout(this._.room.playTimeout);

    var message = {type: events.roomPlaylistUpdate};

    if (this._.room.play) {
        message.lastPlay = {
            id: this._.room.play.id,
            media: utils.clone(this._.room.play.media),
            user: utils.clone(this._.room.users.findWhere({id: this._.room.play.user})),
            score: this._.room.play.getScore()
        };
    }

    this._.room.play = undefined;
    this._.room.users.set({dub: undefined});

    this.emit('*', message);
    this.emit(events.roomPlaylistUpdate, message);
}

function updatePlay() {
    var that = this;

    clearTimeout(that._.room.playTimeout);

    that._.reqHandler.queue({method: 'GET', url: endpoints.roomPlaylistActive}, function(code, body) {
        if ([200, 404].indexOf(code) === -1) {
            that.emit('error', new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.roomPlaylistActive)));
            return;
        } else if (code === 404) {
            that._.actHandler.clearPlay();
            return;
        }

        if (body.data.song === undefined) {
            //Dubtrack API sometimes doesn't define a song.
            //Schedule an update in the future, maybe it will then.
            that._.room.playTimeout = setTimeout(that._.actHandler.updatePlay, 30000);
            return;
        }

        var message = {type: events.roomPlaylistUpdate},
            newPlay = new PlayModel(body.data.song),
            curPlay = that._.room.play;

        if (curPlay && newPlay.id === curPlay.id) {
            if (Date.now() - newPlay.played > newPlay.songLength) that._.actHandler.clearPlay();
            return;
        }

        newPlay.media = new MediaModel(body.data.songInfo);

        if (newPlay.media.type === undefined || newPlay.media.fkid === undefined) newPlay.media = undefined;

        message.raw = body.data;

        if (that._.room.play) {
            message.lastPlay = {
                id: curPlay.id,
                media: utils.clone(curPlay.media),
                user: utils.clone(that._.room.users.findWhere({id: curPlay.user})),
                score: curPlay.getScore()
            };
        }

        message.id = newPlay.id;
        message.media = utils.clone(newPlay.media);
        message.user = utils.clone(that._.room.users.findWhere({id: newPlay.user}));

        that._.reqHandler.queue({method: 'GET', url: endpoints.roomPlaylistActiveDubs}, function(code, body) {
            that._.room.play = newPlay;
            that._.room.playTimeout = setTimeout(that._.actHandler.updatePlay, newPlay.getTimeRemaining() + 15000);

            that._.room.users.set({dub: undefined});

            if (code === 200) {
                body.data.currentSong = new PlayModel(body.data.currentSong);

                if (newPlay.id === body.data.currentSong.id) {
                    newPlay.updubs = body.data.currentSong.updubs;
                    newPlay.downdubs = body.data.currentSong.downdubs;
                    newPlay.grabs = body.data.currentSong.grabs;

                    body.data.upDubs.forEach(function(dub) {
                        newPlay.dubs[dub.userid] = 'updub';

                        var user = that._.room.users.findWhere({id: dub.userid});
                        if (user) user.set({dub: 'updub'});
                    });

                    body.data.downDubs.forEach(function(dub) {
                        newPlay.dubs[dub.userid] = 'downdub';

                        var user = that._.room.users.findWhere({id: dub.userid});
                        if (user) user.set({dub: 'downdub'});
                    });
                }
            } else {
                that.emit('error', new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.roomPlaylistActiveDubs)));
            }

            that.emit('*', message);
            that.emit(events.roomPlaylistUpdate, message);
        });
    });
}

function updateQueue() {
    var that = this;

    that._.reqHandler.queue({method: 'GET', url: endpoints.roomPlaylistDetails}, function(code, body) {
        if (code !== 200) {
            that.emit('error', new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.roomPlaylistDetails)));
            return;
        }

        var message = {type: events.roomPlaylistQueueUpdate};

        that._.room.queue.clear();

        body.data.forEach(function(queueItem) {
            //Dubtrack API sometimes returns an array containing null.
            if (queueItem === null) return;

            queueItem = {
                id: queueItem._id,
                uid: queueItem._user._id,
                media: new MediaModel(queueItem._song),
                get user() {return that._.room.users.findWhere({id: this.uid});}
            };

            if (queueItem.media.type === undefined || queueItem.media.fkid === undefined) queueItem.media = undefined;

            that._.room.queue.add(queueItem);
        });

        message.raw = body.data;
        message.queue = utils.clone(that._.room.queue, {deep: true});

        that.emit('*', message);
        that.emit(events.roomPlaylistQueueUpdate, message);
    });
}

module.exports = ActionHandler;
