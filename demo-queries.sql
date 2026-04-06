-- ============================================================
-- CloudNest — Demo Data Verification & Exploration Queries
-- ============================================================

-- ── 1. Row counts across all tables ──────────────────────────
SELECT 'users'           AS tbl, COUNT(*) AS rows FROM users
UNION ALL SELECT 'products',         COUNT(*) FROM products
UNION ALL SELECT 'plans',            COUNT(*) FROM plans
UNION ALL SELECT 'subscriptions',    COUNT(*) FROM subscriptions
UNION ALL SELECT 'service_configs',  COUNT(*) FROM service_configs
UNION ALL SELECT 'payments',         COUNT(*) FROM payments
UNION ALL SELECT 'support_tickets',  COUNT(*) FROM support_tickets
UNION ALL SELECT 'ticket_replies',   COUNT(*) FROM ticket_replies;

-- ── 2. All users with subscription and payment counts ─────────
SELECT
  u.name,
  u.email,
  u.role,
  u.isVerified,
  COUNT(DISTINCT s.id) AS subscriptions,
  COUNT(DISTINCT p.id) AS payments,
  COALESCE(SUM(CASE WHEN p.status = 'COMPLETED' THEN p.amount ELSE 0 END), 0) AS total_spent
FROM users u
LEFT JOIN subscriptions s ON s.userId = u.id
LEFT JOIN payments p ON p.userId = u.id
GROUP BY u.id, u.name, u.email, u.role, u.isVerified
ORDER BY total_spent DESC;

-- ── 3. Active subscriptions with service details ──────────────
SELECT
  u.name                  AS customer,
  pr.name                 AS product,
  pr.category,
  pl.name                 AS plan,
  pl.price,
  s.status,
  s.renewsAt,
  sc.hostname,
  sc.ipAddress,
  sc.region
FROM subscriptions s
JOIN users u          ON u.id = s.userId
JOIN products pr      ON pr.id = s.productId
JOIN plans pl         ON pl.id = s.planId
LEFT JOIN service_configs sc ON sc.subscriptionId = s.id
WHERE s.status IN ('ACTIVE', 'TRIAL')
ORDER BY pl.price DESC;

-- ── 4. Revenue summary ────────────────────────────────────────
SELECT
  SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) AS total_revenue,
  SUM(CASE WHEN status = 'REFUNDED'  THEN amount ELSE 0 END) AS total_refunded,
  COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)           AS successful_payments,
  COUNT(CASE WHEN status = 'FAILED'    THEN 1 END)           AS failed_payments,
  COUNT(CASE WHEN status = 'PENDING'   THEN 1 END)           AS pending_payments
FROM payments;

-- ── 5. Monthly revenue for the last 6 months ─────────────────
SELECT
  DATE_FORMAT(createdAt, '%Y-%m') AS month,
  COUNT(*)                         AS transactions,
  SUM(amount)                      AS revenue
FROM payments
WHERE status = 'COMPLETED'
  AND createdAt >= NOW() - INTERVAL 6 MONTH
GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
ORDER BY month;

-- ── 6. Subscriptions breakdown by status ─────────────────────
SELECT
  status,
  COUNT(*) AS count
FROM subscriptions
GROUP BY status
ORDER BY count DESC;

-- ── 7. Subscriptions by product category ─────────────────────
SELECT
  pr.category,
  pr.name      AS product,
  COUNT(s.id)  AS total_subs,
  SUM(CASE WHEN s.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active
FROM subscriptions s
JOIN products pr ON pr.id = s.productId
GROUP BY pr.id, pr.category, pr.name
ORDER BY total_subs DESC;

-- ── 8. Support ticket overview ────────────────────────────────
SELECT
  t.subject,
  u.name       AS customer,
  t.priority,
  t.status,
  COUNT(r.id)  AS replies,
  t.createdAt
FROM support_tickets t
JOIN users u ON u.id = t.userId
LEFT JOIN ticket_replies r ON r.ticketId = t.id
GROUP BY t.id, t.subject, u.name, t.priority, t.status, t.createdAt
ORDER BY
  FIELD(t.priority, 'CRITICAL','HIGH','MEDIUM','LOW'),
  t.createdAt DESC;

-- ── 9. Top spenders ───────────────────────────────────────────
SELECT
  u.name,
  u.email,
  COUNT(p.id)      AS payment_count,
  SUM(p.amount)    AS lifetime_value
FROM payments p
JOIN users u ON u.id = p.userId
WHERE p.status = 'COMPLETED'
GROUP BY u.id, u.name, u.email
ORDER BY lifetime_value DESC
LIMIT 5;

-- ── 10. Plans popularity ─────────────────────────────────────
SELECT
  pr.category,
  pl.name           AS plan,
  pl.price,
  pl.billingCycle,
  COUNT(s.id)       AS subscribers
FROM plans pl
JOIN products pr      ON pr.id = pl.productId
LEFT JOIN subscriptions s ON s.planId = pl.id AND s.status IN ('ACTIVE','TRIAL')
GROUP BY pl.id, pr.category, pl.name, pl.price, pl.billingCycle
ORDER BY subscribers DESC;

-- ── 11. Login credentials reminder ───────────────────────────
SELECT
  email,
  role,
  'Password123!' AS password
FROM users
ORDER BY role DESC, email;
