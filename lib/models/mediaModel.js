'use strict';

var utils = require('../utils.js');

var propertyFilter = ['__v', '_id', 'name', 'updub', 'downdub', 'userid'];

function MediaModel(data) {
    this.id = data._id;
    this.name = utils.decodeHTMLEntities(data.name);

    for (var key in data) {
        if (data.hasOwnProperty(key) && propertyFilter.indexOf(key) === -1) this[key] = data[key];
    }
}

module.exports = MediaModel;
