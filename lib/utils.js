'use strict';

function noop() {
    //No operation
}

exports.noop = noop;

function bind(func, context) {
    return function boundFunc() {
        return func.apply(context, arguments);
    };
}

exports.bind = bind;

function debounce(func, wait, immediate) {
    var timeout;

    return function debouncedFunc() {
        var callNow = immediate && !timeout,
            context = this,
            args = arguments;

        clearTimeout(timeout);

        timeout = setTimeout(function() {
            timeout = null;

            if (!immediate) func.apply(context, args);
        }, wait);

        if (callNow) func.apply(context, args);
    };
}

exports.debounce = debounce;

function encodeHTMLEntities(str) {
    if (typeof str !== 'string') return str;

    str = str.replace(/&/g, '&amp;')
             .replace(/'/g, '&#39;')
             .replace(/"/g, '&#34;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');

    return str;
}

exports.encodeHTMLEntities = encodeHTMLEntities;

function decodeHTMLEntities(str) {
    if (typeof str !== 'string') return str;

    str = str.replace(/&#39;|&apos;/g, '\'')
             .replace(/&#34;|&quot;/g, '"')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>');

    return str;
}

exports.decodeHTMLEntities = decodeHTMLEntities;

function clone(obj, options) {
    options = options || {};

    if (options.deep === undefined) options.deep = false;
    if (options.exclude === undefined) options.exclude = [];

    function copy(obj, level) {
        if (obj == null || typeof obj !== 'object') return obj;

        var clone, i;

        if (obj instanceof Array) {
            clone = [];

            for (i = 0; i < obj.length; i++) {
                if (!obj.hasOwnProperty(i)) continue;
                if (options.deep && level < 4) clone.push(copy(obj[i], level + 1));
                else clone.push(obj[i]);
            }
        } else {
            clone = {};

            for (i in obj) {
                if (!obj.hasOwnProperty(i)) continue;
                if (options.exclude[level] !== undefined && options.exclude[level].indexOf(i) !== -1) continue;
                if (options.deep && level < 4) clone[i] = copy(obj[i], level + 1);
                else clone[i] = obj[i];
            }
        }

        return clone;
    }

    return copy(obj, 0);
}

exports.clone = clone;
