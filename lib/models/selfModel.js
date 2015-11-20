
var propertyFilter = ['__v', '_id', 'userInfo'];

function SelfModel(data) {
    this.id = data._id;

    for (var key in data) {
        if (data.hasOwnProperty(key) && propertyFilter.indexOf(key) === -1) this[key] = data[key];
    }
}

module.exports = SelfModel;
