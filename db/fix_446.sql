-- Fix Q446: add answers if missing (ON CONFLICT safe)
INSERT INTO answers (question_id, answer_text, is_correct)
SELECT q.id, a.answer_text, a.is_correct
FROM questions q,
(VALUES
    ('Select an appropriate gear and brake gently to control speed.', true),
    ('Use a higher gear than normal in order to avoid wheel spin.', false),
    ('Avoid using the brake and use a high gear.', false),
    ('Keep close to the left and brake sharply to reduce speed.', false)
) AS a(answer_text, is_correct)
WHERE q.source_id = 446
AND NOT EXISTS (SELECT 1 FROM answers WHERE question_id = q.id);

-- Also ensure Q446 has correct text and explanation
UPDATE questions SET
    question_text = 'What should a driver do when travelling downhill on snow or ice?',
    explanation = 'When travelling downhill in snow or ice, you should select a lower gear to take advantage of engine braking and use the brakes very gently when you need to.'
WHERE source_id = 446;

-- Verify both
SELECT q.source_id, q.question_text, COUNT(a.id) as answers
FROM questions q LEFT JOIN answers a ON a.question_id = q.id
WHERE q.source_id IN (446, 447)
GROUP BY q.source_id, q.question_text;

SELECT COUNT(*) AS total_q FROM questions;
SELECT COUNT(*) AS total_a FROM answers;
