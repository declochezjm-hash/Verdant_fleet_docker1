import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';
import { tmpdir } from 'os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = resolve(root, 'supabase/.temp');
const schemaFile = join(tempDir, 'cloud-schema.sql');
const dataFile = join(tempDir, 'cloud-public-data.sql');
const dbContainer = 'supabase_db_verdant_fleet';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/\r$/, '')
      .replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(root, '.env'));
loadEnvFile(resolve(root, '.env.cloud'));

function run(cmd) {
  return execSync(cmd, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function parseQueryJson(raw) {
  const jsonStart = raw.trim().search(/[\[{]/);
  if (jsonStart === -1) return [];
  const parsed = JSON.parse(raw.trim().slice(jsonStart));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.rows)) return parsed.rows;
  return [];
}

function runLinkedQuery(sql) {
  const file = join(tmpdir(), `verdant-data-${Date.now()}.sql`);
  writeFileSync(file, sql, 'utf8');
  try {
    const raw = run(`npx supabase db query --linked -o json -f "${file}"`);
    return parseQueryJson(raw);
  } finally {
    unlinkSync(file);
  }
}

function runPsql(sql, { stopOnError = false } = {}) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', `ON_ERROR_STOP=${stopOnError ? 1 : 0}`],
    { input: sql, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  );
  if (result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.stderr?.trim()) console.warn(result.stderr.trim());
  if (stopOnError && result.status !== 0) {
    throw new Error(result.stderr || 'psql failed');
  }
}

function runPsqlFile(filePath) {
  const sql = readFileSync(filePath, 'utf8');
  runPsql(sql, { stopOnError: false });
}

function runLocalQueryJson(sql) {
  const file = join(tmpdir(), `verdant-local-${Date.now()}.sql`);
  writeFileSync(file, sql, 'utf8');
  try {
    const raw = run(`npx supabase db query --local -o json -f "${file}"`);
    return parseQueryJson(raw);
  } finally {
    unlinkSync(file);
  }
}

function resolveLocalCredentials() {
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const raw = run('npx supabase status -o env');
    url = raw.match(/API_URL="([^"]+)"/)?.[1] || url;
    key = raw.match(/SERVICE_ROLE_KEY="([^"]+)"/)?.[1] || key;
  } catch {
    // ignore
  }
  return { url, key };
}

function resolveCloudCredentials() {
  const refFile = resolve(root, 'supabase/.temp/project-ref');
  const projectRef = existsSync(refFile) ? readFileSync(refFile, 'utf8').trim() : null;
  const url = process.env.CLOUD_SUPABASE_URL || (projectRef ? `https://${projectRef}.supabase.co` : null);
  let key = process.env.CLOUD_SUPABASE_SERVICE_ROLE_KEY;
  if (projectRef) {
    try {
      const raw = run(`npx supabase projects api-keys --project-ref ${projectRef} -o json`);
      const jsonStart = raw.search(/[\[{]/);
      const keys = JSON.parse(raw.slice(jsonStart));
      key = keys.find((k) => k.name === 'service_role')?.api_key || key;
    } catch {
      // ignore
    }
  }
  return { url, key };
}

function readLinkedProjectRef() {
  const refFile = resolve(root, 'supabase/.temp/project-ref');
  if (!existsSync(refFile)) return null;
  return readFileSync(refFile, 'utf8').trim().replace(/\r$/, '');
}

async function ensureAuthUsersForProfiles(localClient, defaultPassword) {
  const profiles = runLinkedQuery(`
    select id, name, email
    from public.profiles
    order by created_at;
  `);
  const authUsers = runLinkedQuery(`
    select id, email
    from auth.users
    order by email;
  `);
  const authIds = new Set(authUsers.map((u) => u.id));

  let created = 0;
  for (const profile of profiles) {
    if (authIds.has(profile.id)) continue;
    const email =
      profile.email ||
      `${String(profile.name || 'user')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '.')}@verdura.local`;

    const { error } = await localClient.auth.admin.createUser({
      id: profile.id,
      email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { name: profile.name || email },
    });

    if (error) {
      console.warn(`  Profil fantôme ignoré ${profile.name}: ${error.message}`);
      continue;
    }

    created += 1;
    console.log(`  ✓ Auth fantôme: ${email}`);
  }

  return created;
}

async function syncStorage() {
  const cloud = resolveCloudCredentials();
  const local = resolveLocalCredentials();
  if (!cloud.url || !cloud.key || !local.url || !local.key) {
    console.warn('Stockage: clés indisponibles, étape ignorée.');
    return;
  }

  const cloudClient = createClient(cloud.url, cloud.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const localClient = createClient(local.url, local.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bucket = 'task-media';
  console.log(`\nSynchronisation du bucket "${bucket}"...`);

  let copied = 0;

  async function walk(prefix = '') {
    const { data: entries, error: listError } = await cloudClient.storage.from(bucket).list(prefix, {
      limit: 1000,
    });
    if (listError || !entries?.length) return;

    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        await walk(path);
        continue;
      }

      const { data: blob, error: downloadError } = await cloudClient.storage.from(bucket).download(path);
      if (downloadError || !blob) continue;

      const { error: uploadError } = await localClient.storage.from(bucket).upload(path, blob, {
        upsert: true,
        contentType: blob.type || 'application/octet-stream',
      });

      if (!uploadError) {
        copied += 1;
        if (copied % 20 === 0) console.log(`  ${copied} fichier(s)...`);
      }
    }
  }

  await walk('');
  console.log(`Stockage: ${copied} fichier(s) copié(s).`);
}

async function main() {
  if (!readLinkedProjectRef()) {
    console.error('Projet cloud non lié. Lancez: npx supabase link --project-ref <ref>');
    process.exit(1);
  }

  mkdirSync(tempDir, { recursive: true });
  const defaultPassword = process.env.SYNC_DEFAULT_PASSWORD || 'VerdantLocal2026!';
  const local = resolveLocalCredentials();
  const localClient = createClient(local.url, local.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('=== 1/6 Comptes Auth cloud ===');
  spawnSync('npm', ['run', 'sync:users'], { cwd: root, stdio: 'inherit', shell: true });

  console.log('\n=== 2/6 Profils fantômes (sans compte Auth) ===');
  const ghosts = await ensureAuthUsersForProfiles(localClient, defaultPassword);
  console.log(`${ghosts} compte(s) fantôme(s) créé(s).`);

  console.log('\n=== 3/6 Export cloud (schéma + données) ===');
  run(`npx supabase db dump --linked --schema public -f "${schemaFile.replace(/\\/g, '/')}"`);
  run(`npx supabase db dump --linked --data-only --schema public -f "${dataFile.replace(/\\/g, '/')}"`);

  console.log('\n=== 4/6 Réinitialisation schéma public local ===');
  runPsql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO anon;
    GRANT ALL ON SCHEMA public TO authenticated;
    GRANT ALL ON SCHEMA public TO service_role;
  `, { stopOnError: true });

  console.log('Application du schéma cloud...');
  runPsqlFile(schemaFile);

  console.log('\n=== 5/6 Import des données cloud ===');
  runPsqlFile(dataFile);

  console.log('\n=== 6/6 Fichiers Storage ===');
  await syncStorage();

  const counts = runLocalQueryJson(`
    select
      (select count(*)::int from public.profiles) as profiles,
      (select count(*)::int from public.tasks) as tasks,
      (select count(*)::int from public.equipment) as equipment,
      (select count(*)::int from public.products) as products,
      (select count(*)::int from public.teams) as teams;
  `);

  console.log('\n✅ Synchronisation complète terminée.');
  if (counts[0]) {
    console.log(
      `Données locales: ${counts[0].profiles} profils, ${counts[0].tasks} tâches, ${counts[0].equipment} matériels, ${counts[0].products} produits, ${counts[0].teams} équipes.`,
    );
  }
  console.log(`Mot de passe local des comptes importés: ${defaultPassword}`);
}

main().catch((err) => {
  console.error('\nÉchec:', err.message || err);
  process.exit(1);
});
