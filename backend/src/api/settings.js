import { cors } from '../utils/cors.js';
import { verifyAuth } from './auth.js';

// 前台可讀取的設定白名單（避免外洩其他後台設定）
const PUBLIC_KEYS = ['site_title', 'site_description', 'website_url', 'facebook_url', 'give_url'];

// 可由管理後台「🔗 更新連結」修改的設定
const EDITABLE_KEYS = ['website_url', 'facebook_url', 'give_url'];

// 資料庫尚未寫入（或留空）時使用的預設值，與 App 原本的內建值一致
const DEFAULTS = {
    site_title: 'CCAC Granada Hills',
    site_description: 'Chinese Christian Assembly',
    website_url: 'https://ccacgranadahills.org',
    facebook_url: 'https://facebook.com',
    give_url: 'https://ccacgranadahills.org/give'
};

function jsonResponse(body, status, request) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors(request) }
    });
}

/**
 * 正規化使用者輸入的網址。
 * - 可省略 https://（例如輸入 facebook.com/ccac）
 * - 只接受 http / https，其他協定（javascript:、data:…）一律拒絕並回傳 null
 * - 空字串代表「使用預設值」，回傳 ''
 */
function normalizeUrl(value) {
    if (value === null || value === undefined) return '';
    const raw = String(value).trim();
    if (!raw) return '';

    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;

    try {
        const parsed = new URL(withScheme);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        if (!parsed.hostname) return null;
        return parsed.href;
    } catch {
        return null;
    }
}

/**
 * GET /api/settings
 * 公開讀取（前台 App 需要），只回傳白名單內的設定，並自動補上預設值。
 */
export async function getSettings(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors(request) });
    }

    try {
        const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
        const stored = {};
        (results || []).forEach(row => {
            if (row && row.key) stored[row.key] = row.value;
        });

        const settings = {};
        PUBLIC_KEYS.forEach(key => {
            const value = stored[key];
            const isEmpty = value === null || value === undefined || String(value).trim() === '';
            settings[key] = isEmpty ? DEFAULTS[key] : String(value);
        });

        return jsonResponse({ success: true, data: settings }, 200, request);
    } catch (error) {
        console.error('API error:', error && error.message);
        return jsonResponse({ success: false, error: 'Internal server error' }, 500, request);
    }
}

/**
 * PUT /api/settings（亦接受 POST / PATCH）
 * 需管理員授權。可更新 website_url、facebook_url、give_url。
 * 傳空字串 = 恢復預設值。
 */
export async function updateSettings(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors(request) });
    }

    if (!(await verifyAuth(request, env))) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
    }

    try {
        const data = await request.json();
        const updates = [];

        for (const key of EDITABLE_KEYS) {
            if (!data || !(key in data)) continue;
            const normalized = normalizeUrl(data[key]);
            if (normalized === null) {
                return jsonResponse({
                    success: false,
                    error: `網址格式不正確（${key}），請輸入 http:// 或 https:// 開頭的網址`
                }, 400, request);
            }
            updates.push([key, normalized]);
        }

        if (updates.length === 0) {
            return jsonResponse({ success: false, error: '沒有可更新的連結' }, 400, request);
        }

        const stmts = updates.map(([key, value]) => env.DB.prepare(
            `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
        ).bind(key, value));

        await env.DB.batch(stmts);

        // 回傳更新後的值（與 GET 相同格式）
        return await getSettings(request, env);
    } catch (error) {
        console.error('API error:', error && error.message);
        return jsonResponse({ success: false, error: 'Internal server error' }, 500, request);
    }
}
