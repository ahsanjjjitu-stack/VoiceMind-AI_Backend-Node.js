const { getMessaging } = require("firebase-admin/messaging");
const app = require('../config/firebase');

const sendPushNotification = async (fcmToken, title, body, dataPayload = {}) => {
    if (!fcmToken) {
        console.log("FCM token missing, skipping notification.");
        return;
    }

    const message = {
        token: fcmToken,
        data: {
            title: title,
            body: body,
            ...dataPayload,   // noteId, status ityadi
        },
        android: {
            priority: 'high',   // killed state e-o taratari pouchanor jonom
        },
    };

    try {
        const response = await getMessaging(app).send(message);
        console.log('Notification sent successfully:', response);
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};

module.exports = sendPushNotification;














/*


const admin = require('../config/firebase');

const sendPushNotification = async (fcmToken, title, body, dataPayload = {}) => {

    if (!fcmToken) {
        console.log("FCM token missing, skipping notification.");
        return;
    }

    // 🟢 message অবজেক্টে token টা দিয়ে দিতে হবে
    const message = {
        token: fcmToken,
        notification: {
            title: title,
            body: body,
        },
        data: dataPayload,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Notification sent successfully:', response);
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};

module.exports = sendPushNotification;



*/