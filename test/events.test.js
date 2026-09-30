'use strict';

var test = require('node:test'),
    assert = require('assert');

var EventHandler = require('../lib/eventHandler.js');

var fixtures = require('./fixtures.js');

var ids = fixtures.ids;

function setup() {
    var room = fixtures.makeRoom({owner: [], bot: [], target: []}),
        api = fixtures.makeApi(room);

    api.send = function(msg) {
        EventHandler.call(api, msg);
    };

    api.user = function(id) {
        return room.users.findWhere({id: id});
    };

    return api;
}

function roleData(id) {
    return fixtures.roles().find(function(role) {
        return role.id === id;
    });
}

test('user-setrole adds the role and keeps the highest one as user.role', function() {
    var api = setup();

    api.send(fixtures.roleEvent('user-setrole', 'target', roleData(ids.vip)));
    api.send(fixtures.roleEvent('user-setrole', 'target', roleData(ids.dj)));

    assert.deepStrictEqual(api.user('target').roles, [ids.vip, ids.dj]);
    assert.strictEqual(api.user('target').role, ids.vip);
    assert.strictEqual(api.refreshes, 0, 'other users do not refresh the bot\'s permissions');
});

test('user-setrole emits the moderator, the target and the role', function() {
    var api = setup();

    api.send(fixtures.roleEvent('user-setrole', 'target', roleData(ids.dj)));

    var msg = api.emitted[0];

    assert.strictEqual(msg.mod.id, fixtures.OWNER_ID);
    assert.strictEqual(msg.user.id, 'target');
    assert.strictEqual(msg.role.label, 'DJ');
    assert.strictEqual(msg.targetUser, undefined);
});

test('user-setrole ignores a role the user already holds', function() {
    var api = setup();

    api.send(fixtures.roleEvent('user-setrole', 'target', roleData(ids.dj)));
    api.send(fixtures.roleEvent('user-setrole', 'target', roleData(ids.dj)));

    assert.deepStrictEqual(api.user('target').roles, [ids.dj]);
});

test('user-unsetrole removes only that role', function() {
    var api = setup();

    api.send(fixtures.roleEvent('user-setrole', 'target', roleData(ids.vip)));
    api.send(fixtures.roleEvent('user-setrole', 'target', roleData(ids.dj)));
    api.send(fixtures.roleEvent('user-unsetrole', 'target', roleData(ids.vip)));

    assert.deepStrictEqual(api.user('target').roles, [ids.dj]);
    assert.strictEqual(api.user('target').role, ids.dj);

    api.send(fixtures.roleEvent('user-unsetrole', 'target', roleData(ids.dj)));

    assert.strictEqual(api.user('target').role, null);
});

test('role changes on the bot refresh its permissions', function() {
    var api = setup();

    api.send(fixtures.roleEvent('user-setrole', fixtures.BOT_ID, roleData(ids.tester)));
    assert.strictEqual(api.refreshes, 1);

    api.send(fixtures.roleEvent('user-unsetrole', fixtures.BOT_ID, roleData(ids.tester)));
    assert.strictEqual(api.refreshes, 2);
});

test('role events for users not in the room do not throw', function() {
    var api = setup();

    api.send(fixtures.roleEvent('user-setrole', 'gone', roleData(ids.dj)));
    api.send(fixtures.roleEvent('user-unsetrole', 'gone', roleData(ids.dj)));

    assert.strictEqual(api.emitted.length, 2);
    assert.strictEqual(api.emitted[0].user, undefined);
});

test('room-role-delete removes the role from every user and refreshes', function() {
    var api = setup();

    api.send(fixtures.roleEvent('user-setrole', 'target', roleData(ids.dj)));
    api.send({type: 'room-role-delete', roleid: ids.dj});

    assert.deepStrictEqual(api.user('target').roles, []);
    assert.strictEqual(api.refreshes, 1);
});

test('room-role-create, update and reorder refresh the roles', function() {
    var api = setup();

    api.send({type: 'room-role-create', role: roleData(ids.dj)});
    api.send({type: 'room-role-update', role: roleData(ids.dj)});
    api.send({type: 'room-roles-reorder', roles: fixtures.roles()});

    assert.strictEqual(api.refreshes, 3);
});

test('user-join sets user.role from the joining user\'s roles', function() {
    var api = setup(),
        entry = fixtures.rosterEntry('joiner', 'joiner', [ids.mod]);

    api.send({type: 'user-join', user: entry._user, roomUser: entry});

    assert.strictEqual(api.user('joiner').role, ids.mod);
});
