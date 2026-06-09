/**
 * Busca o título de uma página externa direto do navegador.
 * Sites não mandam CORS para nós, então passamos por leitores/proxies públicos:
 * 1) r.jina.ai — devolve "Title: ..." em texto puro
 * 2) api.allorigins.win — devolve o HTML cru; extraímos <title> / og:title
 * Falhou tudo? Devolve '' e o site mostra o domínio como fallback.
 */

function decodeHtmlEntities(text) {
  const el = document.createElement('textarea');
  el.innerHTML = String(text || '');
  return el.value;
}

function cleanTitle(raw) {
  const title = decodeHtmlEntities(String(raw || '')).replace(/\s+/g, ' ').trim();
  if (!title) return '';
  /* Corta sufixos tipo " - G1" / " | Folha" só quando o título continua legível. */
  const sliced = title.split(/\s+[|–—-]\s+/)[0].trim();
  return (sliced.length >= 18 ? sliced : title).slice(0, 160);
}

async function fetchWithTimeout(url, ms = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function titleViaJina(target) {
  const res = await fetchWithTimeout(`https://r.jina.ai/${target}`);
  if (!res.ok) return '';
  const text = await res.text();
  const m = text.match(/^Title:\s*(.+)$/m);
  return m ? cleanTitle(m[1]) : '';
}

async function titleViaAllOrigins(target) {
  const res = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`);
  if (!res.ok) return '';
  const html = await res.text();
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (og) return cleanTitle(og[1]);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? cleanTitle(t[1]) : '';
}

export async function fetchPageTitleForUrl(url) {
  const target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target)) return '';
  try {
    const viaJina = await titleViaJina(target);
    if (viaJina) return viaJina;
  } catch { /* tenta o próximo */ }
  try {
    return await titleViaAllOrigins(target);
  } catch {
    return '';
  }
}
