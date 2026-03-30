const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const authMiddleware = require('../middlewares/auth');

router.post('/create', authMiddleware(['professor']), quizController.createQuiz);
router.get('/:id', authMiddleware(['student', 'professor']), quizController.getQuiz);
router.post('/submit', authMiddleware(['student']), quizController.submitQuiz);
router.post('/violation', authMiddleware(['student']), quizController.recordViolation);
router.get('/subject/:id', authMiddleware(['professor', 'student']), quizController.getSubjectQuizzes);

module.exports = router;
