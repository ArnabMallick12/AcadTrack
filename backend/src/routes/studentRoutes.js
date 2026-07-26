const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middlewares/auth');

router.get('/profile', authMiddleware(['student']), studentController.getProfile);

module.exports = router;
