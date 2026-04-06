import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminHash = await bcrypt.hash('admin123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cloudnest.io' },
    update: {},
    create: {
      email: 'admin@cloudnest.io',
      name: 'CloudNest Admin',
      passwordHash: adminHash,
      role: 'ADMIN',
      isVerified: true,
    },
  });

  // Create test user
  const userHash = await bcrypt.hash('user123456', 12);
  const user = await prisma.user.upsert({
    where: { email: 'john@example.com' },
    update: {},
    create: {
      email: 'john@example.com',
      name: 'John Doe',
      passwordHash: userHash,
      role: 'USER',
      isVerified: true,
    },
  });

  // VPS Products
  const vpsProduct = await prisma.product.upsert({
    where: { slug: 'cloud-vps' },
    update: {},
    create: {
      name: 'Cloud VPS',
      slug: 'cloud-vps',
      description: 'High-performance virtual private servers with NVMe SSD storage, dedicated resources, and 99.9% uptime SLA. Scale your applications with ease using our fully managed infrastructure.',
      category: 'VPS',
      features: ['NVMe SSD Storage', 'Dedicated vCPUs', '99.9% Uptime SLA', 'DDoS Protection', 'Full Root Access', 'Automated Backups', '24/7 Monitoring', 'Custom OS Images'],
      specs: { network: '1 Gbps', datacenter: 'Tier 4', hypervisor: 'KVM', backup: 'Daily' },
      imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    },
  });

  await prisma.plan.createMany({
    skipDuplicates: true,
    data: [
      { productId: vpsProduct.id, name: 'Starter', price: 5.99, billingCycle: 'MONTHLY', limits: { cpu: '1 vCPU', ram: '1 GB', storage: '25 GB SSD', bandwidth: '1 TB', snapshots: 1 } },
      { productId: vpsProduct.id, name: 'Professional', price: 19.99, billingCycle: 'MONTHLY', isPopular: true, limits: { cpu: '2 vCPUs', ram: '4 GB', storage: '80 GB SSD', bandwidth: '4 TB', snapshots: 5 } },
      { productId: vpsProduct.id, name: 'Business', price: 49.99, billingCycle: 'MONTHLY', limits: { cpu: '4 vCPUs', ram: '8 GB', storage: '160 GB SSD', bandwidth: '8 TB', snapshots: 10 } },
      { productId: vpsProduct.id, name: 'Enterprise', price: 99.99, billingCycle: 'MONTHLY', limits: { cpu: '8 vCPUs', ram: '16 GB', storage: '320 GB SSD', bandwidth: 'Unlimited', snapshots: 20 } },
    ],
  });

  // Docker Products
  const dockerProduct = await prisma.product.upsert({
    where: { slug: 'managed-docker' },
    update: {},
    create: {
      name: 'Managed Docker',
      slug: 'managed-docker',
      description: 'Deploy containerized applications with our fully managed Docker hosting. Auto-scaling, load balancing, and zero-downtime deployments out of the box.',
      category: 'DOCKER',
      features: ['Auto-Scaling', 'Load Balancing', 'Zero-Downtime Deploys', 'Private Registry', 'Docker Compose Support', 'Kubernetes Compatible', 'CI/CD Integration', 'Resource Monitoring'],
      specs: { orchestration: 'Swarm/K8s', registry: 'Private', deployments: 'Blue-Green', logging: 'Centralized' },
      imageUrl: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=800',
    },
  });

  await prisma.plan.createMany({
    skipDuplicates: true,
    data: [
      { productId: dockerProduct.id, name: 'Developer', price: 9.99, billingCycle: 'MONTHLY', limits: { containers: 5, ram: '2 GB', storage: '10 GB', builds: 50 } },
      { productId: dockerProduct.id, name: 'Team', price: 29.99, billingCycle: 'MONTHLY', isPopular: true, limits: { containers: 20, ram: '8 GB', storage: '50 GB', builds: 200 } },
      { productId: dockerProduct.id, name: 'Scale', price: 79.99, billingCycle: 'MONTHLY', limits: { containers: 100, ram: '32 GB', storage: '200 GB', builds: 'Unlimited' } },
    ],
  });

  // Email Products
  const emailProduct = await prisma.product.upsert({
    where: { slug: 'business-email' },
    update: {},
    create: {
      name: 'Business Email',
      slug: 'business-email',
      description: 'Professional email hosting with your own domain, spam filtering, and enterprise-grade security. IMAP/SMTP/POP3 support with a beautiful webmail interface.',
      category: 'EMAIL',
      features: ['Custom Domain', 'Spam Filtering', 'Virus Protection', 'IMAP/SMTP/POP3', 'Webmail Interface', 'Aliases & Forwarding', 'Calendar & Contacts', 'Mobile Sync'],
      specs: { uptime: '99.99%', encryption: 'TLS 1.3', spam: 'AI-Powered', backup: 'Real-time' },
      imageUrl: 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800',
    },
  });

  await prisma.plan.createMany({
    skipDuplicates: true,
    data: [
      { productId: emailProduct.id, name: 'Solo', price: 2.99, billingCycle: 'MONTHLY', limits: { mailboxes: 1, storage: '5 GB', aliases: 5, domains: 1 } },
      { productId: emailProduct.id, name: 'Business', price: 7.99, billingCycle: 'MONTHLY', isPopular: true, limits: { mailboxes: 10, storage: '50 GB', aliases: 50, domains: 3 } },
      { productId: emailProduct.id, name: 'Enterprise', price: 24.99, billingCycle: 'MONTHLY', limits: { mailboxes: 'Unlimited', storage: '500 GB', aliases: 'Unlimited', domains: 10 } },
    ],
  });

  console.log('✅ Seed complete!');
  console.log('Admin: admin@cloudnest.io / admin123456');
  console.log('User:  john@example.com / user123456');
}

main().catch(console.error).finally(() => prisma.$disconnect());
