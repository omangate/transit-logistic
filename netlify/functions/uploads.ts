import type { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

const STORE = process.env.NETLIFY_BLOB_STORE ?? 'transit-uploads';

function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

export const handler: Handler = async (event) => {
  const rawPath = event.path ?? event.rawUrl ?? '';
  const match = rawPath.match(/\/uploads\/(.+)$/);
  if (!match) {
    return { statusCode: 404, body: 'Not found' };
  }

  const relative = decodeURIComponent(match[1]);
  const key = relative.startsWith('public/') ? relative : `public/${relative}`;

  try {
    const store = getStore(STORE);
    const result = await store.getWithMetadata(key, { type: 'blob' });
    if (!result?.data) {
      return { statusCode: 404, body: 'Not found' };
    }

    const buffer = Buffer.from(await result.data.arrayBuffer());
    const contentType =
      (result.metadata?.contentType as string | undefined) ?? contentTypeForKey(key);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch {
    return { statusCode: 404, body: 'Not found' };
  }
};
