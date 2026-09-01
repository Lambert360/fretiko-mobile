import { Paths, Directory, File } from 'expo-file-system';

const CACHE_DIR = new Directory(Paths.cache, 'gift-assets');

function normalizeUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function ensureCacheDir(): void {
  if (!CACHE_DIR.exists) {
    try {
      CACHE_DIR.create({ idempotent: true });
    } catch (error) {
      console.warn('Failed to create gift asset cache directory:', error);
    }
  }
}

function isRemoteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

function isAudioUrl(url: string): boolean {
  return /\.(mp3|m4a|aac|wav|ogg|flac)(\?.*)?$/i.test(url);
}

/**
 * Returns a local URI for a remote gift sound asset.
 * Lottie/JSON files are returned as their original remote URIs because
 * lottie-react-native on Android can fail to play dotLottie files from
 * a cached file:// URI, while remote https:// .lottie files work fine.
 */
export async function getCachedAssetUri(
  url: string | number | { uri?: string } | undefined
): Promise<string | number | undefined> {
  if (url === undefined || url === null) return undefined;
  if (typeof url === 'number') return url;

  const actual = typeof url === 'string' ? url : url.uri;
  if (!actual || !isRemoteUrl(actual)) {
    return actual;
  }

  // Only cache sound files. Lottie/JSON should stay as remote URLs.
  if (!isAudioUrl(actual)) {
    return actual;
  }

  ensureCacheDir();
  const fileName = normalizeUrl(actual);
  const file = new File(CACHE_DIR, fileName);

  if (file.exists) {
    return file.uri;
  }

  try {
    const downloaded = await File.downloadFileAsync(actual, file, { idempotent: true });
    return downloaded.uri;
  } catch (error) {
    console.warn('Failed to cache gift asset:', actual, error);
    return actual;
  }
}

/**
 * Prefetch remote gift sound assets into the cache.
 */
export async function prefetchGiftAssets(urls: (string | undefined)[]): Promise<void> {
  const remote = urls.filter((u): u is string => !!u && isRemoteUrl(u) && isAudioUrl(u));
  if (remote.length === 0) return;
  ensureCacheDir();
  await Promise.all(
    remote.map(async (url) => {
      const fileName = normalizeUrl(url);
      const file = new File(CACHE_DIR, fileName);
      if (!file.exists) {
        try {
          await File.downloadFileAsync(url, file, { idempotent: true });
        } catch (error) {
          console.warn('Failed to prefetch gift asset:', url, error);
        }
      }
    })
  );
}
