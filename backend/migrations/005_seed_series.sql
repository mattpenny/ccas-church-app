-- 粵語堂講道系列種子資料（依 App 顯示順序 sort_order ASC）
-- 使用 WHERE NOT EXISTS 保證可重複執行（部署遠端時不會重複建立）

INSERT INTO sermon_series (title, title_en, subtitle, description, description_en, sort_order, published)
SELECT '客座講員', 'Guest Speakers', 'Guest Speakers', '', '', 10, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '客座講員');

INSERT INTO sermon_series (title, title_en, subtitle, description, description_en, sort_order, published)
SELECT '駱柱成牧師講壇', 'Rev. Victor Luo''s Sermons', 'Rev. Victor Luo''s Sermons', '', '', 20, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '駱柱成牧師講壇');

INSERT INTO sermon_series (title, title_en, subtitle, description, description_en, sort_order, published)
SELECT '聖經難題解答系列', 'Q&A on Difficult Biblical Questions', 'Q&A on Difficult Biblical Questions', '', '', 30, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '聖經難題解答系列');

INSERT INTO sermon_series (title, title_en, subtitle, description, description_en, sort_order, published)
SELECT '列王紀合一王朝系列', 'The United Kingdom Series', 'The United Kingdom Series', '', '', 40, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '列王紀合一王朝系列');

INSERT INTO sermon_series (title, title_en, subtitle, description, description_en, sort_order, published)
SELECT '哥林多前書系列', '1 Corinthians Series', '在亂世中活出聖潔', '', '', 50, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '哥林多前書系列');

INSERT INTO sermon_series (title, title_en, subtitle, description, description_en, sort_order, published)
SELECT '單元講道', 'Standalone Sermons', '袁惠鈞牧師', '', '', 60, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '單元講道');

INSERT INTO sermon_series (title, title_en, subtitle, description, description_en, sort_order, published)
SELECT '羅馬書系列', 'Book of Romans Series', 'Book of Romans Series', '', '', 70, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '羅馬書系列');

INSERT INTO sermon_series (title, title_en, subtitle, description, description_en, sort_order, published)
SELECT '大衛傳系列', 'David Series', 'David, the Man After God''s Own Heart', '', '', 80, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '大衛傳系列');
