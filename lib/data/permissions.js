'use strict';

// Permissions that come with another one
// see https://queup.net/blog/custom-roles-are-here#:~:text=Some%20permissions%20bring%20others%20with%20them
var implied = {
    'room.settings.moderation': ['queue.view'],
    'queue.order': ['queue.view'],
    'queue.remove': ['queue.view'],
    'queue.lock': ['queue.view'],
    'queue.dj.remove': ['queue.view'],
    'members.mute': ['members.list'],
    'members.kick': ['queue.view', 'members.list'],
    'members.ban': ['queue.view', 'members.list'],
    'roles.manage': ['members.list']
};

//Permission names from before custom roles
var legacy = {
    'update-room': 'room.manage',
    'set-roles': 'roles.manage',
    'skip': 'queue.skip',
    'queue-order': 'queue.order',
    'kick': 'members.kick',
    'ban': 'members.ban',
    'mute': 'members.mute',
    'lock-queue': 'queue.lock',
    'delete-chat': 'chat.delete',
    'chat-mention': 'chat.mention',
    'chat': 'chat.send',
    'mod-settings': 'room.settings.moderation'
};

/**
 * Map a permission name from before custom roles to its new key.
 * @param {string} permission - Permission key or old name, e.g. 'ban'
 * @returns {string} The permission key, e.g. 'members.ban'
 */
exports.normalize = function(permission) {
    return legacy[permission] || permission;
};

/**
 * Add the permissions implied by the given ones, e.g. members.kick implies members.list.
 * @param {string[]} permissions - Permission keys
 * @returns {string[]} A new array with the implied permissions added
 */
exports.expand = function(permissions) {
    var expanded = new Set(permissions);

    permissions.forEach(function(permission) {
        (implied[permission] || []).forEach(function(extra) {
            expanded.add(extra);
        });
    });

    return Array.from(expanded);
};
