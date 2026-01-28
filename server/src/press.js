import Parser from 'rss-parser';
import NodeCache from 'node-cache';
import { GOV_PRESS_RSS } from './config.js';

const parser = new Parser();
const cache = new NodeCache({ stdTTL: 600 }); // 10 min

function decodeHtmlEntities(s) {
  if (!s) return "";
  let out = String(s);
  for (let i = 0; i < 3; i++) {
    const before = out;
    out = out.replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      if (!Number.isFinite(code)) return _;
      return String.fromCharCode(code);
    });
    out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      if (!Number.isFinite(code)) return _;
      return String.fromCharCode(code);
    });
    out = out.replace(/&amp;/g, "&");
    out = out
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&middot;/g, "·");
    if (out === before) break;
  }
  return out.replace(/\s+/g, " ").trim();
}


export async function getLatestPress({ limit = 10 } = {}) {
  const lim = Math.max(1, Math.min(50, Number(limit) || 10));
  const key = `press:${lim}:${GOV_PRESS_RSS.join(',')}`;
  const cached = cache.get(key);
  if (cached) return cached;

  if (GOV_PRESS_RSS.length === 0) {
    const empty = {
      items: [],
      note: 'GOV_PRESS_RSS 환경변수에 정부/부처 RSS URL을 콤마로 넣으면 자동 수집합니다.',
    };
    cache.set(key, empty);
    return empty;
  }

  const all = [];
  for (const url of GOV_PRESS_RSS) {
    try {
      const feed = await parser.parseURL(url);
      for (const it of (feed.items || [])) {
        all.push({
          title: decodeHtmlEntities(it.title || ''),
          link: it.link || '',
          pubDate: it.isoDate || it.pubDate || '',
          source: feed.title || url,
        });
      }
    } catch (e) {
      // ignore bad feed
    }
  }

  all.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  const result = { items: all.slice(0, lim) };
  cache.set(key, result);
  return result;
}
