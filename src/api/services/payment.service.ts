// src/api/services/payment.service.ts

import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InitPaymentPayload {
  email: string;
  amount: number; // in Naira — backend converts to kobo
  plan: string;
  org_id: string;
}

export interface InitPaymentResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface VerifyPaymentResponse {
  plan: string;
  org_id: string;
  amount: number;
  reference: string;
  email: string;
}

export interface Payment {
  payment_id: string;
  org_id: string;
  plan: string;
  amount: number;
  reference: string;
  email: string;
  paid_at: string;
  source: 'verify' | 'webhook';
  receipt_url?: string;
}

// ─── Plan Definitions ─────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    key: 'free',
    name: 'Free',
    amount: 0,
    priceLabel: '₦0',
    subLabel: 'Forever free',
    badge: null,
    maxPositions: 2,
    electionsPerMonth: 1,
    features: [
      { text: '2 positions per election', included: true },
      { text: '1 election per month', included: true },
      { text: 'Unlimited voters', included: true },
      { text: 'Self-service portal', included: true },
      { text: 'OTP voter verification', included: true },
      { text: 'Real-time results', included: true },
      { text: 'Basic audit trail & logs', included: true },
      { text: 'Basic results dashboard', included: true },
      { text: 'Email & SMS notifications', included: false },
      { text: 'Custom election branding', included: false },
      { text: 'Results export (PDF/CSV)', included: false },
      { text: 'Email support', included: false },
    ],
    dataRetention: '30-day data retention',
    cta: 'Get Started',
    ctaVariant: 'outline' as const,
  },
  standard: {
    key: 'standard',
    name: 'Pro',
    amount: 35000,
    priceLabel: '₦35,000',
    subLabel: 'per month',
    badge: null,
    maxPositions: 5,
    electionsPerMonth: 2,
    features: [
      { text: 'Up to 5 positions per election', included: true },
      { text: '2 elections per month', included: true },
      { text: 'Unlimited voters', included: true },
      { text: 'Self-service portal', included: true },
      { text: 'OTP voter verification', included: true },
      { text: 'Real-time results', included: true },
      { text: 'Full audit trail & logs', included: true },
      { text: 'Full analytics dashboard', included: true },
      { text: 'Email & SMS notifications', included: true },
      { text: 'Custom election branding', included: false },
      { text: 'Results export (PDF/CSV)', included: true },
      { text: 'Email support', included: true },
    ],
    dataRetention: '90-day data retention',
    cta: 'Upgrade to Pro',
    ctaVariant: 'default' as const,
  },
  pro: {
    key: 'pro',
    name: 'Premium',
    amount: 70000,
    priceLabel: '₦70,000',
    subLabel: 'per month',
    badge: 'Most Popular',
    maxPositions: 10,
    electionsPerMonth: 5,
    features: [
      { text: 'Up to 10 positions per election', included: true },
      { text: '5 elections per month', included: true },
      { text: 'Unlimited voters', included: true },
      { text: 'Self-service portal', included: true },
      { text: 'OTP voter verification', included: true },
      { text: 'Real-time results', included: true },
      { text: 'Full audit trail & logs', included: true },
      { text: 'Analytics dashboard + Export', included: true },
      { text: 'Email & SMS notifications', included: true },
      { text: 'Custom election branding', included: true },
      { text: 'Results export (PDF/CSV)', included: true },
      { text: 'Email + Chat support', included: true },
    ],
    dataRetention: '180-day data retention',
    cta: 'Upgrade to Premium',
    ctaVariant: 'default' as const,
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    amount: 150000,
    priceLabel: '₦150,000',
    subLabel: 'per month',
    badge: 'Best Value',
    maxPositions: Infinity,
    electionsPerMonth: Infinity,
    features: [
      { text: 'Unlimited positions per election', included: true },
      { text: 'Unlimited elections per month', included: true },
      { text: 'Unlimited voters', included: true },
      { text: 'Self-service portal', included: true },
      { text: 'OTP voter verification', included: true },
      { text: 'Real-time results', included: true },
      { text: 'Full audit trail & logs', included: true },
      { text: 'Analytics dashboard + Export', included: true },
      { text: 'Email & SMS notifications', included: true },
      { text: 'Custom election branding', included: true },
      { text: 'Results export (PDF/CSV)', included: true },
      { text: 'Priority phone + email support', included: true },
    ],
    dataRetention: '2-year data retention',
    cta: 'Contact Sales',
    ctaVariant: 'default' as const,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Initialize a Paystack payment — returns Paystack authorization URL
 */
export async function initializePayment(
  payload: InitPaymentPayload
): Promise<InitPaymentResponse> {
  const response = await apiClient.post<InitPaymentResponse>(
    ENDPOINTS.PAYMENT_INITIALIZE,
    payload
  );
  return response.data;
}

/**
 * Verify a payment using the transaction reference
 */
export async function verifyPayment(
  reference: string
): Promise<VerifyPaymentResponse> {
  const response = await apiClient.get<VerifyPaymentResponse>(
    ENDPOINTS.PAYMENT_VERIFY(reference)
  );
  return response.data;
}

/**
 * Get payment history for the authenticated organization
 */
export async function getPaymentHistory(): Promise<Payment[]> {
  const response = await apiClient.get<Payment[]>(ENDPOINTS.PAYMENT_HISTORY);
  return response.data;
}