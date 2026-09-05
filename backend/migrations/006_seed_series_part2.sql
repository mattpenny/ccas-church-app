-- 系列 seeds (part 2：大衛傳系列之後)
-- sort_order 90 起，延續 005 (10~80)
INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '撒母耳傳系列', 'Book of 1 Samuel', 90, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '撒母耳傳系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '路得記系列', 'Book of Ruth Series', 100, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '路得記系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '十二士師系列', '士師和大衛的專輯', 110, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '十二士師系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '使徒行傳系列', '成為世上見證的教會', 120, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '使徒行傳系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '聖經真的可信嗎系列', 'Is the Bible Trustworthy?', 130, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '聖經真的可信嗎系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '約翰福音系列', '我們要來敬拜祂並單單事奉祂', 140, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '約翰福音系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '耶利米書系列', '走過最深的幽谷的五步曲', 140, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '耶利米書系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '祈禱之家系列', '回到初代教會的根基', 150, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '祈禱之家系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '天國揭祕系列', 'The Heaven and Hell Series', 160, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '天國揭祕系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '以斯帖記系列', '神隱藏的手的恩寵', 160, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '以斯帖記系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '啟示系列', '啟示的途徑', 170, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '啟示系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '十二先知書系列', '完成迦南的使命', 180, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '十二先知書系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '馬太福音系列', '天國的福音十講', 190, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '馬太福音系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '申命記系列', '敬虔的選民', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '申命記系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '馬太福音系列二', '耶穌的講道與教導', 210, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '馬太福音系列二');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '但以理書系列', '至上的君王', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '但以理書系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '路加福音系列', '尋找的比喻', 230, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '路加福音系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '民數記系列', '敬畏的旅程', 240, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '民數記系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '利未記系列', '獻祭的歷程', 250, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '利未記系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '馬可福音系列', '出山寶訓：天國的律法', 260, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '馬可福音系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '創世記系列', '起初的故事', 270, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '創世記系列');

INSERT INTO sermon_series (title, subtitle, sort_order, published)
SELECT '約書亞記系列', '剛強壯膽', 280, 1
WHERE NOT EXISTS (SELECT 1 FROM sermon_series WHERE title = '約書亞記系列');
