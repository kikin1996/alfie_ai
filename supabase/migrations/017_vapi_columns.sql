ALTER TABLE viewings ADD COLUMN IF NOT EXISTS vapi_call_id text;
ALTER TABLE viewings ADD COLUMN IF NOT EXISTS vapi_summary text;
ALTER TABLE viewings ADD COLUMN IF NOT EXISTS vapi_transcript text;
