#!/usr/bin/env node
/**
 * Connect existing Netlify site to GitHub and trigger production build.
 * Uses Netlify CLI API wrapper (reads auth from local Netlify config).
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SITE_ID = '67153b44-1cc2-41f2-85f4-cf4da6ca899a';
const REPO = 'omangate/transit-logistic';
const BRANCH = 'feature/premium-ui-ocean-carriers';
const REPO_URL = `https://github.com/${REPO}.git`;

function api(method, data = {}) {
  const payload = JSON.stringify(data);
  const cmd = `npx --yes netlify-cli api ${method} --data ${JSON.stringify(payload)}`;
  const out = execSync(cmd, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

function apiRaw(method, data = {}) {
  const payload = JSON.stringify(data);
  const cmd = `npx --yes netlify-cli api ${method} --data ${JSON.stringify(payload)}`;
  return execSync(cmd, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function getSite() {
  return api('getSite', { site_id: SITE_ID });
}

function createDeployKey() {
  return api('createDeployKey', { title: `transit-logistic-web-test-${Date.now()}` });
}

function updateSite(body) {
  return api('updateSite', { site_id: SITE_ID, ...body });
}

function createSiteBuild() {
  return api('createSiteBuild', { site_id: SITE_ID });
}

function listSiteBuilds() {
  return api('listSiteBuilds', { site_id: SITE_ID, per_page: 5 });
}

function getSiteBuild(buildId) {
  return api('getSiteBuild', { site_id: SITE_ID, build_id: buildId });
}

function getEnvVars() {
  try {
    return api('getEnvVars', { site_id: SITE_ID });
  } catch {
    return [];
  }
}

function ensureEnvVar(key, value, scopes = ['production', 'deploy-preview']) {
  try {
    api('createEnvVars', {
      account_id: getSite().account_id,
      site_id: SITE_ID,
      key,
      values: scopes.map((scope) => ({ value, context: scope })),
    });
    console.log(`Created env var: ${key}`);
  } catch (error) {
    const message = String(error.stderr ?? error.message ?? error);
    if (message.includes('already exists') || message.includes('409')) {
      console.log(`Env var exists: ${key}`);
    } else {
      console.warn(`Env var ${key}:`, message.slice(0, 200));
    }
  }
}

async function addGithubDeployKey(publicKey, title) {
  // Try gh CLI first
  const gh = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
  if (gh.status === 0) {
    const result = spawnSync(
      'gh',
      [
        'api',
        `repos/${REPO}/keys`,
        '-f',
        `title=${title}`,
        '-f',
        `key=${publicKey}`,
        '-f',
        'read_only=true',
      ],
      { encoding: 'utf8' },
    );
    if (result.status === 0) {
      console.log('Added deploy key via gh CLI');
      return true;
    }
    console.warn('gh deploy key failed:', result.stderr?.slice(0, 300));
  }

  // Try git credential helper / stored token via env
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/keys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title, key: publicKey, read_only: true }),
    });
    if (res.ok) {
      console.log('Added deploy key via GitHub API token');
      return true;
    }
    const text = await res.text();
    console.warn('GitHub API deploy key failed:', res.status, text.slice(0, 300));
  }

  return false;
}

async function main() {
  console.log('=== Netlify GitHub Connect ===');
  const site = getSite();
  console.log('Site:', site.name, site.ssl_url);
  console.log('Repo linked:', site.build_settings?.repo_url ?? site.repo?.url ?? 'NO');
  console.log('Published deploy:', site.published_deploy?.id ?? 'NONE');

  // Ensure env vars (netlify.toml also sets these, but explicit is safer)
  ensureEnvVar('NEXT_PUBLIC_API_URL', 'https://transit-logistic-production.up.railway.app');
  ensureEnvVar('NODE_VERSION', '20');
  ensureEnvVar('NETLIFY_USE_PNPM', 'true');
  ensureEnvVar('NEXT_TELEMETRY_DISABLED', '1');

  if (site.build_settings?.repo_url || site.repo?.url) {
    console.log('Repo already linked, triggering build...');
    try {
      const build = createSiteBuild();
      console.log('Build triggered:', build.id, build.state);
      return;
    } catch (error) {
      console.warn('createSiteBuild failed:', String(error.stderr ?? error.message).slice(0, 300));
    }
  }

  console.log('Creating deploy key...');
  const deployKey = createDeployKey();
  console.log('Deploy key id:', deployKey.id);

  console.log('Updating site with repo config...');
  try {
    const updated = updateSite({
      repo: {
        provider: 'github',
        repo: REPO,
        branch: BRANCH,
        repo_path: '',
        dir: 'apps/web/.next',
        cmd: 'node scripts/netlify-build.mjs',
        allowed_roles: ['admin', 'deploy'],
        public_repo: false,
        private_logs: null,
        deploy_key_id: deployKey.id,
        repo_url: REPO_URL,
        repo_branch: BRANCH,
        repo_branch_is_set: true,
      },
      build_settings: {
        cmd: 'node scripts/netlify-build.mjs',
        dir: 'apps/web/.next',
        repo_branch: BRANCH,
        repo_url: REPO_URL,
        provider: 'github',
        deploy_key_id: deployKey.id,
      },
    });
    console.log('Site updated. Repo:', updated.build_settings?.repo_url ?? updated.repo?.url);
  } catch (error) {
    console.error('updateSite failed:', String(error.stderr ?? error.message).slice(0, 500));
  }

  const keyAdded = await addGithubDeployKey(deployKey.public_key, `netlify-${SITE_ID.slice(0, 8)}`);
  if (!keyAdded) {
    console.log('\n--- MANUAL STEP REQUIRED ---');
    console.log('Add this deploy key to GitHub repo Settings > Deploy keys:');
    console.log(deployKey.public_key);
    console.log('Then re-run this script to trigger build.');
    process.exit(2);
  }

  console.log('Triggering production build...');
  try {
    const build = createSiteBuild();
    console.log('Build id:', build.id, 'state:', build.state);
  } catch (error) {
    console.error('Build trigger failed:', String(error.stderr ?? error.message).slice(0, 500));
  }

  const builds = listSiteBuilds();
  console.log('Recent builds:', JSON.stringify(builds, null, 2).slice(0, 1000));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
