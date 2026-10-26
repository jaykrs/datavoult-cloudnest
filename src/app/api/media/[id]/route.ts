import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/** GET /api/media/:id — public image bytes. Immutable, so cached for a year. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(params.id)) return new Response('Not found', { status: 404 });
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(asset.data), {
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': String(asset.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Defence in depth: never let a stored file be sniffed into something executable.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'Content-Disposition': `inline; filename="${asset.filename}"`,
    },
  });
}
