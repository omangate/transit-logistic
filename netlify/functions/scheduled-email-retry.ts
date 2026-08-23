import type { Config } from '@netlify/functions';

export const config: Config = {
  schedule: '*/15 * * * *',
};

/** Placeholder scheduled hook — extend to drain queued email logs when needed. */
export const handler = async () => ({
  statusCode: 200,
  body: JSON.stringify({ ok: true, processed: 0 }),
});
