const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.post('/create', authMiddleware(['professor']), assignmentController.createAssignment);
router.post('/submit', authMiddleware(['student']), upload.single('file'), assignmentController.submitAssignment);
router.get('/:id/submissions', authMiddleware(['professor']), assignmentController.getSubmissions);

module.exports = router;
