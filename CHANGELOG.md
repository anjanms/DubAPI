# Change Log

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

[1.2.0]: https://github.com/anjanms/DubAPI/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/anjanms/DubAPI/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/anjanms/DubAPI/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/anjanms/DubAPI/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/anjanms/DubAPI/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/anjanms/DubAPI/compare/0.2.4...v1.0.0