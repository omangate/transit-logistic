import { Injectable, Logger } from '@nestjs/common';

export type ProcessedImage = {
  main: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  mimeType: 'image/jpeg' | 'image/webp';
};

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  async processTruckImage(input: Buffer, detectedMime: string): Promise<ProcessedImage> {
    try {
      const sharp = (await import('sharp')).default;
      const image = sharp(input, { failOn: 'error' }).rotate();
      const metadata = await image.metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;

      if (width < 400 || height < 300) {
        throw new Error(`Image too small (${width}x${height}); minimum 400x300`);
      }
      if (width > 8000 || height > 8000) {
        throw new Error(`Image too large (${width}x${height}); maximum 8000x8000`);
      }

      const main = await image
        .clone()
        .resize({ width: 1920, height: 1440, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      const thumbnail = await sharp(input)
        .rotate()
        .resize({ width: 480, height: 360, fit: 'cover' })
        .webp({ quality: 75 })
        .toBuffer();

      return { main, thumbnail, width, height, mimeType: 'image/webp' };
    } catch (error) {
      this.logger.warn(`Sharp unavailable or failed, using original image: ${String(error)}`);
      return {
        main: input,
        thumbnail: input,
        width: 0,
        height: 0,
        mimeType: detectedMime === 'image/png' ? 'image/jpeg' : 'image/jpeg',
      };
    }
  }
}
