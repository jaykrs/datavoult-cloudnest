import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { MAX_IMAGE_BYTES, sniffImageType, safeFilename, mediaUrl } from '@/lib/media';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/admin/media — multipart form with a `file` field. Accepts png, jpeg, gif and
 * webp up to 3 MB; the type is decided from the file's bytes, never from its name or
 * Content-Type. Returns the public URL to put in `<img src>`.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const limit = rateLimit(`media:${session.userId}`, 60, 10 * 60_000);
    if (!limit.allowed) return apiError('Too many uploads. Please wait a moment.', 429);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return apiError('Choose an image file to upload', 400);
    if (file.size === 0) return apiError('That file is empty', 400);
    if (file.size > MAX_IMAGE_BYTES) return apiError('Image is too large (max 3 MB)', 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImageType(bytes);
    if (!mime) return apiError('Only PNG, JPEG, GIF or WebP images are allowed', 415);

    const asset = await prisma.mediaAsset.create({
      data: { filename: safeFilename(file.name, mime), mimeType: mime, size: bytes.length, data: Buffer.from(bytes), uploadedById: session.userId as string },
      select: { id: true, filename: true },
    });
    return apiSuccess({ id: asset.id, url: mediaUrl(asset.id), filename: asset.filename }, 201);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    console.error('[admin/media POST]', e);
    return apiError('Upload failed', 500);
  }
}
