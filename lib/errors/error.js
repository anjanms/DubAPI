
function DubAPIError(message) {
    Error.captureStackTrace(this);
    this.name = 'DubAPIError';
    this.message = message || '';
}

DubAPIError.prototype = Object.create(Error.prototype);

module.exports = DubAPIError;
