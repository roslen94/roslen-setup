/* Netlify Function: public YouTube RSS -> three most recent uploads.
 * No API key required. Optional YT_CHANNEL_ID env var improves reliability.
 */
'use strict';
const HANDLE = 'roslen_tv';
const DEFAULT_CHANNEL_URL = `https://www.youtube.com/@${HANDLE}`;
const ID_RX = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_RX = /^[A-Za-z0-9_-]{11}$/;
let cachedChannelId = '';
let cachedPayload = null;
let expiresAt = 0;

function decodeXml(value) {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&(?:amp|lt|gt|quot|apos);/g, x => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[x]);
}
function xmlValue(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(new RegExp(`<${escaped}>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return m ? decodeXml(m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').trim()) : '';
}
function readFeed(xml) {
  if (!xml.includes('<feed') || !xml.includes('</feed>')) throw Error('YouTube RSS response invalid');
  const videos = [];
  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
  for (const entry of entries) {
    const id = xmlValue(entry, 'yt:videoId');
    if (!VIDEO_RX.test(id)) continue;
    const title = xmlValue(entry, 'title').slice(0, 220) || 'Vidéo ROSLEN';
    const published = xmlValue(entry, 'published');
    videos.push({ id, title, published, url: `https://www.youtube.com/watch?v=${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` });
  }
  // RSS normally arrives ordered, but sort defensively for recent updates.
  videos.sort((a, b) => Date.parse(b.published || 0) - Date.parse(a.published || 0));
  if (!videos.length) throw Error('No public videos found in feed');
  return videos.slice(0, 3);
}
async function getText(url) {
  const response = await fetch(url, {
    headers: {'user-agent':'Mozilla/5.0 (compatible; ROSLENWebsite/1.0; YouTube RSS reader)', 'accept':'text/html,application/xml;q=0.9,*/*;q=0.8'},
    redirect: 'follow',
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw Error(`YouTube returned ${response.status}`);
  return response.text();
}
async function resolveChannelId() {
  const configured = process.env.YT_CHANNEL_ID || process.env.YOUTUBE_CHANNEL_ID;
  if (configured) {
    if (!ID_RX.test(configured)) throw Error('YT_CHANNEL_ID must be a valid YouTube channel ID (UC...)');
    return configured;
  }
  if (cachedChannelId) return cachedChannelId;
  const pages = [DEFAULT_CHANNEL_URL, `${DEFAULT_CHANNEL_URL}/videos`];
  // Prioritize the channel owner ID rather than IDs of recommended channels.
  const patterns = [
    /<meta\s+(?=[^>]*\bitemprop=["']channelId["'])(?=[^>]*\bcontent=["'](UC[A-Za-z0-9_-]{22})["'])[^>]*>/i,
    /<link\s+(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})["'])[^>]*>/i,
    /"channelMetadataRenderer"\s*:\s*\{[\s\S]{0,1800}?"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
    /"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
  ];
  for (const page of pages) {
    try {
      const source = await getText(page);
      for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match && ID_RX.test(match[1])) return (cachedChannelId = match[1]);
      }
    } catch(e) { /* try the next channel page */ }
  }
  throw Error('Unable to resolve YouTube channel ID from @roslen_tv. Set YT_CHANNEL_ID on Netlify.');
}
const headers = {
  'content-type':'application/json; charset=utf-8',
  'cache-control':'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
  'access-control-allow-origin':'*',
};
exports.handler = async () => {
  try {
    if (cachedPayload && Date.now() < expiresAt) {
      return { statusCode:200, headers, body:JSON.stringify(cachedPayload) };
    }
    const channelId = await resolveChannelId();
    const xml = await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
    const payload = {channel:HANDLE, videos:readFeed(xml), fetchedAt:new Date().toISOString()};
    cachedPayload = payload;
    expiresAt = Date.now() + 60000;
    return { statusCode:200, headers, body:JSON.stringify(payload) };
  } catch (e) {
    // Don't claim success or show fake latest videos if RSS is blocked.
    return { statusCode:503, headers:{...headers,'cache-control':'no-store'}, body:JSON.stringify({error:'YouTube feed temporarily unavailable',detail:String(e.message).slice(0,180)}) };
  }
};
// helpers exported for offline fixture tests
exports._test = {readFeed, decodeXml, resolveChannelId};
