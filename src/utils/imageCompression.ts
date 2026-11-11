import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

export const AVATAR_MAX_WIDTH = 1024;
export const DOCUMENT_MAX_WIDTH = 1600;

type CompressOptions = {
  maxWidth?: number;
  quality?: number;
};

export function isCompressibleImage(uri: string, mimeType?: string | null): boolean {
  if (!uri) return false;
  if (mimeType === 'application/pdf' || /\.pdf($|\?)/i.test(uri)) return false;
  // Android pickers return extension-less content:// URIs, so scheme wins here.
  if (/^(file|content|ph|assets-library|data):/i.test(uri)) return true;
  return /\.(jpe?g|png|webp|heic|heif)($|\?)/i.test(uri);
}

function getImageWidth(uri: string): Promise<number> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width) => resolve(width),
      () => resolve(0)
    );
  });
}

/**
 * Downscales + re-encodes a picked image before it is uploaded, so a 12 MP
 * phone photo does not land in storage at 4-8 MB. Falls back to the original
 * file when the platform manipulator cannot handle it (e.g. HEIC on web).
 */
export async function compressImageForUpload(
  uri: string,
  { maxWidth = AVATAR_MAX_WIDTH, quality = 0.7 }: CompressOptions = {}
): Promise<string> {
  if (!uri) return uri;
  try {
    const width = await getImageWidth(uri);
    const context = ImageManipulator.manipulate(uri);
    if (width > maxWidth) {
      context.resize({ width: maxWidth });
    }
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    return result.uri || uri;
  } catch (error: any) {
    console.warn('[imageCompression] Compression skipped:', error?.message || error);
    return uri;
  }
}
