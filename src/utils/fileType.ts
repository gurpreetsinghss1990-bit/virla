export type SafeFileType = 'jpg' | 'png' | 'webp' | 'heic' | 'pdf';

export type SniffedFile = {
  ext: SafeFileType;
  contentType: string;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function ascii(data: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...data.subarray(start, start + length));
}

function startsWith(data: Uint8Array, signature: number[]): boolean {
  if (data.length < signature.length) return false;
  return signature.every((byte, i) => data[i] === byte);
}

/**
 * Identifies an upload by its magic bytes instead of trusting the file
 * extension or the picker-supplied MIME type.
 */
export function sniffFileType(buffer: ArrayBuffer): SniffedFile | null {
  const data = new Uint8Array(buffer);

  if (startsWith(data, [0xff, 0xd8, 0xff])) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (data.length >= 12 && ascii(data, 0, 4) === 'RIFF' && ascii(data, 8, 4) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  if (data.length >= 12 && ascii(data, 4, 4) === 'ftyp') {
    const brand = ascii(data, 8, 4);
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) {
      return { ext: 'heic', contentType: 'image/heic' };
    }
  }
  if (ascii(data, 0, 4) === '%PDF') {
    return { ext: 'pdf', contentType: 'application/pdf' };
  }
  return null;
}

export function assertUploadableFile(buffer: ArrayBuffer, allowed?: SafeFileType[]): SniffedFile {
  if (buffer.byteLength === 0) throw new Error('Selected file is empty.');
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new Error('File is too large (max 10 MB).');

  const sniffed = sniffFileType(buffer);
  if (!sniffed) throw new Error('Unsupported file type. Upload a JPG, PNG, WebP, HEIC or PDF.');
  if (allowed && !allowed.includes(sniffed.ext)) {
    throw new Error(`Unsupported file type. Allowed: ${allowed.join(', ')}.`);
  }
  return sniffed;
}

/** Keeps user-controlled ids from escaping the storage folder. */
export function safeStorageSegment(value: string): string {
  const cleaned = (value || '').replace(/[^A-Za-z0-9_-]/g, '').replace(/^[.-]+/, '');
  return cleaned.length > 0 ? cleaned.slice(0, 64) : 'unknown';
}
