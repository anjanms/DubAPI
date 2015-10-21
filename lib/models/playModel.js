
var propertyFilter = ['__v', '_id', '_user', '_song', 'songid', 'userid', 'roomid'];

function PlayModel(data) {
    this.id = data._id;
    this.user = data.userid;

    for (var key in data) {
        if (data.hasOwnProperty(key) && propertyFilter.indexOf(key) === -1) this[key] = data[key];
    }

    this.dubs = {};
    this.media = undefined;
}

PlayModel.prototype.getTimeElapsed = function() {
    return Math.min(this.songLength, Date.now() - this.played);
};

PlayModel.prototype.getTimeRemaining = function() {
    return Math.max(0, this.played + this.songLength - Date.now());
};

PlayModel.prototype.getScore = function() {
    return {updubs: this.updubs, downdubs: this.downdubs};
};

module.exports = PlayModel;
