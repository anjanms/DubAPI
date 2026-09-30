/* eslint-disable max-len */
'use strict';

module.exports = {
    authDubtrack: 'auth/login',
    authSession: 'auth/session',
    authToken: 'auth/token',
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
    roomQueuePauseUser: 'room/%RID%/queue/user/%UID%/pause',

    /**
     * List the permission catalogue (GET)
     * https://queup.net/blog/custom-roles-are-here#:~:text=List%20the%20permission%20catalogue
     * Public and the same for every room. Cache it for the lifetime of your process.
     */
    permissions: 'permissions',

    /**
     * List a room's roles (GET)
     * https://queup.net/blog/custom-roles-are-here#:~:text=wording%20matches%20ours.-,List%20a%20room%27s%20roles,-GET%20/room/%3Aroomid
     */
    roomRoles: 'room/%RID%/roles',

    /**
     * Retrieve your bot's permissions (GET)
     * https://queup.net/blog/custom-roles-are-here#:~:text=Retrieve%20your%20bot%27s%20permissions
     */
    myPermissions: 'room/%RID%/permissions/me',

    /**
     * Create a new role in a room (POST)
     * https://queup.net/blog/custom-roles-are-here#:~:text=65e0.../permissions/me-,Create%20a%20role,-POST%20/room/%3Aroomid
     */
    createRole: 'room/%RID%/roles',

    /**
     * Update a role (PUT)
     * https://queup.net/blog/custom-roles-are-here#:~:text=you%20need%20to.-,Update%20a%20role,-PUT%20/room/%3Aroomid
     */
    updateRole: 'room/%RID%/roles/%ROLEID%',

    /**
     * Delete a role (DELETE)
     * https://queup.net/blog/custom-roles-are-here#:~:text=any%20other%20role%27s.-,Delete%20a%20role,-DELETE%20/room/%3Aroomid
     */
    deleteRole: 'room/%RID%/roles/%ROLEID%',

    /**
     * Reorder roles (PUT)
     * https://queup.net/blog/custom-roles-are-here#:~:text=an%20ordinary%20member.-,Reorder%20roles,-PUT%20/room/%3Aroomid
     */
    reorderRoles: 'room/%RID%/roles/order',

    /**
     * Assign a role (PUT), or remove a role (DELETE)
     * https://queup.net/blog/custom-roles-are-here#:~:text=whole%20list%20back.-,Assign%20a%20role,-PUT%20/room/%3Aroomid
     * https://queup.net/blog/custom-roles-are-here#:~:text=remove%20the%20first.-,Remove%20a%20role,-DELETE%20/room/%3Aroomid
     */
    roomUserRole: 'room/%RID%/users/%UID%/roles/%ROLEID%',

    /**
     * Read all users in a room (GET)
     * https://queup.net/blog/custom-roles-are-here#:~:text=64aa.../roles/65f1...-,Read%20who%20holds%20what,-There%20is%20no
     * There is no endpoint that lists a role's holders. Read the room roster instead.
     */
    roomUsers: 'room/%RID%/users',
    roomModSettings: 'room/%RID%/modsettings',
    roomAuditLog: 'room/%RID%/audit',
    song: 'song/%SONGID%',
    lockQueue: 'room/%RID%/lockQueue',
    queuePlaylist: 'room/%RID%/queueplaylist/%PID%',
    queuePause: 'room/%RID%/queue/pause',
    userPlaylists: 'playlist',
    userPlaylist: 'playlist/%PID%'
};
