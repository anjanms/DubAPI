'use strict';

//Permissions that come with another one, see https://queup.net/blog/custom-roles-are-here
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

exports.normalize = function(permission) {
    return legacy[permission] || permission;
};

exports.expand = function(permissions) {
    var expanded = permissions.slice();

    permissions.forEach(function(permission) {
        (implied[permission] || []).forEach(function(extra) {
            if (expanded.indexOf(extra) === -1) expanded.push(extra);
        });
    });

    return expanded;
};
