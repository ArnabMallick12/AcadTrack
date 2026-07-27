const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const SIGNING_KEY_TTL_MINUTES = Number(process.env.ATTENDANCE_SIGNING_KEY_TTL_MINUTES || 10);
const PACKET_FRESHNESS_SECONDS = Number(process.env.ATTENDANCE_PACKET_FRESHNESS_SECONDS || 120);

function sha256(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hmacSha256(key, value) {
    return crypto.createHmac('sha256', key).update(value).digest('hex');
}

function timingSafeHexEqual(left, right) {
    if (!left || !right || left.length !== right.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
    } catch {
        return false;
    }
}

function normalizeCoordinate(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n.toFixed(6);
}

function buildAttendancePacket({ action, studentId, sessionId, latitude, longitude, timestamp, nonce }) {
    return JSON.stringify({
        action: String(action),
        studentId: String(studentId),
        sessionId: String(sessionId),
        gps: {
            latitude: normalizeCoordinate(latitude),
            longitude: normalizeCoordinate(longitude),
        },
        timestamp: new Date(timestamp).toISOString(),
        nonce: String(nonce),
    });
}

function deriveSigningKey({ keyId, userSessionId, studentId }) {
    return hmacSha256(
        process.env.JWT_SECRET,
        `attendance-signing-key|${keyId}|${userSessionId}|${studentId}`
    );
}

function getSigningKeyExpiry() {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + SIGNING_KEY_TTL_MINUTES);
    return expiresAt;
}

function createSigningKeyPayload({ userSessionId, studentId }) {
    const keyId = uuidv4();
    const signingKey = deriveSigningKey({ keyId, userSessionId, studentId });
    return {
        keyId,
        signingKey,
        keyHash: sha256(signingKey),
        expiresAt: getSigningKeyExpiry(),
    };
}

function buildAttendanceIntegrityHash({ studentId, subjectId, date, status }) {
    const normalizedDate = new Date(date).toISOString().slice(0, 10);
    return sha256(`attendance-record|${studentId}|${subjectId}|${normalizedDate}|${status}`);
}

async function issueAttendanceSigningKey(db, user) {
    const payload = createSigningKeyPayload({
        userSessionId: user.session_id,
        studentId: user.role_id,
    });

    await db.query(
        `INSERT INTO attendance_signing_keys (id, user_session_id, student_id, key_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [payload.keyId, user.session_id, user.role_id, payload.keyHash, payload.expiresAt]
    );

    return {
        key_id: payload.keyId,
        signing_key: payload.signingKey,
        expires_at: payload.expiresAt,
        packet_freshness_seconds: PACKET_FRESHNESS_SECONDS,
    };
}

async function verifyAttendancePacket(db, req, { action, sessionId, latitude, longitude }) {
    const signaturePayload = req.body?.attendance_signature;
    if (!signaturePayload) {
        return { ok: false, status: 400, error: 'Missing attendance signature' };
    }

    const { key_id, timestamp, nonce, signature } = signaturePayload;
    if (!key_id || !timestamp || !nonce || !signature) {
        return { ok: false, status: 400, error: 'Incomplete attendance signature' };
    }

    const packetTime = new Date(timestamp);
    if (!Number.isFinite(packetTime.getTime())) {
        return { ok: false, status: 400, error: 'Invalid attendance signature timestamp' };
    }

    const ageSeconds = Math.abs(Date.now() - packetTime.getTime()) / 1000;
    if (ageSeconds > PACKET_FRESHNESS_SECONDS) {
        return { ok: false, status: 401, error: 'Attendance packet expired' };
    }

    const keyRes = await db.query(
        `SELECT id, user_session_id, student_id, key_hash, expires_at, revoked_at
         FROM attendance_signing_keys
         WHERE id = $1 AND user_session_id = $2 AND student_id = $3`,
        [key_id, req.user.session_id, req.user.role_id]
    );
    const keyRow = keyRes.rows[0];
    if (!keyRow || keyRow.revoked_at || new Date(keyRow.expires_at) <= new Date()) {
        return { ok: false, status: 401, error: 'Attendance signing key expired' };
    }

    const signingKey = deriveSigningKey({
        keyId: key_id,
        userSessionId: req.user.session_id,
        studentId: req.user.role_id,
    });
    if (sha256(signingKey) !== keyRow.key_hash) {
        return { ok: false, status: 401, error: 'Attendance signing key mismatch' };
    }

    const packet = buildAttendancePacket({
        action,
        studentId: req.user.role_id,
        sessionId,
        latitude,
        longitude,
        timestamp,
        nonce,
    });
    const expectedSignature = hmacSha256(signingKey, packet);
    if (!timingSafeHexEqual(expectedSignature, signature)) {
        return { ok: false, status: 401, error: 'Invalid attendance packet signature' };
    }

    try {
        await db.query(
            `INSERT INTO attendance_nonces (nonce, user_session_id, student_id, action, packet_timestamp)
             VALUES ($1, $2, $3, $4, $5)`,
            [nonce, req.user.session_id, req.user.role_id, action, packetTime]
        );
    } catch (err) {
        if (err.code === '23505') {
            return { ok: false, status: 409, error: 'Replay detected: attendance nonce already used' };
        }
        throw err;
    }

    return { ok: true };
}

module.exports = {
    buildAttendanceIntegrityHash,
    issueAttendanceSigningKey,
    sha256,
    verifyAttendancePacket,
};
