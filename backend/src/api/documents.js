import { cors } from '../utils/cors.js';
import { verifyAuth } from './auth.js';

// Allowed file types - only documents and images
const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function getDocuments(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const url = new URL(request.url);
        const category = url.searchParams.get('category') || 'all';
        const limit = parseInt(url.searchParams.get('limit')) || 100;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        
        let query = 'SELECT * FROM documents WHERE published = 1';
        let params = [];
        
        if (category !== 'all') {
            query += ' AND category = ?';
            params.push(category);
        }
        
        query += ' ORDER BY uploaded_at DESC, sort_order DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        const { results } = await globalThis.DB.prepare(query)
            .bind(...params)
            .all();
        
        // Generate download URLs
        const documents = results.map(doc => ({
            ...doc,
            download_url: `${globalThis.env.FRONTEND_URL || ''}/api/documents/${doc.id}/download`
        }));
        
        return new Response(JSON.stringify({
            success: true,
            data: documents
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

export async function getDocument(request, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const { id } = params;
        const { results } = await globalThis.DB.prepare(
            'SELECT * FROM documents WHERE id = ?'
        ).bind(id).all();
        
        if (!results || results.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: '找不到文檔'
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

export async function uploadDocument(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    if (!verifyAuth(request)) {
        return new Response(JSON.stringify({
            success: false,
            error: '未授權'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const title = formData.get('title');
        const description = formData.get('description') || '';
        const category = formData.get('category') || 'general';
        
        if (!file || !title) {
            return new Response(JSON.stringify({
                success: false,
                error: '請選擇檔案並填寫標題'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        // Check file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return new Response(JSON.stringify({
                success: false,
                error: '不支援的檔案格式。請上傳 PDF、JPG、PNG 或 Word 檔案'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return new Response(JSON.stringify({
                success: false,
                error: '檔案太大，請上傳小於 10MB 的檔案'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `${timestamp}-${cleanName}`;
        const fileKey = `documents/${category}/${fileName}`;

        // Upload to R2
        const r2 = globalThis.R2;
        await r2.put(fileKey, file.stream(), {
            httpMetadata: {
                contentType: file.type,
                contentDisposition: `inline; filename="${file.name}"`
            }
        });

        // Save to database
        const result = await globalThis.DB.prepare(`
            INSERT INTO documents (
                title, title_en, file_name, file_key, file_size, file_type,
                description, description_en, category, published
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            title,
            title,
            file.name,
            fileKey,
            file.size,
            file.type,
            description,
            description,
            category,
            1
        ).run();

        const { results } = await globalThis.DB.prepare(
            'SELECT * FROM documents WHERE id = ?'
        ).bind(result.meta.last_row_id).all();

        return new Response(JSON.stringify({
            success: true,
            data: results[0],
            message: '文檔上傳成功'
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

export async function deleteDocument(request, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    if (!verifyAuth(request)) {
        return new Response(JSON.stringify({
            success: false,
            error: '未授權'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }

    try {
        const { id } = params;
        
        // Get document info first
        const { results } = await globalThis.DB.prepare(
            'SELECT file_key FROM documents WHERE id = ?'
        ).bind(id).all();
        
        if (!results || results.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: '找不到文檔'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        // Delete from R2
        const r2 = globalThis.R2;
        await r2.delete(results[0].file_key);

        // Delete from database
        await globalThis.DB.prepare(
            'DELETE FROM documents WHERE id = ?'
        ).bind(id).run();

        return new Response(JSON.stringify({
            success: true,
            message: '文檔刪除成功'
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

// Download document from R2
export async function downloadDocument(request, params) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const { id } = params;
        
        const { results } = await globalThis.DB.prepare(
            'SELECT file_key, file_name FROM documents WHERE id = ?'
        ).bind(id).all();
        
        if (!results || results.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: '找不到文檔'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const r2 = globalThis.R2;
        const object = await r2.get(results[0].file_key);
        
        if (!object) {
            return new Response(JSON.stringify({
                success: false,
                error: '檔案不存在'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        const headers = {
            'Content-Type': object.httpMetadata.contentType || 'application/octet-stream',
            'Content-Disposition': `inline; filename="${results[0].file_name}"`,
            ...cors()
        };

        return new Response(object.body, { headers });
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