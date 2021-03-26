'use strict';

var roles = {};

roles['co-owner'] = roles['5615fa9ae596154a5c000000'] = {
    id: '5615fa9ae596154a5c000000',
    type: 'co-owner',
    label: 'Co-Owner',
    rights: [
        'update-room',
        'set-roles',
        'set-managers',
        'skip',
        'queue-order',
        'kick',
        'ban',
        'mute',
        'set-dj',
        'lock-queue',
        'delete-chat',
        'chat-mention'
    ]
};

roles['manager'] = roles['5615fd84e596150061000003'] = {
    id: '5615fd84e596150061000003',
    type: 'manager',
    label: 'Manager',
    rights: [
        'set-roles',
        'skip',
        'queue-order',
        'kick',
        'ban',
        'mute',
        'set-dj',
        'lock-queue',
        'delete-chat',
        'chat-mention'
    ]
};

roles['mod'] = roles['52d1ce33c38a06510c000001'] = {
    id: '52d1ce33c38a06510c000001',
    type: 'mod',
    label: 'Moderator',
    rights: [
        'skip',
        'queue-order',
        'kick',
        'ban',
        'mute',
        'set-dj',
        'lock-queue',
        'delete-chat',
        'chat-mention'
    ]
};

roles['vip'] = roles['5615fe1ee596154fc2000001'] = {
    id: '5615fe1ee596154fc2000001',
    type: 'vip',
    label: 'VIP',
    rights: [
        'skip',
        'set-dj'
    ]
};

roles['resident-dj'] = roles['5615feb8e596154fc2000002'] = {
    id: '5615feb8e596154fc2000002',
    type: 'resident-dj',
    label: 'Resident DJ',
    rights: [
        'set-dj'
    ]
};

// 20210325 The 'dj' role here differs from its server side representation
// The 'set-dj' right seems to be technically correct given the role's purpose
roles['dj'] = roles['564435423f6ba174d2000001'] = {
    id: '564435423f6ba174d2000001',
    type: 'dj',
    label: 'DJ',
    rights: [
        'set-dj'
    ]
};

module.exports = roles;
