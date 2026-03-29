-- ═══════════════════════════════════════════════════
-- Ireland Driver Test — Full Database Schema
-- 13 tables, 2 enums, 3 indexes
-- Auto-run on first PostgreSQL start via init.sql mount
-- ═══════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- CONTENT DOMAIN
-- ═══════════════════════════════════════

CREATE TABLE categories (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE questions (
    id             SERIAL PRIMARY KEY,
    source_id      INT NOT NULL UNIQUE,
    question_text  TEXT NOT NULL,
    explanation    TEXT,
    category_id    INT REFERENCES categories(id),
    image_filename VARCHAR(255),
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE answers (
    id          SERIAL PRIMARY KEY,
    question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_answers_question ON answers(question_id);

-- ═══════════════════════════════════════
-- TRANSLATION DOMAIN
-- ═══════════════════════════════════════

CREATE TABLE category_translations (
    id          SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    lang        VARCHAR(5) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    UNIQUE (category_id, lang)
);

CREATE TABLE question_translations (
    id            SERIAL PRIMARY KEY,
    question_id   INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    lang          VARCHAR(5) NOT NULL,
    question_text TEXT NOT NULL,
    explanation   TEXT,
    UNIQUE (question_id, lang)
);

CREATE TABLE answer_translations (
    id          SERIAL PRIMARY KEY,
    answer_id   INT NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
    lang        VARCHAR(5) NOT NULL,
    answer_text TEXT NOT NULL,
    UNIQUE (answer_id, lang)
);

-- ═══════════════════════════════════════
-- USER DOMAIN
-- ═══════════════════════════════════════

CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL UNIQUE,
    username    VARCHAR(255),
    first_name  VARCHAR(255),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_settings (
    user_id              INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    marathon_auto_next   INT DEFAULT 0,
    theme                VARCHAR(10) DEFAULT 'auto',
    haptic_feedback      BOOLEAN DEFAULT TRUE,
    exam_time_limit      INT DEFAULT 2400,
    language             VARCHAR(5) DEFAULT 'en'
);

-- ═══════════════════════════════════════
-- TRACKING DOMAIN
-- ═══════════════════════════════════════

CREATE TYPE test_type AS ENUM ('exam', 'marathon', 'incorrect', 'category');
CREATE TYPE test_status AS ENUM ('in_progress', 'completed', 'timed_out');

CREATE TABLE test_sessions (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    test_type       test_type NOT NULL,
    category_id     INT REFERENCES categories(id),
    status          test_status NOT NULL DEFAULT 'in_progress',
    total_questions INT NOT NULL,
    correct_count   INT DEFAULT 0,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    time_limit_sec  INT
);

CREATE TABLE user_answers (
    id          SERIAL PRIMARY KEY,
    session_id  INT NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
    question_id INT NOT NULL REFERENCES questions(id),
    answer_id   INT REFERENCES answers(id),
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    answered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_srs_cards (
    id            SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id   INT NOT NULL REFERENCES questions(id),
    stability     REAL NOT NULL DEFAULT 0.4,
    difficulty    REAL NOT NULL DEFAULT 5.0,
    interval_days REAL NOT NULL DEFAULT 0,
    due_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    repetitions   INT NOT NULL DEFAULT 0,
    lapses        INT NOT NULL DEFAULT 0,
    last_review   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, question_id)
);
CREATE INDEX idx_srs_user_due ON user_srs_cards(user_id, due_date);

CREATE TABLE user_bookmarks (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id INT NOT NULL REFERENCES questions(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, question_id)
);
