
function QueueCollection() {}

QueueCollection.prototype = Object.create(Array.prototype);

QueueCollection.prototype.add = function(queueObject) {
    if (!queueObject || this.findWhere({id: queueObject.id}) !== undefined) return false;
    this.push(queueObject);
    return true;
};

QueueCollection.prototype.where = function(attrs) {
    var keys = Object.keys(attrs),
        results = [];

    for (var queueIndex = 0; queueIndex < this.length; queueIndex++) {
        for (var queueKey = 0; queueKey < keys.length; queueKey++) {
            if (this[queueIndex][keys[queueKey]] !== attrs[keys[queueKey]]) break;
            if (queueKey === keys.length - 1) results.push(this[queueIndex]);
        }
    }

    return results;
};

QueueCollection.prototype.findWhere = function(attrs) {
    return this.where(attrs)[0];
};

QueueCollection.prototype.remove = function(queueObject) {
    if (!queueObject || this.findWhere({id: queueObject.id}) === undefined) return false;

    for (var queueIndex = 0; queueIndex < this.length; queueIndex++) {
        if (this[queueIndex].id !== queueObject.id) continue;
        this.splice(queueIndex, 1);
        break;
    }

    return true;
};

QueueCollection.prototype.clear = function() {
    this.splice(0, this.length);
};

module.exports = QueueCollection;
