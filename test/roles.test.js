'use strict';

var test = require('node:test'),
    assert = require('assert');

var ActionHandler = require('../lib/actionHandler.js'),
    RoomModel = require('../lib/models/roomModel.js'),
    UserModel = require('../lib/models/userModel.js');

var fixtures = require('./fixtures.js');

var ids = fixtures.ids;

test('UserModel reads roles from the roster, keyed by _id', function() {
    var user = new UserModel(fixtures.rosterEntry('u1', 'someone', [ids.mod, ids.dj]));

    assert.deepStrictEqual(user.roles, [ids.mod, ids.dj]);
    assert.strictEqual(user.role, null, 'set once the room knows its roles');
    assert.strictEqual(user.roleids, undefined, 'raw roleids are filtered out');
});

test('UserModel accepts role ids, role objects keyed by id, and no roles', function() {
    var entry = fixtures.rosterEntry('u1', 'someone', []);

    entry.roleids = [ids.mod, {id: ids.dj}];
    assert.deepStrictEqual(new UserModel(entry).roles, [ids.mod, ids.dj]);

    delete entry.roleids;
    assert.deepStrictEqual(new UserModel(entry).roles, []);
});

test('user.role is the highest role held, ignoring the default role', function() {
    var room = fixtures.makeRoom({mixed: [ids.dj, ids.vip], plain: [], guestOnly: [ids.guest]});

    assert.strictEqual(room.users.findWhere({id: 'mixed'}).role, ids.vip);
    assert.strictEqual(room.users.findWhere({id: 'plain'}).role, null);
    assert.strictEqual(room.users.findWhere({id: 'guestOnly'}).role, null);
});

test('findRole matches id, templateKey and label in any case', function() {
    var room = fixtures.makeRoom({});

    assert.strictEqual(room.findRole(ids.mod).label, 'Moderator');
    assert.strictEqual(room.findRole('resident-dj').id, ids.residentDj);
    assert.strictEqual(room.findRole('NIGHT crew').id, ids.tester);
    assert.strictEqual(room.findRole('nope'), undefined);
});

test('rank is the highest role position, the owner outranks every role', function() {
    var room = fixtures.makeRoom({owner: [], mod: [ids.mod, ids.dj], plain: []});

    assert.strictEqual(room.rank(room.users.findWhere({id: fixtures.OWNER_ID})), Infinity);
    assert.strictEqual(room.rank(room.users.findWhere({id: 'mod'})), 640);
    assert.strictEqual(room.rank(room.users.findWhere({id: 'plain'})), 0);
});

test('rank for the bot comes from the actor, null means unlimited', function() {
    var room = fixtures.makeRoom({bot: [ids.tester]}),
        bot = room.users.findWhere({id: fixtures.BOT_ID});

    assert.strictEqual(room.rank(bot, true), 128);

    room.actor.position = null;
    assert.strictEqual(room.rank(bot, true), Infinity);
});

test('hasPermission combines the user\'s roles, the default role and implied permissions', function() {
    var room = fixtures.makeRoom({mod: [ids.mod], dj: [ids.dj], plain: []});

    function get(id) {
        return room.users.findWhere({id: id});
    }

    assert.ok(room.hasPermission(get('mod'), 'members.kick'));
    assert.ok(room.hasPermission(get('mod'), 'kick'), 'old permission name');
    assert.ok(room.hasPermission(get('mod'), 'members.list'), 'implied by members.kick');
    assert.ok(!room.hasPermission(get('mod'), 'roles.manage'));
    assert.ok(room.hasPermission(get('plain'), 'chat.send'), 'from the default role');
    assert.ok(!room.hasPermission(get('plain'), 'queue.skip'));
    assert.ok(!room.hasPermission(get('dj'), 'queue.skip'));
});

test('hasPermission grants everything to the room owner and room.admin', function() {
    var room = fixtures.makeRoom({owner: [], coOwner: [ids.coOwner]});

    assert.ok(room.hasPermission(room.users.findWhere({id: fixtures.OWNER_ID}), 'members.ban'));
    assert.ok(room.hasPermission(room.users.findWhere({id: 'coOwner'}), 'some.future.permission'));
});

test('hasPermission uses the actor for the bot', function() {
    var room = fixtures.makeRoom({bot: [ids.tester]}),
        bot = room.users.findWhere({id: fixtures.BOT_ID});

    room.actor.permissions = ['members.ban'];

    assert.ok(room.hasPermission(bot, 'ban', true));
    assert.ok(!room.hasPermission(bot, 'chat.send', true), 'the actor list is authoritative');
    assert.ok(room.hasPermission(bot, 'chat.send', false), 'computed from roles otherwise');
});

test('updateRoles stores the API response and takes the bot\'s roles from the actor', function() {
    var room = new RoomModel({_id: fixtures.ROOM_ID, userid: fixtures.OWNER_ID}),
        done = false;

    //The join response may not include the bot's roles
    room.users.add(new UserModel({userid: fixtures.BOT_ID, _user: {username: 'bot'}}));

    var dubAPI = {
        _: {
            room: room,
            self: {id: fixtures.BOT_ID},
            reqHandler: {
                queue: function(options, callback) {
                    assert.strictEqual(options.url, 'room/%RID%/roles');
                    callback(200, {code: 200, message: 'OK', data: {roles: fixtures.roles(), actor: fixtures.actor()}});
                }
            }
        }
    };

    new ActionHandler(dubAPI, {}).updateRoles(function() {
        done = true;
    });

    assert.ok(done);
    assert.strictEqual(room.roles.length, 8);
    assert.strictEqual(room.actor.position, 128);
    assert.strictEqual(room.users.findWhere({id: fixtures.BOT_ID}).role, ids.tester);
});

test('updateRoles ignores a response that arrives after leaving the room', function() {
    var room = new RoomModel({_id: fixtures.ROOM_ID}),
        done = false,
        dubAPI = {_: {room: room, self: {id: fixtures.BOT_ID}, reqHandler: {}}};

    dubAPI._.reqHandler.queue = function(options, callback) {
        dubAPI._.room = undefined;
        callback(200, {data: {roles: fixtures.roles(), actor: fixtures.actor()}});
    };

    new ActionHandler(dubAPI, {}).updateRoles(function() {
        done = true;
    });

    assert.ok(!done);
    assert.deepStrictEqual(room.roles, []);
});

test('updateRoles emits an error and still calls back when the request fails', function() {
    var room = new RoomModel({_id: fixtures.ROOM_ID}),
        errors = [],
        done = false;

    var dubAPI = {
        _: {
            room: room,
            self: {id: fixtures.BOT_ID},
            reqHandler: {
                queue: function(options, callback) {
                    callback(500, {});
                },
                endpoint: function(url) {
                    return url;
                }
            }
        },
        emit: function(type, err) {
            errors.push(err);
        }
    };

    new ActionHandler(dubAPI, {}).updateRoles(function() {
        done = true;
    });

    assert.ok(done);
    assert.strictEqual(errors.length, 1);
    assert.deepStrictEqual(room.roles, []);
});
