-- CCAC Church Database Schema

-- 講道表 - 只存 YouTube 影片資訊
CREATE TABLE IF NOT EXISTS sermons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_en TEXT,
    speaker TEXT NOT NULL,
    speaker_en TEXT,
    date TEXT NOT NULL,
    date_short TEXT,
    video_id TEXT NOT NULL,              -- YouTube Video ID
    youtube_url TEXT,                    -- Full YouTube URL
    duration TEXT,
    description TEXT,
    description_en TEXT,
    type TEXT DEFAULT 'video',           -- video or audio (from YouTube)
    thumbnail_url TEXT,                  -- YouTube thumbnail
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

-- 文檔表 - PDF 檔案存 R2
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_en TEXT,
    file_name TEXT NOT NULL,
    file_key TEXT NOT NULL,              -- R2 storage key
    file_size INTEGER,
    file_type TEXT,                      -- PDF, JPG, PNG
    description TEXT,
    description_en TEXT,
    category TEXT DEFAULT 'general',     -- bulletin, study, newsletter, photo
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

-- 活動表
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_en TEXT,
    day INTEGER NOT NULL,
    month TEXT NOT NULL,
    month_en TEXT,
    weekday TEXT NOT NULL,
    weekday_en TEXT,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    location_en TEXT,
    description TEXT,
    description_en TEXT,
    start_date DATETIME,
    end_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_en TEXT,
    description TEXT NOT NULL,
    description_en TEXT,
    time_label TEXT,
    time_label_en TEXT,
    modal_title TEXT,
    modal_title_en TEXT,
    modal_sub TEXT,
    modal_sub_en TEXT,
    modal_content TEXT,
    modal_content_en TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

-- 設定表
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入預設設定
INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('site_title', 'CCAC Granada Hills'),
    ('site_description', 'Chinese Christian Assembly'),
    ('maintenance_mode', 'false');

-- 插入示範講道資料 (只有 YouTube ID)
INSERT OR IGNORE INTO sermons (title, title_en, speaker, speaker_en, date, date_short, video_id, duration, type) VALUES 
    ('信心的行走：信靠神的計劃', 'Walking in Faith: Trusting God''s Plan', '陳大衛牧師', 'Pastor David Chen', '2026-07-14', '7月14日', 'nq1e0g8jQpE', '42:18', 'video'),
    ('禱告的力量：日常生活中的禱告', 'The Power of Prayer in Daily Life', '劉瑪麗牧師', 'Pastor Mary Liu', '2026-07-07', '7月7日', 'qN4ooNxvBDU', '35:42', 'video');

-- 插入示範活動資料
INSERT OR IGNORE INTO events (title, title_en, day, month, month_en, weekday, weekday_en, time, location, location_en) VALUES 
    ('主日崇拜', 'Sunday Worship', 20, '7月', 'Jul', '週日', 'Sun', '上午9:00 - 11:30', '主堂', 'Main Sanctuary'),
    ('週中查經班', 'Midweek Bible Study', 23, '7月', 'Jul', '週三', 'Wed', '晚上7:30 - 9:00', '團契廳', 'Fellowship Hall');

-- 插入示範公告資料
INSERT OR IGNORE INTO announcements (title, title_en, description, description_en, time_label, time_label_en) VALUES 
    ('主日崇拜時間調整', 'Sunday Service Schedule Change', '從本週開始，英語崇拜時間調整為上午10:30。', 'Starting this week, English service begins at 10:30 AM.', '2小時前', '2 hours ago');