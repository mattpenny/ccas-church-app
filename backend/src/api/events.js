import { cors } from '../utils/cors.js';
import { verifyAuth } from './auth.js';

export async function getEvents(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const isAuth = verifyAuth(request);
        const query = isAuth 
            ? 'SELECT * FROM events ORDER BY start_date ASC, sort_order DESC'
            : 'SELECT * FROM events WHERE published = 1 ORDER BY start_date ASC, sort_order DESC';

        const { results } = await env.DB.prepare(query).all();
        
        return new Response(JSON.stringify({
            success: true,
            data: results || []
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

export async function getEvent(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const { id } = params;
        const { results } = await env.DB.prepare(
            'SELECT * FROM events WHERE id = ?'
        ).bind(id).all();
        
        if (!results || results.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Event not found'
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

export async function createEvent(request, env) {
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
        const required = ['title', 'day', 'month', 'weekday', 'time', 'location'];
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

        const result = await env.DB.prepare(`
            INSERT INTO events (
                title, title_en, day, month, month_en,
                weekday, weekday_en, time, location, location_en,
                description, description_en, start_date, end_date, published
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.title,
            data.title_en || data.title,
            data.day,
            data.month,
            data.month_en || data.month,
            data.weekday,
            data.weekday_en || data.weekday,
            data.time,
            data.location,
            data.location_en || data.location,
            data.description || null,
            data.description_en || data.description || null,
            data.start_date || null,
            data.end_date || null,
            data.published !== undefined ? data.published : 1
        ).run();

        const { results } = await env.DB.prepare(
            'SELECT * FROM events WHERE id = ?'
        ).bind(result.meta.last_row_id).all();

        return new Response(JSON.stringify({
            success: true,
            data: results[0],
            message: 'Event created successfully'
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

export async function updateEvent(request, env, params) {
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
            'title', 'title_en', 'day', 'month', 'month_en',
            'weekday', 'weekday_en', 'time', 'location', 'location_en',
            'description', 'description_en', 'start_date', 'end_date', 'published'
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
        const query = `UPDATE events SET ${fields.join(', ')} WHERE id = ?`;
        
        await env.DB.prepare(query).bind(...values).run();

        const { results } = await env.DB.prepare(
            'SELECT * FROM events WHERE id = ?'
        ).bind(id).all();

        return new Response(JSON.stringify({
            success: true,
            data: results[0],
            message: 'Event updated successfully'
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

export async function deleteEvent(request, env, params) {
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
        await env.DB.prepare(
            'DELETE FROM events WHERE id = ?'
        ).bind(id).run();

        return new Response(JSON.stringify({
            success: true,
            message: 'Event deleted successfully'
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