import { cors } from '../utils/cors.js';

const pad = n => String(n).padStart(3, '0');

// 串流播放聖經音頻檔（R2: bible-audio/{ver}/{book:000}/{chapter}.mp3|.wav）
// 支援 HTTP Range（瀏覽器 <audio> seek），模式與講道音頻相同
export async function getBibleAudio(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const ver = String(params.ver || 'cut').toLowerCase().replace(/[^a-z0-9_]/g, '');
        const book = pad(params.book);
        const ch = String(params.ch || '');

        const baseKey = `bible-audio/${ver}/${book}/${ch}`;

        if (!env.R2) {
            return new Response(JSON.stringify({ success: false, error: 'R2 儲存未設置' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        let key = `${baseKey}.mp3`;
        let object = await env.R2.get(key);
        let contentType = 'audio/mpeg';
        if (!object) {
            key = `${baseKey}.wav`;
            object = await env.R2.get(key);
            contentType = 'audio/wav';
        }
        if (!object) {
            return new Response(JSON.stringify({ success: false, error: '本章尚未有音頻檔' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const size = object.size;
        const commonHeaders = {
            'Content-Type': object.httpMetadata && object.httpMetadata.contentType
                ? object.httpMetadata.contentType
                : contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
            ...cors()
        };

        const rangeHeader = request.headers.get('Range');
        if (rangeHeader) {
            const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
            if (match && (match[1] || match[2])) {
                let start = match[1] ? parseInt(match[1], 10) : 0;
                let end = match[2] ? parseInt(match[2], 10) : size - 1;
                if (end >= size) end = size - 1;
                const length = end - start + 1;

                const chunk = await env.R2.get(key, { range: { offset: start, length } });

                return new Response(chunk.body, {
                    status: 206,
                    headers: {
                        ...commonHeaders,
                        'Content-Range': `bytes ${start}-${end}/${size}`,
                        'Content-Length': String(length)
                    }
                });
            }
        }

        return new Response(object.body, {
            headers: {
                ...commonHeaders,
                'Content-Length': String(size)
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}