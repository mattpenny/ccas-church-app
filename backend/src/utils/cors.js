// 允許跨來源存取的來源清單：
// - Cloudflare Worker 網域（網頁版 App／後台與 API 同源，此項僅供保險）
// - 本機 wrangler dev
// - Capacitor Android App 的 WebView（androidScheme: https => https://localhost）
const ALLOWED_ORIGINS = [
    'https://ccac-api.ccac-church.workers.dev',
    'https://localhost',
    'capacitor://localhost',
    'http://localhost',
    'http://localhost:8787',
    'http://127.0.0.1:8787'
];

function allowedOrigin(request) {
    if (!request || !request.headers || typeof request.headers.get !== 'function') return null;
    const origin = request.headers.get('Origin');
    if (!origin) return null;
    return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

/**
 * 產生 CORS 標頭。
 * 只有在來源於白名單內才回傳 Access-Control-Allow-Origin，
 * 其他來源不會取得授權標頭（瀏覽器會阻擋），避免任意網站呼叫管理 API。
 */
export function cors(request) {
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };

    const origin = allowedOrigin(request);
    if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}
