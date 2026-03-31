const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.register = async (req, res) => {
    const { name, email, password, role, roll_no, department, semester } = req.body;

    try {
        if (!['student', 'professor'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, role',
            [name, email, hashedPassword, role]
        );
        
        const userId = result.rows[0].id;

        if (role === 'student') {
            await db.query(
                'INSERT INTO students (user_id, roll_no, department, semester) VALUES ($1, $2, $3, $4)',
                [userId, roll_no, department, semester]
            );
        } else if (role === 'professor') {
            await db.query(
                'INSERT INTO professors (user_id, department) VALUES ($1, $2)',
                [userId, department]
            );
        }

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        if (err.code === '23505') { // unique violation
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.error("Register Error:", err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        let id = user.id;
        let details = null;

        if (user.role === 'student') {
            const studentRes = await db.query('SELECT id FROM students WHERE user_id = $1', [user.id]);
            id = studentRes.rows[0]?.id;
            details = { student_id: id };
        } else if (user.role === 'professor') {
            const profRes = await db.query('SELECT id FROM professors WHERE user_id = $1', [user.id]);
            id = profRes.rows[0]?.id;
            details = { professor_id: id };
        }

        const token = jwt.sign(
            { user_id: user.id, role: user.role, role_id: id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({ token, user: { id: user.id, role_id: id, name: user.name, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
