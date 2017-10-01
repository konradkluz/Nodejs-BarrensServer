const admin = require('firebase-admin');
const _ = require('lodash');

// admin.database.enableLogging(true);

const NOTIF_TYPES = {
    newPublicMsg: 'newPublicMsg',
    newPrivateMsg: 'newPrivateMsg',
    newRoomInDistance: 'newRoomInDistance',
    newInvitationToFriends: 'newInvitationToFriends'
};

function initListeners() {
    const db = admin.database();
    const roomsListeners = {};
    let initLoad = true;
    const msgRef = db.ref("/messages");

    msgRef.on('child_added', (roomMsgs) => {

        const roomMsgsRef = db.ref(`/messages/${roomMsgs.key}`);

        const roomId = roomMsgs.key;


        roomsListeners[roomId] = roomMsgsRef.on('child_added', (msgSnap) => {
            if (initLoad) return;
            const msg = msgSnap.val();
            // console.log(roomsListeners);
            if (roomId.charAt(0) === '-') {
                onNewMsgSendPublicNotif(roomId, msg)
            } else {
                const friendIds = _.split(roomId, '_');
                const senderId = msg.user._id;
                const receiverId = friendIds.filter(id => id !== senderId)[0];
                onNewMsgSendPrivateNotif(receiverId, msg);

            }

        });
        roomMsgsRef.once('value').then(() => initLoad = false);


    });

    msgRef.on('child_removed', (roomMsgsSnap) => {
        msgRef.child(roomMsgsSnap.key).off('child_added', roomsListeners[roomMsgsSnap.key]);
        delete roomsListeners[roomMsgsSnap.key];
    })

    initFriendInvitaionsListener()

}


function initFriendInvitaionsListener() {
    const invitatonRef = admin.database().ref('/invitations');

    let initLoad = true;

    invitatonRef.on('child_added', (invitSnap => {
        if (initLoad) return;
        onInvitationsSendNotif(invitSnap);
    }));

    invitatonRef.once('value').then(() => initLoad = false);

}


function onInvitationsSendNotif(invitSnap) {
    const inv = invitSnap.val();
    admin.database().ref(`/userFCMTokens/${inv.receiverId}`).once('value')
        .then(tokenSnap => [tokenSnap.val()])
        .then(processTokens(NOTIF_TYPES.newPrivateMsg))
        .then(tokensArr => sendTokens(tokensArr, undefined,
            createPublicMsgPayload(translations.en.friendInvitation, inv.senderDispalyName),
            createPublicMsgPayload(translations.pl.friendInvitation, inv.senderDispalyName)
        ))
        .catch(err => console.log(err));
}

function onNewMsgSendPublicNotif(roomId, msg) {
    let roomTitle;
    admin.database().ref("/rooms").child(roomId).once('value').then(roomSnap => {
            const room = roomSnap.val();
            roomTitle = room.title;
            return Promise.all(_.map(room.usersInRoom, (user, userId) => {
                return admin.database().ref(`/userFCMTokens/${userId}`).once('value');
            }))
        }
    ).then(tokensSnap =>
        tokensSnap.map(tokenSnap => tokenSnap.val())
    ).then(processTokens(NOTIF_TYPES.newPublicMsg))
        .then(tokensArr => sendTokens(tokensArr, createPublicMsgPayload(roomTitle, msg.text, roomId)))
        .catch(err => console.log(err));
}

function onNewMsgSendPrivateNotif(receiverId, msg) {
    admin.database().ref(`/userFCMTokens/${receiverId}`).once('value')
        .then(tokenSnap => [tokenSnap.val()])
        .then(processTokens(NOTIF_TYPES.newPrivateMsg))
        .then(tokensArr => sendTokens(tokensArr, createPublicMsgPayload(msg.user.name, msg.text, msg.user._id)))
        .catch(err => console.log(err))
}

function processTokens(notifType) {
    return (tokenObjects) => {
        return Promise.resolve(tokenObjects)
            .then(extractUserTokens)
            .then(filterNotificationSetting(notifType))
            .then(sortDependingOnOs)
            .then(extractTokensFromTokenObjects)
    }
}


function extractTokensFromTokenObjects(osSortedTokenObjects) {
    return createOsSortedObject(osSortedTokenObjects,
        (osSortedTokenObjects, os) =>
            Object.keys(osSortedTokenObjects[os].reduce(((allTokens, tokenObject) => Object.assign(allTokens, tokenObject)), {})))
}

function createOsSortedObject(tokensObject, callback) {
    return {
        android_en: callback(tokensObject, 'android_en'),
        android_pl: callback(tokensObject, 'android_pl'),
        ios_en: callback(tokensObject, 'ios_en'),
        ios_pl: callback(tokensObject, 'ios_pl')
    };
}

function sendTokens(tokensArr, payload, enPayload, plPayload) {
    !_.isEmpty(tokensArr.ios_pl) && admin.messaging().sendToDevice(tokensArr.ios_pl, plPayload || payload);
    !_.isEmpty(tokensArr.ios_en) && admin.messaging().sendToDevice(tokensArr.ios_en, enPayload || payload);
    !_.isEmpty(tokensArr.android_pl) && admin.messaging().sendToDevice(tokensArr.android_pl, plPayload || payload);
    !_.isEmpty(tokensArr.android_en) && admin.messaging().sendToDevice(tokensArr.android_en, enPayload || payload);
}


function filterNotificationSetting(notifType) {
    return (tokenObjects) =>
        tokenObjects.filter(tokenObject => {
            const tokenSetting = tokenObject[Object.keys(tokenObject)[0]];
            return tokenSetting.notifications.globalSetting && tokenSetting.notifications[notifType]
        })
}


function sortDependingOnOs(tokenObjects) {
    return createOsSortedObject(tokenObjects,
        (tokenObjects, os) => tokenObjects.filter(tokenObject => {
            const tokenSetting = tokenObject[Object.keys(tokenObject)[0]];
            const osDbArr = _.split(tokenSetting.os, '_');
            const osSortArr = _.split(os, '_');

            if (osDbArr[0] === osSortArr[0] && osSortArr[1] === 'en' && osDbArr[1] !== 'pl') {
                return true;
            } else {
                return tokenSetting.os === os;
            }
        }))
}


function extractUserTokens(tokenObjects) {
    return _.flatMap(tokenObjects, userTokens => _.map(userTokens, (setting, token) => {
        return {[token]: setting}
    }))
}

function createPublicMsgPayload(title, body, id) {
    return {
        data: {
            custom_notification: `{
                "body": "${body}",
                "title": "${title}",
                "color":"#00ACD4",
                "priority":"high",
                "group": "GROUP",
                "id": "${id}",
                "show_in_foreground": false
                }
            `
        }

    }
}

const translations = {
    en: {
        friendInvitation: 'Friend invitation'
    },
    pl: {
        friendInvitation: 'Zaproszenie do znajomych'
    }
};


function initNotifSender() {
    initListeners();
}

module.exports = {initNotifSender};