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
  success: boolean;
  plan: string;
  org_id: string;
  amount: number;
  reference: string;
}

// ─── Plan Definitions ─────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    key: 'free',
    name: 'Free Plan',
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
      { text: 'Customer support', included: false },
    ],
    dataRetention: '30-day data retention',
    cta: 'Get Started Free',
    ctaVariant: 'outline' as const,
  },
  standard: {
    key: 'standard',
    name: 'Standard Plan',
    amount: 35000,
    priceLabel: '₦35,000',
    subLabel: 'per election',
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
      { text: 'Email-based support', included: true },
      { text: 'Custom election branding', included: false },
      { text: 'Results export (PDF/CSV)', included: false },
    ],
    dataRetention: '90-day data retention',
    cta: 'Buy Standard Plan',
    ctaVariant: 'default' as const,
  },
  pro: {
    key: 'pro',
    name: 'Pro Plan',
    amount: 70000,
    priceLabel: '₦70,000',
    subLabel: 'per election',
    badge: 'Most Popular',
    maxPositions: 10,
    electionsPerMonth: 2,
    features: [
      { text: 'Up to 10 positions per election', included: true },
      { text: '2 elections per month', included: true },
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
      { text: '99.5% SLA uptime guarantee', included: true },
    ],
    dataRetention: '180-day data retention',
    cta: 'Buy Pro Plan',
    ctaVariant: 'default' as const,
  },
  standard_pro: {
    key: 'standard_pro',
    name: 'Standard Pro Plan',
    amount: 120000,
    priceLabel: '₦120,000',
    subLabel: 'per election',
    badge: 'Best Value',
    maxPositions: Infinity,
    electionsPerMonth: 2,
    features: [
      { text: 'Unlimited positions per election', included: true },
      { text: '2 elections per month', included: true },
      { text: 'Unlimited voters', included: true },
      { text: 'Self-service portal', included: true },
      { text: 'OTP voter verification', included: true },
      { text: 'Real-time results', included: true },
      { text: 'Full audit trail & logs', included: true },
      { text: 'Analytics dashboard + Export', included: true },
      { text: 'Email & SMS notifications', included: true },
      { text: 'Custom election branding', included: true },
      { text: 'Results export (PDF/CSV)', included: true },
      { text: 'Priority support (Email + Phone)', included: true },
      { text: '99.9% SLA uptime guarantee', included: true },
    ],
    dataRetention: '1-year data retention',
    cta: 'Buy Standard Pro Plan',
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