
function UserCollection() {
    this.cache = [];
}

UserCollection.prototype = Object.create(Array.prototype);

UserCollection.prototype.add = function(userModel) {
    if (!userModel || this.findWhere({id: userModel.id}, true) !== undefined) return false;
    this.push(userModel);
    return true;
};

UserCollection.prototype.where = function(attrs, ignoreCache) {
    var keys = Object.keys(attrs),
        results = [];

    for (var userIndex = 0; userIndex < this.length; userIndex++) {
        for (var userKey = 0; userKey < keys.length; userKey++) {
            if (this[userIndex][keys[userKey]] !== attrs[keys[userKey]]) break;
            if (userKey === keys.length - 1) results.push(this[userIndex]);
        }
    }

    if (ignoreCache) return results;

    for (var cacheIndex = 0; cacheIndex < this.cache.length; cacheIndex++) {
        for (var cacheKey = 0; cacheKey < keys.length; cacheKey++) {
            if (this.cache[cacheIndex][keys[cacheKey]] !== attrs[keys[cacheKey]]) break;
            if (cacheKey === keys.length - 1) results.push(this.cache[cacheIndex]);
        }
    }

    return results;
};

UserCollection.prototype.findWhere = function(attrs, ignoreCache) {
    return this.where(attrs, ignoreCache)[0];
};

UserCollection.prototype.set = function(attrs) {
    var keys = Object.keys(attrs);

    for (var userIndex = 0; userIndex < this.length; userIndex++) {
        for (var userKey = 0; userKey < keys.length; userKey++) {
            this[userIndex][keys[userKey]] = attrs[keys[userKey]];
        }
    }
};

UserCollection.prototype.remove = function(userModel) {
    if (!userModel || this.findWhere({id: userModel.id}, true) === undefined) return false;

    function removeFromCache() {
        for (var cacheIndex = 0; cacheIndex < this.cache.length; cacheIndex++) {
            if (this.cache[cacheIndex].id !== userModel.id) continue;
            this.cache.splice(cacheIndex, 1);
            break;
        }
    }

    for (var userIndex = 0; userIndex < this.length; userIndex++) {
        if (this[userIndex].id !== userModel.id) continue;
        this.cache.push(this.splice(userIndex, 1)[0]);
        setTimeout(removeFromCache.bind(this), 10000);
        break;
    }

    return true;
};

module.exports = UserCollection;
