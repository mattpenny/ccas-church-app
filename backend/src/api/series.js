import { cors } from '../utils/cors.js';
import { verifyAuth } from './auth.js';

const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_COVER_SIZE = 5 * 1024 * 1024; // 5MB

function unauthorized() {
    return new Response(JSON.stringify({ success: false, error: '未授權' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors() }
    });
}

function badRequest(error) {
    return new Response(JSON.stringify({ success: false, error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors() }
    });
}

function serverError(error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors() }
    });
}

async function getSeriesById(env, id) {
    const { results } = await env.DB.prepare('SELECT * FROM sermon_series WHERE id = ?').bind(id).all();
    return results && results.length ? results[0] : null;
}

function withCover(series) {
    return {
        ...series,
        cover_url: series.cover_url || (series.cover_key ? `/api/series/${series.id}/cover` : null)
    };
}

export async function getSeries(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    try {
        const isAuth = verifyAuth(request);
        const query = isAuth
            ? `SELECT s.*,
                      (SELECT COUNT(*) FROM sermons x WHERE x.series_id = s.id) AS sermon_count
               FROM sermon_series s
               ORDER BY s.sort_order ASC, s.id ASC`
            : `SELECT s.*,
                      (SELECT COUNT(*) FROM sermons x WHERE x.series_id = s.id AND x.published = 1) AS sermon_count
               FROM sermon_series s
               WHERE s.published = 1
               ORDER BY s.sort_order ASC, s.id ASC`;
        const { results } = await env.DB.prepare(query).all();
        const data = (results || []).map(s => withCover(s));
        return new Response(JSON.stringify({ success: true, data }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return serverError(error);
    }
}

export async function getSeriesDetail(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    try {
        const { id } = params;
        const series = await getSeriesById(env, id);
        if (!series || (!verifyAuth(request) && series.published !== 1)) {
            return new Response(JSON.stringify({ success: false, error: '系列不存在' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const isAuth = verifyAuth(request);
        const query = isAuth
            ? `SELECT s.*, ser.title AS series_title
               FROM sermons s LEFT JOIN sermon_series ser ON s.series_id = ser.id
               WHERE s.series_id = ?
               ORDER BY s.date DESC, s.id DESC`
            : `SELECT s.*, ser.title AS series_title
               FROM sermons s LEFT JOIN sermon_series ser ON s.series_id = ser.id
               WHERE s.series_id = ? AND s.published = 1
               ORDER BY s.date DESC, s.id DESC`;
        const { results } = await env.DB.prepare(query).bind(id).all();

        return new Response(JSON.stringify({
            success: true,
            data: {
                series: withCover(series),
                sermons: results || []
            }
        }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return serverError(error);
    }
}

// 重新排序系列：接收 { ids: [3, 1, 2] }，依陣列順序寫入 sort_order = 0, 1, 2...
export async function reorderSeries(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    if (!verifyAuth(request)) return unauthorized();

    try {
        const data = await request.json();
        const ids = Array.isArray(data.ids)
            ? data.ids.map(Number).filter(n => !isNaN(n))
            : null;

        if (!ids || ids.length === 0) {
            return badRequest('請提供系列 ID 順序陣列');
        }

        const stmts = ids.map((id, index) =>
            env.DB.prepare('UPDATE sermon_series SET sort_order = ? WHERE id = ?').bind(index, id)
        );
        await env.DB.batch(stmts);

        return new Response(JSON.stringify({ success: true, message: '排序更新成功' }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return serverError(error);
    }
}

export async function createSeries(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    if (!verifyAuth(request)) return unauthorized();

    try {
        const data = await request.json();
        if (!data.title) return badRequest('系列名稱為必填');

        const result = await env.DB.prepare(`
            INSERT INTO sermon_series (title, subtitle, title_en, description, description_en, cover_url, sort_order, published)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.title,
            data.subtitle || null,
            data.title_en || data.title,
            data.description || '',
            data.description_en || data.description || '',
            data.cover_url || null,
            data.sort_order !== undefined ? Number(data.sort_order) : 0,
            data.published !== undefined ? Number(data.published) : 1
        ).run();

        const series = await getSeriesById(env, result.meta.last_row_id);
        return new Response(JSON.stringify({ success: true, data: withCover(series), message: '系列建立成功' }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return serverError(error);
    }
}
export async function updateSeries(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    if (!verifyAuth(request)) return unauthorized();

    try {
        const { id } = params;
        const data = await request.json();
        const allowedFields = ['title', 'subtitle', 'title_en', 'description', 'description_en', 'cover_url', 'sort_order', 'published'];
        const fields = [];
        const values = [];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(data[field]);
            }
        }

        if (fields.length === 0) return badRequest('沒有需要更新的欄位');

        values.push(id);
        await env.DB.prepare(`UPDATE sermon_series SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

        const series = await getSeriesById(env, id);
        return new Response(JSON.stringify({ success: true, data: withCover(series), message: '系列更新成功' }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return serverError(error);
    }
}

export async function deleteSeries(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    if (!verifyAuth(request)) return unauthorized();

    try {
        const { id } = params;
        const series = await getSeriesById(env, id);
        if (!series) return badRequest('系列不存在');

        if (env.R2 && series.cover_key) {
            await env.R2.delete(series.cover_key);
        }

        // 系列刪除後，其講道變為「單次講道」
        await env.DB.prepare('UPDATE sermons SET series_id = NULL WHERE series_id = ?').bind(id).run();
        await env.DB.prepare('DELETE FROM sermon_series WHERE id = ?').bind(id).run();

        return new Response(JSON.stringify({ success: true, message: '系列刪除成功' }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return serverError(error);
    }
}

export async function uploadSeriesCover(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    if (!verifyAuth(request)) return unauthorized();

    try {
        const { id } = params;
        const series = await getSeriesById(env, id);
        if (!series) return badRequest('系列不存在');

        const formData = await request.formData();
        const cover = formData.get('cover');
        if (!cover) return badRequest('請選擇封面圖片');

        if (!ALLOWED_COVER_TYPES.includes(cover.type)) {
            return badRequest('不支援的圖片格式（請使用 JPG、PNG、WEBP、GIF）');
        }
        if (cover.size > MAX_COVER_SIZE) {
            return badRequest('封面圖片太大（上限 5MB）');
        }

        const ext = cover.type.split('/')[1] === 'jpeg' ? 'jpg' : cover.type.split('/')[1];
        const coverKey = `series/${id}/cover.${ext}`;

        if (env.R2) {
            if (series.cover_key) {
                await env.R2.delete(series.cover_key);
            }
            await env.R2.put(coverKey, cover.stream(), {
                httpMetadata: { contentType: cover.type }
            });
        }

        await env.DB.prepare('UPDATE sermon_series SET cover_key = ? WHERE id = ?').bind(coverKey, id).run();

        const updated = await getSeriesById(env, id);
        return new Response(JSON.stringify({ success: true, data: withCover(updated), message: '封面上傳成功' }), {
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return serverError(error);
    }
}

export async function getSeriesCover(request, env, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }
    try {
        const { id } = params;
        const series = await getSeriesById(env, id);
        if (!series || !series.cover_key) {
            return new Response(JSON.stringify({ success: false, error: '封面不存在' }), {
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

        const object = await env.R2.get(series.cover_key);
        if (!object) {
            return new Response(JSON.stringify({ success: false, error: '封面檔案不存在' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const headers = {
            'Content-Type': object.httpMetadata?.contentType || 'image/png',
            'Cache-Control': 'public, max-age=86400',
            ...cors()
        };

        return new Response(object.body, { headers });
    } catch (error) {
        return serverError(error);
    }
}