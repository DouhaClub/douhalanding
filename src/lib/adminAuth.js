import { supabase } from './supabaseClient';

/** Admin = usuario Supabase Auth com app_metadata.role === 'admin' (definir no painel). */
export function isDouhaAdminUser(user) {
  if (!user) return false;
  return user.app_metadata?.role === 'admin';
}

export function isDouhaAdminSession(session) {
  return Boolean(session?.user && isDouhaAdminUser(session.user));
}

export async function getAdminSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return isDouhaAdminSession(data.session) ? data.session : null;
}

export async function signInDouhaAdmin(email, password) {
  if (!supabase) {
    throw new Error('Supabase nao configurado.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || '').trim(),
    password: String(password || ''),
  });
  if (error) throw error;
  if (!isDouhaAdminUser(data.user)) {
    await supabase.auth.signOut();
    throw new Error('Conta sem permissao de administrador. Verifique app_metadata.role no Supabase.');
  }
  return data.session;
}

export async function signOutDouhaAdmin() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function subscribeAdminAuth(onChange) {
  if (!supabase) {
    onChange(null);
    return () => {};
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(isDouhaAdminSession(session) ? session : null);
  });
  return () => data.subscription.unsubscribe();
}

export function formatAdminAuthError(error) {
  const msg = String(error?.message || error || '');
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha invalidos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme o e-mail do usuario no painel Supabase (Authentication).';
  }
  if (lower.includes('row-level security') || lower.includes('policy')) {
    return `Permissao negada (RLS). Rode supabase/migrations/006_douha_rls_admin_auth.sql e confira app_metadata.role = admin. Detalhe: ${msg}`;
  }
  return msg || 'Erro de autenticacao.';
}
