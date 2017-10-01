const {db} = require('./initialization/firebaseInitialization');
const _ = require('lodash');
const PropertiesReader = require('properties-reader');
const properties = PropertiesReader('server.properties');

const ROOMS_REF = 'rooms';
const MESSAGES_REF = 'messages';
const ROOMS_LOCATIONS_REF = 'roomsLocations';
const ROOMS_LOCATIONS_ALL_REF = 'all';

const startRemoveRoomTask = () => {
    setInterval(() => {
        removeUnusedRooms();
    }, properties.get('rooms_remover_sheduler_ratio'));
};

const removeUnusedRooms = () => {
    const roomsRef = db.ref(ROOMS_REF);
    const roomsLocRef = db.ref(ROOMS_LOCATIONS_REF);
    const messagesRef = db.ref(MESSAGES_REF);

    roomsRef.once('value').then((roomsSnapshot) => {
        const rooms = roomsSnapshot.val();
        return filterPublicRoomId(rooms);
    }).then((publicRoomsKeys) => {
        publicRoomsKeys.forEach(roomId => {
            checkIfRoomExpired(messagesRef, roomsRef, roomId)
                .then((toDelete) => {
                    if (toDelete) {
                        removeRoom(roomsRef, roomsLocRef, messagesRef, roomId);
                    }
                })
        });
    }).catch((err) => {
        console.log(err);
    });
};

const checkIfRoomExpired = (messagesRef, roomsRef, roomId) => {
    return messagesRef
        .child(roomId)
        .limitToLast(1)
        .once('value')
        .then((messageSnapshot) => {
            const message = messageSnapshot.val();
            if (!message) {
                return isRoomExpiredByRoomCreationTime(roomsRef, roomId);
            }
            return isRoomExpiredByLastMessage(message);
        })
};

const isRoomExpiredByRoomCreationTime = (roomsRef, roomId) => {
    return roomsRef
        .child(roomId)
        .once('value')
        .then((roomsSnapshot) => {
            const rooms = roomsSnapshot.val();
            const {createdAt} = rooms;
            if (createdAt) {
                return isRoomExpired(createdAt);
            }
            return false;
        });
};

const isRoomExpiredByLastMessage = (message) => {
    const lastMessage = _.values(message)[0];
    return isRoomExpired(lastMessage.createdAt);
};

const isRoomExpired = (timestamp) => {
    const timestampDiff = _.now() - timestamp;
    const hoursDiff = Math.floor(timestampDiff / 3600 / 1000);
    return hoursDiff >= properties.get('room_expiration_time_hours');
};

const filterPublicRoomId = (rooms) => {
    const roomIds = _.keys(rooms);

    return _.filter(roomIds, (roomId) => {
        return roomId !== 'privates';
    });
};

const removeRoom = (roomsRef, roomsLocRef, messagesRef, roomId) => {
    roomsRef
        .child(roomId)
        .once('value')
        .then((roomsSnapshot) => {
            roomsLocRef
                .child(ROOMS_LOCATIONS_ALL_REF)
                .child(roomId)
                .remove()
                .then(() => console.log(`Room: ${roomId} deleted from roomsLocations>all`));
            return roomsSnapshot;
        })
        .then((roomsSnapshot) => {
            const rooms = roomsSnapshot.val();
            const {roomType} = rooms;
            roomsLocRef
                .child(roomType)
                .child(roomId)
                .remove()
                .then(() => console.log(`Room: ${roomId} deleted from roomsLocations>roomType: ${roomType}`));
        })
        .then(() => {
            roomsRef
                .child(roomId)
                .remove()
                .then(() => console.log(`Room: ${roomId} deleted from rooms`));
        })
        .then(() => {
            messagesRef
                .child(roomId)
                .remove()
                .then(() => console.log(`Messages from room: ${roomId} deleted from messages`));
        });
};

module.exports = {startRemoveRoomTask};