// 從 ibibles.net HTML 來源建置聖經 JSON 資料（多譯本）
// 用法: node scripts/build-bible.mjs
// 譯本皆為公有領域：CUT/CUS (Chinese Union Version, 1919)、KJV (1611)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_SRC = path.join(__dirname, '..', '.bible-src');
const BASE_OUT = path.join(__dirname, '..', 'public', 'bible');

const VERSIONS = [
    { code: 'cut', label: '繁體和合本', src: path.join(BASE_SRC, 'cut', 'cut') },
    { code: 'cus', label: '简体和合本', src: path.join(BASE_SRC, 'cus', 'cus') },
    { code: 'kjv', label: 'King James Version', src: path.join(BASE_SRC, 'kjv', 'kjv') }
];

const decodeEntities = (s) =>
    s.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

for (const ver of VERSIONS) {
    const outDir = path.join(BASE_OUT, ver.code);
    fs.mkdirSync(outDir, { recursive: true });

    const files = fs.readdirSync(ver.src)
        .filter(f => /^\d{3}.*\.htm$/i.test(f))
        .sort();

    const books = [];
    let totalVerses = 0;

    for (const file of files) {
        const raw = fs.readFileSync(path.join(ver.src, file), 'utf-8');

        const titleMatch = raw.match(/<title>([\s\S]*?)<\/title/i);
        const zh = titleMatch ? titleMatch[1].trim() : file;

        const h3 = raw.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
        let en = file.replace(/^\d{3}/, '').replace(/\.htm$/i, '');
        if (h3) {
            const m = h3[1].replace(/<[^>]+>/g, ' ').trim().match(/^(\d+)\s+(.+?)\s+([A-Za-z0-9 ]+)$/);
            if (m) en = m[3].trim();
        }

        const id = parseInt(file.slice(0, 3), 10);
        const testament = id <= 39 ? 'OT' : 'NT';

        // 擷取經文: <a name="008-1:4"></a> ... <small>1:4</small> 經文 <br>
        const verseRe = /<a name="\d+-(\d+):(\d+)"><\/a>\s*<small>\s*\d+:\d+\s*<\/small>\s*([\s\S]*?)<br>/gi;
        const chapters = new Map();
        let m2;
        while ((m2 = verseRe.exec(raw)) !== null) {
            const ch = parseInt(m2[1], 10);
            const vs = parseInt(m2[2], 10);
            let text = decodeEntities(m2[3].replace(/<[^>]+>/g, ' '))
                .replace(/\s+/g, ' ')
                .trim();
            if (!text) continue;
            if (!chapters.has(ch)) chapters.set(ch, new Map());
            chapters.get(ch).set(vs, text);
        }

        const chapterCounts = [...chapters.keys()].sort((a, b) => a - b).map(c => ({
            ch: c,
            verses: chapters.get(c).size
        }));
        const verseCount = chapterCounts.reduce((s, c) => s + c.verses, 0);
        totalVerses += verseCount;

        const data = {
            id,
            zh,
            en,
            testament,
            chapters: Object.fromEntries([...chapters.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([ch, vmap]) => [String(ch), [...vmap.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([, t]) => t)]))
        };

        const outName = `${String(id).padStart(3, '0')}.json`;
        fs.writeFileSync(path.join(outDir, outName), JSON.stringify(data), 'utf-8');

        books.push({
            id,
            zh,
            en,
            testament,
            chapterCount: chapterCounts.length,
            verseCount,
            file: `/bible/${ver.code}/${outName}`
        });
    }

    fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({
        version: ver.code,
        label: ver.label,
        source: 'Public Domain, from ibibles.net',
        books
    }, null, 1), 'utf-8');

    const sizeMB = (fs.readdirSync(outDir).reduce((s, f) => s + fs.statSync(path.join(outDir, f)).size, 0) / 1024 / 1024).toFixed(1);
    console.log(`[${ver.code}] ${ver.label}: ${books.length} books, ${totalVerses} verses, ${sizeMB} MB -> public/bible/${ver.code}/`);
}

console.log('\nDONE: 3 versions -> public/bible/{cut,cus,kjv}/');

