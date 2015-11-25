
var BaseCollection = require('./baseCollection.js');

function QueueCollection() {}

QueueCollection.prototype = Object.create(BaseCollection.prototype);

module.exports = QueueCollection;
