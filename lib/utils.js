
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
    str = str.replace(/&#39;/g, '\'')
             .replace(/&#34;/g, '"')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>');

    return str;
}

exports.decodeHTMLEntities = decodeHTMLEntities;
