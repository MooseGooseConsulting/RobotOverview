/**
 * Download/verify Hangar library binaries and upload to Garage hangar-library.
 *
 *   # terminal A
 *   kubectl -n garage port-forward svc/garage 3900:3900
 *
 *   # terminal B
 *   doppler run --project homelab --config dev -- npx tsx db/hangar/upload-library.ts
 *
 * Uses HANGAR_LIBRARY_* from Doppler; overrides endpoint to localhost when
 * HANGAR_LIBRARY_ENDPOINT is unset or points at in-cluster DNS.
 */
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  CATALOG_LIBRARY_SOURCES,
  EXTRA_LIBRARY_SOURCES,
  type LibrarySource,
} from './library-sources';

const ROOT = resolve(import.meta.dirname, '../..');
const STAGING = join(ROOT, '.tmp-library-staging');
const MANIFEST_PATH = join(ROOT, 'db/hangar/library-manifest.json');

type ManifestEntry = {
  docId: string;
  objectKey: string;
  status: 'uploaded' | 'missing_source' | 'hash_mismatch' | 'error';
  bytes?: number;
  sha256?: string;
  sourcePath?: string;
  downloadUrl?: string;
  expectedSha256?: string | null;
  error?: string;
  uploadedAt?: string;
};

function sha256File(path: string): string {
  const hash = createHash('sha256');
  hash.update(readFileSync(path));
  return hash.digest('hex');
}

function resolveConfig() {
  const accessKeyId = process.env.HANGAR_LIBRARY_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.HANGAR_LIBRARY_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.HANGAR_LIBRARY_BUCKET?.trim() || 'hangar-library';
  const region = process.env.HANGAR_LIBRARY_REGION?.trim() || 'garage';
  let endpoint = process.env.HANGAR_LIBRARY_ENDPOINT?.trim();
  if (!endpoint || endpoint.includes('.svc')) {
    endpoint = 'http://127.0.0.1:3900';
  }
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'HANGAR_LIBRARY_ACCESS_KEY_ID / HANGAR_LIBRARY_SECRET_ACCESS_KEY required (doppler run …)',
    );
  }
  return { endpoint, bucket, region, accessKeyId, secretAccessKey };
}

async function download(url: string, dest: string): Promise<void> {
  mkdirSync(dirname(dest), { recursive: true });
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`download HTTP ${res.status} for ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(dest));
}

async function materialize(source: LibrarySource): Promise<{ path: string } | { missing: string }> {
  for (const rel of source.localCandidates) {
    const abs = resolve(ROOT, rel);
    if (existsSync(abs)) return { path: abs };
  }
  if (!source.downloadUrl) {
    return { missing: 'no local file and no downloadUrl' };
  }
  const dest = join(STAGING, source.objectKey);
  if (!existsSync(dest)) {
    console.log(`download ${source.docId} …`);
    await download(source.downloadUrl, dest);
  }
  return { path: dest };
}

async function uploadOne(
  client: S3Client,
  bucket: string,
  source: LibrarySource,
): Promise<ManifestEntry> {
  const base: ManifestEntry = {
    docId: source.docId,
    objectKey: source.objectKey,
    status: 'missing_source',
    expectedSha256: source.expectedSha256,
    downloadUrl: source.downloadUrl,
  };
  try {
    const material = await materialize(source);
    if ('missing' in material) {
      return { ...base, status: 'missing_source', error: material.missing };
    }
    const sha = sha256File(material.path);
    const bytes = readFileSync(material.path).byteLength;
    if (source.expectedSha256 && sha !== source.expectedSha256) {
      return {
        ...base,
        status: 'hash_mismatch',
        bytes,
        sha256: sha,
        sourcePath: material.path,
        error: `expected ${source.expectedSha256}`,
      };
    }
    const body = readFileSync(material.path);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: source.objectKey,
        Body: body,
        ContentType: guessType(source.objectKey),
      }),
    );
    return {
      ...base,
      status: 'uploaded',
      bytes,
      sha256: sha,
      sourcePath: material.path,
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...base,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function guessType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.md')) return 'text/markdown; charset=utf-8';
  return 'application/octet-stream';
}

async function main() {
  const cfg = resolveConfig();
  console.log(`endpoint=${cfg.endpoint} bucket=${cfg.bucket}`);
  mkdirSync(STAGING, { recursive: true });

  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  const all = [...CATALOG_LIBRARY_SOURCES, ...EXTRA_LIBRARY_SOURCES];
  const entries: ManifestEntry[] = [];
  for (const source of all) {
    const entry = await uploadOne(client, cfg.bucket, source);
    entries.push(entry);
    console.log(`${entry.status.padEnd(14)} ${entry.docId} → ${entry.objectKey}`);
  }
  client.destroy();

  const manifest = {
    generatedAt: new Date().toISOString(),
    bucket: cfg.bucket,
    catalogUploaded: entries.filter((e) => e.docId.startsWith('doc-') && e.status === 'uploaded')
      .length,
    catalogTotal: CATALOG_LIBRARY_SOURCES.length,
    entries,
  };
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  console.log(`\nmanifest → ${MANIFEST_PATH}`);
  console.log(
    `catalog uploaded ${manifest.catalogUploaded}/${manifest.catalogTotal}; missing=${
      entries.filter((e) => e.status === 'missing_source').length
    }; mismatch=${entries.filter((e) => e.status === 'hash_mismatch').length}; error=${
      entries.filter((e) => e.status === 'error').length
    }`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
