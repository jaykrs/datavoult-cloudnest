import { NextRequest } from 'next/server';
import { z } from 'zod';
import { SLUG_PATTERN } from './slug';
import { IMAGE_URL_PATTERN } from './media';

// Shared field helpers (declared first: the schemas below use them at module load).
const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
/** Optional text that treats '' as null. */
const optText = (max: number) => z.preprocess(blank, z.string().trim().max(max).nullable().optional());
/** Optional image URL: one of our own uploads (/api/media/...) or an https URL. */
export const imageUrlField = z.preprocess(
  blank,
  z.string().trim().max(500).regex(IMAGE_URL_PATTERN, 'Use an uploaded image or an https:// image URL').nullable().optional(),
);
const slugField = z.preprocess(blank, z.string().trim().max(80).regex(SLUG_PATTERN, 'Slug can only contain lowercase letters, numbers and dashes').nullable().optional());


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

export const orderDaysField = z.number().int('Days must be a whole number');

export const createManualPaymentSchema = z.object({
  productId: z.string().min(1),
  planId: z.string().min(1),
  subscriptionId: z.string().min(1).optional(),
  days: orderDaysField,
  method: z.enum(['UPI', 'BANK_TRANSFER']),
});

/** Bank/UPI reference (UTR, RRN, IMPS/NEFT ref): letters, digits, - and _ only. */
export const submitManualPaymentSchema = z.object({
  transactionRef: z.string().trim().min(6, 'Enter the transaction / UTR number').max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'The reference can only contain letters, numbers, - and _')
    .transform((s) => s.toUpperCase()),
  payerDetails: z.string().trim().max(150).optional(),
});

export const approveManualPaymentSchema = z.object({
  /** Amount in INR the admin saw credited — must equal what was ordered. */
  receivedAmount: z.number().positive(),
  note: z.string().trim().max(190).optional(),
});

export const rejectManualPaymentSchema = z.object({
  reason: z.string().trim().min(3, 'Please give a reason').max(190),
});

export const billingProfileSchema = z.object({
  billingName: z.string().trim().max(150).optional().nullable(),
  billingGstin: z.string().trim().toUpperCase().max(15).optional().nullable(),
  billingAddress: z.string().trim().max(500).optional().nullable(),
  billingStateCode: z.string().trim().regex(/^\d{2}$/, 'Choose a state').optional().nullable(),
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
  /** GST % charged on this product (0–28, max 2 decimals). null = no GST. */
  gstRate: z.number().min(0).max(28)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'GST rate can have at most 2 decimals')
    .nullable().optional(),
  /** true: listed price includes GST; false: GST is added on top. */
  gstInclusive: z.boolean().optional(),
  /** GST service accounting code (4–8 digits) shown on invoices. */
  sacCode: z.string().trim().regex(/^\d{4,8}$/, 'SAC code must be 4–8 digits').nullable().optional(),
  metaTitle: optText(255),
  metaDescription: optText(320),
  metaKeywords: optText(255),
  ogImageUrl: imageUrlField,
});

export const createPlanSchema = z.object({
  productId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  /** INR per DAY of service (max 2 decimals). */
  price: z.number().positive('Price per day must be greater than 0').max(100_000)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Price per day can have at most 2 decimals'),
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


// ── Blog & SEO ──────────────────────────────────────────────────────────────

export const blogPostSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(190),
  slug: slugField,
  excerpt: optText(500),
  content: z.string().max(600_000, 'Content is too long'),
  coverImageUrl: imageUrlField,
  categoryId: z.preprocess(blank, z.string().min(1).nullable().optional()),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  /** ISO date-time; a future date schedules the post. */
  publishedAt: z.preprocess(blank, z.string().datetime({ offset: true }).nullable().optional()),
  metaTitle: optText(255),
  metaDescription: optText(320),
  ogImageUrl: imageUrlField,
});
export const updateBlogPostSchema = blogPostSchema.partial();

export const blogCategorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  slug: slugField,
  description: optText(190),
});
export const updateBlogCategorySchema = blogCategorySchema.partial();

/** SEO fields editable per product from the admin dashboard. */
export const productSeoSchema = z.object({
  metaTitle: optText(255),
  metaDescription: optText(320),
  metaKeywords: optText(255),
  ogImageUrl: imageUrlField,
});
