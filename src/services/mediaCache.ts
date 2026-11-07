import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const CACHE_DIR_NAME = 'virla-media';

const inflight = new Map<string, Promise<string>>();

function cacheFileNameFor(url: string): string {
  const path = url.split('?')[0];
  const name = path.substring(path.lastIndexOf('/') + 1).replace(/[^A-Za-z0-9._-]/g, '_');
  let hash = 5381;
  for (let i = 0; i < url.length; i += 1) {
    hash = ((hash << 5) + hash + url.charCodeAt(i)) >>> 0;
  }
  return `${hash.toString(36)}-${name.slice(-48)}`;
}

function cacheDirectory(): Directory {
  return new Directory(Paths.cache, CACHE_DIR_NAME);
}

/**
 * Returns a local `file://` URI for a remote media URL, downloading it into the
 * app cache directory on first use. Falls back to the remote URL on any failure
 * so playback never breaks because of the cache layer.
 *
 * Concurrent calls for the same URL share a single download.
 */
export async function getCachedMediaUri(url: string | null | undefined): Promise<string> {
  if (!url) return '';
  if (Platform.OS === 'web' || !/^https?:/i.test(url)) return url;

  const pending = inflight.get(url);
  if (pending) return pending;

  const task = (async () => {
    try {
      const dir = cacheDirectory();
      if (!dir.exists) {
        dir.create({ intermediates: true, idempotent: true });
      }
      const file = new File(dir, cacheFileNameFor(url));
      if (file.exists && (file.size ?? 0) > 0) return file.uri;
      const downloaded = await File.downloadFileAsync(url, file, { idempotent: true });
      return downloaded.uri;
    } catch (error) {
      console.warn('[mediaCache] download failed, using remote url', url, error);
      return url;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, task);
  return task;
}
