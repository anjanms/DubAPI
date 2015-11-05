
module.exports = {
    authDubtrack: 'auth/dubtrack',
    authSession: 'auth/session',
    chat: 'chat/%RID%',
    chatBan: 'chat/ban/%RID%/user/%UID%',
    chatDelete: 'chat/%RID%/%CID%',
    chatKick: 'chat/kick/%RID%/user/%UID%',
    chatSkip: 'chat/skip/%RID%/%PID%',
    chatMute: 'chat/mute/%RID%/user/%UID%',
    room: 'room/%SLUG%',
    roomUsers: 'room/%RID%/users',
    roomPlaylist: 'room/%RID%/playlist',
    roomPlaylistActive: 'room/%RID%/playlist/active',
    roomPlaylistActiveDubs: 'room/%RID%/playlist/active/dubs',
    roomQueueRemove: 'room/%RID%/queue/user/%UID%'
};
