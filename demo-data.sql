-- ============================================================
-- CloudNest - Complete Demo Data for MySQL
-- ============================================================
-- Run after: npm run db:push  (or prisma migrate dev)
-- Usage:     mysql -u root -p cloudnest < demo-data.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- Clear existing data (safe order)
TRUNCATE TABLE ticket_replies;
TRUNCATE TABLE support_tickets;
TRUNCATE TABLE payments;
TRUNCATE TABLE service_configs;
TRUNCATE TABLE subscriptions;
TRUNCATE TABLE plans;
TRUNCATE TABLE products;
TRUNCATE TABLE sessions;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- USERS
-- All passwords are: Password123!
-- Hash generated with bcrypt cost=12
-- ============================================================

INSERT INTO users (id, email, name, passwordHash, role, avatarUrl, isVerified, createdAt, updatedAt) VALUES

-- Admins
('usr_admin_001', 'admin@cloudnest.io',       'CloudNest Admin',    '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'ADMIN',       NULL, TRUE,  NOW() - INTERVAL 180 DAY, NOW()),
('usr_admin_002', 'sarah.ops@cloudnest.io',   'Sarah Mitchell',     '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'SUPER_ADMIN', NULL, TRUE,  NOW() - INTERVAL 200 DAY, NOW()),

-- Regular users — mix of verified/unverified, various join dates
('usr_user_001', 'john.doe@example.com',      'John Doe',           '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, TRUE,  NOW() - INTERVAL 120 DAY, NOW()),
('usr_user_002', 'emma.wilson@techcorp.com',  'Emma Wilson',        '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, TRUE,  NOW() - INTERVAL 95 DAY,  NOW()),
('usr_user_003', 'liam.chen@startup.io',      'Liam Chen',          '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, TRUE,  NOW() - INTERVAL 80 DAY,  NOW()),
('usr_user_004', 'sofia.garcia@devstudio.co', 'Sofia Garcia',       '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, TRUE,  NOW() - INTERVAL 60 DAY,  NOW()),
('usr_user_005', 'noah.patel@cloudify.net',   'Noah Patel',         '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, TRUE,  NOW() - INTERVAL 45 DAY,  NOW()),
('usr_user_006', 'ava.johnson@webagency.com', 'Ava Johnson',        '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, FALSE, NOW() - INTERVAL 30 DAY,  NOW()),
('usr_user_007', 'ethan.kim@freelance.dev',   'Ethan Kim',          '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, TRUE,  NOW() - INTERVAL 22 DAY,  NOW()),
('usr_user_008', 'maya.brown@saasbuilder.io', 'Maya Brown',         '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, TRUE,  NOW() - INTERVAL 15 DAY,  NOW()),
('usr_user_009', 'oliver.white@enterprise.com','Oliver White',      '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, TRUE,  NOW() - INTERVAL 10 DAY,  NOW()),
('usr_user_010', 'isabella.lee@mediahouse.tv','Isabella Lee',       '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, FALSE, NOW() - INTERVAL 5 DAY,   NOW()),
('usr_user_011', 'james.taylor@hosting.pro',  'James Taylor',       '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, TRUE,  NOW() - INTERVAL 3 DAY,   NOW()),
('usr_user_012', 'amelia.scott@digital.agency','Amelia Scott',      '$2a$12$LQv3c1yqBwEHXp.9YeZXxOMpf5GFx0/6u5.XVB.GXMxHwP4AEalUS', 'USER', NULL, TRUE,  NOW() - INTERVAL 1 DAY,   NOW());


-- ============================================================
-- PRODUCTS
-- ============================================================

INSERT INTO products (id, name, slug, description, category, status, features, specs, imageUrl, createdAt, updatedAt) VALUES

-- VPS
('prod_vps_001',
 'Cloud VPS',
 'cloud-vps',
 'High-performance virtual private servers with NVMe SSD storage, dedicated resources, and 99.9% uptime SLA. Scale your applications with ease using our fully managed KVM infrastructure.',
 'VPS', 'ACTIVE',
 '["NVMe SSD Storage","Dedicated vCPUs","99.9% Uptime SLA","DDoS Protection","Full Root Access","Automated Backups","24/7 Monitoring","Custom OS Images"]',
 '{"network":"1 Gbps","datacenter":"Tier 4","hypervisor":"KVM","backup":"Daily","locations":"12 regions"}',
 NULL,
 NOW() - INTERVAL 180 DAY, NOW()),

-- Docker
('prod_docker_001',
 'Managed Docker',
 'managed-docker',
 'Deploy containerized applications with our fully managed Docker hosting. Auto-scaling, load balancing, and zero-downtime deployments out of the box with private registry included.',
 'DOCKER', 'ACTIVE',
 '["Auto-Scaling","Load Balancing","Zero-Downtime Deploys","Private Registry","Docker Compose Support","Kubernetes Compatible","CI/CD Integration","Resource Monitoring"]',
 '{"orchestration":"Swarm/K8s","registry":"Private","deployments":"Blue-Green","logging":"Centralized","runtime":"Docker 24.x"}',
 NULL,
 NOW() - INTERVAL 175 DAY, NOW()),

-- Email
('prod_email_001',
 'Business Email',
 'business-email',
 'Professional email hosting with your own domain, AI-powered spam filtering, and enterprise-grade security. Full IMAP/SMTP/POP3 support with a beautiful modern webmail interface.',
 'EMAIL', 'ACTIVE',
 '["Custom Domain","AI Spam Filtering","Virus Protection","IMAP/SMTP/POP3","Webmail Interface","Aliases & Forwarding","Calendar & Contacts","Mobile Sync"]',
 '{"uptime":"99.99%","encryption":"TLS 1.3","spam":"AI-Powered","backup":"Real-time","storage":"SSD"}',
 NULL,
 NOW() - INTERVAL 170 DAY, NOW()),

-- Inactive / coming soon products
('prod_vps_002',
 'Bare Metal Servers',
 'bare-metal',
 'Dedicated bare metal servers for maximum performance and isolation. No hypervisor overhead — pure hardware power for demanding workloads.',
 'VPS', 'COMING_SOON',
 '["Dedicated Hardware","No Hypervisor","Custom RAID","IPMI Access","10 Gbps Network","Hardware RAID"]',
 '{"network":"10 Gbps","cpu":"Intel Xeon","ram":"Up to 512GB","storage":"NVMe RAID"}',
 NULL,
 NOW() - INTERVAL 30 DAY, NOW());


-- ============================================================
-- PLANS
-- ============================================================

INSERT INTO plans (id, productId, name, description, price, billingCycle, isPopular, limits, createdAt, updatedAt) VALUES

-- VPS plans
('plan_vps_starter',    'prod_vps_001', 'Starter',      'Perfect for personal projects and small apps',   5.99,  'MONTHLY', FALSE, '{"cpu":"1 vCPU","ram":"1 GB","storage":"25 GB SSD","bandwidth":"1 TB","snapshots":"1","ipv4":"1"}',    NOW() - INTERVAL 180 DAY, NOW()),
('plan_vps_pro',        'prod_vps_001', 'Professional', 'Ideal for growing businesses and production apps',19.99, 'MONTHLY', TRUE,  '{"cpu":"2 vCPUs","ram":"4 GB","storage":"80 GB SSD","bandwidth":"4 TB","snapshots":"5","ipv4":"2"}',   NOW() - INTERVAL 180 DAY, NOW()),
('plan_vps_business',   'prod_vps_001', 'Business',     'For high-traffic sites and multiple services',   49.99, 'MONTHLY', FALSE, '{"cpu":"4 vCPUs","ram":"8 GB","storage":"160 GB SSD","bandwidth":"8 TB","snapshots":"10","ipv4":"4"}', NOW() - INTERVAL 180 DAY, NOW()),
('plan_vps_enterprise', 'prod_vps_001', 'Enterprise',   'Maximum resources for enterprise workloads',     99.99, 'MONTHLY', FALSE, '{"cpu":"8 vCPUs","ram":"16 GB","storage":"320 GB SSD","bandwidth":"Unlimited","snapshots":"20","ipv4":"8"}', NOW() - INTERVAL 180 DAY, NOW()),

-- VPS annual plans (20% discount)
('plan_vps_pro_ann',    'prod_vps_001', 'Professional Annual', 'Annual billing — save 20%',               191.90, 'ANNUAL', FALSE, '{"cpu":"2 vCPUs","ram":"4 GB","storage":"80 GB SSD","bandwidth":"4 TB","snapshots":"5","ipv4":"2"}',  NOW() - INTERVAL 180 DAY, NOW()),

-- Docker plans
('plan_docker_dev',     'prod_docker_001', 'Developer', 'For solo devs and side projects',                9.99,  'MONTHLY', FALSE, '{"containers":"5","ram":"2 GB","storage":"10 GB","builds":"50/month","registrySize":"5 GB"}',         NOW() - INTERVAL 175 DAY, NOW()),
('plan_docker_team',    'prod_docker_001', 'Team',      'For small teams shipping products',              29.99, 'MONTHLY', TRUE,  '{"containers":"20","ram":"8 GB","storage":"50 GB","builds":"200/month","registrySize":"20 GB"}',      NOW() - INTERVAL 175 DAY, NOW()),
('plan_docker_scale',   'prod_docker_001', 'Scale',     'For production workloads at scale',              79.99, 'MONTHLY', FALSE, '{"containers":"100","ram":"32 GB","storage":"200 GB","builds":"Unlimited","registrySize":"100 GB"}',   NOW() - INTERVAL 175 DAY, NOW()),

-- Email plans
('plan_email_solo',     'prod_email_001', 'Solo',       'For individuals and freelancers',                2.99,  'MONTHLY', FALSE, '{"mailboxes":"1","storage":"5 GB","aliases":"5","domains":"1","attachment":"25 MB"}',               NOW() - INTERVAL 170 DAY, NOW()),
('plan_email_business', 'prod_email_001', 'Business',   'For teams and small companies',                  7.99,  'MONTHLY', TRUE,  '{"mailboxes":"10","storage":"50 GB","aliases":"50","domains":"3","attachment":"50 MB"}',             NOW() - INTERVAL 170 DAY, NOW()),
('plan_email_enterprise','prod_email_001','Enterprise',  'Unlimited mailboxes for large organisations',   24.99, 'MONTHLY', FALSE, '{"mailboxes":"Unlimited","storage":"500 GB","aliases":"Unlimited","domains":"10","attachment":"100 MB"}', NOW() - INTERVAL 170 DAY, NOW());


-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

INSERT INTO subscriptions (id, userId, productId, planId, status, startDate, endDate, renewsAt, cancelledAt, metadata, createdAt, updatedAt) VALUES

-- John Doe — active VPS Pro + active Docker Team
('sub_001', 'usr_user_001', 'prod_vps_001',    'plan_vps_pro',        'ACTIVE',     NOW() - INTERVAL 90 DAY,  NULL, NOW() + INTERVAL 30 DAY,  NULL, NULL, NOW() - INTERVAL 90 DAY,  NOW()),
('sub_002', 'usr_user_001', 'prod_docker_001', 'plan_docker_team',    'ACTIVE',     NOW() - INTERVAL 60 DAY,  NULL, NOW() + INTERVAL 30 DAY,  NULL, NULL, NOW() - INTERVAL 60 DAY,  NOW()),

-- Emma Wilson — Business Email + VPS Business
('sub_003', 'usr_user_002', 'prod_email_001',  'plan_email_business', 'ACTIVE',     NOW() - INTERVAL 75 DAY,  NULL, NOW() + INTERVAL 15 DAY,  NULL, NULL, NOW() - INTERVAL 75 DAY,  NOW()),
('sub_004', 'usr_user_002', 'prod_vps_001',    'plan_vps_business',   'ACTIVE',     NOW() - INTERVAL 50 DAY,  NULL, NOW() + INTERVAL 10 DAY,  NULL, NULL, NOW() - INTERVAL 50 DAY,  NOW()),

-- Liam Chen — Docker Scale (power user)
('sub_005', 'usr_user_003', 'prod_docker_001', 'plan_docker_scale',   'ACTIVE',     NOW() - INTERVAL 45 DAY,  NULL, NOW() + INTERVAL 15 DAY,  NULL, NULL, NOW() - INTERVAL 45 DAY,  NOW()),
('sub_006', 'usr_user_003', 'prod_email_001',  'plan_email_solo',     'ACTIVE',     NOW() - INTERVAL 45 DAY,  NULL, NOW() + INTERVAL 15 DAY,  NULL, NULL, NOW() - INTERVAL 45 DAY,  NOW()),

-- Sofia Garcia — VPS Pro Annual
('sub_007', 'usr_user_004', 'prod_vps_001',    'plan_vps_pro_ann',    'ACTIVE',     NOW() - INTERVAL 30 DAY,  NULL, NOW() + INTERVAL 335 DAY, NULL, NULL, NOW() - INTERVAL 30 DAY,  NOW()),

-- Noah Patel — Trial Docker Developer
('sub_008', 'usr_user_005', 'prod_docker_001', 'plan_docker_dev',     'TRIAL',      NOW() - INTERVAL 5 DAY,   NULL, NOW() + INTERVAL 2 DAY,   NULL, NULL, NOW() - INTERVAL 5 DAY,   NOW()),

-- Ava Johnson — cancelled VPS Starter
('sub_009', 'usr_user_006', 'prod_vps_001',    'plan_vps_starter',    'CANCELLED',  NOW() - INTERVAL 25 DAY,  NOW() - INTERVAL 5 DAY,  NULL, NOW() - INTERVAL 5 DAY, NULL, NOW() - INTERVAL 25 DAY, NOW()),

-- Ethan Kim — active Email Business
('sub_010', 'usr_user_007', 'prod_email_001',  'plan_email_business', 'ACTIVE',     NOW() - INTERVAL 18 DAY,  NULL, NOW() + INTERVAL 12 DAY,  NULL, NULL, NOW() - INTERVAL 18 DAY,  NOW()),

-- Maya Brown — VPS Starter
('sub_011', 'usr_user_008', 'prod_vps_001',    'plan_vps_starter',    'ACTIVE',     NOW() - INTERVAL 10 DAY,  NULL, NOW() + INTERVAL 20 DAY,  NULL, NULL, NOW() - INTERVAL 10 DAY,  NOW()),

-- Oliver White — VPS Enterprise (big spender)
('sub_012', 'usr_user_009', 'prod_vps_001',    'plan_vps_enterprise', 'ACTIVE',     NOW() - INTERVAL 8 DAY,   NULL, NOW() + INTERVAL 22 DAY,  NULL, NULL, NOW() - INTERVAL 8 DAY,   NOW()),
('sub_013', 'usr_user_009', 'prod_docker_001', 'plan_docker_scale',   'ACTIVE',     NOW() - INTERVAL 8 DAY,   NULL, NOW() + INTERVAL 22 DAY,  NULL, NULL, NOW() - INTERVAL 8 DAY,   NOW()),
('sub_014', 'usr_user_009', 'prod_email_001',  'plan_email_enterprise','ACTIVE',    NOW() - INTERVAL 8 DAY,   NULL, NOW() + INTERVAL 22 DAY,  NULL, NULL, NOW() - INTERVAL 8 DAY,   NOW()),

-- Isabella Lee — Trial VPS Starter (new)
('sub_015', 'usr_user_010', 'prod_vps_001',    'plan_vps_starter',    'TRIAL',      NOW() - INTERVAL 3 DAY,   NULL, NOW() + INTERVAL 4 DAY,   NULL, NULL, NOW() - INTERVAL 3 DAY,   NOW()),

-- James Taylor — suspended (payment failed)
('sub_016', 'usr_user_011', 'prod_docker_001', 'plan_docker_team',    'SUSPENDED',  NOW() - INTERVAL 20 DAY,  NULL, NULL,                      NULL, NULL, NOW() - INTERVAL 20 DAY,  NOW()),

-- Amelia Scott — active Docker Dev (newest user)
('sub_017', 'usr_user_012', 'prod_docker_001', 'plan_docker_dev',     'ACTIVE',     NOW() - INTERVAL 1 DAY,   NULL, NOW() + INTERVAL 29 DAY,  NULL, NULL, NOW() - INTERVAL 1 DAY,   NOW());


-- ============================================================
-- SERVICE CONFIGS
-- (only for active/trial/suspended subscriptions)
-- ============================================================

INSERT INTO service_configs (id, subscriptionId, hostname, ipAddress, domain, credentials, config, region, createdAt, updatedAt) VALUES

-- John Doe VPS
('sc_001', 'sub_001', 'srv-jd7f2a91.cloudnest.io',  '45.132.18.77',   NULL,
 '{"username":"root","sshPort":22,"sshKeyId":"key_jd_001"}',
 '{"os":"Ubuntu 22.04 LTS","kernel":"5.15.0-91","cpuPinning":true}',
 'us-east-1', NOW() - INTERVAL 90 DAY, NOW()),

-- John Doe Docker
('sc_002', 'sub_002', 'docker-jd3b1c42.cloudnest.io', '45.132.18.88', NULL,
 '{"registryUrl":"registry.cloudnest.io/jd3b1c42","registryToken":"tok_dk_jd_001"}',
 '{"swarmMode":true,"replicas":3,"autoScale":true,"minReplicas":1,"maxReplicas":10}',
 'us-east-1', NOW() - INTERVAL 60 DAY, NOW()),

-- Emma Wilson Email
('sc_003', 'sub_003', 'mail-ew9a3f01.cloudnest.io',  NULL,            'techcorp.com',
 '{"imapServer":"imap.cloudnest.io","smtpServer":"smtp.cloudnest.io","webmailUrl":"https://mail.techcorp.com"}',
 '{"spamFilter":"aggressive","virusScan":true,"archiving":true}',
 'eu-west-1', NOW() - INTERVAL 75 DAY, NOW()),

-- Emma Wilson VPS
('sc_004', 'sub_004', 'srv-ew2c8b56.cloudnest.io',   '185.240.101.44', NULL,
 '{"username":"root","sshPort":2244,"sshKeyId":"key_ew_001"}',
 '{"os":"Debian 12","kernel":"6.1.0-17","backupSchedule":"daily-2am"}',
 'eu-west-1', NOW() - INTERVAL 50 DAY, NOW()),

-- Liam Chen Docker Scale
('sc_005', 'sub_005', 'docker-lc8d4e77.cloudnest.io', '103.21.244.15', NULL,
 '{"registryUrl":"registry.cloudnest.io/lc8d4e77","registryToken":"tok_dk_lc_001"}',
 '{"kubernetesMode":true,"namespaces":["production","staging","dev"],"autoScale":true}',
 'ap-southeast-1', NOW() - INTERVAL 45 DAY, NOW()),

-- Liam Chen Email
('sc_006', 'sub_006', 'mail-lc5f2a11.cloudnest.io',  NULL,            'startup.io',
 '{"imapServer":"imap.cloudnest.io","smtpServer":"smtp.cloudnest.io"}',
 '{"spamFilter":"standard","virusScan":true}',
 'ap-southeast-1', NOW() - INTERVAL 45 DAY, NOW()),

-- Sofia Garcia VPS Annual
('sc_007', 'sub_007', 'srv-sg1e9c33.cloudnest.io',   '94.130.21.199', NULL,
 '{"username":"root","sshPort":22,"sshKeyId":"key_sg_001"}',
 '{"os":"Ubuntu 22.04 LTS","kernel":"5.15.0-91","autoBackup":true}',
 'eu-central-1', NOW() - INTERVAL 30 DAY, NOW()),

-- Noah Patel Docker Trial
('sc_008', 'sub_008', 'docker-np6a7b22.cloudnest.io', '51.178.9.123', NULL,
 '{"registryUrl":"registry.cloudnest.io/np6a7b22","registryToken":"tok_dk_np_001"}',
 '{"trialMode":true,"containers":2}',
 'us-west-1', NOW() - INTERVAL 5 DAY, NOW()),

-- Ethan Kim Email
('sc_009', 'sub_010', 'mail-ek4c3d88.cloudnest.io',  NULL,            'freelance.dev',
 '{"imapServer":"imap.cloudnest.io","smtpServer":"smtp.cloudnest.io","webmailUrl":"https://mail.freelance.dev"}',
 '{"spamFilter":"aggressive","virusScan":true,"aliases":["hello@freelance.dev","work@freelance.dev"]}',
 'us-east-1', NOW() - INTERVAL 18 DAY, NOW()),

-- Maya Brown VPS Starter
('sc_010', 'sub_011', 'srv-mb2f5e44.cloudnest.io',   '148.251.44.12', NULL,
 '{"username":"root","sshPort":22}',
 '{"os":"Ubuntu 22.04 LTS","kernel":"5.15.0-91"}',
 'us-east-1', NOW() - INTERVAL 10 DAY, NOW()),

-- Oliver White VPS Enterprise
('sc_011', 'sub_012', 'srv-ow9g8h55.cloudnest.io',   '162.55.100.200', NULL,
 '{"username":"root","sshPort":22,"sshKeyId":"key_ow_001","backupKeys":["bk_ow_001","bk_ow_002"]}',
 '{"os":"RHEL 9","kernel":"5.14.0-362","cpuPinning":true,"hugepages":true,"networkPolicy":"strict"}',
 'us-east-1', NOW() - INTERVAL 8 DAY, NOW()),

-- Oliver White Docker Scale
('sc_012', 'sub_013', 'docker-ow7h1i66.cloudnest.io', '162.55.100.201', NULL,
 '{"registryUrl":"registry.cloudnest.io/ow7h1i66","registryToken":"tok_dk_ow_001"}',
 '{"kubernetesMode":true,"namespaces":["prod","stage"],"dedicatedNodes":4,"autoScale":true}',
 'us-east-1', NOW() - INTERVAL 8 DAY, NOW()),

-- Oliver White Email Enterprise
('sc_013', 'sub_014', 'mail-ow3i2j77.cloudnest.io',  NULL,            'enterprise.com',
 '{"imapServer":"imap.cloudnest.io","smtpServer":"smtp.cloudnest.io","webmailUrl":"https://mail.enterprise.com"}',
 '{"spamFilter":"enterprise","virusScan":true,"archiving":true,"dlpEnabled":true,"ssoIntegration":"okta"}',
 'us-east-1', NOW() - INTERVAL 8 DAY, NOW()),

-- Isabella Lee Trial
('sc_014', 'sub_015', 'srv-il5k3m88.cloudnest.io',   '195.201.9.42',  NULL,
 '{"username":"root","sshPort":22}',
 '{"os":"Ubuntu 22.04 LTS","trialMode":true}',
 'eu-west-1', NOW() - INTERVAL 3 DAY, NOW()),

-- James Taylor Suspended Docker
('sc_015', 'sub_016', 'docker-jt2l4n99.cloudnest.io', '37.187.100.55', NULL,
 '{"registryUrl":"registry.cloudnest.io/jt2l4n99","registryToken":"tok_dk_jt_001"}',
 '{"suspended":true,"suspendReason":"payment_failed"}',
 'eu-west-1', NOW() - INTERVAL 20 DAY, NOW()),

-- Amelia Scott Docker Dev
('sc_016', 'sub_017', 'docker-as4m5o00.cloudnest.io', '51.195.44.33', NULL,
 '{"registryUrl":"registry.cloudnest.io/as4m5o00","registryToken":"tok_dk_as_001"}',
 '{"containers":2,"autoScale":false}',
 'eu-central-1', NOW() - INTERVAL 1 DAY, NOW());


-- ============================================================
-- PAYMENTS
-- Realistic history spanning 6 months
-- ============================================================

INSERT INTO payments (id, userId, subscriptionId, amount, currency, status, method, gatewayId, gatewayData, invoiceUrl, paidAt, createdAt, updatedAt) VALUES

-- ── John Doe (sub_001 VPS Pro — 3 months) ──
('pay_001', 'usr_user_001', 'sub_001', 19.99, 'USD', 'COMPLETED', 'CARD',   'ch_jd_vps_001', '{"last4":"4242","brand":"Visa"}',   NULL, NOW() - INTERVAL 90 DAY, NOW() - INTERVAL 90 DAY, NOW()),
('pay_002', 'usr_user_001', 'sub_001', 19.99, 'USD', 'COMPLETED', 'CARD',   'ch_jd_vps_002', '{"last4":"4242","brand":"Visa"}',   NULL, NOW() - INTERVAL 60 DAY, NOW() - INTERVAL 60 DAY, NOW()),
('pay_003', 'usr_user_001', 'sub_001', 19.99, 'USD', 'COMPLETED', 'CARD',   'ch_jd_vps_003', '{"last4":"4242","brand":"Visa"}',   NULL, NOW() - INTERVAL 30 DAY, NOW() - INTERVAL 30 DAY, NOW()),

-- ── John Doe (sub_002 Docker Team — 2 months) ──
('pay_004', 'usr_user_001', 'sub_002', 29.99, 'USD', 'COMPLETED', 'CARD',   'ch_jd_dk_001',  '{"last4":"4242","brand":"Visa"}',   NULL, NOW() - INTERVAL 60 DAY, NOW() - INTERVAL 60 DAY, NOW()),
('pay_005', 'usr_user_001', 'sub_002', 29.99, 'USD', 'COMPLETED', 'CARD',   'ch_jd_dk_002',  '{"last4":"4242","brand":"Visa"}',   NULL, NOW() - INTERVAL 30 DAY, NOW() - INTERVAL 30 DAY, NOW()),

-- ── Emma Wilson (sub_003 Email Business — 3 months) ──
('pay_006', 'usr_user_002', 'sub_003',  7.99, 'USD', 'COMPLETED', 'PAYPAL', 'pp_ew_em_001',  '{"paypalEmail":"emma@techcorp.com"}',NULL, NOW() - INTERVAL 75 DAY, NOW() - INTERVAL 75 DAY, NOW()),
('pay_007', 'usr_user_002', 'sub_003',  7.99, 'USD', 'COMPLETED', 'PAYPAL', 'pp_ew_em_002',  '{"paypalEmail":"emma@techcorp.com"}',NULL, NOW() - INTERVAL 45 DAY, NOW() - INTERVAL 45 DAY, NOW()),
('pay_008', 'usr_user_002', 'sub_003',  7.99, 'USD', 'COMPLETED', 'PAYPAL', 'pp_ew_em_003',  '{"paypalEmail":"emma@techcorp.com"}',NULL, NOW() - INTERVAL 15 DAY, NOW() - INTERVAL 15 DAY, NOW()),

-- ── Emma Wilson (sub_004 VPS Business — 2 months) ──
('pay_009', 'usr_user_002', 'sub_004', 49.99, 'USD', 'COMPLETED', 'CARD',   'ch_ew_vps_001', '{"last4":"1234","brand":"Mastercard"}', NULL, NOW() - INTERVAL 50 DAY, NOW() - INTERVAL 50 DAY, NOW()),
('pay_010', 'usr_user_002', 'sub_004', 49.99, 'USD', 'COMPLETED', 'CARD',   'ch_ew_vps_002', '{"last4":"1234","brand":"Mastercard"}', NULL, NOW() - INTERVAL 20 DAY, NOW() - INTERVAL 20 DAY, NOW()),

-- ── Liam Chen (sub_005 Docker Scale — 2 months) ──
('pay_011', 'usr_user_003', 'sub_005', 79.99, 'USD', 'COMPLETED', 'CRYPTO', 'btc_lc_dk_001', '{"coin":"BTC","txHash":"0xabc123"}', NULL, NOW() - INTERVAL 45 DAY, NOW() - INTERVAL 45 DAY, NOW()),
('pay_012', 'usr_user_003', 'sub_005', 79.99, 'USD', 'COMPLETED', 'CRYPTO', 'btc_lc_dk_002', '{"coin":"BTC","txHash":"0xdef456"}', NULL, NOW() - INTERVAL 15 DAY, NOW() - INTERVAL 15 DAY, NOW()),

-- ── Liam Chen (sub_006 Email Solo — 2 months) ──
('pay_013', 'usr_user_003', 'sub_006',  2.99, 'USD', 'COMPLETED', 'CRYPTO', 'btc_lc_em_001', '{"coin":"ETH","txHash":"0xghi789"}', NULL, NOW() - INTERVAL 45 DAY, NOW() - INTERVAL 45 DAY, NOW()),
('pay_014', 'usr_user_003', 'sub_006',  2.99, 'USD', 'COMPLETED', 'CRYPTO', 'btc_lc_em_002', '{"coin":"ETH","txHash":"0xjkl012"}', NULL, NOW() - INTERVAL 15 DAY, NOW() - INTERVAL 15 DAY, NOW()),

-- ── Sofia Garcia (sub_007 VPS Annual) ──
('pay_015', 'usr_user_004', 'sub_007', 191.90, 'USD', 'COMPLETED', 'CARD',  'ch_sg_vps_001', '{"last4":"9876","brand":"Amex"}',   NULL, NOW() - INTERVAL 30 DAY, NOW() - INTERVAL 30 DAY, NOW()),

-- ── Ava Johnson (sub_009 — cancelled, had 1 successful + 1 refund) ──
('pay_016', 'usr_user_006', 'sub_009',  5.99, 'USD', 'COMPLETED', 'CARD',   'ch_aj_vps_001', '{"last4":"5555","brand":"Visa"}',   NULL, NOW() - INTERVAL 25 DAY, NOW() - INTERVAL 25 DAY, NOW()),
('pay_017', 'usr_user_006', 'sub_009',  5.99, 'USD', 'REFUNDED',  'CARD',   'ch_aj_vps_002', '{"last4":"5555","brand":"Visa","refundId":"re_001"}', NULL, NULL, NOW() - INTERVAL 5 DAY, NOW()),

-- ── Ethan Kim (sub_010 Email Business) ──
('pay_018', 'usr_user_007', 'sub_010',  7.99, 'USD', 'COMPLETED', 'BANK_TRANSFER', 'bt_ek_em_001', '{"bank":"Chase","reference":"EK20240115"}', NULL, NOW() - INTERVAL 18 DAY, NOW() - INTERVAL 18 DAY, NOW()),

-- ── Maya Brown (sub_011 VPS Starter) ──
('pay_019', 'usr_user_008', 'sub_011',  5.99, 'USD', 'COMPLETED', 'CARD',   'ch_mb_vps_001', '{"last4":"3333","brand":"Visa"}',   NULL, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 10 DAY, NOW()),

-- ── Oliver White (sub_012 VPS Enterprise) ──
('pay_020', 'usr_user_009', 'sub_012', 99.99, 'USD', 'COMPLETED', 'CARD',   'ch_ow_vps_001', '{"last4":"6666","brand":"Mastercard"}', NULL, NOW() - INTERVAL 8 DAY, NOW() - INTERVAL 8 DAY, NOW()),

-- ── Oliver White (sub_013 Docker Scale) ──
('pay_021', 'usr_user_009', 'sub_013', 79.99, 'USD', 'COMPLETED', 'CARD',   'ch_ow_dk_001',  '{"last4":"6666","brand":"Mastercard"}', NULL, NOW() - INTERVAL 8 DAY, NOW() - INTERVAL 8 DAY, NOW()),

-- ── Oliver White (sub_014 Email Enterprise) ──
('pay_022', 'usr_user_009', 'sub_014', 24.99, 'USD', 'COMPLETED', 'CARD',   'ch_ow_em_001',  '{"last4":"6666","brand":"Mastercard"}', NULL, NOW() - INTERVAL 8 DAY, NOW() - INTERVAL 8 DAY, NOW()),

-- ── James Taylor (sub_016 — suspended after failed payment) ──
('pay_023', 'usr_user_011', 'sub_016', 29.99, 'USD', 'COMPLETED', 'CARD',   'ch_jt_dk_001',  '{"last4":"7777","brand":"Visa"}',   NULL, NOW() - INTERVAL 20 DAY, NOW() - INTERVAL 20 DAY, NOW()),
('pay_024', 'usr_user_011', 'sub_016', 29.99, 'USD', 'FAILED',    'CARD',   'ch_jt_dk_002',  '{"last4":"7777","brand":"Visa","failureCode":"insufficient_funds","failureMessage":"Your card has insufficient funds."}', NULL, NULL, NOW() - INTERVAL 2 DAY, NOW()),

-- ── Amelia Scott (sub_017 Docker Dev) ──
('pay_025', 'usr_user_012', 'sub_017',  9.99, 'USD', 'COMPLETED', 'CARD',   'ch_as_dk_001',  '{"last4":"2222","brand":"Visa"}',   NULL, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW()),

-- ── Pending payment (just created) ──
('pay_026', 'usr_user_010', 'sub_015',  5.99, 'USD', 'PENDING',   'CARD',   NULL,            NULL,                                NULL, NULL, NOW(), NOW());


-- ============================================================
-- SUPPORT TICKETS
-- ============================================================

INSERT INTO support_tickets (id, userId, subject, body, status, priority, createdAt, updatedAt) VALUES

('ticket_001', 'usr_user_001', 'SSH connection timeout after server reboot',
 'Hello, after rebooting my VPS (srv-jd7f2a91.cloudnest.io) about 2 hours ago I am unable to SSH back in. The connection times out at the TCP level before even reaching the authentication step. I have tried from multiple networks. My IP: 203.0.113.45.',
 'RESOLVED', 'HIGH', NOW() - INTERVAL 15 DAY, NOW() - INTERVAL 14 DAY),

('ticket_002', 'usr_user_002', 'Domain verification failing for custom email',
 'I have added the required DNS TXT and MX records for techcorp.com about 48 hours ago but the verification still shows as pending in the dashboard. SPF record: v=spf1 include:cloudnest.io ~all. Please advise.',
 'IN_PROGRESS', 'MEDIUM', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 1 DAY),

('ticket_003', 'usr_user_003', 'Docker containers not auto-scaling above 5 replicas',
 'Our Docker Scale plan should support up to 100 containers with auto-scaling enabled. However we have noticed that scale-out events stop at 5 replicas even under high CPU load (>80%). Swarm mode is enabled. Namespace: production.',
 'OPEN', 'CRITICAL', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY),

('ticket_004', 'usr_user_006', 'Request refund for cancelled subscription',
 'I cancelled my VPS Starter subscription (sub_009) within the first week as it did not meet my requirements. I would like to request a refund for the second month charge of $5.99 as per your 30-day money-back guarantee.',
 'RESOLVED', 'LOW', NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 4 DAY),

('ticket_005', 'usr_user_005', 'Trial ends in 2 days — questions before upgrading',
 'My Docker Developer trial is ending in 2 days. I have a few questions: 1) Can I keep my existing containers and images when I upgrade? 2) Is there downtime during the plan change? 3) What happens to data if I do not upgrade in time?',
 'OPEN', 'MEDIUM', NOW() - INTERVAL 6 HOUR, NOW() - INTERVAL 6 HOUR),

('ticket_006', 'usr_user_011', 'Payment failing — card details are correct',
 'My last payment for Docker Team failed with "insufficient funds" but I have verified with my bank that sufficient funds are available and the card details in my account are correct. The subscription is now suspended. Please help urgently.',
 'IN_PROGRESS', 'HIGH', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 1 DAY),

('ticket_007', 'usr_user_009', 'Request for dedicated account manager',
 'As an Enterprise customer spending over $200/month across three services, I would like to discuss the possibility of being assigned a dedicated account manager and a custom SLA agreement.',
 'OPEN', 'LOW', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY),

('ticket_008', 'usr_user_007', 'How to configure DKIM for custom domain',
 'I have set up Business Email with the domain freelance.dev and the basic MX records are working. However I notice emails are landing in spam with some providers. I believe I need to configure DKIM and DMARC — could you provide the records I need to add?',
 'CLOSED', 'LOW', NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 8 DAY);


-- ============================================================
-- TICKET REPLIES
-- ============================================================

INSERT INTO ticket_replies (id, ticketId, authorId, body, isAdmin, createdAt) VALUES

-- ticket_001 (SSH timeout — RESOLVED)
('reply_001', 'ticket_001', 'usr_admin_001',
 'Hi John, thanks for reaching out. I can see from our monitoring that the server firewall rules were updated during the reboot. I have re-opened port 22 for your registered management IPs. Please try connecting again and let us know if the issue persists.',
 TRUE, NOW() - INTERVAL 14 DAY - INTERVAL 22 HOUR),

('reply_002', 'ticket_001', 'usr_user_001',
 'That fixed it! Thank you for the quick response. Is there a way to prevent this from happening again on future reboots?',
 FALSE, NOW() - INTERVAL 14 DAY - INTERVAL 18 HOUR),

('reply_003', 'ticket_001', 'usr_admin_001',
 'Great to hear! Yes — in your server control panel under Firewall → Persistent Rules you can mark your SSH rule as "Survive Reboot". I have also added a note to your account. Marking this ticket as resolved.',
 TRUE, NOW() - INTERVAL 14 DAY - INTERVAL 12 HOUR),

-- ticket_002 (Email DNS — IN_PROGRESS)
('reply_004', 'ticket_002', 'usr_admin_002',
 'Hi Emma, I have reviewed your DNS records and can see the MX records propagated correctly. The TXT record for verification appears to be missing the underscore prefix. It should be: _cloudnest-verify.techcorp.com with value: cloudnest-verify=ew2c8b56. Could you check and update?',
 TRUE, NOW() - INTERVAL 2 DAY - INTERVAL 20 HOUR),

('reply_005', 'ticket_002', 'usr_user_002',
 'Thank you Sarah, I have updated the TXT record. DNS propagation should take a few hours — I will check back tomorrow.',
 FALSE, NOW() - INTERVAL 1 DAY - INTERVAL 16 HOUR),

-- ticket_004 (Refund — RESOLVED)
('reply_006', 'ticket_004', 'usr_admin_001',
 'Hi Ava, I have reviewed your account and confirmed the cancellation within the eligible refund window. A refund of $5.99 has been processed back to your Visa ending in 5555. Please allow 5-7 business days for it to appear on your statement.',
 TRUE, NOW() - INTERVAL 4 DAY - INTERVAL 20 HOUR),

('reply_007', 'ticket_004', 'usr_user_006',
 'Thank you, received the refund confirmation. Appreciate the quick resolution!',
 FALSE, NOW() - INTERVAL 4 DAY - INTERVAL 10 HOUR),

-- ticket_006 (Payment failing — IN_PROGRESS)
('reply_008', 'ticket_006', 'usr_admin_001',
 'Hi James, I can see the failed payment attempt. Our system sometimes flags new cards for a manual review cycle even when funds are available. I have cleared the payment hold and sent a new payment link to your email. Please try again within the next 2 hours. Your service will be unsuspended immediately upon successful payment.',
 TRUE, NOW() - INTERVAL 1 DAY - INTERVAL 18 HOUR),

-- ticket_008 (DKIM — CLOSED)
('reply_009', 'ticket_008', 'usr_admin_002',
 'Hi Ethan, here are the DNS records you need to add for DKIM and DMARC:\n\nDKIM: cloudnest._domainkey.freelance.dev TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSq..."\n\nDMARC: _dmarc.freelance.dev TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@cloudnest.io"\n\nAfter adding these, DKIM signing will activate within 30 minutes. Let me know once you have added them!',
 TRUE, NOW() - INTERVAL 9 DAY),

('reply_010', 'ticket_008', 'usr_user_007',
 'Worked perfectly, emails are landing in inbox now. Thank you so much!',
 FALSE, NOW() - INTERVAL 8 DAY - INTERVAL 16 HOUR),

('reply_011', 'ticket_008', 'usr_admin_002',
 'Excellent! Closing this ticket. Feel free to re-open if you need anything else.',
 TRUE, NOW() - INTERVAL 8 DAY - INTERVAL 10 HOUR);


-- ============================================================
-- VERIFICATION QUERIES (run these to check data loaded ok)
-- ============================================================
-- SELECT 'users' AS tbl, COUNT(*) AS rows FROM users
-- UNION ALL SELECT 'products',  COUNT(*) FROM products
-- UNION ALL SELECT 'plans',     COUNT(*) FROM plans
-- UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions
-- UNION ALL SELECT 'service_configs', COUNT(*) FROM service_configs
-- UNION ALL SELECT 'payments',  COUNT(*) FROM payments
-- UNION ALL SELECT 'support_tickets', COUNT(*) FROM support_tickets
-- UNION ALL SELECT 'ticket_replies', COUNT(*) FROM ticket_replies;
-- ============================================================
