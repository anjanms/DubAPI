
function ChatCollection() {}

ChatCollection.prototype = Object.create(Array.prototype);

ChatCollection.prototype.add = function(chatObject) {
    if (!chatObject || this.findWhere({id: chatObject.id}) !== undefined) return false;
    this.push(chatObject);
    if (this.length > 512) this.shift();
    return true;
};

ChatCollection.prototype.where = function(attrs) {
    var keys = Object.keys(attrs),
        results = [];

    for (var chatIndex = 0; chatIndex < this.length; chatIndex++) {
        for (var chatKey = 0; chatKey < keys.length; chatKey++) {
            if (this[chatIndex][keys[chatKey]] !== attrs[keys[chatKey]]) break;
            if (chatKey === keys.length - 1) results.push(this[chatIndex]);
        }
    }

    return results;
};

ChatCollection.prototype.findWhere = function(attrs) {
    return this.where(attrs)[0];
};

ChatCollection.prototype.remove = function(chatObject) {
    if (!chatObject || this.findWhere({id: chatObject.id}) === undefined) return false;

    for (var chatIndex = 0; chatIndex < this.length; chatIndex++) {
        if (this[chatIndex].id !== chatObject.id) continue;
        this.splice(chatIndex, 1);
        break;
    }

    return true;
};

module.exports = ChatCollection;
