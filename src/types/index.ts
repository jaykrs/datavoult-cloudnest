export type Category = 'VPS' | 'DOCKER' | 'EMAIL';
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'COMING_SOON';
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export type SubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED' | 'TRIAL';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: Category;
  status: ProductStatus;
  features: string[];
  specs: Record<string, string | number>;
  imageUrl?: string;
  plans: Plan[];
  createdAt: string;
}

export interface Plan {
  id: string;
  productId: string;
  name: string;
  description?: string;
  price: number;
  billingCycle: BillingCycle;
  isPopular: boolean;
  limits: Record<string, string | number>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  productId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate?: string;
  renewsAt?: string;
  product: Product;
  plan: Plan;
  serviceConfig?: ServiceConfig;
}

export interface ServiceConfig {
  id: string;
  hostname?: string;
  ipAddress?: string;
  domain?: string;
  region?: string;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  paidAt?: string;
  subscription?: {
    product: { name: string };
    plan: { name: string };
  };
}

export interface AdminStats {
  totalUsers: number;
  totalRevenue: number;
  activeSubscriptions: number;
  totalProducts: number;
  recentPayments: Payment[];
  subscriptionsByCategory: { category: string; count: number }[];
  revenueByMonth: { month: string; revenue: number }[];
}
