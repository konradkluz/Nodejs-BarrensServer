const admin = require("firebase-admin");
const serviceAccount = require("");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://rectus2-66ec5.firebaseio.com"
});

const db = admin.database();

module.exports = {db};
