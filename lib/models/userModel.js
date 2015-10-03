
var deepAssign = require('deep-assign');

var propertyFilter = ['__v', '_id', '_user', 'updub', 'downdub', 'userid', 'roleid', 'roomid', 'ot_token'];

function UserModel(data) {
    this.id = data.userid;
    this.role = data.roleid;
    this.created = data._user.created;
    this.username = data._user.username;

    for (var key in data) {
        if (!data.hasOwnProperty(key) || propertyFilter.indexOf(key) !== -1) continue;
        this[key] = data[key];
    }
}

UserModel.prototype.update = function(data) {
    for (var key in data) {
        if (!data.hasOwnProperty(key) || propertyFilter.indexOf(key) !== -1) continue;
        this[key] = data[key];
    }
};

UserModel.prototype.setDub = function(play) {
    if (play) this.dub = play.dubs[this.id];
    else this.dub = undefined;
};

UserModel.prototype.toNewObject = function() {
    return deepAssign({}, this);
};

module.exports = UserModel;
