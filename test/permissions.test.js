'use strict';

var test = require('node:test'),
    assert = require('assert');

var permissions = require('../lib/data/permissions.js');

test('normalize maps permission names from before custom roles', function() {
    assert.strictEqual(permissions.normalize('ban'), 'members.ban');
    assert.strictEqual(permissions.normalize('set-roles'), 'roles.manage');
    assert.strictEqual(permissions.normalize('queue-order'), 'queue.order');
    assert.strictEqual(permissions.normalize('chat'), 'chat.send');
});

test('normalize leaves new permission keys alone', function() {
    assert.strictEqual(permissions.normalize('members.kick'), 'members.kick');
    assert.strictEqual(permissions.normalize('not.a.permission'), 'not.a.permission');
});

test('expand adds implied permissions', function() {
    assert.deepStrictEqual(permissions.expand(['members.kick']).sort(),
        ['members.kick', 'members.list', 'queue.view']);
    assert.deepStrictEqual(permissions.expand(['roles.manage']).sort(), ['members.list', 'roles.manage']);
});

test('expand does not duplicate permissions', function() {
    assert.deepStrictEqual(permissions.expand(['queue.view', 'queue.order', 'queue.lock']).sort(),
        ['queue.lock', 'queue.order', 'queue.view']);
});

test('expand does not modify its input', function() {
    var input = ['members.ban'];

    permissions.expand(input);

    assert.deepStrictEqual(input, ['members.ban']);
});
