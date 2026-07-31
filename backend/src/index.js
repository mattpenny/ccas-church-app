import { Router } from 'itty-router';

const router = Router();

// 健康檢查
router.get('/', () => {
    return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'CCAC API 運行中',
        version: '1.0.0'
    }), {
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
});

// 登入 API (測試用)
router.post('/api/auth/login', async (request) => {
    try {
        const { password } = await request.json();
        const ADMIN_PASSWORD = globalThis.env?.ADMIN_PASSWORD || 'admin123';
        
        if (password === ADMIN_PASSWORD) {
            const token = btoa(JSON.stringify({ 
                authenticated: true, 
                timestamp: Date.now() 
            }));
            
            return new Response(JSON.stringify({
                success: true,
                token: token,
                message: '登入成功'
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        return new Response(JSON.stringify({
            success: false,
            message: '密碼錯誤'
        }), {
            status: 401,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: '登入失敗: ' + error.message
        }), {
            status: 400,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
});

// 獲取講道列表 (測試用)
router.get('/api/sermons', async () => {
    try {
        // 從 D1 獲取資料
        const DB = globalThis.DB;
        if (DB) {
            const { results } = await DB.prepare(
                'SELECT * FROM sermons WHERE published = 1 ORDER BY date DESC LIMIT 10'
            ).all();
            
            return new Response(JSON.stringify({
                success: true,
                data: results
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        
        // 如果沒有資料庫，返回範例資料
        return new Response(JSON.stringify({
            success: true,
            data: [
                { id: 1, title: '信心的行走', speaker: '陳大衛牧師', date: '2026-07-14', video_id: 'nq1e0g8jQpE' }
            ]
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
});

// 獲取活動列表 (測試用)
router.get('/api/events', async () => {
    try {
        const DB = globalThis.DB;
        if (DB) {
            const { results } = await DB.prepare(
                'SELECT * FROM events WHERE published = 1 ORDER BY start_date ASC LIMIT 10'
            ).all();
            
            return new Response(JSON.stringify({
                success: true,
                data: results
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            data: []
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
});

// 獲取公告列表 (測試用)
router.get('/api/announcements', async () => {
    try {
        const DB = globalThis.DB;
        if (DB) {
            const { results } = await DB.prepare(
                'SELECT * FROM announcements WHERE published = 1 ORDER BY created_at DESC LIMIT 10'
            ).all();
            
            return new Response(JSON.stringify({
                success: true,
                data: results
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            data: []
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
});

// 獲取文檔列表 (測試用)
router.get('/api/documents', async () => {
    try {
        const DB = globalThis.DB;
        if (DB) {
            const { results } = await DB.prepare(
                'SELECT * FROM documents WHERE published = 1 ORDER BY uploaded_at DESC LIMIT 10'
            ).all();
            
            return new Response(JSON.stringify({
                success: true,
                data: results
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            data: []
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
});

// 處理 CORS 預檢請求
router.options('*', () => {
    return new Response(null, { 
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
});

// 404 處理
router.all('*', async (request) => {
    const url = new URL(request.url);
    
    // 嘗試提供靜態檔案
    try {
        const asset = await globalThis.env?.ASSETS?.fetch(request);
        if (asset && asset.status !== 404) {
            return asset;
        }
    } catch (e) {
        // 繼續
    }
    
    return new Response(JSON.stringify({ 
        error: '找不到頁面',
        path: url.pathname
    }), {
        status: 404,
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
});

export default {
    async fetch(request, env, ctx) {
        // 設置全域環境變數
        globalThis.env = env;
        globalThis.DB = env.DB;
        globalThis.R2 = env.R2;
        
        try {
            return await router.handle(request);
        } catch (error) {
            return new Response(JSON.stringify({
                error: 'Worker 錯誤',
                message: error.message,
                stack: error.stack
            }), {
                status: 500,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }
};