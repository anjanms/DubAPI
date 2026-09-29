'use strict';

var ChatCollection = require('../collections/chatCollection.js'),
    QueueCollection = require('../collections/queueCollection.js'),
    UserCollection = require('../collections/userCollection.js');

var permissions = require('../data/permissions.js'),
    utils = require('../utils.js');

var propertyFilter = ['__v', '_id', '_user', 'userid', 'currentSong', 'otSession'];

function RoomModel(data) {
    this.id = data._id;
    this.user = data.userid;

    for (var key in data) {
        if (data.hasOwnProperty(key) && propertyFilter.indexOf(key) === -1) this[key] = data[key];
    }

    this.chat = new ChatCollection();
    this.queue = new QueueCollection();
    this.users = new UserCollection();

    this.play = undefined;
    this.playTimeout = undefined;

    //Highest position first, as the API returns them
    this.roles = [];
    //The bot's own permissions and position, see GET /room/:roomid/roles
    this.actor = undefined;
}

RoomModel.prototype.set = function(attrs) {
    for (var key in attrs) {
        if (attrs.hasOwnProperty(key) && propertyFilter.indexOf(key) === -1) this[key] = attrs[key];
    }
};

RoomModel.prototype.setRoles = function(roles, actor) {
    this.roles = roles;
    this.actor = actor;

    for (var i = 0; i < this.users.length; i++) this.syncUserRole(this.users[i]);
};

//Keep user.role as the id of the highest role they hold, or null
RoomModel.prototype.syncUserRole = function(user) {
    var role = this.roles.find(function(role) {return !role.isDefault && user.roles.indexOf(role.id) !== -1;});
    user.role = role ? role.id : null;
};

//Find a role by id, label or starter role templateKey (e.g. 'mod', 'resident-dj')
RoomModel.prototype.findRole = function(role) {
    var name = role.toLowerCase();

    return this.roles.find(function(r) {
        return r.id === role || r.templateKey === name || r.label.toLowerCase() === name;
    });
};

//Position of the highest role a user holds, the room owner outranks every role
RoomModel.prototype.rank = function(user, isSelf) {
    if (user.id === this.user) return Infinity;

    //The API reports null for the owner and QueUp staff, meaning unlimited
    if (isSelf && this.actor) return this.actor.position === null ? Infinity : this.actor.position;

    var role = this.roles.find(function(r) {return r.isDefault || user.roles.indexOf(r.id) !== -1;});
    return role ? role.position : 0;
};

RoomModel.prototype.hasPermission = function(user, permission, isSelf) {
    permission = permissions.normalize(permission);

    //The room owner holds every permission without holding a role
    if (user.id === this.user) return true;

    var granted;

    if (isSelf && this.actor) {
        //The API already expanded implied permissions for the bot
        granted = this.actor.permissions;
    } else {
        granted = [];

        this.roles.forEach(function(role) {
            if (role.isDefault || user.roles.indexOf(role.id) !== -1) granted = granted.concat(role.permissions);
        });

        granted = permissions.expand(granted);
    }

    return granted.indexOf(permission) !== -1 || granted.indexOf('room.admin') !== -1;
};

RoomModel.prototype.getMeta = function() {
    return utils.clone(this, {deep: true, exclude: [['chat', 'queue', 'users', 'play', 'playTimeout']]});
};

module.exports = RoomModel;
