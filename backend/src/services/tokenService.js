const crypto = require('crypto');
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
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN, algorithm: 'HS256' }
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
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN, algorithm: 'HS256' }
    );
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function compareToken(token, hash) {
    const tokenHash = hashToken(token);
    const left = Buffer.from(tokenHash, 'hex');
    const right = Buffer.from(hash || '', 'hex');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
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
