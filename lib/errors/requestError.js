
function DubAPIRequestError(code, endpoint) {
    Error.captureStackTrace(this);
    this.name = 'DubAPIRequestError';
    this.message = 'Response ' + code + ' from ' + endpoint;
}

DubAPIRequestError.prototype = Object.create(Error.prototype);

module.exports = DubAPIRequestError;
