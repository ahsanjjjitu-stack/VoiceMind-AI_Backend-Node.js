const express = require("express");
const router = express.Router();
const noteController = require('../controllers/noteController');
const { uploadMulter } = require('../config/cloudinary');
const authMiddleware = require('../middleware/auth');

// ১. আগে সব Specific Routes (যেগুলোর নির্দিষ্ট নাম আছে)
router.post('/upload', authMiddleware, uploadMulter.single('audio'), noteController.uploadAudio);
router.get('/all', authMiddleware, noteController.getAllNotes);

// 🟢 session-by-date অবশ্যই /:id এর উপরে থাকবে!
router.get('/session-by-date', authMiddleware, noteController.getSessionByDate); 

router.put('/update-title/:id', authMiddleware, noteController.updateNoteTitle);
router.delete('/delete-note/:id', authMiddleware, noteController.deleteNote);

// ২. সবার শেষে Dynamic Parameter Routes (/:id)
router.get('/details/:id', authMiddleware, noteController.getNoteDetails);
router.get('/:id', authMiddleware, noteController.getNoteById);

module.exports = router;

