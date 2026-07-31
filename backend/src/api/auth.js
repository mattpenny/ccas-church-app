import { cors } from '../utils/cors.js';

export async function handleAuth(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: cors() });
    }

    try {
        const { password } = await request.json();
        const adminPassword = globalThis.env.ADMIN_PASSWORD || 'ccacadmin2026';
        
        if (password === adminPassword) {
            const token = btoa(JSON.stringify({ 
                authenticated: true, 
                timestamp: Date.now() 
            }));
            
            return new Response(JSON.stringify({
                success: true,
                token: token,
                message: 'Login successful'
            }), {
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }

        return new Response(JSON.stringify({
            success: false,
            message: 'Invalid password'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: 'Login failed'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}

export function verifyAuth(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
    }
    
    try {
        const token = authHeader.split(' ')[1];
        const decoded = JSON.parse(atob(token));
        return decoded.authenticated === true;
    } catch {
        return false;
    }
}