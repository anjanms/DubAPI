'use strict';

var test = require('node:test'),
    assert = require('assert');

var fixtures = require('./fixtures.js');

var ids = fixtures.ids;

//The bot holds Manager, with roles.manage and a few permissions it can grant
function manager(permissions) {
    var room = fixtures.makeRoom({bot: [ids.manager]}, {
        permissions: permissions || ['roles.manage', 'members.list', 'queue.view', 'queue.join', 'chat.send'],
        position: 768,
        isOwner: false,
        isGlobalAdmin: false,
        roles: [ids.manager, ids.guest]
    });

    return fixtures.makeApi(room);
}

function roleIds() {
    return fixtures.roles().map(function(role) {
        return role.id;
    });
}

test('createRole posts the role data', function() {
    var api = manager();

    assert.ok(api.createRole({label: 'Helpers', color: '#00ff00', permissions: ['queue.join']}));
    assert.deepStrictEqual(api.requests, [{
        method: 'POST',
        url: 'room/%RID%/roles',
        json: {label: 'Helpers', color: '#00ff00', permissions: ['queue.join']}
    }]);
});

test('createRole refuses permissions the bot does not hold', function() {
    var api = manager();

    assert.ok(!api.createRole({label: 'Bouncers', permissions: ['members.ban']}));
    assert.strictEqual(api.requests.length, 0);
});

test('createRole needs roles.manage and a label', function() {
    assert.ok(!manager(['chat.send']).createRole({label: 'Helpers'}));

    assert.throws(function() {
        manager().createRole({color: '#00ff00'});
    }, /data.label must be a string/);
});

test('updateRole sends the whole role with the changes applied', function() {
    var api = manager();

    assert.ok(api.updateRole('dj', {label: 'Selectors', permissions: ['queue.join']}));

    var request = api.requests[0];

    assert.strictEqual(request.method, 'PUT');
    assert.strictEqual(request.url, 'room/%RID%/roles/' + ids.dj);
    assert.strictEqual(request.json.label, 'Selectors');
    assert.deepStrictEqual(request.json.permissions, ['queue.join']);
    assert.ok('color' in request.json, 'fields left out would be cleared by the API');
});

test('updateRole keeps fields that are not changed', function() {
    var api = manager();

    api.updateRole('Night Crew', {label: 'Late Crew'});

    assert.deepStrictEqual(api.requests[0].json.permissions, ['queue.view', 'queue.join']);
});

test('updateRole refuses roles at or above the bot and permissions it does not hold', function() {
    var api = manager();

    assert.ok(!api.updateRole('manager', {label: 'Boss'}), 'the bot\'s own rank');
    assert.ok(!api.updateRole('co-owner', {label: 'Boss'}), 'above the bot');
    assert.ok(!api.updateRole('dj', {permissions: ['members.ban']}), 'not held by the bot');
    assert.ok(!api.updateRole('dj', {}), 'the DJ role already has queue.lock.bypass, which the bot lacks');
    assert.strictEqual(api.requests.length, 0);

    assert.throws(function() {
        api.updateRole('nope', {});
    }, /role not found/);
});

test('deleteRole deletes roles below the bot', function() {
    var api = manager();

    assert.ok(api.deleteRole('Night Crew'));
    assert.deepStrictEqual(api.requests, [{method: 'DELETE', url: 'room/%RID%/roles/' + ids.tester}]);
});

test('deleteRole refuses the default role and roles at or above the bot', function() {
    var api = manager();

    assert.ok(!api.deleteRole('guest'));
    assert.ok(!api.deleteRole('manager'));
    assert.ok(!api.deleteRole('co-owner'));
    assert.strictEqual(api.requests.length, 0);
});

test('reorderRoles sends every role id in the new order', function() {
    var api = manager(),
        order = roleIds();

    //Swap DJ and Night Crew
    order.splice(5, 2, ids.tester, ids.dj);

    assert.ok(api.reorderRoles(order));
    assert.deepStrictEqual(api.requests, [{method: 'PUT', url: 'room/%RID%/roles/order', json: {order: order}}]);
});

test('reorderRoles accepts labels and templateKeys', function() {
    var api = manager();

    assert.ok(api.reorderRoles(['co-owner', 'manager', 'mod', 'vip', 'resident-dj', 'Night Crew', 'dj', 'guest']));
    assert.strictEqual(api.requests[0].json.order[5], ids.tester);
});

test('reorderRoles refuses moving roles the bot does not outrank', function() {
    var api = manager(),
        order = roleIds();

    //Swap Manager (the bot) and Moderator
    order.splice(1, 2, ids.mod, ids.manager);

    assert.ok(!api.reorderRoles(order));
    assert.strictEqual(api.requests.length, 0);
});

test('reorderRoles checks the order lists every role once with the default role last', function() {
    var api = manager();

    assert.throws(function() {
        api.reorderRoles(roleIds().slice(1));
    }, /every role/);

    assert.throws(function() {
        var order = roleIds();
        order.splice(6, 2, ids.guest, ids.tester);
        api.reorderRoles(order);
    }, /default role must be last/);

    assert.throws(function() {
        api.reorderRoles(roleIds().concat('nope'));
    }, /role not found: nope/);
});

test('role management needs roles.manage', function() {
    var api = manager(['chat.send']);

    assert.ok(!api.deleteRole('Night Crew'));
    assert.ok(!api.updateRole('Night Crew', {label: 'x'}));
    assert.ok(!api.reorderRoles(roleIds()));
});
