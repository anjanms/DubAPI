
var propertyFilter = ['__v', '_id', '_user', 'userid', 'currentSong'];

function RoomModel(data) {
    this.id = data._id;
    this.user = data.userid;

    for (var key in data) {
        if (!data.hasOwnProperty(key) || propertyFilter.indexOf(key) !== -1) continue;
        this[key] = data[key];
    }

    this.users = [];
    this.userCache = [];
    this.play = undefined;
    this.playTimeout = undefined;
}

/*
 * User Functions
 */

RoomModel.prototype.addUser = function(userModel) {
    if (this.getUser(userModel.id, true) !== undefined) return false;
    this.users.push(userModel);
    return true;
};

RoomModel.prototype.addUsers = function(userModels) {
    userModels.forEach(this.addUser, this);
};

RoomModel.prototype.getUsers = function() {
    return this.users.map(function(userModel) {
        userModel.setDub(this.play);
        return userModel;
    }.bind(this));
};

RoomModel.prototype.getUser = function(id, ignoreCache) {
    var user = this.users.filter(function(userModel) {
        userModel.setDub(this.play);
        return userModel.id === id;
    })[0];

    if (user === undefined && !ignoreCache) {
        user = this.userCache.filter(function(userModel) {
            userModel.setDub(this.play);
            return userModel.id === id;
        })[0];
    }

    return user;
};

RoomModel.prototype.getUserByName = function(username, ignoreCache) {
    var user = this.users.filter(function(userModel) {
        userModel.setDub(this.play);
        return userModel.username === username;
    })[0];

    if (user === undefined && !ignoreCache) {
        user = this.userCache.filter(function(userModel) {
            userModel.setDub(this.play);
            return userModel.username === username;
        })[0];
    }

    return user;
};

RoomModel.prototype.getCreator = function() {
    return this.getUser(this.user);
};

RoomModel.prototype.getDJ = function() {
    return this.play ? this.getUser(this.play.user) : undefined;
};

RoomModel.prototype.getMods = function() {
    return this.getUsers().filter(this.isMod);
};

RoomModel.prototype.getStaff = function() {
    return this.getUsers().filter(this.isStaff);
};

RoomModel.prototype.removeUser = function(id) {
    if (this.getUser(id, true) === undefined) return false;
    this.userCache.push(this.getUser(id));

    var that = this;

    setTimeout(function() {
        that.userCache = that.userCache.filter(function(userModel) {return userModel.id !== id;});
    }, 10000);

    this.users = this.users.filter(function(userModel) {return userModel.id !== id;});
    return true;
};

/*
 * Permission Functions
 */

RoomModel.prototype.isCreator = function(userModel) {
    if (userModel === undefined) return false;
    return userModel.id === this.user;
};

RoomModel.prototype.isMod = function(userModel) {
    if (userModel === undefined) return false;
    return userModel.role && userModel.role._id === '52d1ce33c38a06510c000001';
};

RoomModel.prototype.isStaff = function(userModel) {
    if (userModel === undefined) return false;
    return (userModel.role && userModel.role._id === '52d1ce33c38a06510c000001') || userModel.id === this.user;
};

module.exports = RoomModel;
