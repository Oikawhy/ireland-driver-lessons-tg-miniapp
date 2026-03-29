-- Insert missing questions #446 and #447 (timed out during parsing)

-- Question 446
WITH q446 AS (
    INSERT INTO questions (source_id, question_text, explanation, category_id)
    SELECT 446,
           'What should a driver do when travelling downhill on snow or ice?',
           'When travelling downhill in snow or ice, you should select a lower gear to take advantage of engine braking and use the brakes very gently when you need to.',
           id
    FROM categories WHERE name = 'Managing Risk'
    ON CONFLICT (source_id) DO NOTHING
    RETURNING id
)
INSERT INTO answers (question_id, answer_text, is_correct)
SELECT id, answer_text, is_correct FROM q446,
(VALUES
    ('Select an appropriate gear and brake gently to control speed.', true),
    ('Use a higher gear than normal in order to avoid wheel spin.', false),
    ('Avoid using the brake and use a high gear.', false),
    ('Keep close to the left and brake sharply to reduce speed.', false)
) AS a(answer_text, is_correct);

-- Question 447
WITH q447 AS (
    INSERT INTO questions (source_id, question_text, explanation, category_id)
    SELECT 447,
           'What is the recommended minimum stopping distance for a car travelling at 50 km/h on a dry road?',
           'The total minimum stopping distance of a vehicle depends on four things: Perception time, reaction time, the vehicle''s speed and the vehicle''s braking capability. The recommend minimum stopping distance of a car driving at 50 km/h under dry conditions is 25 metres.',
           id
    FROM categories WHERE name = 'Managing Risk'
    ON CONFLICT (source_id) DO NOTHING
    RETURNING id
)
INSERT INTO answers (question_id, answer_text, is_correct)
SELECT id, answer_text, is_correct FROM q447,
(VALUES
    ('55 metres.', false),
    ('15 metres.', false),
    ('25 metres.', true),
    ('5 metres.', false)
) AS a(answer_text, is_correct);

-- Verify
SELECT source_id, question_text FROM questions WHERE source_id IN (446, 447);
SELECT COUNT(*) AS total_questions FROM questions;
SELECT COUNT(*) AS total_answers FROM answers;
