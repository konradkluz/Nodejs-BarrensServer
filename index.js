const {initializeServer} = require('./server/initialization/serverInitialization');
const {startRemoveRoomTask} = require('./server/roomsRemover');
const {initNotifSender} = require('./server/notifs/notifSender');
const {startRemoveUsersTask} = require('./server/usersInRoomRemover');
const {startKeepAwakeTask} = require('./server/herokuAwaker');

// initializeServer();
// startRemoveRoomTask();
initNotifSender();

initializeServer();
startRemoveRoomTask();
startRemoveUsersTask();

startKeepAwakeTask();


