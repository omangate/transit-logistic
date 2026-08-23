#!/usr/bin/env node
/**
 * Netlify API helper using local CLI auth token (never logs token).
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SITE_ID = '67153b44-1cc2-41f2-85f4-cf4da6ca899a';
const API = 'https://api.netlify.com/api/v1';

function getNetlifyToken() {
  const configPath = join(homedir(), 'AppData', 'Roaming', 'netlify', 'Config', 'config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const userId = config.userId;
  const token = config.users?.[userId]?.auth?.token;
  if (!token) throw new Error('Netlify auth token not found');
  return token;
}

function getGithubToken() {
  const configPath = join(homedir(), 'AppData', 'Roaming', 'netlify', 'Config', 'config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const userId = config.userId;
  return config.users?.[userId]?.auth?.github?.token ?? null;
}

async function netlify(method, path, body) {
  const token = getNetlifyToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`Netlify ${method} ${path} failed: ${res.status} ${text.slice(0, 400)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function github(method, path, body) {
  const token = getGithubToken();
  if (!token) throw new Error('GitHub token not found in Netlify config');
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`GitHub ${method} ${path} failed: ${res.status} ${text.slice(0, 400)}`);
  }
  return data;
}

const REPO = 'omangate/transit-logistic';
const BRANCH = 'feature/premium-ui-ocean-carriers';
const BUILD_CMD = 'bash scripts/netlify-build.sh';

async function main() {
  const action = process.argv[2] ?? 'status';

  if (action === 'status') {
    const site = await netlify('GET', `/sites/${SITE_ID}`);
    console.log(JSON.stringify({
      name: site.name,
      url: site.ssl_url,
      repo_url: site.build_settings?.repo_url ?? site.repo?.repo_url ?? null,
      branch: site.build_settings?.repo_branch ?? site.repo?.branch ?? null,
      published: site.published_deploy?.state ?? null,
      quick_setup: site.quick_setup_in_progress,
    }, null, 2));
    return;
  }

  if (action === 'link') {
    const deployKey = await netlify('POST', '/deploy_keys', {
      title: `netlify-${SITE_ID.slice(0, 8)}`,
    });
    console.log('Deploy key created:', deployKey.id);

    try {
      await github('POST', `/repos/${REPO}/keys`, {
        title: `netlify-${SITE_ID.slice(0, 8)}`,
        key: deployKey.public_key,
        read_only: true,
      });
      console.log('Deploy key added to GitHub');
    } catch (error) {
      if (String(error.message).includes('422')) {
        console.log('Deploy key may already exist on GitHub, continuing...');
      } else {
        throw error;
      }
    }

    const site = await netlify('PATCH', `/sites/${SITE_ID}`, {
      repo: {
        provider: 'github',
        repo: REPO,
        branch: BRANCH,
        dir: 'apps/web/.next',
        cmd: BUILD_CMD,
        deploy_key_id: deployKey.id,
      },
    });
    console.log('Site linked:', site.build_settings?.repo_url ?? site.repo?.repo);
    return;
  }

  if (action === 'build') {
    const build = await netlify('POST', `/sites/${SITE_ID}/builds`, {});
    console.log('Build triggered:', build.id, build.state ?? 'new');
    return build.id;
  }

  if (action === 'builds') {
    const builds = await netlify('GET', `/sites/${SITE_ID}/builds?per_page=5`);
    console.log(JSON.stringify(builds, null, 2));
    return;
  }

  if (action === 'wait') {
    const buildId = process.argv[3];
    if (!buildId) throw new Error('Usage: wait <build_id>');
    for (let i = 0; i < 60; i++) {
      const build = await netlify('GET', `/sites/${SITE_ID}/builds/${buildId}`);
      console.log(`[${i + 1}] build ${buildId}: ${build.done ? 'done' : 'running'} error=${build.error ?? 'none'}`);
      if (build.done) {
        console.log(JSON.stringify({ done: true, error: build.error, deploy_id: build.deploy_id }, null, 2));
        process.exit(build.error ? 1 : 0);
      }
      await new Promise((r) => setTimeout(r, 15000));
    }
    throw new Error('Build timed out');
  }

  console.log('Actions: status | link | build | builds | wait <id>');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
