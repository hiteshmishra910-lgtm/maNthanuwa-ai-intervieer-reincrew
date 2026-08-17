DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_session_question'
  ) THEN 
    ALTER TABLE session_responses ADD CONSTRAINT unique_session_question UNIQUE (session_id, question_index);
  END IF; 
END $$;
