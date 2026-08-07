import { detectFileKind } from './file-magic.util';

describe('detectFileKind', () => {
  it('detects JPEG from magic bytes', () => {
    const buf = Buffer.alloc(16);
    buf.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(detectFileKind(buf)).toBe('image/jpeg');
  });

  it('detects PNG from magic bytes', () => {
    const buf = Buffer.alloc(16);
    buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectFileKind(buf)).toBe('image/png');
  });

  it('rejects spoofed MIME (text pretending to be image)', () => {
    const buf = Buffer.from('not an image file');
    expect(detectFileKind(buf)).toBeNull();
  });

  it('detects PDF', () => {
    const buf = Buffer.from('%PDF-1.4 fake content');
    expect(detectFileKind(buf)).toBe('application/pdf');
  });
});
