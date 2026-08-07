const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];
const PDF = [0x25, 0x50, 0x44, 0x46];

export type DetectedFileKind = 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'video/webm' | 'application/pdf';

export function detectFileKind(buffer: Buffer): DetectedFileKind | null {
  if (buffer.length < 12) return null;

  if (startsWith(buffer, JPEG)) return 'image/jpeg';
  if (startsWith(buffer, PNG)) return 'image/png';
  if (startsWith(buffer, WEBP_RIFF) && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  if (startsWith(buffer, PDF)) return 'application/pdf';

  const ftyp = buffer.slice(4, 8).toString('ascii');
  if (ftyp === 'ftyp') {
    const brand = buffer.slice(8, 12).toString('ascii');
    if (['isom', 'mp41', 'mp42', 'avc1', 'M4V ', 'MSNV'].includes(brand)) {
      return 'video/mp4';
    }
  }

  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBM') {
    return 'video/webm';
  }

  return null;
}

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((byte, index) => buffer[index] === byte);
}

export function extensionForKind(kind: DetectedFileKind): string {
  switch (kind) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'video/mp4':
      return '.mp4';
    case 'video/webm':
      return '.webm';
    case 'application/pdf':
      return '.pdf';
    default:
      return '.bin';
  }
}
