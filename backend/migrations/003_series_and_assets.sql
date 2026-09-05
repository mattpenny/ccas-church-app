-- CCAC Sermon Series + PDF per sermon
-- 系列表（Subsplash 風格：系列導向）

CREATE TABLE IF NOT EXISTS sermon_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_en TEXT,
    description TEXT,
    description_en TEXT,
    cover_key TEXT,              -- R2 儲存鍵（上傳的封面圖）
    cover_url TEXT,              -- 外部封面圖 URL（擇一）
    sort_order INTEGER DEFAULT 0,
    published BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- sermons 表加入系列與講道大綱 PDF
ALTER TABLE sermons ADD COLUMN series_id INTEGER;
ALTER TABLE sermons ADD COLUMN pdf_key TEXT;
ALTER TABLE sermons ADD COLUMN pdf_name TEXT;
ALTER TABLE sermons ADD COLUMN pdf_size INTEGER;