import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawSupabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function isLikelyHttpUrl(value) {
  return value.startsWith('http://') || value.startsWith('https://');
}

const configIssues = [];
if (!rawSupabaseUrl) configIssues.push('VITE_SUPABASE_URL ausente');
if (!rawSupabaseAnonKey) configIssues.push('VITE_SUPABASE_ANON_KEY ausente');
if (rawSupabaseUrl && !isLikelyHttpUrl(rawSupabaseUrl)) {
  configIssues.push('VITE_SUPABASE_URL invalida (use https://<project-ref>.supabase.co)');
}
if (rawSupabaseAnonKey && !rawSupabaseAnonKey.startsWith('eyJ')) {
  configIssues.push('VITE_SUPABASE_ANON_KEY invalida (deve ser token JWT anon)');
}

export const isSupabaseConfigured = configIssues.length === 0;
export const supabaseConfigError = configIssues.join(' | ');

export const supabase = isSupabaseConfigured
  ? createClient(rawSupabaseUrl, rawSupabaseAnonKey)
  : null;

/** ID do projeto (ex.: abcdefgh) extraido da URL, para o admin conferir se bate com o painel do Supabase. */
export function getSupabaseProjectRef() {
  if (!rawSupabaseUrl || !isLikelyHttpUrl(rawSupabaseUrl)) return '';
  try {
    const host = new URL(rawSupabaseUrl).hostname;
    const m = host.match(/^([^.]+)\.supabase\.co$/);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

/**
 * Traduz erros comuns do Storage em texto acionavel (bucket inexistente, RLS, chave errada).
 * O objeto `error` do supabase-js costuma ter .message e as vezes statusCode.
 */
export function formatSupabaseStorageUploadError(error) {
  const raw = String(error?.message ?? error ?? '');
  const lower = raw.toLowerCase();
  const code = error?.statusCode ?? error?.status;

  if (
    (lower.includes('bucket') && (lower.includes('not found') || lower.includes('does not exist')))
    || lower.includes('the resource was not found')
    || code === '404'
    || code === 404
  ) {
    return (
      'Bucket de Storage nao encontrado (ou URL do projeto errada). '
      + 'No Supabase deste projeto, abra Storage e confira buckets douha-posters e douha-role-photos. '
      + 'Se faltarem, rode no SQL Editor: supabase-events.sql e supabase/migrations/002_douha_editorial_and_role_photos.sql'
    );
  }
  if (lower.includes('row-level security') || lower.includes('policy')) {
    return `Permissao negada no Storage (RLS/politicas): ${raw}`;
  }
  if (lower.includes('jwt') || lower.includes('invalid api key') || lower.includes('apikey')) {
    return `Chave ou URL do Supabase invalida no build: ${raw}. Use Project URL + anon public key (Settings > API), com prefixo VITE_ no Amplify, e faca novo deploy.`;
  }
  return raw || 'Erro desconhecido no upload ao Storage.';
}
