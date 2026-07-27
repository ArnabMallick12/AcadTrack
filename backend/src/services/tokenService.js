const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const REFRESH_TOKEN_DAYS = 7;

function getRefreshExpiresAt() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
    return expiresAt;
}

function signAccessToken(user, sessionId) {
    return jwt.sign(
        {
            user_id: user.user_id,
            role: user.role,
            role_id: user.role_id,
            session_id: sessionId,
            token_type: 'access',
        },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );
}

function signRefreshToken(user, sessionId) {
    return jwt.sign(
        {
            user_id: user.user_id,
            role: user.role,
            role_id: user.role_id,
            session_id: sessionId,
            token_type: 'refresh',
            jti: uuidv4(),
        },
        process.env.JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
}

async function hashToken(token) {
    return bcrypt.hash(token, 10);
}

async function compareToken(token, hash) {
    return bcrypt.compare(token, hash);
}

module.exports = {
    ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN,
    getRefreshExpiresAt,
    signAccessToken,
    signRefreshToken,
    hashToken,
    compareToken,
};
