# Change Log

## [1.6.8] - 2017-02-21
### Changed
- Send presence enter on socket reconnect too

## [1.6.7] - 2017-02-21
### Changed
- Now sends presence enter message when attaching to room channels

### Dependencies
- Updated engine.io-client to 2.0.0

## [1.6.6] - 2017-01-18
### Fixed
- Fixed a TypeError on bot disconnect [#34](https://github.com/anjanms/DubAPI/issues/34)

### Changed
- Changed dependency version selector to appease [David DM](https://david-dm.org/anjanms/DubAPI)

## [1.6.5] - 2016-12-22
### Fixed
- Fixed a crash when creating a RequestError
- Fixed a case where the bot could be left without a socket connection
- Removed an extra authToken request that was accidentally left behind

## [1.6.4] - 2016-12-22
### Changed
- Now using Dubtrack's own WebSockets [#32](https://github.com/anjanms/DubAPI/issues/32)

## [1.6.3] - 2016-09-09
### Changed
- Set Ably environment to `dubtrack`

## [1.6.2] - 2016-07-01
### Fixed
- Fixed bot not showing in presence

## [1.6.1] - 2016-06-30
### Added
- Added API User-Agent to requests

### Dependencies
- Changed realtime from PubNub to Ably

## [1.6.0] - 2016-03-01
### Added
- Added callback functionality to sendChat [#23](https://github.com/anjanms/DubAPI/issues/23)

### Dependencies
- Updated PubNub to 3.13.0

## [1.5.1] - 2016-02-16
### Dependencies
- Updated PubNub to 3.9.0
- Updated ESLint to 2.0.0

## [1.5.0] - 2016-02-11
### Added
- Added user queue methods (queuePlaylist, clearQueue, pauseQueue) [#21](https://github.com/anjanms/DubAPI/issues/21) [#22](https://github.com/anjanms/DubAPI/pull/22) ([@Fuechschen](https://github.com/Fuechschen))
- Added queueMedia method [#21](https://github.com/anjanms/DubAPI/issues/21)

## [1.4.0] - 2016-02-04
### Added
- Added chat-mention permission
- Added moderatePauseDJ [#20](https://github.com/anjanms/DubAPI/pull/20) ([@Fuechschen](https://github.com/Fuechschen))

## [1.3.0] - 2016-01-28
### Added
- Added user profileImage support
- Added `user-update` event for profileImage updates
- Added moderateLockQueue [#19](https://github.com/anjanms/DubAPI/pull/19) ([@Fuechschen](https://github.com/Fuechschen))
- Added support for case-insensitive matching in getUserByName [#18](https://github.com/anjanms/DubAPI/issues/18)

### Changed
- Changed existing `user-update` event to `user_update` to match dubtrack

## [1.2.1] - 2016-01-17
### Changed
- Changed media objects to be undefined when missing `type` or `fkid` [#16](https://github.com/anjanms/DubAPI/issues/16)

## [1.2.0] - 2016-01-13
### Added
- Added support for grabs

### Fixed
- Fixed a crash when media name is undefined [#16](https://github.com/anjanms/DubAPI/issues/16)

## [1.1.0] - 2015-12-14
### Added
- Added option to limit chat message splits
- Added automatic re-join when the bot erroneously leaves the room

### Changed
- Changed max chat message length to 255

### Fixed
- Fixed users still in the cache not being re-added to the collection
- Fixed old events being processed when the bot reconnects
- Fixed internal models accidentally being exposed to event listeners
- Fixed a crash when the bot disconnects and still has requests queued

### Removed
- Removed `chatid` property with duplicate value from `delete-chat-message` event (use `id` instead)

## [1.0.3] - 2015-12-08
### Added
- Added updating of usernames on chat-message event [#10](https://github.com/anjanms/DubAPI/issues/10)

### Changed
- Changed updub/downdub to use new endpoint [#11](https://github.com/anjanms/DubAPI/pull/11) ([@thedark1337](https://github.com/thedark1337))

## [1.0.2] - 2015-12-01
### Fixed
- Fixed a crash caused by song being undefined in responses from `room/%RID%/playlist/active` [#8](https://github.com/anjanms/DubAPI/issues/8)
- Fixed a crash caused by the array containing null in responses from `room/%RID%/playlist/details` [#8](https://github.com/anjanms/DubAPI/issues/8)

## [1.0.1] - 2015-11-29
### Fixed
- Fixed a crash in moderateBanUser and moderateMoveUser on node 0.10

## [1.0.0] - 2015-11-29
### Added
- Added moderateSetRole and moderateUnsetRole methods [#5](https://github.com/anjanms/DubAPI/pull/5) ([@Fuechschen](https://github.com/Fuechschen))
- Added moderateRemoveSong and moderateRemoveDJ methods [#5](https://github.com/anjanms/DubAPI/pull/5) ([@Fuechschen](https://github.com/Fuechschen))
- Added automatic relogin and request retrying
- Added getQueue and getQueuePosition methods [#3](https://github.com/anjanms/DubAPI/issues/3)
- Added moderateMoveDJ method

### Fixed
- Fixed a TypeError when a kick message is not defined
- Fixed media objects emitted via RTEs not being clones
- Fixed some methods missing state checks
- Fixed methods accepting non-finite numbers

### Changed
- Changed artificial advance events to include lastPlay and raw
- Changed split chat messages to be queued immediately instead of waiting for server response
- Changed chat messages to not be emitted if one already exists in chat history with the same id
- Changed moderation methods to return true if the request was queued, false otherwise
- Changed methods that should return arrays to return empty arrays when state checks fail
- Changed methods that should return numbers to return -1 when state checks fail
- Enabled strict mode
- Enabled gzip compression

[1.6.8]: https://github.com/anjanms/DubAPI/compare/v1.6.7...v1.6.8
[1.6.7]: https://github.com/anjanms/DubAPI/compare/v1.6.6...v1.6.7
[1.6.6]: https://github.com/anjanms/DubAPI/compare/v1.6.5...v1.6.6
[1.6.5]: https://github.com/anjanms/DubAPI/compare/v1.6.4...v1.6.5
[1.6.4]: https://github.com/anjanms/DubAPI/compare/v1.6.3...v1.6.4
[1.6.3]: https://github.com/anjanms/DubAPI/compare/v1.6.2...v1.6.3
[1.6.2]: https://github.com/anjanms/DubAPI/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/anjanms/DubAPI/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/anjanms/DubAPI/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/anjanms/DubAPI/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/anjanms/DubAPI/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/anjanms/DubAPI/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/anjanms/DubAPI/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/anjanms/DubAPI/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/anjanms/DubAPI/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/anjanms/DubAPI/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/anjanms/DubAPI/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/anjanms/DubAPI/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/anjanms/DubAPI/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/anjanms/DubAPI/compare/0.2.4...v1.0.0
