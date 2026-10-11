import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, updateProfileSchema } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export async function GET() {
  try {
    const session = await requireAuth();
    const user = await prisma.user.findUnique({
      where: { id: session.userId as string},
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, isVerified: true, createdAt: true },
    });
    if (!user) return apiError('User not found', 404);
    return apiSuccess({ user });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Internal server error', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;
    const { name, currentPassword, newPassword } = updateProfileSchema.parse(await req.json());

    const updateData: { name?: string; passwordHash?: string } = {};
    if (name) updateData.name = name;

    if (newPassword) {
      // Password changes need the current password; throttle guesses.
      const limit = rateLimit(`pwchange:${userId}`, 5, 15 * 60_000);
      if (!limit.allowed) return apiError('Too many attempts. Try again later.', 429);
      if (!currentPassword) return apiError('Current password is required', 400);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return apiError('User not found', 404);
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return apiError('Current password is incorrect', 400);
      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) return apiError('Nothing to update', 400);

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
    });

    return apiSuccess({ user });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[users/me PATCH]', e);
    return apiError('Internal server error', 500);
  }
}
