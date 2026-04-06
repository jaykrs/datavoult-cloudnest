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
- **sessions** — JWT session tokens
- **products** — VPS, Docker, Email products
- **plans** — pricing plans per product (monthly/quarterly/annual)
- **subscriptions** — user ↔ product+plan links
- **service_configs** — provisioned hostname, IP, region per subscription
- **payments** — transaction records
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

Edit `.env`:
```env
DATABASE_URL="mysql://root:password@localhost:3306/cloudnest"
JWT_SECRET="your-super-secret-key-at-least-32-characters-long"
```

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

| Role | Email | Password |
|------|-------|----------|
| User | john@example.com | user123456 |
| Admin | admin@cloudnest.io | admin123456 |

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
| GET | `/api/subscriptions` | User |
| POST | `/api/subscriptions` | User |
| GET | `/api/subscriptions/[id]` | User |
| PATCH | `/api/subscriptions/[id]` | User |
| DELETE | `/api/subscriptions/[id]` | User |

### Payments
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/payments` | User |

### Admin
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/admin/stats` | Admin |
| GET | `/api/admin/users` | Admin |
| GET | `/api/admin/subscriptions` | Admin |

---

## 🎨 Design System

The app uses a custom CSS design system defined in `globals.css`:

- **Colors**: Deep navy palette with electric blue accents
- **Typography**: DM Serif Display (headings) + DM Sans (body) + DM Mono (code)
- **Dark theme** — optimized for infrastructure dashboards
- **CSS variables** for full consistency across components

---

## 🔐 Security Features

- **HttpOnly JWT cookies** — XSS-resistant auth
- **bcrypt password hashing** (cost factor 12)
- **Route protection** via Next.js middleware
- **Role-based access control** (USER / ADMIN / SUPER_ADMIN)
- **Input validation** with Zod on all API endpoints
- **Admin endpoints** protected server-side, not just UI

---

## 📈 Extending the App

### Add Stripe payments
1. `npm install stripe`
2. Add `STRIPE_SECRET_KEY` to `.env`
3. Replace mock payment in `/api/subscriptions` with Stripe checkout
4. Add webhook handler at `/api/stripe/webhook`

### Add email notifications
1. `npm install nodemailer`
2. Configure SMTP in `.env`
3. Send welcome emails on register, invoice emails on payment

### Add a plans API
Create `/api/plans` for full plan CRUD from the admin panel
