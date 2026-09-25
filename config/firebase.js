const { initializeApp, cert } = require("firebase-admin/app");
const serviceAccount = require("../serviceAccountKey.json");

const app = initializeApp({
  credential: cert(serviceAccount),
});

module.exports = app;






/*

const { initializeApp, cert } = require("firebase-admin/app");
const serviceAccount = require("../serviceAccountKey.json");

const admin = initializeApp({
  credential: cert(serviceAccount)
});

module.exports = admin;

*/

