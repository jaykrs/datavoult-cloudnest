# CloudNest — Cloud Infrastructure SaaS

A full-stack Next.js 14 application for selling VPS hosting, Docker services, and business email — complete with user portal and admin dashboard.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | MySQL via Prisma ORM |
| Auth | JWT (jose) + HttpOnly cookies |
| Styling | Pure CSS (no Tailwind) — custom design system |
| Charts | Recharts |
| Icons | Lucide React |
| Validation | Zod |
| Passwords | bcryptjs |
| Payments | Razorpay (orders, signature verification, webhooks) |
| Remote ops | ssh2 (host-key pinned) |
| Tests | Vitest |

---

## 📁 Project Structure

```
cloudnest/
├── prisma/
│   ├── schema.prisma         # Full MySQL schema
│   └── seed.ts               # Sample data seeder
├── src/
│   ├── app/
│   │   ├── page.tsx          # Landing page
│   │   ├── login/            # Auth pages
│   │   ├── register/
│   │   ├── products/         # Product listing + detail
│   │   ├── pricing/          # Pricing page
│   │   ├── dashboard/        # User dashboard overview
│   │   ├── services/         # Subscription management
│   │   ├── billing/          # Payment history
│   │   ├── support/          # Support tickets
│   │   ├── settings/         # Profile & security settings
│   │   ├── admin/            # Admin dashboard overview
│   │   │   ├── products/     # Product CRUD
│   │   │   ├── users/        # User management
│   │   │   ├── subscriptions/# Subscription tracking
│   │   │   └── payments/     # Payment tracking
│   │   └── api/
│   │       ├── auth/         # login, register, logout
│   │       ├── products/     # CRUD + plans
│   │       ├── subscriptions/# Subscribe, cancel
│   │       ├── payments/     # Payment history
│   │       ├── users/me/     # Profile management
│   │       └── admin/        # stats, users, subscriptions
│   ├── components/
│   │   ├── marketing/        # Navbar
│   │   ├── dashboard/        # Sidebar
│   │   └── admin/            # AdminSidebar
│   ├── lib/
│   │   ├── prisma.ts         # Prisma singleton
│   │   ├── auth.ts           # JWT utilities
│   │   └── api.ts            # Helpers + Zod schemas
│   ├── types/index.ts        # TypeScript types
│   └── middleware.ts         # Route protection
```

---

## 🗄️ Database Schema

### Tables
- **users** — accounts, roles (USER/ADMIN/SUPER_ADMIN)
- **sessions** — reserved (auth is stateless JWT today)
- **products** — VPS, Docker, Email products
- **plans** — pricing plans per product (monthly/quarterly/annual); soft-deleted via `isDeleted`
- **subscriptions** — user ↔ product+plan links (`PENDING → ACTIVE → SUSPENDED → EXPIRED / CANCELLED`)
- **service_configs** — provisioned hostname, IP, region per subscription; SSH credentials stored encrypted, host key pinned
- **provisioning_jobs** — one per subscription; turns a paid order into a real service
- **payments** — transaction records (`gatewayId` is unique, which makes fulfilment idempotent)
- **support_tickets** + **ticket_replies** — support system

---

## ⚙️ Getting Started

### 1. Prerequisites
- Node.js 18+
- MySQL 8.0+ running locally or remote

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```

Edit `.env`. Three values are **required** — the app refuses to run the related feature without them (there are no insecure defaults):

```env
DATABASE_URL="mysql://root:password@localhost:3306/cloudnest"
JWT_SECRET=""                    # openssl rand -base64 48  (min 32 chars)
CREDENTIALS_ENCRYPTION_KEY=""    # openssl rand -hex 32     (encrypts customer server credentials)
```

Payments, the webhook, the billing cron and provisioning have their own variables — see the commented [`.env.example`](.env.example) for all of them.

### 4. Set up database
```bash
# Push schema to MySQL
npm run db:push

# Seed with sample data
npx ts-node prisma/seed.ts
```

### 5. Start development server
```bash
npm run dev
```

Visit **http://localhost:3000**

---

## 👤 Demo Accounts

`prisma/seed.ts` creates these **for local development only**. The seed refuses to run with `NODE_ENV=production` (unless `SEED_ALLOW_DEMO=1`), because the admin password is public.

| Role | Email | Password |
|------|-------|----------|
| User | john.doe@example.com | Password123! |
| Admin | admin@cloudnest.io | Password123! |

---

## 🛣️ Pages & Routes

### Public
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/products` | Product catalog with plans |
| `/products/[slug]` | Product detail + subscribe |
| `/pricing` | Pricing comparison |
| `/login` | Sign in |
| `/register` | Create account |

### User Dashboard (auth required)
| Route | Description |
|-------|-------------|
| `/dashboard` | Overview: services, payments, stats |
| `/services` | All subscriptions with config details |
| `/billing` | Invoice history, payment methods |
| `/support` | Submit support tickets |
| `/settings` | Profile, security, notifications |

### Admin Panel (ADMIN role required)
| Route | Description |
|-------|-------------|
| `/admin` | Overview with charts: revenue, subscriptions |
| `/admin/products` | Create, edit, toggle, delete products |
| `/admin/users` | Browse users with search |
| `/admin/subscriptions` | All subscriptions, filter by status |
| `/admin/payments` | Transaction history + revenue stats |

---

## 🔌 REST API

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/logout` | Logout |

### Products
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/products` | Public |
| GET | `/api/products/[id]` | Public |
| POST | `/api/products` | Admin |
| PATCH | `/api/products/[id]` | Admin |
| DELETE | `/api/products/[id]` | Admin |

### Subscriptions
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/subscriptions?status=` | User (own) |
| GET | `/api/subscriptions/[id]` | User (own) |
| PATCH | `/api/subscriptions/[id]` | User (own) — only `label` |
| DELETE | `/api/subscriptions/[id]` | User (own) — cancels |

There is deliberately **no** way to create a subscription except by paying: see *Payments* below.

### Payments (Razorpay)
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/payments` | User |
| POST | `/api/razorpay/create-order` | User — price comes from the DB; pass `subscriptionId` to renew |
| POST | `/api/razorpay/verify` | User — idempotent |
| POST | `/api/razorpay/webhook` | Razorpay signature |

### CloudOps (VPS owners)
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/deploy/cmd` | User — install a supported package |
| POST | `/api/deploy/deploy-remote` | User — deploy a public git repo with PM2 |
| GET | `/api/deploy/deploy-logs` | User — tail PM2 logs |

All take a `subscriptionId`; credentials are looked up server-side and never sent by the browser.

### Admin
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/admin/stats` | Admin |
| GET | `/api/admin/users` | Admin |
| GET | `/api/admin/subscriptions` | Admin |
| POST | `/api/admin/subscriptions/[id]/provision` | Admin — record a manually provisioned server |

### Internal
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/internal/cron` | `Authorization: Bearer $CRON_SECRET` |

---

## 🎨 Design System

The app uses a custom CSS design system defined in `globals.css`:

- **Colors**: Deep navy palette with electric blue accents
- **Typography**: DM Serif Display (headings) + DM Sans (body) + DM Mono (code)
- **Dark theme** — optimized for infrastructure dashboards
- **CSS variables** for full consistency across components

---

## 🔐 Security Features

- **HttpOnly, SameSite, `Secure` (in production) JWT cookies**; `JWT_SECRET` is mandatory, with no fallback
- **bcrypt** password hashing (cost 12), constant-time login path, and rate limiting on login/register/password change
- **Route protection** via Next.js middleware; admin endpoints also re-check the role server-side
- **Input validation** with Zod; update endpoints use explicit allow-lists (no raw request bodies reach the database)
- **CloudOps hardening**: authenticated, ownership-checked per subscription; commands are built from constants or strictly validated, shell-quoted values; env vars ship base64-encoded; SSH host keys are pinned; time and output limits; rate limits
- **Credentials encrypted at rest** (AES-256-GCM) and never returned by any API
- **Payments**: signature verified in constant time; product/plan/amount are read back from Razorpay and the DB, never trusted from the browser; fulfilment is idempotent (`payments.gatewayId` is unique); the webhook fails closed without its secret

---

## 🧭 Operations

### Payments
Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`. In the Razorpay dashboard add a webhook to `https://<your-domain>/api/razorpay/webhook` for `payment.captured`, `payment.failed` and `refund.processed`, using the same secret. The webhook is what activates a service when a customer closes the tab before returning to the site.

### Provisioning
A paid order creates a `PENDING` subscription plus a provisioning job, and becomes `ACTIVE` only once the service exists.

- `PROVISIONING_PROVIDER=manual` (default): an admin creates the server out of band, then records it with `POST /api/admin/subscriptions/[id]/provision` (hostname, IP, region, SSH credentials, optional host-key fingerprint).
- `PROVISIONING_PROVIDER=mock`: development only; creates no infrastructure (uses reserved `203.0.113.0/24` addresses). Refused in production.
- To automate a real cloud, implement `ProvisioningProvider` in `src/lib/provisioning/types.ts`, register it in `providers.ts`/`index.ts`, and the queue and retries come for free.

### Billing cron
Call `POST /api/internal/cron` with `Authorization: Bearer $CRON_SECRET` every 5–15 minutes (system cron, Vercel Cron, GitHub Actions, …). It suspends services unpaid `RENEWAL_GRACE_DAYS` after their renewal date, expires them after a further `SUSPENDED_EXPIRE_DAYS`, ends cancelled services at the end of the paid period, and runs due provisioning jobs. Customers renew from the Services page.

### Tests & CI
```bash
npm test            # unit tests (vitest)
npm run typecheck
```
GitHub Actions (`.github/workflows/ci.yml`) also generates the Prisma client, checks that the migrations match `schema.prisma`, and builds the app.

### Known limitations
- Rate limiting is in-memory (per instance). Use a shared store or an edge/WAF limit when running several instances.
- The software *version* picker in CloudOps is informational; the OS package version is installed.
- CloudOps deploys public https repositories only.
- No transactional email is sent yet (receipts, renewal reminders).
