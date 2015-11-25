
var BaseCollection = require('./baseCollection.js');

function ChatCollection() {
    this.maxLength = 512;
}

ChatCollection.prototype = Object.create(BaseCollection.prototype);

module.exports = ChatCollection;
