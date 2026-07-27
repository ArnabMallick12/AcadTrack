const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authMiddleware = (roles = []) => {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        const deviceId = req.headers['x-device-id'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }
        if (!deviceId) {
            return res.status(401).json({ error: 'Unauthorized: Device ID is required' });
        }

        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.token_type !== 'access' || !decoded.session_id) {
                return res.status(401).json({ error: 'Unauthorized: Invalid access token' });
            }

            const sessionRes = await db.query(
                `SELECT id, user_id, device_id, is_active, revoked_at, expires_at
                 FROM user_sessions
                 WHERE id = $1 AND user_id = $2`,
                [decoded.session_id, decoded.user_id]
            );
            const session = sessionRes.rows[0];

            if (
                !session ||
                !session.is_active ||
                session.revoked_at ||
                new Date(session.expires_at) <= new Date() ||
                session.device_id !== deviceId
            ) {
                return res.status(401).json({ error: 'Session expired or signed in on another device' });
            }

            req.user = decoded;
            req.user.session_id = decoded.session_id;

            if (roles.length && !roles.includes(decoded.role) && decoded.role !== 'admin') {
                return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            }
            next();
        } catch (err) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
    };
};

module.exports = authMiddleware;
