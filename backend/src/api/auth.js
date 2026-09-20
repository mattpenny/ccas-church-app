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

async function createToken(secret) {
    const payload = base64UrlEncode(encoder.encode(JSON.stringify({
        authenticated: true,
        iat: Date.now(),
        exp: Date.now() + TOKEN_TTL_MS
    })));
    return `${payload}.${await signPayload(payload, secret)}`;
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

    const adminPassword = getAdminPassword(env);

    // Fail-closed：未設定 ADMIN_PASSWORD 時一律拒絕登入，不再回退到任何預設密碼
    if (!adminPassword) {
        console.error('ADMIN_PASSWORD 未設定，拒絕登入（請用 wrangler secret put ADMIN_PASSWORD 設定）');
        return jsonResponse({ success: false, message: 'Server not configured' }, 500, request);
    }

    try {
        const { password } = await request.json();

        if (!safeEqual(password, adminPassword)) {
            return jsonResponse({ success: false, message: 'Invalid password' }, 401, request);
        }

        return jsonResponse({
            success: true,
            token: await createToken(adminPassword),
            message: 'Login successful'
        }, 200, request);
    } catch (error) {
        console.error('Login error:', error && error.message);
        return jsonResponse({ success: false, message: 'Login failed' }, 400, request);
    }
}

/**
 * 驗證 Authorization: Bearer <payload>.<hmac> token
 * - 簽章以 ADMIN_PASSWORD 作 HMAC-SHA256，無法偽造
 * - 檢查 exp，過期即失效
 */
export async function verifyAuth(request, env) {
    const secret = getAdminPassword(env);
    if (!secret) return false;

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
        const expected = await signPayload(payload, secret);
        if (!safeEqual(signature, expected)) return false;

        const decoded = JSON.parse(decoder.decode(base64UrlDecode(payload)));
        if (decoded.authenticated !== true) return false;
        if (typeof decoded.exp !== 'number' || Date.now() > decoded.exp) return false;

        return true;
    } catch {
        return false;
    }
}
