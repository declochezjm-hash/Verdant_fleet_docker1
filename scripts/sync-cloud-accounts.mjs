import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const PROFILE_FIELDS = ['id', 'name', 'team', 'hourly_rate', 'created_at'];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

function resolveLocalCredentials() {
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const raw = execSync('npx supabase status -o env', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const api = raw.match(/API_URL="([^"]+)"/)?.[1];
    const service = raw.match(/SERVICE_ROLE_KEY="([^"]+)"/)?.[1];
    if (api) url = api;
    if (service) key = service;
  } catch {
    // garde .env
  }

  return { url, key };
}
const DEFAULT_PASSWORD = process.env.SYNC_DEFAULT_PASSWORD || 'VerdantLocal2026!';

function isProjectLinked() {
  return existsSync(resolve(root, 'supabase/.temp/project-ref'));
}

function parseQueryJson(raw) {
  const trimmed = raw.trim();
  const jsonStart = trimmed.search(/[\[{]/);
  if (jsonStart === -1) return [];
  const parsed = JSON.parse(trimmed.slice(jsonStart));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.rows)) return parsed.rows;
  if (Array.isArray(parsed?.data)) return parsed.data;
  return [];
}

function readLinkedProjectRef() {
  const refFile = resolve(root, 'supabase/.temp/project-ref');
  if (!existsSync(refFile)) return null;
  return readFileSync(refFile, 'utf8').trim().replace(/\r$/, '');
}

function resolveCloudServiceKey() {
  const fromEnv = process.env.CLOUD_SUPABASE_SERVICE_ROLE_KEY?.replace(/\r$/, '');
  const projectRef = process.env.CLOUD_PROJECT_REF || readLinkedProjectRef();
  if (!projectRef) return fromEnv;

  try {
    const raw = execSync(
      `npx supabase projects api-keys --project-ref ${projectRef} -o json`,
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const jsonStart = raw.search(/[\[{]/);
    if (jsonStart === -1) return fromEnv;
    const keys = JSON.parse(raw.slice(jsonStart));
    const service = keys.find((k) => k.name === 'service_role');
    return service?.api_key || fromEnv;
  } catch {
    return fromEnv;
  }
}

function runLinkedQuery(sql) {
  const file = join(tmpdir(), `verdant-sync-${Date.now()}.sql`);
  writeFileSync(file, sql, 'utf8');
  try {
    const raw = execSync(`npx supabase db query --linked -o json -f "${file}"`, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseQueryJson(raw);
  } catch (err) {
    const details = err.stderr?.toString?.() || err.stdout?.toString?.() || err.message;
    throw new Error(`Requête cloud échouée (${details}). Essayez: npx supabase login`);
  } finally {
    unlinkSync(file);
  }
}

async function listAllUsersRest(supabase) {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }

  return users;
}

function pickProfile(profile, userId) {
  if (!profile) return null;
  const picked = { id: userId, team: '' };
  for (const field of PROFILE_FIELDS) {
    if (field === 'id') continue;
    if (profile[field] !== undefined && profile[field] !== null) picked[field] = profile[field];
  }
  if (!picked.team) picked.team = '';
  if (!picked.name) picked.name = 'Utilisateur';
  return picked;
}

async function fetchCloudData() {
  if (isProjectLinked()) {
    try {
      console.log('Lecture cloud via Supabase CLI (projet lié)...');
      const users = runLinkedQuery(`
        select id, email, raw_user_meta_data as user_metadata, email_confirmed_at
        from auth.users
        where email is not null
        order by email;
      `);
      const profiles = runLinkedQuery('select * from public.profiles order by name;');
      const roles = runLinkedQuery('select user_id, role from public.user_roles;');
      return { users, profiles, roles, source: 'cli' };
    } catch (err) {
      console.warn(`CLI cloud indisponible (${err.message}), bascule API REST...`);
    }
  }

  const cloudUrl = process.env.CLOUD_SUPABASE_URL || `https://${readLinkedProjectRef()}.supabase.co`;
  const cloudKey = resolveCloudServiceKey();
  if (!cloudUrl || !cloudKey) {
    throw new Error(
      'Projet non lié. Lancez: npx supabase link --project-ref <ref>\n' +
        'Ou renseignez CLOUD_SUPABASE_URL / CLOUD_SUPABASE_SERVICE_ROLE_KEY dans .env.cloud',
    );
  }

  console.log('Lecture cloud via API REST...');
  const cloud = createClient(cloudUrl, cloudKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [users, profilesRes, rolesRes] = await Promise.all([
    listAllUsersRest(cloud),
    cloud.from('profiles').select('*'),
    cloud.from('user_roles').select('user_id, role'),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (rolesRes.error) throw rolesRes.error;

  return {
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      user_metadata: u.user_metadata,
      email_confirmed_at: u.email_confirmed_at,
    })),
    profiles: profilesRes.data || [],
    roles: rolesRes.data || [],
    source: 'rest',
  };
}

async function sync() {
  const { url: LOCAL_URL, key: LOCAL_KEY } = resolveLocalCredentials();
  if (!LOCAL_URL || !LOCAL_KEY) {
    console.error('Variables manquantes: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env)');
    process.exit(1);
  }

  const local = createClient(LOCAL_URL, LOCAL_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { users: cloudUsers, profiles, roles } = await fetchCloudData();
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const rolesByUser = roles.reduce((acc, role) => {
    if (!acc[role.user_id]) acc[role.user_id] = [];
    acc[role.user_id].push(role);
    return acc;
  }, {});

  const localUsers = await listAllUsersRest(local);
  const localByEmail = new Map(localUsers.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u]));
  const localById = new Map(localUsers.map((u) => [u.id, u]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  console.log(`Local: ${LOCAL_URL}`);
  console.log(`${cloudUsers.length} utilisateur(s) cloud à synchroniser\n`);

  for (const user of cloudUsers) {
    if (!user.email) {
      skipped += 1;
      continue;
    }

    const email = user.email.toLowerCase();
    const profile = profileById.get(user.id);
    const userRoles = rolesByUser[user.id] || [];
    const metadata = { ...(user.user_metadata || {}) };

    if (profile?.name && !metadata.name) metadata.name = profile.name;
    if (profile?.team && !metadata.team) metadata.team = profile.team;
    if (userRoles[0]?.role && !metadata.role) metadata.role = userRoles[0].role;

    const existingByEmail = localByEmail.get(email);
    const existingById = localById.get(user.id);

    try {
      let localUserId = existingByEmail?.id || existingById?.id;

      if (!localUserId) {
        const { data, error } = await local.auth.admin.createUser({
          id: user.id,
          email: user.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: metadata,
        });

        if (error) {
          const retry = await local.auth.admin.createUser({
            email: user.email,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: metadata,
          });
          if (retry.error) throw retry.error;
          localUserId = retry.data.user.id;
        } else {
          localUserId = data.user.id;
        }

        created += 1;
        console.log(`✓ Créé: ${user.email}`);
      } else {
        const { error } = await local.auth.admin.updateUserById(localUserId, {
          email: user.email,
          email_confirm: true,
          user_metadata: metadata,
          password: DEFAULT_PASSWORD,
        });
        if (error) throw error;
        updated += 1;
        console.log(`↻ Mis à jour: ${user.email}`);
      }

      const profilePayload = pickProfile(profile, localUserId);
      if (profilePayload) {
        const { error } = await local.from('profiles').upsert(profilePayload, { onConflict: 'id' });
        if (error) throw error;
      }

      if (userRoles.length) {
        await local.from('user_roles').delete().eq('user_id', localUserId);
        const { error } = await local.from('user_roles').insert(
          userRoles.map((r) => ({ user_id: localUserId, role: r.role })),
        );
        if (error) throw error;
      }
    } catch (err) {
      errors += 1;
      console.error(`✗ ${user.email}:`, err.message || err);
    }
  }

  console.log(`\nSynchronisation terminée: ${created} créés, ${updated} mis à jour, ${skipped} ignorés, ${errors} erreur(s)`);
  console.log(`Mot de passe local pour tous les comptes importés: ${DEFAULT_PASSWORD}`);
}

sync().catch((err) => {
  console.error('Échec de la synchronisation:', err.message || err);
  process.exit(1);
});
