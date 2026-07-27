const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const {
    ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN,
    compareToken,
    getRefreshExpiresAt,
    hashToken,
    signAccessToken,
    signRefreshToken,
} = require('../services/tokenService');

async function getRoleProfile(user) {
    let roleId = user.id;

    if (user.role === 'student') {
        const studentRes = await db.query('SELECT id FROM students WHERE user_id = $1', [user.id]);
        if (studentRes.rows.length === 0) {
            throw new Error('Student profile is missing for this account');
        }
        roleId = studentRes.rows[0].id;
    } else if (user.role === 'professor') {
        const profRes = await db.query('SELECT id FROM professors WHERE user_id = $1', [user.id]);
        if (profRes.rows.length === 0) {
            throw new Error('Professor profile is missing for this account');
        }
        roleId = profRes.rows[0].id;
    } else if (user.role === 'admin') {
        const adminRes = await db.query('SELECT id FROM admins WHERE user_id = $1', [user.id]);
        if (adminRes.rows.length === 0) {
            throw new Error('Admin profile is missing for this account');
        }
        roleId = adminRes.rows[0].id;
    }

    return {
        user_id: user.id,
        role_id: roleId,
        role: user.role,
        name: user.name,
    };
}

function getDeviceId(req) {
    return req.body?.device_id || req.headers['x-device-id'];
}

function sendTokenResponse(res, user, accessToken, refreshToken) {
    return res.status(200).json({
        access_token: accessToken,
        refresh_token: refreshToken,
        access_token_expires_in: ACCESS_TOKEN_EXPIRES_IN,
        refresh_token_expires_in: REFRESH_TOKEN_EXPIRES_IN,
        // Keep token for older frontend call sites while the app migrates.
        token: accessToken,
        user: { id: user.user_id, role_id: user.role_id, name: user.name, role: user.role },
    });
}

exports.register = async (req, res) => {
    const { name, email, password, role, roll_no, department, semester } = req.body;

    try {
        if (!['student', 'professor', 'admin'].includes(role)) {
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
        } else if (role === 'admin') {
            await db.query(
                'INSERT INTO admins (user_id, department) VALUES ($1, $2)',
                [userId, department || 'ALL']
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
    const email = req.body?.email?.trim();
    const password = req.body?.password;
    const deviceId = getDeviceId(req);
    const forceLogin = Boolean(req.body?.force_login);

    try {
        console.log('[login] attempt', { email, forceLogin });
        if (!email || !password) {
            console.log('[login] missing_fields', { emailPresent: Boolean(email), passwordPresent: Boolean(password) });
            return res.status(400).json({ error: 'Email and password are required' });
        }
        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID is required' });
        }

        const result = await db.query(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );
        if (result.rows.length === 0) {
            console.log('[login] user_not_found', { email });
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            console.log('[login] invalid_password', { email, user_id: user.id, role: user.role });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const tokenUser = await getRoleProfile(user);
        const client = await db.getClient();

        try {
            await client.query('BEGIN');
            await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);

            const activeSessionRes = await client.query(
                `SELECT id, device_id
                 FROM user_sessions
                 WHERE user_id = $1
                   AND is_active = TRUE
                   AND revoked_at IS NULL
                   AND expires_at > CURRENT_TIMESTAMP
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [user.id]
            );
            const activeSession = activeSessionRes.rows[0];

            if (activeSession && activeSession.device_id !== deviceId) {
                if (!forceLogin) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({
                        code: 'SESSION_CONFLICT',
                        error: 'This account is already signed in on another device. Please log out there first.'
                    });
                }

                await client.query(
                    `UPDATE user_sessions
                     SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP
                     WHERE user_id = $1
                       AND is_active = TRUE
                       AND revoked_at IS NULL`,
                    [user.id]
                );
            }

            await client.query(
                `UPDATE user_sessions
                 SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1
                   AND device_id = $2
                   AND revoked_at IS NULL`,
                [user.id, deviceId]
            );

            const sessionRes = await client.query(
                `INSERT INTO user_sessions (user_id, device_id, refresh_token_hash, expires_at, is_active)
                 VALUES ($1, $2, '', $3, TRUE)
                 RETURNING id`,
                [user.id, deviceId, getRefreshExpiresAt()]
            );
            const sessionId = sessionRes.rows[0].id;
            const accessToken = signAccessToken(tokenUser, sessionId);
            const refreshToken = signRefreshToken(tokenUser, sessionId);
            const refreshTokenHash = await hashToken(refreshToken);

            await client.query(
                `UPDATE user_sessions
                 SET refresh_token_hash = $1
                 WHERE id = $2`,
                [refreshTokenHash, sessionId]
            );
            await client.query('COMMIT');

            console.log('[login] success', { email, user_id: user.id, role: user.role, role_id: tokenUser.role_id, session_id: sessionId });

            return sendTokenResponse(res, tokenUser, accessToken, refreshToken);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('[login] server_error', { email, message: err.message });
        console.error(err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
};

exports.refresh = async (req, res) => {
    const refreshToken = req.body?.refresh_token;
    const deviceId = getDeviceId(req);

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }
    if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        if (decoded.token_type !== 'refresh' || !decoded.session_id) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const sessionRes = await db.query(
            `SELECT id, user_id, device_id, refresh_token_hash, is_active, revoked_at, expires_at
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

        const refreshMatches = await compareToken(refreshToken, session.refresh_token_hash);
        if (!refreshMatches) {
            await db.query(
                'UPDATE user_sessions SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP WHERE id = $1',
                [session.id]
            );
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const userRes = await db.query('SELECT id, name, role FROM users WHERE id = $1', [decoded.user_id]);
        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const tokenUser = await getRoleProfile(userRes.rows[0]);
        const accessToken = signAccessToken(tokenUser, session.id);
        const newRefreshToken = signRefreshToken(tokenUser, session.id);
        const refreshTokenHash = await hashToken(newRefreshToken);

        await db.query(
            `UPDATE user_sessions
             SET refresh_token_hash = $1,
                 is_active = TRUE,
                 last_seen_at = CURRENT_TIMESTAMP,
                 expires_at = $2
             WHERE id = $3`,
            [refreshTokenHash, getRefreshExpiresAt(), session.id]
        );

        return sendTokenResponse(res, tokenUser, accessToken, newRefreshToken);
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
};

exports.logout = async (req, res) => {
    const refreshToken = req.body?.refresh_token;

    try {
        if (refreshToken) {
            const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
            if (decoded.session_id) {
                await db.query(
                    'UPDATE user_sessions SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [decoded.session_id]
                );
            }
        } else if (req.user?.session_id) {
            await db.query(
                'UPDATE user_sessions SET is_active = FALSE, revoked_at = CURRENT_TIMESTAMP WHERE id = $1',
                [req.user.session_id]
            );
        }
    } catch {
        // Logging out should be idempotent from the user's point of view.
    }

    res.status(200).json({ message: 'Logged out successfully' });
};
