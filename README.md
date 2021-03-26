# DubAPI [![][npmbadge]][npmlink] [![][licbadge]][liclink]

## About

A NodeJS API for creating dubtrack.fm bots.

## Usage

```
npm install dubapi
```

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

[npmlink]: https://www.npmjs.com/package/dubapi
[npmbadge]: https://img.shields.io/npm/v/dubapi.svg "npm version"

[liclink]: https://github.com/anjanms/DubAPI/blob/master/LICENSE.md
[licbadge]: https://img.shields.io/npm/l/dubapi.svg "License"
