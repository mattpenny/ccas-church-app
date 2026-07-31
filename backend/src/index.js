import { Router } from 'itty-router';
import { cors } from './utils/cors.js';
import { handleAuth } from './api/auth.js';
import { 
    getSermons, getSermon, createSermon, updateSermon, deleteSermon 
} from './api/sermons.js';
import { 
    getDocuments, getDocument, uploadDocument, deleteDocument 
} from './api/documents.js';
import { 
    getEvents, getEvent, createEvent, updateEvent, deleteEvent 
} from './api/events.js';
import { 
    getAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement, deleteAnnouncement 
} from './api/announcements.js';

const router = Router();

// CORS headers
router.all('*', () => cors());

// Health check
router.get('/', () => {
    return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'CCAC API is running',
        version: '1.0.0'
    }), {
        headers: { 'Content-Type': 'application/json', ...cors() }
    });
});

// Auth endpoints
router.post('/api/auth/login', handleAuth);

// Sermons endpoints
router.get('/api/sermons', getSermons);
router.get('/api/sermons/:id', getSermon);
router.post('/api/sermons', createSermon);
router.put('/api/sermons/:id', updateSermon);
router.delete('/api/sermons/:id', deleteSermon);

// Documents endpoints
router.get('/api/documents', getDocuments);
router.get('/api/documents/:id', getDocument);
router.post('/api/documents/upload', uploadDocument);
router.delete('/api/documents/:id', deleteDocument);

// Events endpoints
router.get('/api/events', getEvents);
router.get('/api/events/:id', getEvent);
router.post('/api/events', createEvent);
router.put('/api/events/:id', updateEvent);
router.delete('/api/events/:id', deleteEvent);

// Announcements endpoints
router.get('/api/announcements', getAnnouncements);
router.get('/api/announcements/:id', getAnnouncement);
router.post('/api/announcements', createAnnouncement);
router.put('/api/announcements/:id', updateAnnouncement);
router.delete('/api/announcements/:id', deleteAnnouncement);

// 404 handler
router.all('*', () => {
    return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors() }
    });
});

export default {
    async fetch(request, env, ctx) {
        // Bind environment variables to global context
        globalThis.env = env;
        globalThis.DB = env.DB;
        globalThis.R2 = env.R2;
        
        const response = await router.handle(request);
        if (!response) {
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...cors() }
            });
        }
        return response;
    }
};