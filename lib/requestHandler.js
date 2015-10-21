
var request = require('request').defaults({baseUrl: 'https://api.dubtrack.fm/', json: true});

var DubAPIError = require('./errors/error.js'),
    DubAPIRequestError = require('./errors/requestError.js');

function RequestHandler(dubAPI) {
    this._ = {};
    this._.dubAPI = dubAPI;

    this._.cookieJar = request.jar();

    this._.ticking = false;
    this._.limit = 10;
    this._.queue = [];
    this._.sent = 0;
}

RequestHandler.prototype.queue = function(options, callback) {
    if (this._.sent >= this._.limit) return false;

    if (typeof options !== 'object') throw new TypeError('options must be an object');
    if (typeof options.url !== 'string') throw new TypeError('options.url must be a string');

    var sync = options.sync;
    delete options.sync;

    this._.queue.push({options: options, callback: callback, sync: sync});

    if (!this._.ticking) this._tick();

    return true;
};

RequestHandler.prototype.send = function(options, callback, next) {
    if (typeof options !== 'object') throw new TypeError('options must be an object');
    if (typeof options.url !== 'string') throw new TypeError('options.url must be a string');

    options.url = this.endpoint(options.url);
    options.jar = this._.cookieJar;

    var that = this,
        emitError = true;

    request(options, function(err, res, body) {
        if (err) return;

        if (typeof next === 'function') next();

        if (typeof callback === 'function') callback(res.statusCode, body);
        else if (res.statusCode !== 200) that._.dubAPI.emit('error', new DubAPIRequestError(res.statusCode, options.url));
    }).on('error', function(err) {
        if (!emitError) return;

        if (typeof next === 'function') next();

        if (err.code === 'ETIMEDOUT') err = new DubAPIError('Failed to send chat, request timed out');

        that._.dubAPI.emit('error', err);

        emitError = false;
    });
};

RequestHandler.prototype._tick = function() {
    if (this._.queue.length === 0) {
        this._.ticking = false;
        return;
    }

    this._.ticking = true;

    var data = this._.queue.shift(),
        that = this,
        next = function() {that._tick();};

    if (data) {
        this._.sent++;

        if (data.sync) data.options.timeout = 1500;

        this.send(data.options, data.callback, data.sync ? next : undefined);

        setTimeout(function() {that._.sent--;}, 1500);
    }

    if (!data || !data.sync) setImmediate(next);
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
