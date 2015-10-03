
var deepAssign = require('deep-assign');

var propertyFilter = ['__v', '_id', 'updub', 'downdub', 'userid'];

function MediaModel(data) {
    this.id = data._id;

    for (var key in data) {
        if (!data.hasOwnProperty(key) || propertyFilter.indexOf(key) !== -1) continue;
        this[key] = data[key];
    }
}

MediaModel.prototype.toNewObject = function() {
    return deepAssign({}, this);
};

module.exports = MediaModel;
