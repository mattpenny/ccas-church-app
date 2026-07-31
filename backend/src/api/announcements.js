import { cors } from '../utils/cors.js';
import { verifyAuth } from './auth.js';

export async function getAnnouncements(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const { results } = await globalThis.DB.prepare(`
            SELECT * FROM announcements 
            WHERE published = 1 
            ORDER BY created_at DESC, sort_order DESC
        `).all();
        
        return new Response(JSON.stringify({
            success: true,
            data: results
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

export async function getAnnouncement(request, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const { id } = params;
        const { results } = await globalThis.DB.prepare(
            'SELECT * FROM announcements WHERE id = ?'
        ).bind(id).all();
        
        if (!results || results.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Announcement not found'
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

export async function createAnnouncement(request) {
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
        const required = ['title', 'description'];
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
            INSERT INTO announcements (
                title, title_en, description, description_en,
                time_label, time_label_en,
                modal_title, modal_title_en,
                modal_sub, modal_sub_en,
                modal_content, modal_content_en,
                published
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.title,
            data.title_en || data.title,
            data.description,
            data.description_en || data.description,
            data.time_label || '刚刚',
            data.time_label_en || 'Just now',
            data.modal_title || data.title,
            data.modal_title_en || data.title_en || data.title,
            data.modal_sub || null,
            data.modal_sub_en || data.modal_sub || null,
            data.modal_content || data.description,
            data.modal_content_en || data.modal_content || data.description_en || data.description,
            data.published !== undefined ? data.published : 1
        ).run();

        const { results } = await globalThis.DB.prepare(
            'SELECT * FROM announcements WHERE id = ?'
        ).bind(result.meta.last_row_id).all();

        return new Response(JSON.stringify({
            success: true,
            data: results[0],
            message: 'Announcement created successfully'
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

export async function updateAnnouncement(request, params) {
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
            'title', 'title_en', 'description', 'description_en',
            'time_label', 'time_label_en',
            'modal_title', 'modal_title_en',
            'modal_sub', 'modal_sub_en',
            'modal_content', 'modal_content_en',
            'published'
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
        const query = `UPDATE announcements SET ${fields.join(', ')} WHERE id = ?`;
        
        await globalThis.DB.prepare(query).bind(...values).run();

        const { results } = await globalThis.DB.prepare(
            'SELECT * FROM announcements WHERE id = ?'
        ).bind(id).all();

        return new Response(JSON.stringify({
            success: true,
            data: results[0],
            message: 'Announcement updated successfully'
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

export async function deleteAnnouncement(request, params) {
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
            'DELETE FROM announcements WHERE id = ?'
        ).bind(id).run();

        return new Response(JSON.stringify({
            success: true,
            message: 'Announcement deleted successfully'
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