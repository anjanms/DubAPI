'use strict';

var propertyFilter = ['__v', '_id', '_user', 'updub', 'downdub', 'userid', 'roleid', 'roleids', 'roomid', 'ot_token'];

/**
 * Get a role id, the roster populates roles keyed by _id and role events use id.
 * @param {string|object} role - A role id or role object
 * @returns {string} The role id
 */
function toRoleId(role) {
    return typeof role === 'string' ? role : role.id || role._id;
}

function UserModel(data) {
    this.id = data.userid;
    this.roles = (data.roleids || (data.roleid ? [data.roleid] : [])).map(toRoleId);
    //Highest role held, set by RoomModel.syncUserRole
    this.role = null;
    this.created = data._user.created;
    this.username = data._user.username;
    this.profileImage = data._user.profileImage;

    for (var key in data) {
        if (data.hasOwnProperty(key) && propertyFilter.indexOf(key) === -1) this[key] = data[key];
    }

    this.dub = undefined;
}

UserModel.prototype.set = function(attrs) {
    for (var key in attrs) {
        if (attrs.hasOwnProperty(key) && propertyFilter.indexOf(key) === -1) this[key] = attrs[key];
    }
};

module.exports = UserModel;
