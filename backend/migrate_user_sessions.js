require('dotenv').config();
const db = require('./src/config/db');

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

        console.log('Session system migration completed');
        process.exit(0);
    } catch (err) {
        console.error('Session system migration failed:', err);
        process.exit(1);
    }
}

migrate();
