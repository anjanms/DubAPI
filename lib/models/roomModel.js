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

/**
 * Store the room's roles and the bot's standing, and update every user's highest role.
 * @param {object[]} roles - The room's roles, highest position first
 * @param {object} actor - The bot's permissions, position and roles
 * @returns {undefined}
 */
RoomModel.prototype.setRoles = function(roles, actor) {
    this.roles = roles;
    this.actor = actor;

    for (var i = 0; i < this.users.length; i++) this.syncUserRole(this.users[i]);
};

/**
 * Set user.role to the id of the highest role the user holds, or null.
 * @param {UserModel} user - The user to update
 * @returns {undefined}
 */
RoomModel.prototype.syncUserRole = function(user) {
    var role = this.roles.find(function(role) {return !role.isDefault && user.roles.indexOf(role.id) !== -1;});
    user.role = role ? role.id : null;
};

/**
 * Find a role by id, label (any case) or starter role templateKey.
 * @param {string} role - Role id, label or templateKey, e.g. 'mod' or 'resident-dj'
 * @returns {object|undefined} The role, or undefined if there is no match
 */
RoomModel.prototype.findRole = function(role) {
    var name = role.toLowerCase();

    return this.roles.find(function(r) {
        return r.id === role || r.templateKey === name || r.label.toLowerCase() === name;
    });
};

/**
 * The position of the highest role a user holds, the room owner outranks every role.
 * @param {UserModel} user - The user
 * @param {boolean} [isSelf] - True for the bot, whose rank comes from the actor
 * @returns {number} The position, Infinity for the room owner and unlimited actors
 */
RoomModel.prototype.rank = function(user, isSelf) {
    if (user.id === this.user) return Infinity;

    //The API reports null for the owner and QueUp staff, meaning unlimited
    if (isSelf && this.actor) return this.actor.position === null ? Infinity : this.actor.position;

    var role = this.roles.find(function(r) {return r.isDefault || user.roles.indexOf(r.id) !== -1;});
    return role ? role.position : 0;
};

/**
 * Whether a user holds a permission through their roles, the room's default role or implied permissions.
 * @param {UserModel} user - The user
 * @param {string} permission - Permission key, or a name from before custom roles such as 'ban'
 * @param {boolean} [isSelf] - True for the bot, whose permissions come from the actor
 * @returns {boolean} true if the user holds the permission
 */
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
