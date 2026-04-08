import asyncpg
import json
import os
from typing import Optional
from datetime import datetime, date

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/insightsphere")

# ─── Owner config ─────────────────────────────────────────────────────────────
# Add your Telegram user_id here — owners always have unlimited Premium for free.
# To find your ID: message @userinfobot in Telegram.
# Multiple owners: OWNER_IDS = "123456789,987654321"
_raw = os.getenv("OWNER_IDS", "")
OWNER_IDS: set = {int(x.strip()) for x in _raw.split(",") if x.strip().isdigit()}


class Database:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        self.pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        await self._init_tables()

    async def disconnect(self):
        if self.pool:
            await self.pool.close()

    async def _init_tables(self):
        async with self.pool.acquire() as conn:
            # ── Users ────────────────────────────────────────────────────────
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    user_id             BIGINT PRIMARY KEY,
                    username            TEXT,
                    language            TEXT        DEFAULT 'uk',
                    conversation        JSONB       DEFAULT '[]'::jsonb,
                    profile             JSONB       DEFAULT NULL,
                    onboarding_step     INTEGER     DEFAULT 0,
                    resistant_count     INTEGER     DEFAULT 0,

                    -- Scheduling
                    daily_enabled       BOOLEAN     DEFAULT TRUE,
                    daily_hour          INTEGER     DEFAULT 8,

                    -- Premium
                    is_premium          BOOLEAN     DEFAULT FALSE,
                    premium_since       TIMESTAMPTZ DEFAULT NULL,
                    stars_total         INTEGER     DEFAULT 0,

                    -- Usage
                    reports_today       INTEGER     DEFAULT 0,
                    reports_date        DATE        DEFAULT CURRENT_DATE,
                    last_report_at      TIMESTAMPTZ DEFAULT NULL,
                    last_weekly_at      TIMESTAMPTZ DEFAULT NULL,
                    weekly_topics       JSONB       DEFAULT '[]'::jsonb,

                    -- Gamification
                    level               INTEGER     DEFAULT 1,
                    xp                  INTEGER     DEFAULT 0,
                    streak_days         INTEGER     DEFAULT 0,
                    last_active_date    DATE        DEFAULT CURRENT_DATE,
                    achievements        JSONB       DEFAULT '[]'::jsonb,
                    active_challenges   JSONB       DEFAULT '[]'::jsonb,

                    -- Focus sessions
                    focus_sessions_week INTEGER     DEFAULT 0,
                    focus_week_start    DATE        DEFAULT CURRENT_DATE,

                    created_at          TIMESTAMPTZ DEFAULT NOW(),
                    updated_at          TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            # ── Reports ──────────────────────────────────────────────────────
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS reports (
                    id          SERIAL PRIMARY KEY,
                    user_id     BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                    content     TEXT NOT NULL,
                    topic       TEXT,
                    depth       TEXT DEFAULT 'medium',
                    created_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            # ── Payments ─────────────────────────────────────────────────────
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS payments (
                    id                  SERIAL PRIMARY KEY,
                    user_id             BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                    telegram_charge_id  TEXT,
                    stars_amount        INTEGER NOT NULL,
                    payload             TEXT,
                    created_at          TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            # ── Habits ───────────────────────────────────────────────────────
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS habits (
                    id          SERIAL PRIMARY KEY,
                    user_id     BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                    name        TEXT NOT NULL,
                    description TEXT,
                    frequency   TEXT DEFAULT 'daily',
                    is_active   BOOLEAN DEFAULT TRUE,
                    streak      INTEGER DEFAULT 0,
                    best_streak INTEGER DEFAULT 0,
                    created_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            # ── Habit logs ───────────────────────────────────────────────────
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS habit_logs (
                    id          SERIAL PRIMARY KEY,
                    habit_id    INTEGER REFERENCES habits(id) ON DELETE CASCADE,
                    user_id     BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                    logged_date DATE DEFAULT CURRENT_DATE,
                    note        TEXT,
                    created_at  TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(habit_id, logged_date)
                )
            """)

            # ── Focus sessions ───────────────────────────────────────────────
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS focus_sessions (
                    id          SERIAL PRIMARY KEY,
                    user_id     BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
                    goal        TEXT,
                    duration_min INTEGER DEFAULT 15,
                    completed   BOOLEAN DEFAULT FALSE,
                    summary     TEXT,
                    created_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            # Indexes
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
                CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);
                CREATE INDEX IF NOT EXISTS idx_habit_logs_user ON habit_logs(user_id);
                CREATE INDEX IF NOT EXISTS idx_focus_user ON focus_sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
                CREATE INDEX IF NOT EXISTS idx_users_daily ON users(daily_enabled, daily_hour);
            """)

    # ─── Core ────────────────────────────────────────────────

    async def ensure_user(self, user_id: int, username: str = None):
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO users (user_id, username)
                VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username
            """, user_id, username)

    async def reset_user(self, user_id: int):
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE users SET
                    conversation = '[]'::jsonb, profile = NULL,
                    onboarding_step = 0, resistant_count = 0, language = 'uk',
                    reports_today = 0, weekly_topics = '[]'::jsonb,
                    level = 1, xp = 0, streak_days = 0,
                    achievements = '[]'::jsonb, active_challenges = '[]'::jsonb,
                    focus_sessions_week = 0, updated_at = NOW()
                WHERE user_id = $1
            """, user_id)

    async def get_user_full(self, user_id: int) -> Optional[dict]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM users WHERE user_id=$1", user_id)
        return dict(row) if row else None

    # ─── Language ─────────────────────────────────────────────

    async def save_language(self, user_id: int, lang: str):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE users SET language=$1 WHERE user_id=$2", lang, user_id)

    async def get_language(self, user_id: int) -> str:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT language FROM users WHERE user_id=$1", user_id)
        return row["language"] if row else "uk"

    # ─── Conversation ─────────────────────────────────────────

    async def get_conversation(self, user_id: int) -> list:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT conversation FROM users WHERE user_id=$1", user_id)
        return list(row["conversation"]) if row and row["conversation"] else []

    async def save_conversation(self, user_id: int, history: list):
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE users SET conversation=$1::jsonb, updated_at=NOW() WHERE user_id=$2
            """, json.dumps(history), user_id)

    # ─── Profile ──────────────────────────────────────────────

    async def get_profile(self, user_id: int) -> Optional[dict]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT profile FROM users WHERE user_id=$1", user_id)
        return dict(row["profile"]) if row and row["profile"] else None

    async def save_profile(self, user_id: int, profile: dict):
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE users SET profile=$1::jsonb, updated_at=NOW() WHERE user_id=$2
            """, json.dumps(profile), user_id)

    # ─── Onboarding ───────────────────────────────────────────

    async def get_onboarding_step(self, user_id: int) -> int:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT onboarding_step FROM users WHERE user_id=$1", user_id)
        return row["onboarding_step"] if row else 0

    async def increment_onboarding_step(self, user_id: int):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE users SET onboarding_step=onboarding_step+1 WHERE user_id=$1", user_id)

    async def get_resistant_count(self, user_id: int) -> int:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT resistant_count FROM users WHERE user_id=$1", user_id)
        return row["resistant_count"] if row else 0

    async def increment_resistant(self, user_id: int):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE users SET resistant_count=resistant_count+1 WHERE user_id=$1", user_id)

    async def reset_resistant(self, user_id: int):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE users SET resistant_count=0 WHERE user_id=$1", user_id)

    # ─── Premium ──────────────────────────────────────────────

    async def set_premium(self, user_id: int, stars: int, charge_id: str, payload: str):
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE users SET is_premium=TRUE,
                    premium_since=COALESCE(premium_since, NOW()),
                    stars_total=stars_total+$2, updated_at=NOW()
                WHERE user_id=$1
            """, user_id, stars)
            await conn.execute("""
                INSERT INTO payments (user_id, telegram_charge_id, stars_amount, payload)
                VALUES ($1,$2,$3,$4)
            """, user_id, charge_id, stars, payload)

    async def is_premium(self, user_id: int) -> bool:
        # Owners always have Premium for free
        if user_id in OWNER_IDS:
            return True
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT is_premium FROM users WHERE user_id=$1", user_id)
        return row["is_premium"] if row else False

    # ─── Reports & usage ──────────────────────────────────────

    async def check_daily_limit(self, user_id: int) -> tuple[int, bool]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT reports_today, reports_date, is_premium FROM users WHERE user_id=$1
            """, user_id)
        if not row or row["is_premium"] or user_id in OWNER_IDS:
            return 0, False
        if row["reports_date"] != date.today():
            async with self.pool.acquire() as conn:
                await conn.execute("UPDATE users SET reports_today=0, reports_date=CURRENT_DATE WHERE user_id=$1", user_id)
            return 0, False
        return row["reports_today"], row["reports_today"] >= 1

    async def increment_reports_today(self, user_id: int):
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE users SET
                    reports_today=CASE WHEN reports_date=CURRENT_DATE THEN reports_today+1 ELSE 1 END,
                    reports_date=CURRENT_DATE, last_report_at=NOW()
                WHERE user_id=$1
            """, user_id)

    async def save_report(self, user_id: int, content: str, topic: str = None, depth: str = "medium"):
        async with self.pool.acquire() as conn:
            await conn.execute("INSERT INTO reports (user_id,content,topic,depth) VALUES ($1,$2,$3,$4)",
                               user_id, content, topic, depth)

    async def get_report_history(self, user_id: int, is_premium: bool = False) -> list:
        limit = 30 if is_premium else 5
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT topic, depth, created_at FROM reports
                WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2
            """, user_id, limit)
        return [dict(r) for r in rows]

    async def get_last_report(self, user_id: int) -> Optional[dict]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT content, topic, depth, created_at FROM reports
                WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1
            """, user_id)
        return dict(row) if row else None

    # ─── Gamification ─────────────────────────────────────────

    async def add_xp(self, user_id: int, xp: int) -> dict:
        """Add XP and check for level up. Returns {leveled_up, new_level, total_xp}"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT xp, level FROM users WHERE user_id=$1", user_id)
            if not row:
                return {"leveled_up": False, "new_level": 1, "total_xp": 0}

            old_level = row["level"]
            new_xp = row["xp"] + xp
            # Level formula: level = 1 + xp // 100
            new_level = 1 + new_xp // 100

            await conn.execute("""
                UPDATE users SET xp=$1, level=$2, updated_at=NOW() WHERE user_id=$3
            """, new_xp, new_level, user_id)

        return {"leveled_up": new_level > old_level, "new_level": new_level, "total_xp": new_xp}

    async def update_streak(self, user_id: int) -> dict:
        """Update streak. Returns {streak_days, milestone_hit}"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT streak_days, last_active_date FROM users WHERE user_id=$1", user_id)
            if not row:
                return {"streak_days": 0, "milestone_hit": None}

            today = date.today()
            last = row["last_active_date"]
            streak = row["streak_days"]

            if last == today:
                return {"streak_days": streak, "milestone_hit": None}
            elif last and (today - last).days == 1:
                streak += 1
            else:
                streak = 1

            await conn.execute("""
                UPDATE users SET streak_days=$1, last_active_date=$2 WHERE user_id=$3
            """, streak, today, user_id)

        milestone = streak if streak in (7, 30, 100) else None
        return {"streak_days": streak, "milestone_hit": milestone}

    async def grant_achievement(self, user_id: int, achievement_id: str) -> bool:
        """Grant achievement if not already granted. Returns True if new."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT achievements FROM users WHERE user_id=$1", user_id)
            achievements = list(row["achievements"]) if row and row["achievements"] else []
            if achievement_id in achievements:
                return False
            achievements.append(achievement_id)
            await conn.execute("""
                UPDATE users SET achievements=$1::jsonb WHERE user_id=$2
            """, json.dumps(achievements), user_id)
        return True

    async def get_gamification_status(self, user_id: int) -> dict:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT level, xp, streak_days, achievements, active_challenges
                FROM users WHERE user_id=$1
            """, user_id)
        if not row:
            return {"level": 1, "xp": 0, "streak_days": 0, "achievements": [], "active_challenges": []}
        return {
            "level": row["level"],
            "xp": row["xp"],
            "streak_days": row["streak_days"],
            "achievements": list(row["achievements"] or []),
            "active_challenges": list(row["active_challenges"] or []),
        }

    # ─── Habits ───────────────────────────────────────────────

    async def get_habits(self, user_id: int, active_only: bool = True) -> list:
        async with self.pool.acquire() as conn:
            if active_only:
                rows = await conn.fetch("SELECT * FROM habits WHERE user_id=$1 AND is_active=TRUE", user_id)
            else:
                rows = await conn.fetch("SELECT * FROM habits WHERE user_id=$1", user_id)
        return [dict(r) for r in rows]

    async def count_active_habits(self, user_id: int) -> int:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT COUNT(*) as c FROM habits WHERE user_id=$1 AND is_active=TRUE", user_id)
        return row["c"] if row else 0

    async def add_habit(self, user_id: int, name: str, description: str = "", frequency: str = "daily") -> int:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO habits (user_id, name, description, frequency)
                VALUES ($1,$2,$3,$4) RETURNING id
            """, user_id, name, description, frequency)
        return row["id"]

    async def log_habit(self, habit_id: int, user_id: int, note: str = "") -> bool:
        """Log habit completion for today. Returns True if new log."""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO habit_logs (habit_id, user_id, note)
                    VALUES ($1,$2,$3)
                    ON CONFLICT (habit_id, logged_date) DO NOTHING
                """, habit_id, user_id, note)
                # Update streak
                logs = await conn.fetch("""
                    SELECT logged_date FROM habit_logs WHERE habit_id=$1
                    ORDER BY logged_date DESC LIMIT 2
                """, habit_id)
                streak = 1
                if len(logs) >= 2:
                    delta = (logs[0]["logged_date"] - logs[1]["logged_date"]).days
                    if delta == 1:
                        # Get current streak from habits table
                        hab = await conn.fetchrow("SELECT streak FROM habits WHERE id=$1", habit_id)
                        streak = (hab["streak"] or 0) + 1
                await conn.execute("""
                    UPDATE habits SET streak=$1, best_streak=GREATEST(best_streak,$1) WHERE id=$2
                """, streak, habit_id)
            return True
        except Exception:
            return False

    async def get_habit_by_id(self, habit_id: int, user_id: int) -> Optional[dict]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM habits WHERE id=$1 AND user_id=$2", habit_id, user_id)
        return dict(row) if row else None

    async def deactivate_habit(self, habit_id: int, user_id: int):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE habits SET is_active=FALSE WHERE id=$1 AND user_id=$2", habit_id, user_id)

    async def get_habit_stats(self, habit_id: int) -> dict:
        async with self.pool.acquire() as conn:
            hab = await conn.fetchrow("SELECT * FROM habits WHERE id=$1", habit_id)
            total = await conn.fetchrow("SELECT COUNT(*) as c FROM habit_logs WHERE habit_id=$1", habit_id)
        if not hab:
            return {}
        return {
            "name": hab["name"],
            "streak": hab["streak"],
            "best_streak": hab["best_streak"],
            "total_logs": total["c"] if total else 0,
            "created_at": hab["created_at"],
        }

    # ─── Focus sessions ───────────────────────────────────────

    async def check_focus_limit(self, user_id: int) -> tuple[int, bool]:
        """Returns (sessions_this_week, limit_reached). Premium = unlimited."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT focus_sessions_week, focus_week_start, is_premium FROM users WHERE user_id=$1
            """, user_id)
        if not row or row["is_premium"] or user_id in OWNER_IDS:
            return 0, False
        today = date.today()
        week_start = row["focus_week_start"]
        # Reset if new week
        if week_start and (today - week_start).days >= 7:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    UPDATE users SET focus_sessions_week=0, focus_week_start=$1 WHERE user_id=$2
                """, today, user_id)
            return 0, False
        count = row["focus_sessions_week"]
        return count, count >= 2  # Free: 2 sessions per week

    async def start_focus_session(self, user_id: int, goal: str, duration: int) -> int:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO focus_sessions (user_id, goal, duration_min) VALUES ($1,$2,$3) RETURNING id
            """, user_id, goal, duration)
            await conn.execute("""
                UPDATE users SET
                    focus_sessions_week=focus_sessions_week+1,
                    focus_week_start=COALESCE(CASE WHEN focus_week_start IS NULL OR
                        (CURRENT_DATE - focus_week_start) >= 7 THEN CURRENT_DATE ELSE focus_week_start END, CURRENT_DATE)
                WHERE user_id=$1
            """, user_id)
        return row["id"]

    async def complete_focus_session(self, session_id: int, summary: str):
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE focus_sessions SET completed=TRUE, summary=$1 WHERE id=$2
            """, summary, session_id)

    # ─── Scheduling ───────────────────────────────────────────

    async def set_daily_time(self, user_id: int, hour: int, enabled: bool = True):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE users SET daily_hour=$1, daily_enabled=$2 WHERE user_id=$3", hour, enabled, user_id)

    async def get_users_for_daily(self, utc_hour: int) -> list:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT user_id, profile, is_premium, language FROM users
                WHERE daily_enabled=TRUE AND profile IS NOT NULL
                  AND (profile->>'onboarding_complete')::boolean=TRUE
                  AND daily_hour=$1
            """, utc_hour)
        return [dict(r) for r in rows]

    async def get_users_for_weekly(self) -> list:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT user_id, profile, is_premium, language FROM users
                WHERE profile IS NOT NULL
                  AND (profile->>'onboarding_complete')::boolean=TRUE
                  AND (last_weekly_at IS NULL OR last_weekly_at < NOW() - INTERVAL '6 days')
            """)
        return [dict(r) for r in rows]

    async def update_last_weekly(self, user_id: int):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE users SET last_weekly_at=NOW() WHERE user_id=$1", user_id)

    async def save_weekly_topics(self, user_id: int, topics: list):
        async with self.pool.acquire() as conn:
            await conn.execute("UPDATE users SET weekly_topics=$1::jsonb WHERE user_id=$2", json.dumps(topics), user_id)

    async def get_weekly_topics(self, user_id: int) -> list:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT weekly_topics FROM users WHERE user_id=$1", user_id)
        return list(row["weekly_topics"]) if row and row["weekly_topics"] else []

    # ─── Habit reminders & missed check ───────────────────────

    async def get_users_with_unlogged_habits_today(self) -> list:
        """Users who have active habits but haven't logged any today"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT DISTINCT u.user_id, u.language
                FROM users u
                JOIN habits h ON h.user_id = u.user_id AND h.is_active = TRUE
                WHERE u.profile IS NOT NULL
                  AND (u.profile->>'onboarding_complete')::boolean = TRUE
                  AND NOT EXISTS (
                      SELECT 1 FROM habit_logs hl
                      WHERE hl.user_id = u.user_id AND hl.logged_date = CURRENT_DATE
                  )
            """)
        return [dict(r) for r in rows]

    async def get_users_with_missed_habits_yesterday(self) -> list:
        """Users with habits that weren't logged yesterday"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT u.user_id, u.language, u.profile,
                       array_agg(h.name) AS missed_habits
                FROM users u
                JOIN habits h ON h.user_id = u.user_id AND h.is_active = TRUE AND h.streak > 0
                WHERE u.profile IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM habit_logs hl
                      WHERE hl.habit_id = h.id
                        AND hl.logged_date = CURRENT_DATE - INTERVAL '1 day'
                  )
                GROUP BY u.user_id, u.language, u.profile
            """)
        return [dict(r) for r in rows]

    # ─── Challenges ───────────────────────────────────────────

    async def add_active_challenge(self, user_id: int, challenge_name: str):
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT active_challenges FROM users WHERE user_id=$1", user_id)
            challenges = list(row["active_challenges"]) if row and row["active_challenges"] else []
            if challenge_name not in challenges:
                challenges.append(challenge_name)
            await conn.execute("""
                UPDATE users SET active_challenges=$1::jsonb WHERE user_id=$2
            """, json.dumps(challenges), user_id)

    async def get_completed_challenges(self) -> list:
        """Placeholder — challenges completed via manual /done_challenge command"""
        return []

    async def mark_challenge_reported(self, user_id: int, challenge_name: str):
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT active_challenges FROM users WHERE user_id=$1", user_id)
            challenges = list(row["active_challenges"]) if row and row["active_challenges"] else []
            if challenge_name in challenges:
                challenges.remove(challenge_name)
            await conn.execute("""
                UPDATE users SET active_challenges=$1::jsonb WHERE user_id=$2
            """, json.dumps(challenges), user_id)

    # ─── Bonus reports & temporary premium ────────────────────

    async def grant_bonus_reports(self, user_id: int, count: int):
        """Add bonus premium reports (stored as negative reports_today offset)"""
        async with self.pool.acquire() as conn:
            # Store as a separate bonus counter
            await conn.execute("""
                UPDATE users SET
                    stars_total = stars_total + $2,
                    updated_at = NOW()
                WHERE user_id = $1
            """, user_id, count * 10)  # 10 stars per bonus report as proxy

    async def grant_temporary_premium(self, user_id: int, days: int):
        """Grant temporary premium access"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE users SET
                    is_premium = TRUE,
                    premium_since = COALESCE(premium_since, NOW()),
                    updated_at = NOW()
                WHERE user_id = $1
            """, user_id)

    # ─── Focus session count ──────────────────────────────────

    async def get_focus_session_count(self, user_id: int) -> int:
        """Total completed focus sessions for stats"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT COUNT(*) as c FROM focus_sessions
                WHERE user_id=$1 AND completed=TRUE
            """, user_id)
        return row["c"] if row else 0

    async def check_focus_achievement(self, user_id: int) -> bool:
        """Check if user hit 10 focus sessions milestone"""
        count = await self.get_focus_session_count(user_id)
        if count >= 10:
            return await self.grant_achievement(user_id, "focus_10")
        return False
