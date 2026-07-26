const db = require('../config/db');

exports.getProfile = async (req, res) => {
    const studentId = req.user.role_id;
    const userId = req.user.user_id;

    try {
        const result = await db.query(
            `SELECT s.id AS student_id, u.name, u.email, s.profile_image_url
             FROM students s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = $1 AND s.user_id = $2`,
            [studentId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student profile not found' });
        }

        const row = result.rows[0];

        res.status(200).json({
            studentId: row.student_id,
            name: row.name,
            email: row.email,
            profileImageUrl: row.profile_image_url || null,
        });
    } catch (err) {
        console.error('Get student profile error:', err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};
