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
