import { NextResponse } from 'next/server';
import {
  contentDispositionFilename,
  getHangarLibraryConfig,
  getHangarLibraryObject,
  guessContentType,
  normalizeLibraryObjectKey,
} from '@/server/hangar/library';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: RouteContext) {
  const { path } = await context.params;
  const key = normalizeLibraryObjectKey(path ?? []);
  if (!key) {
    return NextResponse.json({ ok: false, error: 'Invalid library path' }, { status: 400 });
  }

  const config = getHangarLibraryConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, error: 'Hangar library store is not configured' },
      { status: 503 },
    );
  }

  try {
    const object = await getHangarLibraryObject(key, config);
    if (!object) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const body = object.body as {
      transformToByteArray?: () => Promise<Uint8Array>;
    };
    if (typeof body.transformToByteArray !== 'function') {
      return NextResponse.json({ ok: false, error: 'Library object unreadable' }, { status: 502 });
    }

    const bytes = await body.transformToByteArray();
    const contentType = object.contentType || guessContentType(key);
    const filename = contentDispositionFilename(key);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(object.contentLength ?? bytes.byteLength),
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.warn('Hangar library proxy failed.', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: 'Library fetch failed' }, { status: 502 });
  }
}
