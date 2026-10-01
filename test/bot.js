'use strict';

/* eslint-disable no-console */

//Manual smoke test bot, not part of npm test
//Usage: QUEUP_USER=<bot username> QUEUP_PASS=<bot password> QUEUP_ROOM=<room slug> node test/bot.js

var repl = require('repl');

var DubAPI = require('../index.js');

var auth = {username: process.env.QUEUP_USER, password: process.env.QUEUP_PASS};

new DubAPI(auth, function(err, bot) { //eslint-disable-line no-new
    if (err) throw err;

    bot.on('error', function(e) {
        console.log('ERROR', e && e.message || e);
    });

    ['user-setrole', 'user-unsetrole', 'user-kick'].forEach(function(type) {
        bot.on(type, function(m) {
            console.log('EVENT', type, m.user && m.user.username, m.role ? m.role.label : '');
        });
    });

    bot.on('connected', function(name) {
        console.log('connected to', name);

        var context = repl.start('> ').context;

        context.bot = bot;
        context.cb = function(code) {
            console.log('HTTP', code);
        };
    });

    bot.connect(process.env.QUEUP_ROOM);
});
