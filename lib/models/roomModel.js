
var ChatCollection = require('../collections/chatCollection.js'),
    UserCollection = require('../collections/userCollection.js');

var utils = require('../utils.js');

var propertyFilter = ['__v', '_id', '_user', 'userid', 'currentSong', 'otSession'];


function RoomModel(data) {
    this.id = data._id;
    this.user = data.userid;

    for (var key in data) {
        if (data.hasOwnProperty(key) && propertyFilter.indexOf(key) === -1) this[key] = data[key];
    }

    this.chat = new ChatCollection();
    this.users = new UserCollection();
    this.play = undefined;
    this.playTimeout = undefined;
}

RoomModel.prototype.set = function(attrs) {
    for (var key in attrs) {
        if (attrs.hasOwnProperty(key) && propertyFilter.indexOf(key) === -1) this[key] = attrs[key];
    }
};

RoomModel.prototype.getMeta = function() {
    return utils.clone(this, {deep: true, exclude: [['chat', 'users', 'play', 'playTimeout']]});
};

module.exports = RoomModel;
