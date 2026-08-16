import { NextResponse } from 'next/server';
import { getInventoryItems } from '@/server/hangar/items';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const read = await getInventoryItems();

  if (read.source === 'unavailable') {
    return NextResponse.json(
      {
        source: 'unavailable',
        fallbackReason: read.fallbackReason,
        count: 0,
        items: [],
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    source: read.source,
    fallbackReason: null,
    count: read.items.length,
    items: read.items,
  });
}
