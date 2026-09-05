-- Add MP3 audio storage columns to sermons
ALTER TABLE sermons ADD COLUMN audio_key TEXT;
ALTER TABLE sermons ADD COLUMN audio_name TEXT;
ALTER TABLE sermons ADD COLUMN audio_size INTEGER;
