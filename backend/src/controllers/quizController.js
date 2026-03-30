const db = require('../config/db');

exports.createQuiz = async (req, res) => {
    const { subject_id, title, duration, start_time, end_time, questions } = req.body;
    // questions is an array of objects: { question, option_a, option_b, option_c, option_d, correct_answer }

    try {
        await db.query('BEGIN');
        const quizRes = await db.query(
            'INSERT INTO quizzes (subject_id, title, duration, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [subject_id, title, duration, start_time, end_time]
        );
        const quiz_id = quizRes.rows[0].id;

        for (const q of questions) {
            await db.query(
                `INSERT INTO questions (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [quiz_id, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer]
            );
        }
        await db.query('COMMIT');

        res.status(201).json({ message: 'Quiz created successfully', quiz_id });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getQuiz = async (req, res) => {
    const { id } = req.params;
    try {
        const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1', [id]);
        if (quizRes.rows.length === 0) return res.status(404).json({ error: 'Quiz not found' });
        
        let questionsRes;
        if (req.user.role === 'student') {
            // omit correct_answer for students
            questionsRes = await db.query(
                'SELECT id, question, option_a, option_b, option_c, option_d FROM questions WHERE quiz_id = $1',
                [id]
            );
        } else {
            questionsRes = await db.query('SELECT * FROM questions WHERE quiz_id = $1', [id]);
        }

        res.status(200).json({ ...quizRes.rows[0], questions: questionsRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.submitQuiz = async (req, res) => {
    const { quiz_id, answers } = req.body; // answers: { question_id: 'A', ... }
    const student_id = req.user.role_id;

    try {
        // Evaluate score
        const questionsRes = await db.query('SELECT id, correct_answer FROM questions WHERE quiz_id = $1', [quiz_id]);
        const correctAnswersMap = {};
        questionsRes.rows.forEach(q => { correctAnswersMap[q.id] = q.correct_answer; });

        let score = 0;
        for (const qId in answers) {
            if (answers[qId] === correctAnswersMap[Number(qId)]) {
                score++;
            }
        }

        await db.query('BEGIN');
        const submissionRes = await db.query(
            'INSERT INTO quiz_submissions (student_id, quiz_id, score, submitted_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id',
            [student_id, quiz_id, score]
        );
        const submission_id = submissionRes.rows[0].id;

        for (const qId in answers) {
            await db.query(
                'INSERT INTO quiz_answers (submission_id, question_id, selected_option) VALUES ($1, $2, $3)',
                [submission_id, qId, answers[qId]]
            );
        }
        await db.query('COMMIT');

        res.status(200).json({ message: 'Quiz submitted successfully', score });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.recordViolation = async (req, res) => {
    const { quiz_id, type } = req.body;
    const student_id = req.user.role_id;

    try {
        await db.query(
            'INSERT INTO quiz_violations (student_id, quiz_id, type) VALUES ($1, $2, $3)',
            [student_id, quiz_id, type]
        );
        
        // Count violations
        const viRes = await db.query(
            'SELECT COUNT(*) FROM quiz_violations WHERE student_id = $1 AND quiz_id = $2',
            [student_id, quiz_id]
        );
        const count = parseInt(viRes.rows[0].count, 10);
        
        let autoSubmit = false;
        if (count >= 3) {
            autoSubmit = true;
        }

        res.status(200).json({ message: 'Violation recorded', violations_count: count, auto_submit: autoSubmit });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getSubjectQuizzes = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM quizzes WHERE subject_id = $1 ORDER BY start_time DESC', [id]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
