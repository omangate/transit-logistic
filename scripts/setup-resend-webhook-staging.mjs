/**
 * Staging-only helper: create or reuse Resend webhook and write signing secret to OUTPUT_FILE.
 * Does not print secrets to stdout.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT =
  process.env.RESEND_WEBHOOK_ENDPOINT ??
  'https://transit-logistic-api-staging-staging.up.railway.app/api/v1/webhooks/resend';

const EVENTS = ['email.delivered', 'email.bounced', 'email.complained', 'email.failed', 'email.delivery_failed'];

const OUTPUT_FILE =
  process.env.OUTPUT_FILE ??
  join(dirname(fileURLToPath(import.meta.url)), '..', '.staging-secrets', 'resend-webhook-secret');

async function resendRequest(apiKey, method, path, body) {
  const response = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error ?? `Resend API ${response.status}`);
  }

  return payload;
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error('RESEND_API_KEY is required');
    process.exit(1);
  }

  const list = await resendRequest(apiKey, 'GET', '/webhooks');
  const existing = (list?.data ?? []).find((webhook) => webhook.endpoint === ENDPOINT);

  let signingSecret = existing?.signing_secret ?? null;
  if (existing?.id && !signingSecret) {
    const retrieved = await resendRequest(apiKey, 'GET', `/webhooks/${existing.id}`);
    signingSecret = retrieved?.signing_secret ?? null;
  }

  if (!signingSecret) {
    const created = await resendRequest(apiKey, 'POST', '/webhooks', {
      endpoint: ENDPOINT,
      events: EVENTS,
    });
    signingSecret = created?.signing_secret ?? null;
    console.log(`Created webhook ${created?.id ?? '(unknown id)'}`);
  } else {
    console.log(`Reusing webhook ${existing?.id ?? '(unknown id)'}`);
  }

  if (!signingSecret) {
    console.error('Signing secret unavailable from Resend API response');
    process.exit(1);
  }

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, signingSecret, 'utf8');
  console.log(`Signing secret written to ${OUTPUT_FILE}`);
}

await main();
