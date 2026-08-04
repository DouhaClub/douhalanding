#!/usr/bin/env node
/**
 * Gera SQL de update a partir do manifesto da migração (para rodar no SQL Editor ou via MCP).
 * Uso: node scripts/generate-migrate-db-sql.mjs
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { isSupabaseStorageUrl, normalizeUrlKey } from './lib/localMediaPaths.mjs';
import {
  replaceUrlsInGalleryEntry,
  replaceUrlsInSiteContentPayload,
} from './lib/photoUrlParse.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MANIFEST_PATH = resolve(__dirname, 'migrate-storage-manifest.json');
const SQL_PATH = resolve(__dirname, 'migrate-db-updates.sql');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

function loadEnv() {
  loadEnvFile(resolve(ROOT, '.env'));
  loadEnvFile(resolve(ROOT, '.env.local'));
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function makeReplacer(urlMap) {
  const map = new Map(Object.entries(urlMap));
  return (url) => {
    const raw = String(url || '').trim();
    if (!raw || !isSupabaseStorageUrl(raw)) return raw;
    return map.get(normalizeUrlKey(raw)) ?? raw;
  };
}

async function main() {
  loadEnv();
  if (!existsSync(MANIFEST_PATH)) {
    console.error('Manifesto não encontrado. Rode npm run migrate-storage-to-public primeiro.');
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  if (manifest.dryRun) {
    console.error('Manifesto é de dry-run. Rode a migração LIVE primeiro.');
    process.exit(1);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env');
    process.exit(1);
  }

  const replacer = makeReplacer(manifest.urlMap);
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const statements = ['BEGIN;'];

  const { data: events } = await supabase.from('douha_events').select('id, poster');
  for (const row of events || []) {
    const next = replacer(row.poster);
    if (next === row.poster) continue;
    statements.push(`UPDATE douha_events SET poster = ${sqlLiteral(next)} WHERE id = ${sqlLiteral(row.id)};`);
  }

  const { data: galleryRows } = await supabase.from('douha_site_photos').select('id, photo_url');
  for (const row of galleryRows || []) {
    const next = replaceUrlsInGalleryEntry(row.photo_url, replacer);
    if (next === row.photo_url) continue;
    statements.push(`UPDATE douha_site_photos SET photo_url = ${sqlLiteral(next)} WHERE id = ${sqlLiteral(row.id)};`);
  }

  const { data: roleRows } = await supabase.from('douha_role_photos').select('id, photo_url');
  for (const row of roleRows || []) {
    const next = replacer(row.photo_url);
    if (next === row.photo_url) continue;
    statements.push(`UPDATE douha_role_photos SET photo_url = ${sqlLiteral(next)} WHERE id = ${sqlLiteral(row.id)};`);
  }

  const { data: editorialRows } = await supabase.from('douha_editorial_posts').select('id, cover_url');
  for (const row of editorialRows || []) {
    const next = replacer(row.cover_url);
    if (next === row.cover_url) continue;
    statements.push(`UPDATE douha_editorial_posts SET cover_url = ${sqlLiteral(next)} WHERE id = ${sqlLiteral(row.id)};`);
  }

  const { data: contentRows } = await supabase.from('douha_site_content').select('id, payload');
  for (const row of contentRows || []) {
    const next = replaceUrlsInSiteContentPayload(row.payload, replacer);
    if (JSON.stringify(next) === JSON.stringify(row.payload)) continue;
    statements.push(`UPDATE douha_site_content SET payload = ${sqlLiteral(JSON.stringify(next))}::jsonb WHERE id = ${sqlLiteral(row.id)};`);
  }

  statements.push('COMMIT;');

  const sql = `${statements.join('\n')}\n`;
  writeFileSync(SQL_PATH, sql, 'utf8');
  console.log(`SQL gerado: ${statements.length - 2} UPDATE(s) → scripts/migrate-db-updates.sql`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
