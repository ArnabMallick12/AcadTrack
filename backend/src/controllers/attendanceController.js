const db = require('../config/db');

// Start a new session in `attendance_sessions`
exports.startSession = async (req, res) => {
    const { subject_id, latitude, longitude } = req.body;
    const student_id = req.user.role_id;

    // Placeholder logic: Verify location
    // In a real system, diff against a known class coordinate

    try {
        const result = await db.query(
            'INSERT INTO attendance_sessions (student_id, subject_id, start_time, is_valid) VALUES ($1, $2, CURRENT_TIMESTAMP, $3) RETURNING id',
            [student_id, subject_id, true]
        );
        res.status(200).json({ session_id: result.rows[0].id, message: 'Session started' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Ping to keep session active
exports.pingSession = async (req, res) => {
    const { session_id, latitude, longitude } = req.body;
    // Just a heartbeat. We can log pings, but updating end_time suffices.
    try {
        await db.query(
            'UPDATE attendance_sessions SET end_time = CURRENT_TIMESTAMP WHERE id = $1',
            [session_id]
        );
        res.status(200).json({ message: 'Ping recorded' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Complete session & calculate total duration
exports.completeSession = async (req, res) => {
    const { session_id } = req.body;
    const student_id = req.user.role_id;
    const thresholdMinutes = 45; // e.g., require 45 mins

    try {
        const result = await db.query(
            'SELECT subject_id, start_time, end_time FROM attendance_sessions WHERE id = $1',
            [session_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

        const session = result.rows[0];
        const durationMins = (new Date(session.end_time) - new Date(session.start_time)) / 1000 / 60;
        
        let status = 'absent';
        if (durationMins >= thresholdMinutes) {
            status = 'present';
        }

        // Insert into attendance_records
        await db.query(
            'INSERT INTO attendance_records (student_id, subject_id, date, status) VALUES ($1, $2, CURRENT_DATE, $3)',
            [student_id, session.subject_id, status]
        );

        res.status(200).json({ message: `Attendance marked ${status}`, durationMins });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStudentAttendance = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            'SELECT a.*, s.name as subject_name FROM attendance_records a JOIN subjects s ON a.subject_id = s.id WHERE a.student_id = $1 ORDER BY a.date DESC',
            [id]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getSubjectAttendance = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            'SELECT a.*, st.roll_no, u.name as student_name FROM attendance_records a JOIN students st ON a.student_id = st.id JOIN users u ON st.user_id = u.id WHERE a.subject_id = $1 ORDER BY a.date DESC',
            [id]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
