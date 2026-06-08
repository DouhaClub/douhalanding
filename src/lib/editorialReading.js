/** Velocidade media de leitura em portugues (~220 palavras/min). */
export const EDITORIAL_READING_WPM_PT = 220;

export function stripEditorialMarkup(text) {
  return String(text || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^-\s+/gm, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countEditorialWords(text) {
  const clean = stripEditorialMarkup(text);
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

export function estimateEditorialReadingMinutes(post, wpm = EDITORIAL_READING_WPM_PT) {
  const combined = [post?.title, post?.deck, post?.body].filter(Boolean).join(' ');
  const words = countEditorialWords(combined);
  if (!words) return 1;
  return Math.max(1, Math.ceil(words / Math.max(80, wpm)));
}

export function formatEditorialReadingLabel(minutes) {
  const n = Math.max(1, Number(minutes) || 1);
  return n === 1 ? '1 min' : `${n} min`;
}

function parseEditorialDateValue(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dotted = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotted) {
    const y = dotted[3].length === 2 ? 2000 + Number(dotted[3]) : Number(dotted[3]);
    const d = new Date(y, Number(dotted[2]) - 1, Number(dotted[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const PT_MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Ex.: 21 de jan de 2025 */
export function formatEditorialArticleDate(post) {
  const raw = String(post?.daté || post?.publishedAt || '').trim();
  if (!raw) return '';
  const d = parseEditorialDateValue(raw);
  if (!d) return raw;
  const month = PT_MONTHS_SHORT[d.getMonth()] || '';
  return `${d.getDate()} de ${month} de ${d.getFullYear()}`;
}

export function formatEditorialRelativeUpdate(post) {
  const updatedRaw = post?.updatedAt || post?.publishedAt || post?.date;
  const updated = parseEditorialDateValue(updatedRaw);
  if (!updated) return '';

  const now = new Date();
  const diffMs = now.getTime() - updated.getTime();
  if (diffMs < 0) return 'Atualizado agora';

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return 'Atualizado hoje';
  if (diffDays === 1) return 'Atualizado há 1 dia';
  if (diffDays < 30) return `Atualizado há ${diffDays} dias`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'Atualizado há 1 mês';
  if (diffMonths < 12) return `Atualizado há ${diffMonths} meses`;

  const diffYears = Math.floor(diffDays / 365);
  if (diffYears === 1) return 'Atualizado há 1 ano';
  return `Atualizado há ${diffYears} anos`;
}

export function editorialAuthorInitial(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'D';
  return trimmed.slice(0, 1).toUpperCase();
}

/** Preview da barra (autor | data | tempo) para o admin. */
export function buildEditorialBylinePreview(post) {
  const authorName = String(post?.authorName || '').trim() || 'Douha Club';
  const publishedLabel = formatEditorialArticleDate(post);
  const updatedLabel = formatEditorialRelativeUpdate(post);
  const readingLabel = formatEditorialReadingLabel(estimateEditorialReadingMinutes(post));
  return { authorName, publishedLabel, updatedLabel, readingLabel };
}
