'use strict';

function BaseCollection() {};

BaseCollection.prototype = Object.create(Array.prototype);

BaseCollection.prototype.maxLength = Infinity;

BaseCollection.prototype.add = function(item) {
    if (!item || this.findWhere({id: item.id}) !== undefined) return false;
    this.push(item);
    if (this.length > this.maxLength) this.shift();
    return true;
};

BaseCollection.prototype.where = function(attrs) {
    var keys = Object.keys(attrs),
        results = [];

    for (var itemIndex = 0; itemIndex < this.length; itemIndex++) {
        for (var itemKey = 0; itemKey < keys.length; itemKey++) {
            if (this[itemIndex][keys[itemKey]] !== attrs[keys[itemKey]]) break;
            if (itemKey === keys.length - 1) results.push(this[itemIndex]);
        }
    }

    return results;
};

BaseCollection.prototype.findWhere = function(attrs) {
    return this.where(attrs)[0];
};

BaseCollection.prototype.remove = function(item) {
    if (!item || this.findWhere({id: item.id}) === undefined) return false;

    for (var itemIndex = 0; itemIndex < this.length; itemIndex++) {
        if (this[itemIndex].id !== item.id) continue;
        this.splice(itemIndex, 1);
        break;
    }

    return true;
};

BaseCollection.prototype.clear = function() {
    this.splice(0, this.length);
};

module.exports = BaseCollection;
