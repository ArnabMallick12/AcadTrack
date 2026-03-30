const db = require('../config/db');

exports.uploadMarks = async (req, res) => {
    const { subject_id, exam_type, max_marks, marks } = req.body;
    // marks is an array: [{ student_id, marks_obtained }, ...]

    try {
        await db.query('BEGIN');
        const examRes = await db.query(
            'INSERT INTO exams (subject_id, exam_type, max_marks) VALUES ($1, $2, $3) RETURNING id',
            [subject_id, exam_type, max_marks]
        );
        const exam_id = examRes.rows[0].id;

        for (const m of marks) {
            await db.query(
                `INSERT INTO marks (student_id, exam_id, marks_obtained) VALUES ($1, $2, $3)`,
                [m.student_id, exam_id, m.marks_obtained]
            );
        }
        await db.query('COMMIT');

        res.status(201).json({ message: 'Marks uploaded successfully', exam_id });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStudentMarks = async (req, res) => {
    const { id } = req.params; // student_id
    try {
        const result = await db.query(
            `SELECT m.marks_obtained, e.exam_type, e.max_marks, s.name as subject_name 
             FROM marks m 
             JOIN exams e ON m.exam_id = e.id 
             JOIN subjects s ON e.subject_id = s.id 
             WHERE m.student_id = $1`,
            [id]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getSubjectMarks = async (req, res) => {
    const { id } = req.params; // subject_id
    try {
        const result = await db.query(
            `SELECT m.student_id, m.marks_obtained, e.exam_type, e.max_marks, st.roll_no, u.name as student_name
             FROM marks m
             JOIN exams e ON m.exam_id = e.id
             JOIN students st ON m.student_id = st.id
             JOIN users u ON st.user_id = u.id
             WHERE e.subject_id = $1`,
            [id]
        );

        // Calculate analytics per exam_type
        const marks_data = result.rows;
        const analytics = {};

        marks_data.forEach(m => {
            if (!analytics[m.exam_type]) {
                analytics[m.exam_type] = { total: 0, count: 0, max: -Infinity, min: Infinity, max_marks: m.max_marks };
            }
            analytics[m.exam_type].total += m.marks_obtained;
            analytics[m.exam_type].count += 1;
            if (m.marks_obtained > analytics[m.exam_type].max) analytics[m.exam_type].max = m.marks_obtained;
            if (m.marks_obtained < analytics[m.exam_type].min) analytics[m.exam_type].min = m.marks_obtained;
        });

        for (const type in analytics) {
            analytics[type].avg = analytics[type].total / analytics[type].count;
        }

        res.status(200).json({ marks: marks_data, analytics });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
