// 用 Azure TTS（廣東話神經語音 zh-HK）把聖經章節生成 MP3 音頻，輸出到 build/bible-audio/
//
// 用法：
//   set AZURE_SPEECH_KEY=xxx
//   node scripts/build-bible-audio.mjs --ver cut --book 1 --ch 1
//   node scripts/build-bible-audio.mjs --all            # 生成全部 1189 章
//   node scripts/build-bible-audio.mjs --dry-run ...     # 只印出 SSML／檔名，不實際呼叫
//   --voice zh-HK-HiuGaaiNeural   # 可轉 zh-HK-WanLungNeural（男聲）等
//
// 上傳到 Cloudflare R2（供 App 串流）：
//   npx wrangler r2 object put ccac-storage bible-audio/cut/001/1.mp3 --file build/bible-audio/cut/001/1.mp3
//   （--all 完成後可用 for 迴圈批次上傳所有檔案；或改用 S3 相容 API）
//
// 註：Azure 免費層 F0 每月約 50 萬字；整本和合本約 120 萬字，全生成約 USD $20（一次性）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BIBLE_ROOT = path.join(ROOT, 'public', 'bible');
const OUT_ROOT = path.join(ROOT, 'build', 'bible-audio');

const args = process.argv.slice(2);
const argVal = name => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
};
const has = name => args.includes(name);

const DRY_RUN = has('--dry-run');
const ALL = has('--all');
const VER = (argVal('--ver') || 'cut').toLowerCase();
const TARGET_BOOK = argVal('--book') ? parseInt(argVal('--book'), 10) : null;
const TARGET_CH = argVal('--ch') ? parseInt(argVal('--ch'), 10) : null;
const VOICE = argVal('--voice') || 'zh-HK-HiuGaaiNeural';
const RATE = argVal('--rate') || '0.92';

function escXml(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function chapterSsml(verses) {
    // 以句號串接各節；移除多餘空白後朗讀
    const text = verses.map(v => v.trim()).filter(Boolean).join('。') + '。';
    return `<speak version='1.0' xml:lang='zh-HK'>
    <voice name='${escXml(VOICE)}'>
        <prosody rate='${escXml(RATE)}'>${escXml(text)}</prosody>
    </voice>
</speak>`;
}

async function azureTts(ssml) {
    const key = process.env.AZURE_SPEECH_KEY || process.env.AZURE_TTS_KEY;
    if (!key) throw new Error('缺少 AZURE_SPEECH_KEY（或 AZURE_TTS_KEY）環境變數');
    const region = process.env.AZURE_REGION || 'eastasia';
    const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3'
        },
        body: ssml
    });
    if (!res.ok) throw new Error(`Azure TTS HTTP ${res.status}: ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
}

async function main() {
    const index = JSON.parse(fs.readFileSync(path.join(BIBLE_ROOT, VER, 'index.json'), 'utf-8'));
    const key = process.env.AZURE_SPEECH_KEY || process.env.AZURE_TTS_KEY;
    if (!DRY_RUN && !key) {
        console.error('❌ 缺少 AZURE_SPEECH_KEY。先用 --dry-run 試跑，或設定環境變數。');
        process.exit(1);
    }

    const uploadCmds = [];
    let generated = 0;

    for (const book of index.books) {
        if (TARGET_BOOK && book.id !== TARGET_BOOK) continue;
        const data = JSON.parse(
            fs.readFileSync(path.join(BIBLE_ROOT, VER, `${String(book.id).padStart(3, '0')}.json`), 'utf-8')
        );
        const chKeys = Object.keys(data.chapters || {}).map(Number).sort((a, b) => a - b);
        for (const ch of chKeys) {
            if (TARGET_CH && ch !== TARGET_CH) continue;
            const ssml = chapterSsml(data.chapters[String(ch)]);
            const outDir = path.join(OUT_ROOT, VER, String(book.id).padStart(3, '0'));
            const outFile = path.join(outDir, `${ch}.mp3`);
            const r2Key = `bible-audio/${VER}/${String(book.id).padStart(3, '0')}/${ch}.mp3`;

            if (DRY_RUN) {
                generated++;
                console.log(`[dry] ${VER} ${book.id}:${ch} -> ${outFile}`);
                console.log(ssml.replace(/\n\s*/g, ' ').slice(0, 220) + ' …\n');
                continue;
            }

            fs.mkdirSync(outDir, { recursive: true });
            const mp3 = await azureTts(ssml);
            fs.writeFileSync(outFile, mp3);
            uploadCmds.push(`npx wrangler r2 object put ccac-storage ${r2Key} --file ${outFile}`);
            generated++;
            console.log(`✓ ${VER} ${String(book.id).padStart(3, '0')}:${ch} (${(mp3.length / 1024).toFixed(0)}KB)`);
            if (!ALL) break; // 指定單章時只生成一個
        }
        if (!ALL) break;
    }

    if (generated === 0) {
        console.log('沒有符合條件的章節（檢查 --ver/--book/--ch）。');
    }
    if (uploadCmds.length) {
        // 去重後由使用者執行
        const uniq = [...new Set(uploadCmds)];
        console.log('\n上傳到 R2（複製以下指令執行）：');
        uniq.forEach(c => console.log(`  ${c}`));
    }
    console.log(`\n完成：${generated} 個章節 ${DRY_RUN ? '(dry-run)' : ''}`);
}

main().catch(e => {
    console.error('❌', e.message);
    process.exit(1);
});