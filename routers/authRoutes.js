const express = require("express");
const router = express.Router();
const { googleSignIn, updateFcmToken, getProfile, toggleNotification } = require("../controllers/authController");
const authMiddleware = require('../middleware/auth');


router.post("/google", googleSignIn);
router.post("/token", authMiddleware, updateFcmToken);


router.get('/profile', authMiddleware, getProfile);
router.patch('/toggle-notification', authMiddleware, toggleNotification);


module.exports = router;

