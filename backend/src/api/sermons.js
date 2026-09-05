import { cors } from '../utils/cors.js';
import { verifyAuth } from './auth.js';

// 為講道結果補上可用的資源 URL
function mapSermon(s) {
    return {
        ...s,
        audio_url: s.audio_key ? `/api/sermons/${s.id}/audio` : null,
        pdf_url: s.pdf_key ? `/api/sermons/${s.id}/pdf` : null
    };
}

export async function getSermons(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const url = new URL(request.url);
        const type = url.searchParams.get('type') || 'all';
        const seriesId = url.searchParams.get('series_id') || null; // 'none' = 單次講道
        const limit = parseInt(url.searchParams.get('limit')) || 100;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        
        const isAuth = verifyAuth(request);
        let query = 'SELECT * FROM sermons';
        let params = [];
        
        if (!isAuth) {
            query += ' WHERE published = 1';
        }
        
        if (seriesId !== null) {
            if (seriesId === 'none') {
                query += isAuth ? ' WHERE series_id IS NULL' : ' AND series_id IS NULL';
            } else {
                query += isAuth ? ' WHERE series_id = ?' : ' AND series_id = ?';
                params.push(seriesId);
            }
        }
        
        if (type !== 'all') {
            query += isAuth ? ' WHERE type = ?' : ' AND type = ?';
            params.push(type);
        }
        
        query += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        const { results } = await env.DB.prepare(query)
            .bind(...params)
            .all();
        
        return new Response(JSON.stringify({
            success: true,
            data: (results || []).map(mapSermon),
            total: results ? results.length : 0,
            limit,
            offset
        }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}

export async function getSermon(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const { id } = params;
        const { results } = await env.DB.prepare(
            'SELECT * FROM sermons WHERE id = ?'
        ).bind(id).all();
        
        if (!results || results.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sermon not found'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            data: mapSermon(results[0])
        }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}

export async function createSermon(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    if (!verifyAuth(request)) {
        return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }

    try {
        const data = await request.json();
        const required = ['title', 'speaker', 'date'];
        for (const field of required) {
            if (!data[field]) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `Missing required field: ${field}`
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...cors() }
                });
            }
        }

        // Handle YouTube video URL / ID extraction
        let youtubeUrl = data.youtube_url || data.video_url || null;
        let videoId = data.video_id || '';

        if (youtubeUrl && !videoId) {
            const match = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
            if (match) videoId = match[1];
        } else if (videoId && !youtubeUrl) {
            youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        }

        // video_id has a NOT NULL constraint, so ensure a fallback string exists
        if (!videoId) {
            videoId = 'N/A';
        }

        const result = await env.DB.prepare(`
            INSERT INTO sermons (
                title, title_en, speaker, speaker_en, date, date_short,
                video_id, youtube_url, duration, description, description_en,
                type, thumbnail_url, published, sort_order, series_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.title,
            data.title_en || data.title,
            data.speaker,
            data.speaker_en || data.speaker,
            data.date,
            data.date_short || data.date,
            videoId,
            youtubeUrl,
            data.duration || null,
            data.description || '',
            data.description_en || data.description || '',
            data.type || 'video',
            data.thumbnail_url || (videoId !== 'N/A' ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null),
            data.published !== undefined ? Number(data.published) : 1,
            data.sort_order !== undefined ? Number(data.sort_order) : 0,
            data.series_id !== undefined ? Number(data.series_id) || null : null
        ).run();

        const { results } = await env.DB.prepare(
            'SELECT * FROM sermons WHERE id = ?'
        ).bind(result.meta.last_row_id).all();

        return new Response(JSON.stringify({
            success: true,
            data: mapSermon(results[0]),
            message: 'Sermon created successfully'
        }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        console.error('Create Sermon Error:', error.message);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}

export async function updateSermon(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    if (!verifyAuth(request)) {
        return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }

    try {
        const { id } = params;
        const data = await request.json();

        const fields = [];
        const values = [];
        
        const allowedFields = [
            'title', 'title_en', 'speaker', 'speaker_en', 'date', 'date_short',
            'video_id', 'youtube_url', 'duration', 'description', 'description_en',
            'type', 'thumbnail_url', 'published', 'sort_order', 'series_id'
        ];
        
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(data[field]);
            }
        }
        
        if (fields.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No fields to update'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        values.push(id);
        const query = `UPDATE sermons SET ${fields.join(', ')} WHERE id = ?`;
        
        await env.DB.prepare(query).bind(...values).run();

        const { results } = await env.DB.prepare(
            'SELECT * FROM sermons WHERE id = ?'
        ).bind(id).all();

        return new Response(JSON.stringify({
            success: true,
            data: mapSermon(results[0]),
            message: 'Sermon updated successfully'
        }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}

export async function deleteSermon(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    if (!verifyAuth(request)) {
        return new Response(JSON.stringify({
            success: false,
            error: 'Unauthorized'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }

    try {
        const { id } = params;

        // 一併刪除 R2 中的音頻與 PDF 檔案
        const { results } = await env.DB.prepare(
            'SELECT audio_key, pdf_key FROM sermons WHERE id = ?'
        ).bind(id).all();

        if (env.R2 && results && results.length > 0) {
            if (results[0].audio_key) {
                await env.R2.delete(results[0].audio_key);
            }
            if (results[0].pdf_key) {
                await env.R2.delete(results[0].pdf_key);
            }
        }

        await env.DB.prepare(
            'DELETE FROM sermons WHERE id = ?'
        ).bind(id).run();

        return new Response(JSON.stringify({
            success: true,
            message: 'Sermon deleted successfully'
        }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}
// ============================================================
// 講道音頻 (MP3) - 上傳 / 播放 / 刪除
// GET 支援 HTTP Range，可拖動播放進度
// ============================================================

const MAX_AUDIO_SIZE = 90 * 1024 * 1024; // 90MB（Workers 請求上限）

export async function uploadSermonAudio(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    if (!verifyAuth(request)) {
        return new Response(JSON.stringify({ success: false, error: '未授權' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }

    try {
        const { id } = params;
        const { results } = await env.DB.prepare('SELECT * FROM sermons WHERE id = ?').bind(id).all();
        if (!results || results.length === 0) {
            return new Response(JSON.stringify({ success: false, error: '講道不存在' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const formData = await request.formData();
        const audio = formData.get('audio');
        if (!audio) {
            return new Response(JSON.stringify({ success: false, error: '請選擇音頻檔案' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        if (!audio.type.startsWith('audio/') && audio.type !== 'application/octet-stream') {
            return new Response(JSON.stringify({ success: false, error: '不支援的檔案格式，請上傳 MP3 音頻' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        if (audio.size > MAX_AUDIO_SIZE) {
            return new Response(JSON.stringify({ success: false, error: '音頻檔案太大（上限 90MB）' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const audioKey = `sermons/${id}/audio.mp3`;

        if (env.R2) {
            if (results[0].audio_key) {
                await env.R2.delete(results[0].audio_key);
            }
            await env.R2.put(audioKey, audio.stream(), {
                httpMetadata: {
                    contentType: 'audio/mpeg',
                    contentDisposition: `inline; filename="${audio.name}"`
                }
            });
        }

        await env.DB.prepare(
            'UPDATE sermons SET audio_key = ?, audio_name = ?, audio_size = ? WHERE id = ?'
        ).bind(audioKey, audio.name, audio.size, id).run();

        const updated = await env.DB.prepare('SELECT * FROM sermons WHERE id = ?').bind(id).all();

        return new Response(JSON.stringify({
            success: true,
            data: mapSermon(updated.results[0]),
            message: '音頻上傳成功'
        }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}
export async function getSermonAudio(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const { id } = params;
        const { results } = await env.DB.prepare(
            'SELECT audio_key, audio_name FROM sermons WHERE id = ?'
        ).bind(id).all();

        if (!results || results.length === 0 || !results[0].audio_key) {
            return new Response(JSON.stringify({ success: false, error: '此講道尚無音頻' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        if (!env.R2) {
            return new Response(JSON.stringify({ success: false, error: 'R2 儲存未設置' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const object = await env.R2.get(results[0].audio_key);
        if (!object) {
            return new Response(JSON.stringify({ success: false, error: '音頻檔案不存在' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const size = object.size;
        const commonHeaders = {
            'Content-Type': 'audio/mpeg',
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

                const chunk = await env.R2.get(results[0].audio_key, {
                    range: { offset: start, length }
                });

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
export async function deleteSermonAudio(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    if (!verifyAuth(request)) {
        return new Response(JSON.stringify({ success: false, error: '未授權' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }

    try {
        const { id } = params;
        const { results } = await env.DB.prepare(
            'SELECT audio_key FROM sermons WHERE id = ?'
        ).bind(id).all();

        if (results && results.length > 0 && results[0].audio_key) {
            if (env.R2) {
                await env.R2.delete(results[0].audio_key);
            }
            await env.DB.prepare(
                'UPDATE sermons SET audio_key = NULL, audio_name = NULL, audio_size = NULL WHERE id = ?'
            ).bind(id).run();
        }

        return new Response(JSON.stringify({ success: true, message: '音頻刪除成功' }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}

// ============================================================
// 講道大綱 PDF - 上傳 / 檢視 / 刪除
// 讓會眾一邊聽道、一邊看 PDF
// ============================================================

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

export async function uploadSermonPdf(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    if (!verifyAuth(request)) {
        return new Response(JSON.stringify({ success: false, error: '未授權' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }

    try {
        const { id } = params;
        const { results } = await env.DB.prepare('SELECT * FROM sermons WHERE id = ?').bind(id).all();
        if (!results || results.length === 0) {
            return new Response(JSON.stringify({ success: false, error: '講道不存在' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const formData = await request.formData();
        const pdf = formData.get('pdf');
        if (!pdf) {
            return new Response(JSON.stringify({ success: false, error: '請選擇 PDF 檔案' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        if (pdf.type !== 'application/pdf') {
            return new Response(JSON.stringify({ success: false, error: '請上傳 PDF 檔案' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        if (pdf.size > MAX_PDF_SIZE) {
            return new Response(JSON.stringify({ success: false, error: 'PDF 檔案太大（上限 20MB）' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const pdfKey = `sermons/${id}/outline.pdf`;

        if (env.R2) {
            if (results[0].pdf_key) {
                await env.R2.delete(results[0].pdf_key);
            }
            await env.R2.put(pdfKey, pdf.stream(), {
                httpMetadata: {
                    contentType: 'application/pdf',
                    contentDisposition: `inline; filename="${pdf.name}"`
                }
            });
        }

        await env.DB.prepare(
            'UPDATE sermons SET pdf_key = ?, pdf_name = ?, pdf_size = ? WHERE id = ?'
        ).bind(pdfKey, pdf.name, pdf.size, id).run();

        const updated = await env.DB.prepare('SELECT * FROM sermons WHERE id = ?').bind(id).all();

        return new Response(JSON.stringify({
            success: true,
            data: mapSermon(updated.results[0]),
            message: 'PDF 上傳成功'
        }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}

export async function getSermonPdf(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const { id } = params;
        const { results } = await env.DB.prepare(
            'SELECT pdf_key, pdf_name FROM sermons WHERE id = ?'
        ).bind(id).all();

        if (!results || results.length === 0 || !results[0].pdf_key) {
            return new Response(JSON.stringify({ success: false, error: '此講道尚無 PDF' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        if (!env.R2) {
            return new Response(JSON.stringify({ success: false, error: 'R2 儲存未設置' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const object = await env.R2.get(results[0].pdf_key);
        if (!object) {
            return new Response(JSON.stringify({ success: false, error: 'PDF 檔案不存在' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const headers = {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${results[0].pdf_name}"`,
            'Cache-Control': 'public, max-age=3600',
            ...cors()
        };

        return new Response(object.body, { headers });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}

export async function deleteSermonPdf(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    if (!verifyAuth(request)) {
        return new Response(JSON.stringify({ success: false, error: '未授權' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }

    try {
        const { id } = params;
        const { results } = await env.DB.prepare(
            'SELECT pdf_key FROM sermons WHERE id = ?'
        ).bind(id).all();

        if (results && results.length > 0 && results[0].pdf_key) {
            if (env.R2) {
                await env.R2.delete(results[0].pdf_key);
            }
            await env.DB.prepare(
                'UPDATE sermons SET pdf_key = NULL, pdf_name = NULL, pdf_size = NULL WHERE id = ?'
            ).bind(id).run();
        }

        return new Response(JSON.stringify({ success: true, message: 'PDF 刪除成功' }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}
