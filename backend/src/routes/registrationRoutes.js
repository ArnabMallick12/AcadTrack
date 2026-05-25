const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const authMiddleware = require('../middlewares/auth');

router.get('/current', authMiddleware(['student']), registrationController.getCurrentRegistration);
router.get('/gradesheets', authMiddleware(['student']), registrationController.getGradeSheets);
router.post('/submit', authMiddleware(['student']), registrationController.submitRegistration);

module.exports = router;
