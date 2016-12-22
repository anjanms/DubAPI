'use strict';

var EngineIOClient = require('engine.io-client');

var DubAPIRequestError = require('./errors/requestError.js');

var utils = require('./utils.js');

var endpoints = require('./data/endpoints.js');

function SocketHandler(dubAPI) {
    this._ = {};
    this._.dubAPI = dubAPI;
    this._.socket = undefined;
    this._.channels = {};
    this._.reconnect = true;

    this.connectBind = utils.bind(this.connect, this);

    this.onOpenBind = utils.bind(this.onOpen, this);
    this.onMessageBind = utils.bind(this.onMessage, this);
    this.onErrorBind = utils.bind(this.onError, this);
    this.onCloseBind = utils.bind(this.onClose, this);
}

SocketHandler.prototype.connect = function() {
    if (this._.socket) return;

    this._.reconnect = true;

    var that = this;

    this._.dubAPI._.reqHandler.queue({method: 'GET', url: endpoints.authToken}, function(code, body) {
        if (code !== 200) return that._.dubAPI.emit('error', new DubAPIRequestError(code, that._.reqHandler.endpoint(endpoints.authToken)));

        that._.socket = new EngineIOClient({
            hostname: 'ws.dubtrack.fm',
            secure: true,
            path: '/ws',
            query: {access_token: body.data.token}, //eslint-disable-line camelcase
            transports: ['websocket']
        });

        that._.socket.on('open', that.onOpenBind);
        that._.socket.on('message', that.onMessageBind);
        that._.socket.on('error', that.onErrorBind);
        that._.socket.on('close', that.onCloseBind);
    });
};

SocketHandler.prototype.onOpen = function() {
    var channels = Object.keys(this._.channels);

    for (var i = 0; i < channels.length; i++) {
        this._.socket.send(JSON.stringify({action: 10, channel: channels[i]}));
    }

    this._.dubAPI.emit('socket:open');
};

SocketHandler.prototype.onMessage = function(data) {
    try {
        data = JSON.parse(data);
    } catch (err) {
        this._.dubAPI.emit('error', err);
        return;
    }

    this._.dubAPI.emit('socket:message', data);

    if (data.action === 15 && this._.channels[data.channel]) {
        try {
            data.message.data = JSON.parse(data.message.data);
        } catch (err) {
            this._.dubAPI.emit('error', err);
            return;
        }

        this._.channels[data.channel](data.message.data);
    }
};

SocketHandler.prototype.onError = function(err) {
    this._.dubAPI.emit('error', err);
};

SocketHandler.prototype.onClose = function() {
    this._.socket = undefined;

    if (this._.reconnect) setTimeout(this.connectBind, 5000);

    this._.dubAPI.emit('socket:close');
};

SocketHandler.prototype.attachChannel = function(channel, callback) {
    if (this._.socket && !this._.channels[channel]) this._.socket.send(JSON.stringify({action: 10, channel: channel}));

    this._.channels[channel] = callback;
};

SocketHandler.prototype.detachChannel = function(channel) {
    if (this._.socket && this._.channels[channel]) this._.socket.send(JSON.stringify({action: 12, channel: channel}));

    delete this._.channels[channel];
};

SocketHandler.prototype.disconnect = function() {
    if (!this._.socket) return;

    this._.reconnect = false;
    this._.socket.close();
};

module.exports = SocketHandler;
