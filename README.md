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

Optional integrations (all documented in `.env.example`): **Google reCAPTCHA v2** (`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`), **Google Tag Manager** (`NEXT_PUBLIC_GTM_ID`) and **SMTP email** (`SMTP_*`, `MAIL_FROM`, `ADMIN_NOTIFY_EMAIL`).

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

## 🍪 Privacy, Analytics, Contact & Inventory

- **Cookie consent**: banner with Accept / Reject on every page; the choice is stored for a year and can be changed from the footer ("Cookie settings"). Google Tag Manager is injected **only after Accept**; rejecting (or withdrawing) loads nothing. `page_view`, `sign_up`, `login` and `contact_submit` events are pushed to the `dataLayer`.
- **Privacy Policy** at `/privacy` (a template — have it legally reviewed). Sign-up requires ticking the policy checkbox; the acceptance time is stored (`users.privacyAcceptedAt`).
- **reCAPTCHA v2** on sign in, sign up and the contact form, verified server-side. In production the forms are refused if `RECAPTCHA_SECRET_KEY` is missing (fails closed).
- **Contact form** at `/contact` → stored and shown in **Admin → Messages** (search, status filter, mark read/resolved, delete, reply by email). Honeypot + rate limit; no IP is stored.
- **Email notifications** (SMTP): welcome email + admin alert on sign-up; confirmation + admin alert on each new subscription; admin alert on contact messages. Email never blocks or breaks a request, and is skipped when SMTP is not configured.
- **Inventory**: set an *Inventory count* when creating a product (or edit it inline in Admin → Products). Blank = unlimited. Each **new** subscription takes one unit atomically; at 0 the product disappears from the public lists and cannot be bought (renewals are unaffected). Stock is not restored on cancellation/refund — adjust it manually.

---

## 📝 Blog, SEO & Sitemap

- **Admin → Blog** (`/admin/blog`): create/edit posts with a visual + HTML editor, upload or paste images, categories, cover image, draft/published status and an optional (future) publish date to schedule. Each post has meta title/description/share image with a search-result preview.
- **Public**: `/blog` (category filter via `?category=slug`, pagination) and `/blog/[slug]` (Open Graph, canonical URL, `BlogPosting` JSON-LD, related posts).
- **Security**: post HTML is sanitised server-side with an allow-list on save (and again on render); images are type-checked from their bytes (PNG/JPEG/GIF/WebP, max 3 MB, no SVG) and stored in the database, served from `/api/media/:id`.
- **Product SEO**: Admin → Products → expand a product → *SEO & sharing* (meta title, description, keywords, share image). Blank fields fall back to the product name/description; non-active products are `noindex`.
- **`/sitemap.xml`** lists static pages, active products and published posts; **`/robots.txt`** blocks admin, API, checkout and other private areas and links the sitemap. Set `APP_URL` in production so these use your real domain.
- Apply the new migration with `npx prisma migrate deploy`.

## 🔑 Server details & delivery

After a customer's payment is approved the subscription is **PENDING** until an admin provisions it:

1. **Admin → Subscriptions → Awaiting server → Provision**: enter hostname, IP, region, OS, SSH port and the login (username + password **or** a private key file). Credentials are stored AES-encrypted; the same screen later updates or rotates them (leave the password/key blank to keep the stored one) and the **Server details** button re-opens it.
2. Saving activates the service and (checkbox, on by default) **emails the customer** the IP, username, password and SSH command; a key file is attached as a `.pem`. `POST /api/admin/subscriptions/:id/resend-details` re-sends it.
3. The customer sees the IP/hostname on **Services**, plus a *Server access* panel: the username is visible and the password / key is revealed (or the key downloaded) only on request, over a no-store, rate-limited endpoint that only the owner can call.

The same credentials power CloudOps and App Deployments. Emails carry the password in plain text by design; customers are told to change it after first login. Use TLS-enabled SMTP.

## 🚀 App Deployments (VPS)

Customers with an active VPS open **Services → Deploy app** (`/services/:id/deploy`) to deploy a Next.js / Node.js repo to their server over SSH (credentials are looked up server-side and never reach the browser):

1. clone the repo (public, or private with an access token that is used for the clone only and never stored),
2. write the custom environment variables (stored encrypted; values are never shown again) and force `PORT`,
3. build and run **either** with Node.js + PM2 **or** in Docker (the repo's `Dockerfile`, or a generated Node one),
4. proxy nginx port 80/443 to `127.0.0.1:<port>` with websocket support,
5. HTTPS: Let's Encrypt when a domain pointing at the server is given, otherwise a self-signed certificate on the IP (browsers warn until a domain is added), or HTTP only.

Deployments are saved with live logs, can be redeployed (new code, branch or env) and removed (stops the app and deletes its nginx config and files). A failed build leaves the previous version running.

Requirements on the server: Debian/Ubuntu with root or passwordless sudo (nginx, certbot and Docker are installed with apt when missing); for the PM2 mode Node.js 18+ must already be installed (CloudOps → Install). Only one app without a domain can use the server's IP on 80/443; give others a domain. API: `POST/GET /api/deployments`, `GET/DELETE /api/deployments/:id`, `POST /api/deployments/:id/redeploy`. Run `npx prisma migrate deploy` for the new `deployments` table.

### Docker hosting products

A customer with an active **Docker** product gets **Services → Deploy container** (same page, Docker-only): they paste a GitHub access token (read-only *Contents* + *Metadata*; used for the session only, never stored), click *Load my repos*, and pick from their repositories that have a `Dockerfile` at the root (or paste any repo URL). The repo is built and run as a container **on that subscription's own Docker host** (the server details the admin provisioned) — never on a VPS — using the repo's own Dockerfile (nothing is generated; a missing Dockerfile fails the deploy with a clear message). The plan's limits apply: number of containers (`containers`), memory per container (`ram`), and containers run with a PID cap and `no-new-privileges`. nginx/HTTPS, env vars, redeploy and remove work as for VPS apps.

## 📚 Public documentation

`/docs` is a public, Confluence-style documentation site (page tree, content, "on this page" links, previous/next) rendered from the Markdown files in [`/docs`](docs). To add or change a page edit or add `docs/<slug>.md` with optional front-matter (`title`, `order`, `summary`, `updated: YYYY-MM-DD`), commit and deploy — the sidebar and `sitemap.xml` update automatically. HTML in Markdown is sanitised. Pages are read at build time, so a rebuild is needed after editing.

## 📦 Plan stock

Each plan has its own optional **stock** (blank = unlimited) next to the product's stock. A new subscription uses one unit of both atomically; at 0 the plan disappears from the catalogue and cannot be ordered (other plans stay available, and a product whose plans are all sold out shows as unavailable). Renewals never consume or require stock. Run `npx prisma migrate deploy` for the new column.

## 💳 Pricing & Payments

- **Per-day pricing in ₹**: a plan's price is the cost of **one day**. Customers choose a number of days (**minimum 30**, maximum 1095) at checkout and pay `price × days`. The total is always computed on the server in integer paise (`src/lib/pricing.ts`); the browser never sends an amount. The subscription runs for exactly the purchased days, and renewals add days from the later of "now" and the current end date.
- **Payment methods**: Razorpay (cards, UPI, netbanking, wallets — instant) plus **UPI** and **bank transfer** to your account. For the offline methods the customer gets a unique reference (`DV-XXXXXXXX`) and your payment details, pays, then enters the UTR. Set the account in `.env` (`BANK_*`, `UPI_*`); a method is hidden until configured.
- **Admin approval**: **Admin → Bank/UPI payments** lists requests waiting for verification. Check your bank statement, type the amount you actually received (it must equal the order to the paisa), and approve — the subscription is created, stock decremented and emails sent exactly as for an online payment. Reject with a reason to notify the customer. Duplicate UTRs are flagged. Requests expire after 72 hours if unpaid.
- **Upgrading from monthly plans**: the migration converts each existing plan's price to a per-day rate (monthly ÷ 30, quarterly ÷ 90, annual ÷ 365, rounded to paise) and drops the billing cycle. **Review prices in Admin → Products after migrating.**

---

## 🧾 GST & Invoices

- **Per-product GST** (Admin → Products): set a **GST rate** or leave it blank for **no GST**; choose whether the listed price **includes GST** or GST is **added on top**; optionally set a **SAC code** (default 998315). Checkout shows the breakdown and the server charges exactly that total (`price × days`, plus GST when added on top).
- **Automatic invoices**: an invoice is created as soon as a payment is confirmed — Razorpay, UPI or bank-transfer approval, and renewals alike. Products without GST get a plain **Invoice**; products with GST get a **Tax Invoice** with taxable value and **CGST + SGST** (customer in the seller's state, or no state given) or **IGST** (customer in another state).
- Numbers are sequential per Indian financial year and within GST's 16-character limit (e.g. `DV2627-000042`). The tax split is snapshotted at payment time, so later price/GST changes never alter an issued invoice.
- Customers add name, GSTIN (optional), address and state at checkout; view/print invoices from **Billing** (print → *Save as PDF*) and get an email when it's issued. Admins can open any invoice from **Admin → Payments**.
- **Setup**: set `SELLER_NAME`, `SELLER_ADDRESS` and (if you charge GST) `SELLER_GSTIN` — see `.env.example`. Until then invoices aren't issued; they are generated automatically the next time the payment is looked at once configured.

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

- `AUTO_PROVISION` (default off): online (Razorpay) payments follow the same flow as UPI / bank transfer — the order shows under "Paid — awaiting provisioning" until an admin provisions it. Set `AUTO_PROVISION=true` only with an automated provider.
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
