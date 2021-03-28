'use strict';

var pkg = require('../package.json');

var got = require('got').extend({
    decompress: true,
    followRedirect: false,
    headers: {'user-agent': 'DubAPI/' + pkg.version},
    prefixUrl: 'https://api.queup.net/',
    responseType: 'json',
    retry: 0,
    throwHttpErrors: false
});

var CookieJar = require('tough-cookie').CookieJar;

var DubAPIError = require('./errors/error.js'),
    DubAPIRequestError = require('./errors/requestError.js');

var utils = require('./utils.js');

function RequestHandler(dubAPI) {
    this._ = {};
    this._.dubAPI = dubAPI;

    this._.cookieJar = new CookieJar();

    this._.ticking = false;
    this._.limit = 10;
    this._.queue = [];
    this._.sent = 0;

    //Bind functions once instead of every time we need them
    this._tick = utils.bind(this._tick, this);
    this._decrementSent = utils.bind(this._decrementSent, this);
}

RequestHandler.prototype.queue = function(options, callback) {
    if (typeof options !== 'object') throw new TypeError('options must be an object');
    if (typeof options.url !== 'string') throw new TypeError('options.url must be a string');

    var isChat = options.isChat;
    delete options.isChat;

    options.url = this.endpoint(options.url);

    this._.queue.push({options: options, callback: callback, isChat: isChat});

    if (!this._.ticking) this._tick();

    return true;
};

RequestHandler.prototype.clear = function() {
    this._.queue.splice(0, this._.queue.length);
};

RequestHandler.prototype.send = function(options, callback) {
    if (typeof options !== 'object') throw new TypeError('options must be an object');
    if (typeof options.url !== 'string') throw new TypeError('options.url must be a string');

    delete options.isChat;

    options.url = this.endpoint(options.url);

    this._sendRequest({options: options, callback: callback});

    return true;
};

RequestHandler.prototype._tick = function() {
    if (this._.queue.length === 0) {
        this._.ticking = false;
        return;
    }

    this._.ticking = true;

    if (this._.sent >= this._.limit) {
        setTimeout(this._tick, 5000);
        return;
    }

    var queueItem = this._.queue.shift();

    if (queueItem) {
        if (queueItem.isChat) queueItem.options.timeout = 2500;

        this._.sent++;

        setTimeout(this._decrementSent, queueItem.isChat ? 5000 : 30000);

        this._sendRequest(queueItem);
    }

    if (!queueItem || !queueItem.isChat) setImmediate(this._tick);
};

RequestHandler.prototype._sendRequest = function(queueItem) {
    queueItem.options.cookieJar = this._.cookieJar;

    var that = this;

    got(queueItem.options).then(function(res) {
        if (!queueItem.isRetry && res.statusCode === 302 && res.headers.location === '/auth/login') {
            that._.dubAPI._.actHandler.doLogin(function(err) {
                if (err) that._.dubAPI.emit('error', err);

                queueItem.isRetry = true;
                that._.queue.unshift(queueItem);
                if (!that._.ticking || queueItem.isChat) that._tick();
            });
            return;
        }

        if (queueItem.isChat) that._tick();

        if (typeof queueItem.callback === 'function') queueItem.callback(res.statusCode, res.body);
        else if (res.statusCode !== 200) that._.dubAPI.emit('error', new DubAPIRequestError(res.statusCode, queueItem.options.url));
    }).catch(function(err) {
        if (queueItem.isChat && err.code === 'ETIMEDOUT') err = new DubAPIError('Chat request timed out');

        that._.dubAPI.emit('error', err);

        //Will not work for chat request timeouts
        if (!queueItem.isRetry && ['ETIMEDOUT', 'ECONNRESET', 'ESOCKETTIMEDOUT'].indexOf(err.code) !== -1) {
            queueItem.isRetry = true;
            that._.queue.unshift(queueItem);
            if (!that._.ticking || queueItem.isChat) that._tick();
            return;
        }

        if (queueItem.isChat) that._tick();
    });
};

RequestHandler.prototype._decrementSent = function() {
    this._.sent--;
};

RequestHandler.prototype.endpoint = function(endpoint) {
    if (endpoint.indexOf('%SLUG%') !== -1 && this._.dubAPI._.slug) {
        endpoint = endpoint.replace('%SLUG%', this._.dubAPI._.slug);
    }

    if (endpoint.indexOf('%RID%') !== -1 && this._.dubAPI._.room) {
        endpoint = endpoint.replace('%RID%', this._.dubAPI._.room.id);
    }

    return endpoint;
};

module.exports = RequestHandler;
