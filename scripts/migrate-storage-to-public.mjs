#!/usr/bin/env node
/**
 * Migra imagens do Supabase Storage para public/ e atualiza URLs no banco.
 * Elimina egress do CDN do Supabase — arquivos passam a ser servidos pelo Amplify.
 *
 * Pré-requisitos (.env):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (obrigatório no modo LIVE — leitura + update no banco)
 *
 * Uso:
 *   npm run migrate-storage-to-public -- --dry-run
 *   npm run migrate-storage-to-public
 *   npm run migrate-storage-to-public -- --only=gallery,posters
 *   npm run migrate-storage-to-public -- --no-optimize   (copia bytes originais)
 *   npm run migrate-storage-to-public -- --skip-db       (só grava arquivos em public/)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  IMAGE_EXPORT_PRESETS,
  getBatchPresetForStoragePath,
} from '../src/lib/imagePresets.js';
import { collectStorageTargets } from './lib/collectStorageTargets.mjs';
import {
  categoryForStoragePath,
  isSupabaseStorageUrl,
  normalizeUrlKey,
  storagePathToPublicUrl,
} from './lib/localMediaPaths.mjs';
import {
  replaceUrlsInGalleryEntry,
  replaceUrlsInSiteContentPayload,
} from './lib/photoUrlParse.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MANIFEST_PATH = resolve(__dirname, 'migrate-storage-manifest.json');

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

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const skipDb = argv.includes('--skip-db');
  const optimize = !argv.includes('--no-optimize');
  const onlyArg = argv.find((a) => a.startsWith('--only='));
  const only = onlyArg
    ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
    : null;
  return { dryRun, skipDb, optimize, only };
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function shouldIncludeCategory(category, only) {
  if (!only?.length) return true;
  if (category === 'other') return only.includes('site');
  return only.includes(category);
}

function publicUrlToFilesystem(publicUrl) {
  const rel = String(publicUrl || '').replace(/^\/+/, '');
  return resolve(ROOT, 'public', rel);
}

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function optimizeBuffer(buffer, bucket, path) {
  const preset = getBatchPresetForStoragePath(bucket, path);
  const isPng = /\.png($|[?#])/i.test(path);
  if (isPng) {
    const pngPreset = /logo/i.test(path)
      ? IMAGE_EXPORT_PRESETS.footerLogo
      : { maxWidth: preset.maxWidth, quality: preset.quality, format: 'png' };
    return sharp(buffer)
      .rotate()
      .resize({ width: pngPreset.maxWidth, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
  return sharp(buffer)
    .rotate()
    .resize({ width: preset.maxWidth, withoutEnlargement: true })
    .jpeg({ quality: Math.round(preset.quality * 100), mozjpeg: true })
    .toBuffer();
}

function makeReplacer(urlMap) {
  return (url) => {
    const raw = String(url || '').trim();
    if (!raw || !isSupabaseStorageUrl(raw)) return raw;
    const key = normalizeUrlKey(raw);
    return urlMap.get(key) ?? raw;
  };
}

async function downloadTargets(targets, { dryRun, optimize, only }) {
  const urlMap = new Map();
  const files = [];
  let totalBytes = 0;

  for (const { bucket, path, url } of targets) {
    const category = categoryForStoragePath(path);
    if (!shouldIncludeCategory(category, only)) continue;

    const publicUrl = storagePathToPublicUrl(bucket, path);
    const filePath = publicUrlToFilesystem(publicUrl);
    const label = `${bucket}/${path}`;

    try {
      if (dryRun) {
        const res = await fetch(url, { method: 'HEAD' });
        const bytes = Number(res.headers.get('content-length') || 0);
        urlMap.set(normalizeUrlKey(url), publicUrl);
        files.push({ label, publicUrl, filePath, bytes, status: 'dry-run' });
        totalBytes += bytes;
        console.log(`DRY   ${label} → ${publicUrl}${bytes ? ` (${formatBytes(bytes)})` : ''}`);
        continue;
      }

      let buffer = await downloadBuffer(url);
      const before = buffer.length;

      if (optimize) {
        try {
          const optimized = await optimizeBuffer(buffer, bucket, path);
          if (optimized.length < buffer.length) buffer = optimized;
        } catch {
          // mantém original se sharp falhar (formato exótico)
        }
      }

      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, buffer);

      urlMap.set(normalizeUrlKey(url), publicUrl);
      files.push({ label, publicUrl, filePath, bytes: buffer.length, before, status: 'ok' });
      totalBytes += buffer.length;
      const saved = before - buffer.length;
      const suffix = saved > 0 ? ` (${formatBytes(before)} → ${formatBytes(buffer.length)})` : ` (${formatBytes(buffer.length)})`;
      console.log(`OK    ${label} → ${publicUrl}${suffix}`);
    } catch (error) {
      files.push({ label, publicUrl, filePath, status: 'error', error: error.message });
      console.error(`ERR   ${label}: ${error.message}`);
    }
  }

  return { urlMap, files, totalBytes };
}

async function updateDatabase(supabase, urlMap, dryRun) {
  const replacer = makeReplacer(urlMap);
  const stats = {
    douha_events: 0,
    douha_site_photos: 0,
    douha_role_photos: 0,
    douha_editorial_posts: 0,
    douha_site_content: 0,
  };

  const { data: events, error: eventsErr } = await supabase
    .from('douha_events')
    .select('id, poster');
  if (eventsErr && !eventsErr.message.includes('does not exist')) {
    throw new Error(`douha_events: ${eventsErr.message}`);
  }
  for (const row of events || []) {
    const next = replacer(row.poster);
    if (next === row.poster) continue;
    stats.douha_events += 1;
    if (dryRun) {
      console.log(`DB DRY douha_events ${row.id}: ${row.poster} → ${next}`);
      continue;
    }
    const { error } = await supabase.from('douha_events').update({ poster: next }).eq('id', row.id);
    if (error) throw new Error(`douha_events ${row.id}: ${error.message}`);
    console.log(`DB OK  douha_events ${row.id} → ${next}`);
  }

  const { data: galleryRows, error: galleryErr } = await supabase
    .from('douha_site_photos')
    .select('id, photo_url');
  if (galleryErr && !galleryErr.message.includes('does not exist')) {
    throw new Error(`douha_site_photos: ${galleryErr.message}`);
  }
  for (const row of galleryRows || []) {
    const next = replaceUrlsInGalleryEntry(row.photo_url, replacer);
    if (next === row.photo_url) continue;
    stats.douha_site_photos += 1;
    if (dryRun) {
      console.log(`DB DRY douha_site_photos ${row.id}`);
      continue;
    }
    const { error } = await supabase.from('douha_site_photos').update({ photo_url: next }).eq('id', row.id);
    if (error) throw new Error(`douha_site_photos ${row.id}: ${error.message}`);
    console.log(`DB OK  douha_site_photos ${row.id}`);
  }

  const { data: roleRows, error: roleErr } = await supabase
    .from('douha_role_photos')
    .select('id, photo_url');
  if (roleErr && !roleErr.message.includes('does not exist')) {
    throw new Error(`douha_role_photos: ${roleErr.message}`);
  }
  for (const row of roleRows || []) {
    const next = replacer(row.photo_url);
    if (next === row.photo_url) continue;
    stats.douha_role_photos += 1;
    if (dryRun) {
      console.log(`DB DRY douha_role_photos ${row.id}`);
      continue;
    }
    const { error } = await supabase.from('douha_role_photos').update({ photo_url: next }).eq('id', row.id);
    if (error) throw new Error(`douha_role_photos ${row.id}: ${error.message}`);
    console.log(`DB OK  douha_role_photos ${row.id} → ${next}`);
  }

  const { data: editorialRows, error: editorialErr } = await supabase
    .from('douha_editorial_posts')
    .select('id, cover_url');
  if (editorialErr && !editorialErr.message.includes('does not exist')) {
    throw new Error(`douha_editorial_posts: ${editorialErr.message}`);
  }
  for (const row of editorialRows || []) {
    const next = replacer(row.cover_url);
    if (next === row.cover_url) continue;
    stats.douha_editorial_posts += 1;
    if (dryRun) {
      console.log(`DB DRY douha_editorial_posts ${row.id}`);
      continue;
    }
    const { error } = await supabase.from('douha_editorial_posts').update({ cover_url: next }).eq('id', row.id);
    if (error) throw new Error(`douha_editorial_posts ${row.id}: ${error.message}`);
    console.log(`DB OK  douha_editorial_posts ${row.id} → ${next}`);
  }

  const { data: contentRows, error: contentErr } = await supabase
    .from('douha_site_content')
    .select('id, payload');
  if (contentErr && !contentErr.message.includes('does not exist')) {
    throw new Error(`douha_site_content: ${contentErr.message}`);
  }
  for (const row of contentRows || []) {
    const next = replaceUrlsInSiteContentPayload(row.payload, replacer);
    if (JSON.stringify(next) === JSON.stringify(row.payload)) continue;
    stats.douha_site_content += 1;
    if (dryRun) {
      console.log(`DB DRY douha_site_content ${row.id}`);
      continue;
    }
    const { error } = await supabase.from('douha_site_content').update({ payload: next }).eq('id', row.id);
    if (error) throw new Error(`douha_site_content ${row.id}: ${error.message}`);
    console.log(`DB OK  douha_site_content ${row.id}`);
  }

  return stats;
}

function writeManifest(payload) {
  if (payload.dryRun) return;
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`\nManifesto salvo em scripts/migrate-storage-manifest.json`);
}

async function main() {
  loadEnv();
  const { dryRun, skipDb, optimize, only } = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error('Defina VITE_SUPABASE_URL ou SUPABASE_URL no .env');
    process.exit(1);
  }
  if (!serviceKey && !dryRun && !skipDb) {
    console.error('Modo LIVE com update no banco exige SUPABASE_SERVICE_ROLE_KEY no .env (Project Settings → API → service_role).');
    console.error('Use --skip-db para baixar só os arquivos, ou adicione a service role key.');
    process.exit(1);
  }
  if (!serviceKey && !anonKey) {
    console.error('Defina SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_ANON_KEY no .env.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey || anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Modo: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`Otimizar: ${optimize ? 'sim (sharp)' : 'não (bytes originais)'}`);
  console.log(`Atualizar banco: ${skipDb ? 'não (--skip-db)' : 'sim'}`);
  if (only?.length) console.log(`Filtro --only: ${only.join(', ')}`);
  console.log('');

  const targets = await collectStorageTargets(supabase);
  console.log(`${targets.length} arquivo(s) único(s) no Supabase Storage.\n`);

  if (!targets.length) {
    console.log('Nada para migrar — banco já usa paths locais ou não há imagens no storage.');
    return;
  }

  const { urlMap, files, totalBytes } = await downloadTargets(targets, { dryRun, optimize, only });

  const okFiles = files.filter((f) => f.status === 'ok' || f.status === 'dry-run');
  const errors = files.filter((f) => f.status === 'error');

  console.log('\n--- Arquivos ---');
  console.log(`Baixados: ${okFiles.length} | Erros: ${errors.length} | Total: ${formatBytes(totalBytes)}`);

  let dbStats = null;
  if (!skipDb && urlMap.size) {
    console.log('\n--- Banco de dados ---');
    dbStats = await updateDatabase(supabase, urlMap, dryRun);
    const totalUpdates = Object.values(dbStats).reduce((a, b) => a + b, 0);
    console.log(`\nRegistros atualizados: ${totalUpdates}`);
    for (const [table, count] of Object.entries(dbStats)) {
      if (count) console.log(`  ${table}: ${count}`);
    }
  }

  writeManifest({
    migratedAt: new Date().toISOString(),
    dryRun,
    optimize,
    skipDb,
    totalBytes,
    urlMap: Object.fromEntries(urlMap),
    files,
    dbStats,
  });

  if (dryRun) {
    console.log('\n(dry-run — rode sem --dry-run para aplicar)');
    console.log('Depois: git add public/ && commit && deploy Amplify');
  } else {
    console.log('\nPróximos passos:');
    console.log('  1. git add public/ && commit');
    console.log('  2. Deploy no Amplify');
    console.log('  3. Confira o site — imagens devem carregar de /events/, /gallery/, etc.');
    console.log('  4. Egress do Supabase Storage deve cair a zero para visitantes');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
