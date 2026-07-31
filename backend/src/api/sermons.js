import { cors } from '../utils/cors.js';
import { verifyAuth } from './auth.js';

export async function getSermons(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const url = new URL(request.url);
        const type = url.searchParams.get('type') || 'all';
        const limit = parseInt(url.searchParams.get('limit')) || 100;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        
        let query = 'SELECT * FROM sermons WHERE published = 1';
        let params = [];
        
        if (type !== 'all') {
            query += ' AND type = ?';
            params.push(type);
        }
        
        query += ' ORDER BY date DESC, sort_order DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        const { results } = await globalThis.DB.prepare(query)
            .bind(...params)
            .all();
        
        return new Response(JSON.stringify({
            success: true,
            data: results,
            total: results.length,
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

export async function getSermon(request, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const { id } = params;
        const { results } = await globalThis.DB.prepare(
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
            data: results[0]
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

export async function createSermon(request) {
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

        const result = await globalThis.DB.prepare(`
            INSERT INTO sermons (
                title, title_en, speaker, speaker_en, date, date_short,
                video_id, video_url, audio_url, duration,
                description, description_en, type, published
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.title,
            data.title_en || data.title,
            data.speaker,
            data.speaker_en || data.speaker,
            data.date,
            data.date_short || data.date,
            data.video_id || null,
            data.video_url || null,
            data.audio_url || null,
            data.duration || null,
            data.description || null,
            data.description_en || data.description || null,
            data.type || 'video',
            data.published !== undefined ? data.published : 1
        ).run();

        const { results } = await globalThis.DB.prepare(
            'SELECT * FROM sermons WHERE id = ?'
        ).bind(result.meta.last_row_id).all();

        return new Response(JSON.stringify({
            success: true,
            data: results[0],
            message: 'Sermon created successfully'
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

export async function updateSermon(request, params) {
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

        // Build dynamic update query
        const fields = [];
        const values = [];
        
        const allowedFields = [
            'title', 'title_en', 'speaker', 'speaker_en', 'date', 'date_short',
            'video_id', 'video_url', 'audio_url', 'duration',
            'description', 'description_en', 'type', 'published'
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
        const query = `UPDATE sermons SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        
        await globalThis.DB.prepare(query).bind(...values).run();

        const { results } = await globalThis.DB.prepare(
            'SELECT * FROM sermons WHERE id = ?'
        ).bind(id).all();

        return new Response(JSON.stringify({
            success: true,
            data: results[0],
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

export async function deleteSermon(request, params) {
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
        await globalThis.DB.prepare(
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