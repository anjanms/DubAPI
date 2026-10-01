'use strict';

var test = require('node:test'),
    assert = require('assert');

var fixtures = require('./fixtures.js');

var ids = fixtures.ids;

var users = {
    owner: [],
    bot: [],
    plain: [],
    dj: [ids.dj],
    mod: [ids.mod],
    manager: [ids.manager, ids.dj]
};

//A bot ranked as the given role, holding the given permissions
function botAs(roleId, position, permissions) {
    var botUsers = Object.assign({}, users, {bot: [roleId]});

    return fixtures.makeApi(fixtures.makeRoom(botUsers, {
        permissions: permissions,
        position: position,
        isOwner: false,
        isGlobalAdmin: false,
        roles: [roleId, ids.guest]
    }));
}

function moderator() {
    return botAs(ids.mod, 640, ['members.kick', 'members.ban', 'members.mute', 'members.list', 'queue.view']);
}

function manager() {
    return botAs(ids.manager, 768, ['roles.manage', 'members.list']);
}

test('kick and ban only work on members ranked below the bot', function() {
    var api = moderator();

    assert.ok(api.moderateKickUser('plain'));
    assert.ok(api.moderateKickUser('dj'));
    assert.ok(api.moderateBanUser('dj'));

    assert.ok(!api.moderateKickUser('mod'), 'equal rank');
    assert.ok(!api.moderateBanUser('mod'), 'equal rank');
    assert.ok(!api.moderateKickUser('manager'), 'higher rank');
    assert.ok(!api.moderateKickUser(fixtures.OWNER_ID), 'room owner');
    assert.ok(!api.moderateKickUser(fixtures.BOT_ID), 'the bot itself');

    assert.strictEqual(api.requests.length, 3);
});

test('kick and ban leave users outside the room to the server', function() {
    var api = moderator();

    assert.ok(api.moderateBanUser('not-in-room'));
    assert.ok(!api.moderateBanUser(fixtures.OWNER_ID));
});

test('mute only works on members without a role', function() {
    var api = moderator();

    assert.ok(api.moderateMuteUser('plain'));

    assert.ok(!api.moderateMuteUser('dj'), 'holds a role');
    assert.ok(!api.moderateMuteUser(fixtures.OWNER_ID), 'room owner holds no role but cannot be muted');
    assert.ok(!api.moderateMuteUser(fixtures.BOT_ID), 'the bot itself');

    assert.strictEqual(api.requests.length, 1);
});

test('moderation needs the permission', function() {
    var api = botAs(ids.dj, 256, ['queue.join']);

    assert.ok(!api.moderateKickUser('plain'));
    assert.ok(!api.moderateBanUser('plain'));
    assert.ok(!api.moderateMuteUser('plain'));
    assert.strictEqual(api.requests.length, 0);
});

test('queue moderation checks the specific queue permissions', function() {
    var removeSong = botAs(ids.dj, 256, ['queue.remove']),
        removeDJ = botAs(ids.dj, 256, ['queue.dj.remove']);

    removeSong._.room.queue.push({uid: 'plain'});
    removeDJ._.room.queue.push({uid: 'plain'});

    assert.ok(removeSong.moderateRemoveSong('plain'));
    assert.ok(!removeSong.moderateRemoveDJ('plain'), 'needs queue.dj.remove');
    assert.ok(!removeSong.moderatePauseDJ('plain'), 'needs queue.dj.remove');

    assert.ok(removeDJ.moderateRemoveDJ('plain'));
    assert.ok(removeDJ.moderatePauseDJ('plain'));
    assert.ok(!removeDJ.moderateRemoveSong('plain'), 'needs queue.remove');
});

test('moderateSetRole assigns by templateKey, label or id', function() {
    var api = manager();

    assert.ok(api.moderateSetRole('plain', 'dj'));
    assert.ok(api.moderateSetRole('plain', 'NIGHT crew'));
    assert.ok(api.moderateSetRole('plain', ids.vip));

    assert.deepStrictEqual(api.requests, [
        {method: 'PUT', url: 'room/%RID%/users/plain/roles/' + ids.dj},
        {method: 'PUT', url: 'room/%RID%/users/plain/roles/' + ids.tester},
        {method: 'PUT', url: 'room/%RID%/users/plain/roles/' + ids.vip}
    ]);
});

test('moderateUnsetRole sends a DELETE with the role id', function() {
    var api = manager();

    assert.ok(api.moderateUnsetRole('dj', 'DJ'));
    assert.deepStrictEqual(api.requests, [{method: 'DELETE', url: 'room/%RID%/users/dj/roles/' + ids.dj}]);
});

test('moderateSetRole refuses roles at or above the bot and the default role', function() {
    var api = manager();

    assert.ok(!api.moderateSetRole('plain', 'manager'), 'the bot\'s own rank');
    assert.ok(!api.moderateSetRole('plain', 'co-owner'), 'above the bot');
    assert.ok(!api.moderateSetRole('plain', 'guest'), 'default role');
    assert.strictEqual(api.requests.length, 0);
});

test('moderateSetRole refuses members not ranked below the bot', function() {
    var api = manager();

    assert.ok(!api.moderateSetRole('manager', 'dj'), 'equal rank');
    assert.ok(!api.moderateSetRole(fixtures.OWNER_ID, 'dj'), 'room owner');
    assert.ok(!api.moderateSetRole(fixtures.BOT_ID, 'dj'), 'the bot itself');
    assert.strictEqual(api.requests.length, 0);
});

test('moderateSetRole needs roles.manage and a known role', function() {
    assert.ok(!moderator().moderateSetRole('plain', 'dj'));

    assert.throws(function() {
        manager().moderateSetRole('plain', 'nope');
    }, /role not found/);
});

test('an actor position of null outranks every role', function() {
    var api = botAs(ids.guest, null, ['room.admin']);

    assert.ok(api.moderateKickUser('manager'));
    assert.ok(api.moderateSetRole('plain', 'co-owner'));
});

test('role helpers check the starter roles a user holds', function() {
    var api = moderator();

    assert.ok(api.isMod({id: 'mod'}));
    assert.ok(api.isManager({id: 'manager'}));
    assert.ok(api.isDJ({id: 'manager'}), 'holds DJ as a second role');
    assert.ok(!api.isMod({id: 'dj'}));
    assert.ok(!api.isOwner({id: fixtures.OWNER_ID}), 'the creator holds no role');
    assert.ok(api.isCreator({id: fixtures.OWNER_ID}));
});

test('isMember and isStaff use the room\'s current data', function() {
    var api = moderator();

    assert.ok(api.isMember({id: 'plain'}));
    assert.ok(!api.isMember({id: 'dj'}));
    assert.ok(api.isStaff({id: 'dj'}));
    assert.ok(!api.isStaff({id: 'plain', role: 'stale'}), 'ignores the copy passed in');
    assert.ok(!api.isStaff({id: 'not-in-room'}));
});

test('hasPermission routes the bot to the actor and others to their roles', function() {
    var api = moderator();

    assert.ok(api.hasPermission({id: fixtures.BOT_ID}, 'ban'));
    assert.ok(!api.hasPermission({id: fixtures.BOT_ID}, 'chat.send'), 'not in the actor list');
    assert.ok(api.hasPermission({id: 'mod'}, 'kick'));
    assert.ok(!api.hasPermission({id: 'not-in-room'}, 'chat.send'));
});

test('getRoles returns a copy of the room\'s roles', function() {
    var api = moderator(),
        roles = api.getRoles();

    assert.strictEqual(roles.length, 8);
    assert.notStrictEqual(roles[0], api._.room.roles[0]);
});
