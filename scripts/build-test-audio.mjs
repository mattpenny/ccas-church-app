// 產生測試用 WAV 音檔（柔和和弦「詩歌」），用來在本地驗證 R2 聖經音頻串流管道
// 用法：node scripts/build-test-audio.mjs
// 輸出：build/bible-audio/cut/001/1.wav
// 上傳到本地 R2（配合 npx wrangler dev --local）：
//   npx wrangler r2 object put ccac-storage bible-audio/cut/001/1.wav --file build/bible-audio/cut/001/1.wav --local

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'bible-audio', 'cut', '001');

const sr = 22050;
const seconds = 16;
const n = sr * seconds;
const data = new Float32Array(n);

// 和弦進程：Cmaj7 - Am7 - F - G，各約 4 秒；低頻 pad + 高八度 arpeggio 旋律
const chords = [
    [130.81, 164.81, 196.00, 246.94], // Cmaj7
    [110.00, 130.81, 164.81, 220.00], // Am7
    [ 87.31, 130.81, 174.61, 220.00], // F
    [ 98.00, 123.47, 146.83, 196.00]  // G
];
const seg = seconds / chords.length;

for (let c = 0; c < chords.length; c++) {
    const t0 = c * seg;
    for (let i = 0; i < chords[c].length; i++) {
        const f = chords[c][i];
        // pad：慢起音／釋放的弦樂感，帶細微失諧
        const s0 = Math.floor(t0 * sr);
        const s1 = Math.min(n - 1, Math.floor((t0 + seg) * sr));
        for (let s = s0; s < s1; s++) {
            const t = s / sr - t0;
            const env = Math.min(1, t / 2.5) * Math.min(1, (seg - t) / 2);
            data[s] += Math.sin(2 * Math.PI * f * t) * 0.10 * env;
            data[s] += Math.sin(2 * Math.PI * f * 1.005 * t) * 0.05 * env;
        }
        // 高八度 arpeggio 旋律（明亮音色）
        for (let k = 0; k < 3; k++) {
            const a0 = t0 + i * 0.3 + k * 1.3;
            const a1 = Math.min(n, Math.floor((a0 + 1.4) * sr));
            for (let s = Math.floor(a0 * sr); s < a1; s++) {
                if (s >= n) break;
                const t = (s / sr) - a0;
                const env = Math.exp(-t * 4);
                data[s] += Math.sin(2 * Math.PI * f * 2 * t) * 0.07 * env;
            }
        }
    }
}

// 整體淡入淡出
const fade = Math.floor(1.2 * sr);
for (let s = 0; s < n; s++) {
    let m = 1;
    if (s < fade) m = s / fade;
    if (s > n - fade) m = Math.min(m, (n - s) / fade);
    data[s] = Math.max(-1, Math.min(1, data[s] * 0.9 * m));
}

// 16-bit PCM WAV
const buf = Buffer.alloc(44 + n * 2);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + n * 2, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(sr, 24);
buf.writeUInt32LE(sr * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(n * 2, 40);
for (let s = 0; s < n; s++) {
    buf.writeInt16LE(Math.round(data[s] * 32767), 44 + s * 2);
}

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, '1.wav');
fs.writeFileSync(file, buf);
console.log('WRITTEN:', file, (buf.length / 1024).toFixed(1) + 'KB');