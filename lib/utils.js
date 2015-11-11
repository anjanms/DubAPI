
function encodeHTMLEntities(str) {
    str = str.replace(/&/g, '&amp;')
             .replace(/'/g, '&#39;')
             .replace(/"/g, '&#34;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');

    return str;
}

exports.encodeHTMLEntities = encodeHTMLEntities;

function decodeHTMLEntities(str) {
    str = str.replace(/&#39;|&apos;/g, '\'')
             .replace(/&#34;|&quot;/g, '"')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>');

    return str;
}

exports.decodeHTMLEntities = decodeHTMLEntities;

function clone(obj, deep) {
    function copy(obj, level) {
        if (obj == null || typeof obj !== 'object') return obj;

        var clone, i;

        if (obj instanceof Array) {
            clone = [];

            for (i = 0; i < obj.length; i++) {
                if (!obj.hasOwnProperty(i)) continue;
                if (deep && level < 4) clone.push(copy(obj[i], level + 1));
                else clone.push(obj[i]);
            }
        } else {
            clone = {};

            for (i in obj) {
                if (!obj.hasOwnProperty(i)) continue;
                if (deep && level < 4) clone[i] = copy(obj[i], level + 1);
                else clone[i] = obj[i];
            }
        }

        return clone;
    }

    return copy(obj, 0);
}

exports.clone = clone;
