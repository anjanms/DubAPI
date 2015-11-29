# Change Log

## [1.0.0] - 2015-11-29
### Added
- Added moderateSetRole and moderateUnsetRole methods from @Fuechschen
- Added moderateRemoveSong and moderateRemoveDJ methods from @Fuechschen
- Added automatic relogin and request retrying
- Added getQueue and getQueuePosition methods
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

[1.0.0]: https://github.com/anjanms/DubAPI/compare/0.2.4...v1.0.0