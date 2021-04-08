# DubAPI [![][eslintbadge]][eslintlink] [![][auditbadge]][auditlink] [![][versionbadge]][versionlink] [![][licensebadge]][licenselink]

## About

A Node.js API for creating queup.net bots.

## Installation

```
npm install dubapi
```

Optionally, the [websocket implementation](https://github.com/websockets/ws) can make use of native addons for [performance and spec compliance](https://github.com/websockets/ws#opt-in-for-performance-and-spec-compliance).

```
npm install --save-optional bufferutil utf-8-validate
```

## Usage

```javascript

var DubAPI = require('dubapi');

new DubAPI({username: '', password: ''}, function(err, bot) {
    if (err) return console.error(err);

    console.log('Running DubAPI v' + bot.version);

    function connect() {bot.connect('friendship-is-magic');}

    bot.on('connected', function(name) {
        console.log('Connected to ' + name);
    });

    bot.on('disconnected', function(name) {
        console.log('Disconnected from ' + name);

        setTimeout(connect, 15000);
    });

    bot.on('error', function(err) {
        console.error(err);
    });

    bot.on(bot.events.chatMessage, function(data) {
        console.log(data.user.username + ': ' + data.message);
    });

    connect();
});

```
## Credit

- Design cues taken from [PlugAPI](https://github.com/plugCubed/plugAPI)

[eslintlink]: https://github.com/anjanms/DubAPI/actions/workflows/eslint.yml
[eslintbadge]: https://img.shields.io/github/workflow/status/anjanms/DubAPI/ESLint?label=ESLint&logo=github "ESLint"

[auditlink]: https://github.com/anjanms/DubAPI/actions/workflows/npm.yml
[auditbadge]: https://img.shields.io/github/workflow/status/anjanms/DubAPI/npm%20audit?label=npm%20audit&logo=github "npm audit"

[versionlink]: https://www.npmjs.com/package/dubapi
[versionbadge]: https://img.shields.io/npm/v/dubapi "npm version"

[licenselink]: https://github.com/anjanms/DubAPI/blob/master/LICENSE.md
[licensebadge]: https://img.shields.io/npm/l/dubapi "npm license"
