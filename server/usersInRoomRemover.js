const {db} = require('./initialization/firebaseInitialization');
const _ = require('lodash');
const PropertiesReader = require('properties-reader');
const properties = PropertiesReader('server.properties');

const ROOMS_REF = 'rooms';
const USERS_IN_ROOM_REF = 'usersInRoom';

const startRemoveUsersTask = () => {
    setInterval(() => {
        removeInactiveUsersFromRoom();
    }, properties.get('inactive_users_remover_sheduler_ratio'));
};

const removeInactiveUsersFromRoom = () => {
    const roomsRef = db.ref(ROOMS_REF);

    roomsRef.once('value').then((roomsSnapshot) => {
        const rooms = roomsSnapshot.val();
        return filterPublicRoomId(rooms);
    }).then((publicRoomsKeys) => {
        publicRoomsKeys.forEach(roomId => {
            checkIfUsersInRoomInactive(roomsRef, roomId);
        });
    }).catch((err) => {
        console.log(err);
    });
};

const checkIfUsersInRoomInactive = (roomsRef, roomId) => {
    const usersInRoomRef = roomsRef.child(roomId).child(USERS_IN_ROOM_REF);
    usersInRoomRef
        .once('value')
        .then((usersInRoomSnapshot) => {
            const usersInRoom = usersInRoomSnapshot.val();
            if (usersInRoom) {
                _.forIn(usersInRoom, (user, userId) => {
                    if (user.lastActivity && isUserInactive(user.lastActivity)) {
                        removeInactiveUser(usersInRoomRef, userId, roomId);
                    }
                });
            }
        })
};

const removeInactiveUser = (usersInRoomRef, userId, roomId) => {
    usersInRoomRef
        .child(userId)
        .remove()
        .then(() => console.log(`User : ${userId} deleted from room: ${roomId}`));
};

const isUserInactive = (timestamp) => {
    const timestampDiff = _.now() - timestamp;
    const hoursDiff = Math.floor(timestampDiff / 3600 / 1000);
    return hoursDiff >= properties.get('user_inactivity_time_hours');
};

const filterPublicRoomId = (rooms) => {
    const roomIds = _.keys(rooms);

    return _.filter(roomIds, (roomId) => {
        return roomId !== 'privates';
    });
};

module.exports = {startRemoveUsersTask};