import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

/** Catalog subsystem folders allowed in library object keys. */
export const LIBRARY_SUBSYSTEM_PREFIXES = [
  '02-Driver-Board',
  '03-Power-UPS',
  '04-Servos',
  '05-Chassis-CAD',
  '06-Jetson-Orin',
  '07-Code-Firmware',
  '08-Wiki-Pages',
  'extra',
] as const;

export interface HangarLibraryConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getHangarLibraryConfig(): HangarLibraryConfig | null {
  const endpoint = process.env.HANGAR_LIBRARY_ENDPOINT?.trim();
  const bucket = process.env.HANGAR_LIBRARY_BUCKET?.trim();
  const region = process.env.HANGAR_LIBRARY_REGION?.trim() || 'garage';
  const accessKeyId = process.env.HANGAR_LIBRARY_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.HANGAR_LIBRARY_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, region, accessKeyId, secretAccessKey };
}

/**
 * Join and validate a library object key from URL path segments.
 * Rejects `..`, absolute paths, empty segments, and unknown subsystem roots.
 */
export function normalizeLibraryObjectKey(segments: string[]): string | null {
  if (!segments.length) return null;
  const decoded = segments.map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return null;
    }
  });
  if (decoded.some((s) => s === null)) return null;

  const parts = decoded as string[];
  if (parts.some((p) => !p || p === '.' || p === '..' || p.includes('\\') || p.includes('\0'))) {
    return null;
  }
  if (parts[0] === 'beast') {
    // Accept accidental beast/ prefix from callers; strip to catalog key shape.
    parts.shift();
    if (!parts.length) return null;
  }
  const root = parts[0];
  if (!LIBRARY_SUBSYSTEM_PREFIXES.includes(root as (typeof LIBRARY_SUBSYSTEM_PREFIXES)[number])) {
    return null;
  }
  return parts.join('/');
}

export function createHangarLibraryClient(config: HangarLibraryConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export interface LibraryObject {
  /** Fully buffered object bytes (client is closed before return). */
  bytes: Uint8Array;
  contentType: string | undefined;
  contentLength: number | undefined;
  contentDisposition: string | undefined;
}

export async function getHangarLibraryObject(
  key: string,
  config = getHangarLibraryConfig(),
): Promise<LibraryObject | null> {
  if (!config) return null;
  const client = createHangarLibraryClient(config);
  try {
    const result = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
    if (!result.Body || typeof result.Body.transformToByteArray !== 'function') {
      return null;
    }
    // Buffer before destroy — tearing down the client aborts an unread stream ("aborted").
    const bytes = await result.Body.transformToByteArray();
    return {
      bytes,
      contentType: result.ContentType,
      contentLength: result.ContentLength ?? bytes.byteLength,
      contentDisposition: result.ContentDisposition,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    const message = error instanceof Error ? error.message : String(error);
    if (name === 'NoSuchKey' || name === 'NotFound' || /NoSuchKey|Not Found|404/i.test(message)) {
      return null;
    }
    throw error;
  } finally {
    client.destroy();
  }
}

export function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.step') || lower.endsWith('.stp')) return 'application/step';
  return 'application/octet-stream';
}

export function contentDispositionFilename(key: string): string {
  const base = key.split('/').pop() || 'download';
  // ASCII fallback for Content-Disposition filename=
  const ascii = base.replace(/[^\x20-\x7E]+/g, '_').replace(/["\\]/g, '_');
  return ascii || 'download';
}
