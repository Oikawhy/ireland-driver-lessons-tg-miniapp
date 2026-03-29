-- Migration: add hint column + discard status + question_translations hint
ALTER TABLE questions ADD COLUMN IF NOT EXISTS hint TEXT;
ALTER TABLE question_translations ADD COLUMN IF NOT EXISTS hint TEXT;

-- Allow 'discarded' status for test_sessions  
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'discarded' AND enumtypid = 'session_status'::regtype) THEN
        ALTER TYPE session_status ADD VALUE 'discarded';
    END IF;
END $$;

-- Make user_answers unique per session+question (for re-answering)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_answers_session_question ON user_answers (session_id, question_id);
