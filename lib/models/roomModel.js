'use strict';

var ChatCollection = require('../collections/chatCollection.js'),
    QueueCollection = require('../collections/queueCollection.js'),
    UserCollection = require('../collections/userCollection.js');

var permissions = require('../data/permissions.js'),
    utils = require('../utils.js');

/**
 * The bot's own standing in a room, from GET /room/:roomid/roles or GET /room/:roomid/permissions/me
 * https://queup.net/blog/custom-roles-are-here#:~:text=The%20actor%20object
 * @typedef {object} Actor
 * @property {string[]} permissions - Everything the bot can do in the room, implied permissions included
 * @property {number|null} position - The bot's rank, null when it owns the room or is QueUp staff (unlimited)
 * @property {boolean} isOwner - Whether the bot created the room
 * @property {boolean} isGlobalAdmin - Whether the bot's account is QueUp staff
 * @property {string[]} roles - Ids of the roles the bot holds. The docs say this excludes the room's default
 * role, but the API has been seen to include it
 */

/**
 * A role in a room, from GET /room/:roomid/roles
 * https://queup.net/blog/custom-roles-are-here#:~:text=The%20role%20object
 * @typedef {object} Role
 * @property {string} id - Unique within the room, the same starter role has a different id in every room
 * @property {string} roomId - The room that owns the role
 * @property {string|null} templateKey - The starter role this was copied from, e.g. 'mod', or null for a custom role
 * @property {string} type - Deprecated by QueUp, do not read
 * @property {string} label - The display name, 1 to 32 characters
 * @property {number} position - Ordering only, higher means more authority
 * @property {string} color - Six-digit hex colour, e.g. '#00aeff'
 * @property {string[]} permissions - Exactly what the room ticked, implied permissions not included
 * @property {boolean} isDefault - Whether this is the role every member holds, there is exactly one per room
 * @property {boolean} mentionable - Whether anyone in the room can @mention the role
 * @property {boolean} displaySeparately - Whether holders get their own heading in the user list
 */

var propertyFilter = ['__v', '_id', '_user', 'userid', 'currentSong', 'otSession'];

function RoomModel(data) {
    this.id = data._id;

    /**
     * The ID of the user who owns the room.
     */
    this.user = data.userid;

    this.set(data);

    this.chat = new ChatCollection();
    this.queue = new QueueCollection();
    this.users = new UserCollection();

    this.play = undefined;
    this.playTimeout = undefined;

    /**
     * All the roles in the room as returned from the API, highest ranking role at index 0
     * @type {Role[]}
     */
    this.roles = [];

    /**
     * The bot's own permissions and position, undefined until the roles are loaded
     * @type {Actor|undefined}
     */
    this.actor = undefined;
}

RoomModel.prototype.set = function(attrs) {
    for (var key in attrs) {
        if (attrs.hasOwnProperty(key) && !propertyFilter.includes(key)) this[key] = attrs[key];
    }
};

/**
 * Store the room's roles and the bot's standing, and update every user's highest role.
 * @param {Role[]} roles - The room's roles, highest position first
 * @param {Actor} actor - The bot's permissions, position and roles
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
    // this.roles holds the room's roles, highest position first.
    // find goes through that list from the top and stops at the first role that isn't the default one (Guest)
    // and whose id appears in user.roles
    var role = this.roles.find(function(role) {
        return !role.isDefault && user.roles.includes(role.id);
    });
    user.role = role ? role.id : null;
};

/**
 * Find a role by id, label (any case) or starter role templateKey.
 * @param {string} role - Role id, label or templateKey, e.g. 'mod' or 'resident-dj'
 * @returns {Role|undefined} The role, or undefined if there is no match
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

    // If the bot's position is null, it means it owns the room or is staff
    // and outranks every role. Treat null as unlimited, never as zero.
    // https://queup.net/blog/custom-roles-are-here#:~:text=list-,position
    if (isSelf && this.actor) return this.actor.position === null ? Infinity : this.actor.position;

    var role = this.roles.find(function(r) {return r.isDefault || user.roles.includes(r.id);});
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
            if (role.isDefault || user.roles.includes(role.id)) granted = granted.concat(role.permissions);
        });

        granted = permissions.expand(granted);
    }

    return granted.includes(permission) || granted.includes('room.admin');
};

RoomModel.prototype.getMeta = function() {
    return utils.clone(this, {deep: true, exclude: [['chat', 'queue', 'users', 'play', 'playTimeout']]});
};

module.exports = RoomModel;
