
var ChatCollection = require('../collections/chatCollection.js'),
    UserCollection = require('../collections/userCollection.js');

var propertyFilter = ['__v', '_id', '_user', 'userid', 'currentSong'];

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

module.exports = RoomModel;
