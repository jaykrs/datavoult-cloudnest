import { NextRequest } from 'next/server';
import { z } from 'zod';

export function apiSuccess<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status });
}

export async function parseBody<T>(req: NextRequest, schema: z.ZodSchema<T>): Promise<T> {
  const body = await req.json();
  return schema.parse(body);
}

export function getPaginationParams(req: NextRequest) {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

// Validation schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.enum(['VPS', 'DOCKER', 'EMAIL']),
  features: z.array(z.string()),
  specs: z.record(z.unknown()),
  imageUrl: z.string().url().optional(),
});

export const createPlanSchema = z.object({
  productId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
  isPopular: z.boolean().default(false),
  limits: z.record(z.unknown()),
});

export const subscribeSchema = z.object({
  productId: z.string(),
  planId: z.string(),
  paymentMethodId: z.string().optional(),
});
