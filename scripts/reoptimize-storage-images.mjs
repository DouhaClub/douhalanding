#!/usr/bin/env node
/**
 * Re-exporta imagens já no Supabase Storage (overwrite no mesmo path).
 * URLs no banco não mudam — não é necessário re-upload manual pelo admin.
 *
 * Uso:
 *   npm run reoptimize-images -- --dry-run
 *   npm run reoptimize-images
 *   npm run reoptimize-images -- --only=gallery,role,posters
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  IMAGE_EXPORT_PRESETS,
  IMAGE_SKIP_IF_BYTES,
  getBatchPresetForStoragePath,
} from '../src/lib/imagePresets.js';
import { collectStorageTargets } from './lib/collectStorageTargets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

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
  const onlyArg = argv.find((a) => a.startsWith('--only='));
  const only = onlyArg
    ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
    : null;
  return { dryRun, only };
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function categoryForPath(path) {
  if (path.startsWith('gallery/')) return 'gallery';
  if (path.startsWith('role-photos/')) return 'role';
  if (path.startsWith('events/')) return 'posters';
  if (path.startsWith('editorial/')) return 'editorial';
  return 'other';
}

function shouldIncludeCategory(category, only) {
  if (!only?.length) return true;
  if (category === 'other') return only.includes('site');
  return only.includes(category);
}

async function fetchImageMeta(url) {
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) {
    const getRes = await fetch(url);
    if (!getRes.ok) throw new Error(`HTTP ${getRes.status}`);
    const buf = Buffer.from(await getRes.arrayBuffer());
    const meta = await sharp(buf).metadata();
    return { bytes: buf.length, width: meta.width || 0, buffer: buf };
  }
  const len = Number(res.headers.get('content-length') || 0);
  const getRes = await fetch(url);
  if (!getRes.ok) throw new Error(`HTTP ${getRes.status}`);
  const buf = Buffer.from(await getRes.arrayBuffer());
  const meta = await sharp(buf).metadata();
  return { bytes: len || buf.length, width: meta.width || 0, buffer: buf };
}

async function reencodeBuffer(buffer, preset, isPng) {
  if (isPng) {
    return sharp(buffer)
      .rotate()
      .resize({ width: preset.maxWidth, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
  return sharp(buffer)
    .rotate()
    .resize({ width: preset.maxWidth, withoutEnlargement: true })
    .jpeg({ quality: Math.round(preset.quality * 100), mozjpeg: true })
    .toBuffer();
}

async function collectTargets(supabase) {
  return collectStorageTargets(supabase);
}

async function main() {
  loadEnv();
  const { dryRun, only } = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error('Defina VITE_SUPABASE_URL ou SUPABASE_URL no .env');
    process.exit(1);
  }
  if (!serviceKey && !dryRun) {
    console.error('Modo LIVE exige SUPABASE_SERVICE_ROLE_KEY no .env (Supabase → Project Settings → API → service_role).');
    process.exit(1);
  }
  if (!serviceKey && !anonKey) {
    console.error('Defina SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_ANON_KEY no .env.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey || anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (dryRun && !serviceKey) {
    console.log('(dry-run com anon key — leitura do banco ok; upload exigiria service role)\n');
  }

  console.log(`Modo: ${dryRun ? 'DRY-RUN (nenhum upload)' : 'LIVE (overwrite no storage)'}`);
  if (only?.length) console.log(`Filtro --only: ${only.join(', ')}`);

  const targets = await collectTargets(supabase);
  console.log(`\n${targets.length} arquivo(s) único(s) encontrado(s) no banco.\n`);

  const results = [];
  let totalBefore = 0;
  let totalAfter = 0;

  for (const { bucket, path, url } of targets) {
    const category = categoryForPath(path);
    if (!shouldIncludeCategory(category, only)) continue;

    const preset = getBatchPresetForStoragePath(bucket, path);
    const label = `${bucket}/${path}`;

    try {
      const meta = await fetchImageMeta(url);
      const isPng = /\.png($|[?#])/i.test(path) || /\.png($|[?#])/i.test(url);
      const skipSmall = meta.bytes < IMAGE_SKIP_IF_BYTES && meta.width <= preset.maxWidth;

      if (skipSmall) {
        results.push({ label, status: 'skipped', before: meta.bytes, after: meta.bytes, reason: 'já otimizado' });
        console.log(`SKIP  ${label} (${formatBytes(meta.bytes)}, ${meta.width}px)`);
        continue;
      }

      if (isPng) {
        const pngPreset = /logo/i.test(path) || /logo/i.test(url)
          ? IMAGE_EXPORT_PRESETS.footerLogo
          : { maxWidth: preset.maxWidth, quality: preset.quality, format: 'png' };
        const out = await reencodeBuffer(meta.buffer, pngPreset, true);
        if (out.length >= meta.bytes) {
          results.push({ label, status: 'skipped', before: meta.bytes, after: meta.bytes, reason: 're-encode não reduz' });
          console.log(`SKIP  ${label} (${formatBytes(meta.bytes)} — manter original)`);
          continue;
        }
        totalBefore += meta.bytes;
        if (dryRun) {
          totalAfter += out.length;
          results.push({ label, status: 'dry-run', before: meta.bytes, after: out.length });
          console.log(`DRY   ${label} ${formatBytes(meta.bytes)} → ${formatBytes(out.length)} (PNG)`);
          continue;
        }
        const { error } = await supabase.storage.from(bucket).upload(path, out, {
          upsert: true,
          contentType: 'image/png',
          cacheControl: '3600',
        });
        if (error) throw error;
        totalAfter += out.length;
        results.push({ label, status: 'ok', before: meta.bytes, after: out.length });
        console.log(`OK    ${label} ${formatBytes(meta.bytes)} → ${formatBytes(out.length)} (PNG)`);
        continue;
      }

      const out = await reencodeBuffer(meta.buffer, preset, false);
      if (out.length >= meta.bytes) {
        results.push({ label, status: 'skipped', before: meta.bytes, after: meta.bytes, reason: 're-encode não reduz' });
        console.log(`SKIP  ${label} (${formatBytes(meta.bytes)} — manter original)`);
        continue;
      }
      totalBefore += meta.bytes;

      if (dryRun) {
        totalAfter += out.length;
        results.push({ label, status: 'dry-run', before: meta.bytes, after: out.length });
        console.log(`DRY   ${label} ${formatBytes(meta.bytes)} → ${formatBytes(out.length)}`);
        continue;
      }

      const { error } = await supabase.storage.from(bucket).upload(path, out, {
        upsert: true,
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });
      if (error) throw error;

      totalAfter += out.length;
      results.push({ label, status: 'ok', before: meta.bytes, after: out.length });
      console.log(`OK    ${label} ${formatBytes(meta.bytes)} → ${formatBytes(out.length)}`);
    } catch (error) {
      results.push({ label, status: 'error', error: error.message });
      console.error(`ERR   ${label}: ${error.message}`);
    }
  }

  const ok = results.filter((r) => r.status === 'ok' || r.status === 'dry-run');
  const skipped = results.filter((r) => r.status === 'skipped');
  const errors = results.filter((r) => r.status === 'error');

  console.log('\n--- Resumo ---');
  console.log(`Processados: ${ok.length} | Pulados: ${skipped.length} | Erros: ${errors.length}`);
  if (ok.length) {
    console.log(`Total: ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}`);
    const saved = totalBefore - totalAfter;
    if (saved > 0) console.log(`Economia: ${formatBytes(saved)} (${Math.round((saved / totalBefore) * 100)}%)`);
  }
  if (dryRun) console.log('\n(dry-run — rode sem --dry-run para aplicar)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
