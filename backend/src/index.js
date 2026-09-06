import { cors } from './utils/cors.js';
import { handleAuth } from './api/auth.js';
import { getSermons, getSermon, createSermon, updateSermon, deleteSermon, reorderSermons,
         uploadSermonAudio, getSermonAudio, deleteSermonAudio,
         uploadSermonPdf, getSermonPdf, deleteSermonPdf } from './api/sermons.js';
import { getSeries, getSeriesDetail, createSeries, updateSeries, deleteSeries, reorderSeries,
         uploadSeriesCover, getSeriesCover } from './api/series.js';
import { getRssFeed } from './api/rss.js';
import { getEvents, getEvent, createEvent, updateEvent, deleteEvent } from './api/events.js';
import { getAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement, deleteAnnouncement } from './api/announcements.js';
import { getDocuments, getDocument, uploadDocument, deleteDocument, downloadDocument } from './api/documents.js';

export default {
    async fetch(request, env, ctx) {
        const method = request.method;
        if (method === 'OPTIONS') {
            return new Response(null, { headers: cors() });
        }

        // HEAD → 當作 GET 處理（Apple Podcasts 要求 feed 與 enclosure URL 必須支援 HTTP HEAD）
        // 回傳相同 status 與 headers，但無 body
        if (method === 'HEAD') {
            const getRequest = new Request(request.url, {
                method: 'GET',
                headers: request.headers,
                redirect: request.redirect
            });
            const res = await handleRequest(getRequest, env, ctx);
            return new Response(null, { status: res.status, statusText: res.statusText, headers: res.headers });
        }

        return handleRequest(request, env, ctx);
    }
};

async function handleRequest(request, env, ctx) {
        const url = new URL(request.url);
        // Normalize path: lowercased and strip trailing slash
        let path = url.pathname.toLowerCase();
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        
        const method = request.method;

        // --- AUTH ROUTES ---
        if (path === '/api/auth/login' && method === 'POST') {
            return handleAuth(request, env);
        }

        // --- SERMONS ROUTES ---
        if (path === '/api/sermons' && method === 'GET') return getSermons(request, env);
        if (path === '/api/sermons' && method === 'POST') return createSermon(request, env);
        if (path === '/api/sermons/reorder' && method === 'POST') return reorderSermons(request, env);
        if (path.match(/^\/api\/sermons\/\d+$/)) {
            const id = path.split('/')[3];
            if (method === 'GET') return getSermon(request, env, { id });
            if (method === 'PUT' || method === 'PATCH') return updateSermon(request, env, { id });
            if (method === 'DELETE') return deleteSermon(request, env, { id });
        }
        // 講道音頻（支援 Range 播放）
        if (path.match(/^\/api\/sermons\/\d+\/audio$/)) {
            const id = path.split('/')[3];
            if (method === 'GET') return getSermonAudio(request, env, { id });
            if (method === 'POST') return uploadSermonAudio(request, env, { id });
            if (method === 'DELETE') return deleteSermonAudio(request, env, { id });
        }
        // 音頻 .mp3 結尾別名（Apple Podcasts 要求 enclosure URL 有副檔名，feed 使用此網址）
        if (path.match(/^\/api\/sermons\/\d+\/audio\.mp3$/)) {
            const id = path.split('/')[3];
            if (method === 'GET') return getSermonAudio(request, env, { id });
        }
        // 講道大綱 PDF
        if (path.match(/^\/api\/sermons\/\d+\/pdf$/)) {
            const id = path.split('/')[3];
            if (method === 'GET') return getSermonPdf(request, env, { id });
            if (method === 'POST') return uploadSermonPdf(request, env, { id });
            if (method === 'DELETE') return deleteSermonPdf(request, env, { id });
        }

        // --- SERIES ROUTES ---
        if (path === '/api/series' && method === 'GET') return getSeries(request, env);
        if (path === '/api/series' && method === 'POST') return createSeries(request, env);
        if (path === '/api/series/reorder' && method === 'POST') return reorderSeries(request, env);
        if (path.match(/^\/api\/series\/\d+$/)) {
            const id = path.split('/')[3];
            if (method === 'GET') return getSeriesDetail(request, env, { id });
            if (method === 'PUT' || method === 'PATCH') return updateSeries(request, env, { id });
            if (method === 'DELETE') return deleteSeries(request, env, { id });
        }
        if (path.match(/^\/api\/series\/\d+\/cover$/)) {
            const id = path.split('/')[3];
            if (method === 'GET') return getSeriesCover(request, env, { id });
            if (method === 'POST') return uploadSeriesCover(request, env, { id });
        }

        // --- RSS PODCAST FEED ---
        if ((path === '/feed.xml' || path === '/rss.xml') && method === 'GET') return getRssFeed(request, env);
        // 系列專屬 Feed：/feed/series/1.xml
        if (path.match(/^\/feed\/series\/\d+\.xml$/) && method === 'GET') {
            const id = path.split('/')[3].replace('.xml', '');
            return getRssFeed(request, env, { seriesId: id });
        }

        // --- EVENTS ROUTES ---
        if (path === '/api/events' && method === 'GET') return getEvents(request, env);
        if (path === '/api/events' && method === 'POST') return createEvent(request, env);
        if (path.match(/^\/api\/events\/\d+$/)) {
            const id = path.split('/')[3];
            if (method === 'GET') return getEvent(request, env, { id });
            if (method === 'PUT' || method === 'PATCH') return updateEvent(request, env, { id });
            if (method === 'DELETE') return deleteEvent(request, env, { id });
        }

        // --- ANNOUNCEMENTS ROUTES ---
        if (path === '/api/announcements' && method === 'GET') return getAnnouncements(request, env);
        if (path === '/api/announcements' && method === 'POST') return createAnnouncement(request, env);
        if (path.match(/^\/api\/announcements\/\d+$/)) {
            const id = path.split('/')[3];
            if (method === 'GET') return getAnnouncement(request, env, { id });
            if (method === 'PUT' || method === 'PATCH') return updateAnnouncement(request, env, { id });
            if (method === 'DELETE') return deleteAnnouncement(request, env, { id });
        }

        // --- DOCUMENTS ROUTES ---
        if (path === '/api/documents' && method === 'GET') return getDocuments(request, env);
        // 同時支援 /api/documents 與 /api/documents/upload
        if ((path === '/api/documents' || path === '/api/documents/upload') && method === 'POST') {
            return uploadDocument(request, env);
        }
        if (path.match(/^\/api\/documents\/\d+\/download$/)) {
            const id = path.split('/')[3];
            return downloadDocument(request, env, { id });
        }
        if (path.match(/^\/api\/documents\/\d+$/)) {
            const id = path.split('/')[3];
            if (method === 'GET') return getDocument(request, env, { id });
            if (method === 'DELETE') return deleteDocument(request, env, { id });
        }

        // --- STATIC ASSETS FALLBACK ---
        if (env.ASSETS) {
            try {
                const asset = await env.ASSETS.fetch(request);
                if (asset && asset.status !== 404) return asset;
            } catch (e) {}
        }

        // 404 Not Found
        return new Response(JSON.stringify({
            error: '找不到頁面',
            path: path
        }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }