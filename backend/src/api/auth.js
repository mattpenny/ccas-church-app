import { cors } from '../utils/cors.js';

// Token 有效期：12 小時（過期後需重新登入）
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// 讀取管理員密碼（只從環境變數／Secret 讀取，不再有硬編碼後備密碼）
function getAdminPassword(env) {
    const value = env && env.ADMIN_PASSWORD;
    return typeof value === 'string' && value.length > 0 ? value : null;
}

// 固定時間字串比較，避免以回應時間推測密碼
function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

function base64UrlEncode(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function importHmacKey(secret) {
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
}

async function signPayload(payload, secret) {
    const key = await importHmacKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return base64UrlEncode(new Uint8Array(signature));
}

async function createToken(signingKey) {
    const payload = base64UrlEncode(encoder.encode(JSON.stringify({
        authenticated: true,
        iat: Date.now(),
        exp: Date.now() + TOKEN_TTL_MS
    })));
    return `${payload}.${await signPayload(payload, signingKey)}`;
}

// ============================================================
// 密碼雜湊（PBKDF2-SHA256）— 供後台「🔑 更改密碼」使用
// 儲存格式：pbkdf2$<iterations>$<saltBase64Url>$<hashBase64Url>
// ============================================================

// settings 表中存放自訂密碼雜湊的 key（絕不會透過任何公開 API 回傳）
const PASSWORD_HASH_KEY = 'admin_password_hash';

// PBKDF2 迭代次數：在 Workers 免費方案 CPU 限制內兼顧安全性
const PBKDF2_ITERATIONS = 10000;
const PBKDF2_KEY_BITS = 256;

function bytesToBase64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function pbkdf2Derive(password, salt, iterations) {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
        keyMaterial,
        PBKDF2_KEY_BITS
    );
    return new Uint8Array(bits);
}

function encodePasswordHash(salt, hash, iterations) {
    return `pbkdf2$${iterations}$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`;
}

async function verifyPasswordHash(password, stored) {
    try {
        const parts = String(stored).split('$');
        if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
        const iterations = parseInt(parts[1], 10);
        if (!Number.isFinite(iterations) || iterations <= 0) return false;
        const salt = base64UrlToBytes(parts[2]);
        const expected = base64UrlToBytes(parts[3]);
        const actual = await pbkdf2Derive(password, salt, iterations);
        if (actual.length !== expected.length) return false;
        let diff = 0;
        for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
        return diff === 0;
    } catch {
        return false;
    }
}

// 讀取 D1 settings 內的自訂密碼雜湊（讀取失敗時退回 Cloudflare Secret 驗證，不影響登入）
async function getStoredPasswordHash(env) {
    if (!env || !env.DB) return null;
    try {
        const { results } = await env.DB.prepare(
            'SELECT value FROM settings WHERE key = ?'
        ).bind(PASSWORD_HASH_KEY).all();
        const value = results && results[0] ? results[0].value : null;
        return (typeof value === 'string' && value.startsWith('pbkdf2$')) ? value : null;
    } catch (error) {
        console.error('Read admin password hash error:', error && error.message);
        return null;
    }
}

/**
 * 目前可用的登入憑證：
 * - hash：管理員在後台「🔑 更改密碼」設定的自訂密碼（存 D1 settings）
 * - secret：Cloudflare Secret ADMIN_PASSWORD（永遠可作為「主密碼」登入／救援）
 */
async function getAuthState(env) {
    const hash = await getStoredPasswordHash(env);
    const secret = getAdminPassword(env);
    return { hash, secret, hasCredential: Boolean(hash || secret) };
}

// Token 簽章金鑰：由 secret 與 hash 組合，任一變更即讓所有舊 token 立即失效
function tokenSigningKey(state) {
    return JSON.stringify([state.secret, state.hash]);
}

// 驗證登入密碼：先比對 D1 自訂密碼，再比對 Cloudflare Secret（主密碼）
async function verifyLoginPassword(password, state) {
    if (state.hash && (await verifyPasswordHash(password, state.hash))) return true;
    if (state.secret && safeEqual(password, state.secret)) return true;
    return false;
}

function jsonResponse(body, status, request) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors(request) }
    });
}

export async function handleAuth(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors(request) });
    }

    const state = await getAuthState(env);

    // Fail-closed：沒有任何可用憑證（Secret 與自訂密碼皆未設定）時一律拒絕登入
    if (!state.hasCredential) {
        console.error('ADMIN_PASSWORD 未設定且無自訂密碼，拒絕登入（請用 wrangler secret put ADMIN_PASSWORD 設定）');
        return jsonResponse({ success: false, message: 'Server not configured' }, 500, request);
    }

    try {
        const { password } = await request.json();

        const passwordOk = typeof password === 'string' && password.length > 0
            && (await verifyLoginPassword(password, state));

        if (!passwordOk) {
            return jsonResponse({ success: false, message: 'Invalid password' }, 401, request);
        }

        return jsonResponse({
            success: true,
            token: await createToken(tokenSigningKey(state)),
            message: 'Login successful'
        }, 200, request);
    } catch (error) {
        console.error('Login error:', error && error.message);
        return jsonResponse({ success: false, message: 'Login failed' }, 400, request);
    }
}

/**
 * 驗證 Authorization: Bearer <payload>.<hmac> token
 * - 簽章金鑰由 ADMIN_PASSWORD（Cloudflare Secret）與自訂密碼雜湊組合，無法偽造
 * - 任一密碼變更（後台更改密碼或 Cloudflare 修改 Secret）即讓所有舊 token 失效
 * - 檢查 exp，過期即失效
 */
export async function verifyAuth(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
    }

    const token = authHeader.slice(7).trim();
    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;
    if (!payload || !signature) return false;

    try {
        const state = await getAuthState(env);
        if (!state.hasCredential) return false;

        const expected = await signPayload(payload, tokenSigningKey(state));
        if (!safeEqual(signature, expected)) return false;

        const decoded = JSON.parse(decoder.decode(base64UrlDecode(payload)));
        if (decoded.authenticated !== true) return false;
        if (typeof decoded.exp !== 'number' || Date.now() > decoded.exp) return false;

        return true;
    } catch {
        return false;
    }
}

/**
 * PUT /api/auth/password — 後台「🔑 更改密碼」
 * 需要有效的管理員 token，並再次輸入目前密碼確認。
 * 成功後：新密碼以 PBKDF2 雜湊存入 D1，所有舊 token 立即失效（需重新登入）。
 * Cloudflare Secret ADMIN_PASSWORD 仍可作為主密碼登入／救援。
 */
export async function handlePasswordChange(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors(request) });
    }

    if (!(await verifyAuth(request, env))) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401, request);
    }

    try {
        const data = await request.json();
        const currentPassword = typeof data.current_password === 'string' ? data.current_password : '';
        const newPassword = typeof data.new_password === 'string' ? data.new_password : '';

        if (!currentPassword || !newPassword) {
            return jsonResponse({ success: false, error: '請填寫目前密碼與新密碼' }, 400, request);
        }
        if (newPassword.length < 8) {
            return jsonResponse({ success: false, error: '新密碼至少需要 8 個字元' }, 400, request);
        }
        if (newPassword.length > 128) {
            return jsonResponse({ success: false, error: '新密碼過長（上限 128 字元）' }, 400, request);
        }
        if (newPassword === currentPassword) {
            return jsonResponse({ success: false, error: '新密碼不可與目前密碼相同' }, 400, request);
        }

        const state = await getAuthState(env);
        if (!state.hasCredential) {
            return jsonResponse({ success: false, error: 'Server not configured' }, 500, request);
        }
        if (!(await verifyLoginPassword(currentPassword, state))) {
            return jsonResponse({ success: false, error: '目前密碼不正確' }, 400, request);
        }

        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await pbkdf2Derive(newPassword, salt, PBKDF2_ITERATIONS);

        await env.DB.prepare(
            `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
        ).bind(PASSWORD_HASH_KEY, encodePasswordHash(salt, hash, PBKDF2_ITERATIONS)).run();

        return jsonResponse({ success: true, message: '密碼已更新，請重新登入' }, 200, request);
    } catch (error) {
        console.error('Password change error:', error && error.message);
        return jsonResponse({ success: false, error: 'Internal server error' }, 500, request);
    }
}
