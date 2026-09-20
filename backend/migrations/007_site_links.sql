-- 網站／社群連結預設值
-- 可於管理後台儀表板「🔗 更新連結」按鈕修改（App「更多」頁與奉獻彈窗會即時套用）

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('website_url', 'https://ccacgranadahills.org'),
    ('facebook_url', 'https://facebook.com'),
    ('give_url', 'https://ccacgranadahills.org/give');
