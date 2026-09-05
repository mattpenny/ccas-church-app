-- 本機測試用種子資料
INSERT INTO sermon_series (title, title_en, description, description_en, sort_order, published)
VALUES ('天地揭秘系列', 'Unveiling Heaven and Earth', '測試用系列描述：探索天地奧秘。', 'Test series description', 0, 1);

INSERT INTO sermons (title, speaker, date, date_short, video_id, youtube_url, duration, description, type, published, sort_order, series_id, audio_key, audio_name, audio_size, pdf_key, pdf_name, pdf_size) VALUES
('天地揭秘第一講', '陳大衛牧師', '2026-08-03', '8月3日', 'N/A', NULL, '42:18', '第一講簡介（純音頻 + PDF 大綱）', 'audio', 1, 0, 1, 'sermons/1/audio.mp3', 'test-audio.mp3', 1024, 'sermons/1/outline.pdf', 'outline.pdf', 2048),
('天地揭秘第二講', '陳大衛牧師', '2026-08-10', '8月10日', 'nq1e0g8jQpE', 'https://www.youtube.com/watch?v=nq1e0g8jQpE', '38:00', '第二講簡介（YouTube + 音頻）', 'video', 1, 0, 1, 'sermons/2/audio.mp3', 'test2.mp3', 1024, NULL, NULL, NULL);

INSERT INTO sermons (title, speaker, date, date_short, video_id, duration, description, type, published, sort_order, series_id)
VALUES ('單次特別講道', '劉瑪麗牧師', '2026-08-17', '8月17日', 'N/A', '30:00', '不屬於系列的單次講道', 'audio', 1, 0, NULL);
