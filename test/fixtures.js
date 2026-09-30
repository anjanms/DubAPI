'use strict';

var RoomModel = require('../lib/models/roomModel.js'),
    UserModel = require('../lib/models/userModel.js');

var DubAPI = require('../index.js');

var ROOM_ID = 'aaaaaaaaaaaaaaaaaaaa0001',
    OWNER_ID = 'bbbbbbbbbbbbbbbbbbbb0001',
    BOT_ID = 'bbbbbbbbbbbbbbbbbbbb0002';

var ids = {
    coOwner: 'cccccccccccccccccccc0001',
    manager: 'cccccccccccccccccccc0002',
    mod: 'cccccccccccccccccccc0003',
    vip: 'cccccccccccccccccccc0004',
    residentDj: 'cccccccccccccccccccc0005',
    dj: 'cccccccccccccccccccc0006',
    tester: 'cccccccccccccccccccc0007',
    guest: 'cccccccccccccccccccc0008'
};

function role(id, templateKey, label, position, permissions, isDefault) {
    return {
        id: id,
        roomId: ROOM_ID,
        templateKey: templateKey,
        type: templateKey || 'custom',
        label: label,
        position: position,
        permissions: permissions,
        isDefault: Boolean(isDefault)
    };
}

//Shaped like GET room/:roomid/roles, highest position first
function roles() {
    return [
        role(ids.coOwner, 'co-owner', 'Co-Owner', 896, ['room.manage', 'room.settings.moderation', 'room.audit.view',
            'queue.view', 'queue.join', 'queue.skip', 'queue.order', 'queue.remove', 'queue.lock', 'queue.lock.bypass',
            'queue.dj.remove', 'chat.send', 'chat.delete', 'chat.mention', 'chat.embed.image', 'chat.embed.link',
            'chat.slowmode.bypass', 'members.mute', 'members.kick', 'members.ban', 'roles.manage', 'stream.admin',
            'stream.title', 'room.admin']),
        role(ids.manager, 'manager', 'Manager', 768, ['room.settings.moderation', 'room.audit.view', 'queue.view',
            'queue.join', 'queue.skip', 'queue.order', 'queue.remove', 'queue.lock', 'queue.lock.bypass',
            'queue.dj.remove', 'chat.send', 'chat.delete', 'chat.mention', 'chat.embed.image', 'chat.embed.link',
            'chat.slowmode.bypass', 'members.mute', 'members.kick', 'members.ban', 'roles.manage', 'stream.admin',
            'stream.title']),
        role(ids.mod, 'mod', 'Moderator', 640, ['room.settings.moderation', 'queue.view', 'queue.join', 'queue.skip',
            'queue.order', 'queue.remove', 'queue.lock', 'queue.lock.bypass', 'queue.dj.remove', 'chat.send',
            'chat.delete', 'chat.mention', 'chat.embed.image', 'chat.embed.link', 'chat.slowmode.bypass',
            'members.mute', 'members.kick', 'members.ban', 'stream.title']),
        role(ids.vip, 'vip', 'VIP', 512, ['queue.view', 'queue.join', 'queue.skip', 'queue.lock.bypass', 'chat.send',
            'chat.embed.image', 'chat.embed.link']),
        role(ids.residentDj, 'resident-dj', 'Resident DJ', 384, ['queue.view', 'queue.join', 'queue.lock.bypass',
            'chat.send', 'chat.embed.image', 'chat.embed.link']),
        role(ids.dj, 'dj', 'DJ', 256, ['queue.view', 'queue.join', 'queue.lock.bypass', 'chat.send',
            'chat.embed.image', 'chat.embed.link']),
        role(ids.tester, null, 'Night Crew', 128, ['queue.view', 'queue.join']),
        role(ids.guest, 'guest', 'Guest', 0, ['queue.view', 'queue.join', 'chat.send', 'chat.embed.image',
            'chat.embed.link'], true)
    ];
}

//The actor for a bot holding only the custom role, as returned by the API
function actor() {
    return {
        permissions: ['queue.view', 'queue.join', 'chat.send', 'chat.embed.image', 'chat.embed.link'],
        position: 128,
        isOwner: false,
        isGlobalAdmin: false,
        roles: [ids.tester, ids.guest]
    };
}

//A GET room/:roomid/users entry, roles are populated and keyed by _id
function rosterEntry(userid, username, roleIds) {
    return {
        _id: 'roomuser-' + userid,
        roomid: ROOM_ID,
        userid: userid,
        _user: {_id: userid, username: username, created: 1700000000000, profileImage: null},
        roleids: roleIds.map(function(id) {
            return {_id: id, roomid: ROOM_ID, label: 'populated'};
        })
    };
}

//user-setrole / user-unsetrole as sent on the room channel
function roleEvent(type, targetId, roleData) {
    return {
        type: type,
        user: {_id: OWNER_ID, username: 'owner'},
        targetUser: {_id: targetId, username: 'target'},
        userid: targetId,
        role: roleData
    };
}

//users: {username: [role ids]}, the key 'owner' is the room creator and 'bot' is the bot
function makeRoom(users, botActor) {
    var room = new RoomModel({_id: ROOM_ID, userid: OWNER_ID});

    var userIds = {owner: OWNER_ID, bot: BOT_ID};

    Object.keys(users).forEach(function(name) {
        var userid = userIds[name] || name;
        room.users.add(new UserModel(rosterEntry(userid, name, users[name])));
    });

    room.setRoles(roles(), botActor || actor());

    return room;
}

//A DubAPI instance wired to a room, recording requests, emitted events and role refreshes
function makeApi(room) {
    var api = Object.create(DubAPI.prototype);

    api.requests = [];
    api.emitted = [];
    api.refreshes = 0;

    api._ = {
        connected: true,
        room: room,
        self: {id: BOT_ID},
        reqHandler: {
            queue: function(options) {
                api.requests.push(options);
            }
        },
        actHandler: {
            updateRolesDebounce: function() {
                api.refreshes++;
            }
        }
    };

    api.emit = function(type, msg) {
        if (type !== '*') api.emitted.push(msg);
    };

    return api;
}

module.exports = {
    ROOM_ID: ROOM_ID,
    OWNER_ID: OWNER_ID,
    BOT_ID: BOT_ID,
    ids: ids,
    roles: roles,
    actor: actor,
    rosterEntry: rosterEntry,
    roleEvent: roleEvent,
    makeRoom: makeRoom,
    makeApi: makeApi
};
