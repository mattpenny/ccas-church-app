import { cors } from '../utils/cors.js';

function esc(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function toRfc822(dateStr) {
    if (!dateStr) return new Date().toUTCString();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

// 產生 Podcast RSS 2.0 + iTunes namespace 的 XML
// 只包含有 MP3 音頻的已發布講道
export async function getRssFeed(request, env) {
    try {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: cors() });
        }

        const url = new URL(request.url);
        const base = `${url.protocol}//${url.host}`;

        const { results: settingRows } = await env.DB.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        (settingRows || []).forEach(s => { settings[s.key] = s.value; });

        const siteTitle = settings.site_title || 'CCAC Granada Hills';
        const podcastTitle = settings.podcast_title || `${siteTitle} 講道`;
        const podcastDesc = settings.podcast_description || settings.site_description || 'CCAC Granada Hills 基督教會講道音頻 Podcast';
        const podcastAuthor = settings.podcast_author || 'CCAC Granada Hills';
        const podcastImage = settings.podcast_image_url || '';
        const podcastEmail = settings.podcast_email || 'podcast@ccacgranadahills.org';
        const channelLink = settings.website_url || 'https://ccacgranadahills.org';

        const { results: sermons } = await env.DB.prepare(`
            SELECT s.*,
                   ser.title AS series_title,
                   ser.cover_url AS series_cover_url,
                   ser.cover_key AS series_cover_key
            FROM sermons s
            LEFT JOIN sermon_series ser ON s.series_id = ser.id
            WHERE s.published = 1 AND s.audio_key IS NOT NULL AND s.audio_key <> ''
            ORDER BY s.date DESC, s.id DESC
        `).all();

        const items = (sermons || []).map(s => {
            const audioUrl = `${base}/api/sermons/${s.id}/audio`;
            const link = s.youtube_url || audioUrl;
            const image = podcastImage || s.series_cover_url || (s.series_cover_key ? `${base}/api/series/${s.series_id}/cover` : '');
            const description = s.description || (s.series_title ? `${s.series_title}系列講道` : '');
            const duration = s.duration || '';

            return `
    <item>
      <title>${esc(s.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">${esc(audioUrl)}</guid>
      <pubDate>${toRfc822(s.date)}</pubDate>
      <description>${esc(description)}</description>
      <enclosure url="${esc(audioUrl)}" length="${s.audio_size || 0}" type="audio/mpeg"/>
      <itunes:author>${esc(s.speaker)}</itunes:author>
      <itunes:subtitle>${esc(s.series_title || '')}</itunes:subtitle>
      <itunes:summary>${esc(description)}</itunes:summary>
      <itunes:duration>${esc(duration)}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      ${image ? `<itunes:image href="${esc(image)}"/>` : ''}
    </item>`;
        }).join('\n');

        const channelImage = podcastImage
            || (sermons && sermons[0] && (sermons[0].series_cover_url || (sermons[0].series_cover_key ? `${base}/api/series/${sermons[0].series_id}/cover` : '')))
            || '';

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(podcastTitle)}</title>
    <link>${esc(channelLink)}</link>
    <description>${esc(podcastDesc)}</description>
    <language>zh-tw</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${esc(`${base}/feed.xml`)}" rel="self" type="application/rss+xml"/>
    <itunes:author>${esc(podcastAuthor)}</itunes:author>
    <itunes:summary>${esc(podcastDesc)}</itunes:summary>
    <itunes:owner>
      <itunes:name>${esc(podcastAuthor)}</itunes:name>
      <itunes:email>${esc(podcastEmail)}</itunes:email>
    </itunes:owner>
    <itunes:category text="Religion &amp; Spirituality">
      <itunes:category text="Christianity"/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
    ${channelImage ? `<itunes:image href="${esc(channelImage)}"/>` : ''}
${items}
  </channel>
</rss>`;

        return new Response(xml, {
            headers: {
                'Content-Type': 'application/rss+xml; charset=utf-8',
                'Cache-Control': 'public, max-age=600',
                ...cors()
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors() }
        });
    }
}