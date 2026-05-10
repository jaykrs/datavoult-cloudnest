import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import bcrypt from 'bcryptjs';

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
    const body = await req.json();
    const { name, currentPassword, newPassword } = body;

    const updateData: Record<string, string> = {};
    if (name) updateData.name = name;

    if (newPassword) {
      const user = await prisma.user.findUnique({ where: { id: session.userId as string} });
      if (!user) return apiError('User not found', 404);
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return apiError('Current password is incorrect', 400);
      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    const user = await prisma.user.update({
      where: { id: session.userId as string},
      data: updateData,
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
    });

    return apiSuccess({ user });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Internal server error', 500);
  }
}
