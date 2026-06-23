export function isMissingPublishAtColumnError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('publish_at') && text.includes('does not exist');
}

export function isAgendaEventPublished(item, now = new Date()) {
  const at = item?.publishAt;
  if (!at) return true;
  const t = new Date(at).getTime();
  return !Number.isNaN(t) && t <= now.getTime();
}

export function filterPublicAgendaEvents(events, now = new Date()) {
  return (events || []).filter((event) => isAgendaEventPublished(event, now));
}

export function getAgendaPublishStatus(item, now = new Date()) {
  const at = item?.publishAt;
  if (!at) return 'immediate';
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return 'immediate';
  return t > now.getTime() ? 'scheduled' : 'published';
}

export function toDatetimeLocalValue(isoOrDate) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function datetimeLocalToIso(localValue) {
  const trimmed = String(localValue || '').trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatAgendaPublishLabel(isoOrDate) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
