require('dotenv').config();
const db = require('./src/config/db');
const { buildAttendanceIntegrityHash } = require('./src/services/attendanceSecurity');

async function migrate() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                device_id TEXT NOT NULL,
                refresh_token_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                revoked_at TIMESTAMP
            )
        `);

        await db.query(`
            ALTER TABLE user_sessions
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
        `);

        await db.query(`
            UPDATE user_sessions
            SET is_active = CASE
                WHEN revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP THEN TRUE
                ELSE FALSE
            END
        `);

        await db.query('DROP INDEX IF EXISTS idx_user_sessions_user_active');

        await db.query(`
            CREATE INDEX idx_user_sessions_user_active
            ON user_sessions(user_id)
            WHERE is_active = TRUE
        `);


        await db.query(`
            CREATE TABLE IF NOT EXISTS attendance_signing_keys (
                id UUID PRIMARY KEY,
                user_session_id INT REFERENCES user_sessions(id) ON DELETE CASCADE,
                student_id INT REFERENCES students(id) ON DELETE CASCADE,
                key_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                revoked_at TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS attendance_nonces (
                nonce VARCHAR(120) PRIMARY KEY,
                user_session_id INT REFERENCES user_sessions(id) ON DELETE CASCADE,
                student_id INT REFERENCES students(id) ON DELETE CASCADE,
                action VARCHAR(30) NOT NULL,
                packet_timestamp TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            ALTER TABLE attendance_records
            ADD COLUMN IF NOT EXISTS integrity_hash TEXT
        `);

        const attendanceRows = await db.query(`
            SELECT id, student_id, subject_id, date, status
            FROM attendance_records
            WHERE integrity_hash IS NULL
        `);

        for (const row of attendanceRows.rows) {
            const integrityHash = buildAttendanceIntegrityHash({
                studentId: row.student_id,
                subjectId: row.subject_id,
                date: row.date,
                status: row.status,
            });
            await db.query(
                'UPDATE attendance_records SET integrity_hash = $1 WHERE id = $2',
                [integrityHash, row.id]
            );
        }
        console.log(`Backfilled attendance integrity hashes: ${attendanceRows.rowCount}`);
        console.log('Session system migration completed');
        process.exit(0);
    } catch (err) {
        console.error('Session system migration failed:', err);
        process.exit(1);
    }
}

migrate();
