'use strict';

module.exports = {
    authDubtrack: 'auth/dubtrack',
    authSession: 'auth/session',
    chat: 'chat/%RID%',
    chatBan: 'chat/ban/%RID%/user/%UID%',
    chatDelete: 'chat/%RID%/%CID%',
    chatKick: 'chat/kick/%RID%/user/%UID%',
    chatMute: 'chat/mute/%RID%/user/%UID%',
    chatSkip: 'chat/skip/%RID%/%PID%',
    room: 'room/%SLUG%',
    roomPlaylist: 'room/%RID%/playlist',
    roomPlaylistActive: 'room/%RID%/playlist/active',
    roomPlaylistActiveDubs: 'room/%RID%/playlist/active/dubs',
    roomPlaylistDetails: 'room/%RID%/playlist/details',
    roomPlaylistVote: 'room/%RID%/playlist/%PLAYLISTID%/dubs',
    roomQueueOrder: 'room/%RID%/queue/order',
    roomQueueRemoveSong: 'room/%RID%/queue/user/%UID%',
    roomQueueRemoveUser: 'room/%RID%/queue/user/%UID%/all',
    roomQueuePauseUserQueue: 'room/%RID%/queue/user/%UID%/pause',
    roomUsers: 'room/%RID%/users',
    setRole: '/chat/%ROLEID%/%RID%/user/%UID%',
    lockQueue: '/room/%RID%/lockQueue'
};
