
var roles = require('../data/roles.js');

var propertyFilter = ['__v', '_id', '_user', 'updub', 'downdub', 'userid', 'roleid', 'roomid', 'ot_token'];

function UserModel(data) {
    this.id = data.userid;
    this.role = data.roleid ? data.roleid._id : null;
    this.created = data._user.created;
    this.username = data._user.username;

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

UserModel.prototype.hasPermission = function(perm) {
    if (this.role && roles[this.role] && roles[this.role].rights.indexOf(perm) !== -1) return true;
    return false;
};

module.exports = UserModel;
