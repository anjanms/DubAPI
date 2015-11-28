'use strict';

var BaseCollection = require('./baseCollection.js');

function QueueCollection() {}

QueueCollection.prototype = Object.create(BaseCollection.prototype);

QueueCollection.prototype.indexWhere = function(attrs) {
    var keys = Object.keys(attrs);

    for (var itemIndex = 0; itemIndex < this.length; itemIndex++) {
        for (var itemKey = 0; itemKey < keys.length; itemKey++) {
            if (this[itemIndex][keys[itemKey]] !== attrs[keys[itemKey]]) break;
            if (itemKey === keys.length - 1) return itemIndex;
        }
    }

    return -1;
};

module.exports = QueueCollection;
