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
export const recaptchaTokenField = z.string().max(4096).optional();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  recaptchaToken: recaptchaTokenField,
});

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  acceptPrivacy: z.literal(true, { errorMap: () => ({ message: 'You must accept the Privacy Policy to create an account' }) }),
  recaptchaToken: recaptchaTokenField,
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  email: z.string().trim().email('Please enter a valid email').max(200),
  subject: z.string().trim().min(3, 'Please enter a subject').max(200),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(5000),
  recaptchaToken: recaptchaTokenField,
  /** Honeypot: real users never see or fill this. */
  website: z.string().max(500).optional(),
});

export const contactStatusSchema = z.object({ status: z.enum(['NEW', 'READ', 'RESOLVED']) });

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.enum(['VPS', 'DOCKER', 'EMAIL']),
  features: z.array(z.string()),
  specs: z.record(z.unknown()),
  imageUrl: z.string().url().optional(),
  /** Units available. null/omitted = unlimited (not tracked). 0 = sold out. */
  inventoryCount: z.number().int().min(0).max(1_000_000).nullable().optional(),
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

/** Partial update for a plan — only these fields can ever be changed. */
export const updatePlanSchema = createPlanSchema.omit({ productId: true }).partial();

/** Partial update for a product — only these fields can ever be changed. */
export const updateProductSchema = createProductSchema
  .partial()
  .extend({ status: z.enum(['ACTIVE', 'INACTIVE', 'COMING_SOON']).optional() });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  currentPassword: z.string().min(1).max(100).optional(),
  newPassword: z.string().min(8).max(100).optional(),
});
