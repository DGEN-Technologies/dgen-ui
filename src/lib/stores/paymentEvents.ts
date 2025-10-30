import { writable } from 'svelte/store';
import type { Payment } from '@breeztech/breez-sdk-liquid';
import { notifyPaymentReceived as showBrowserNotification } from '$lib/notifications';

export type PaymentStatus = 'pending' | 'confirmed' | 'complete' | 'fee_acceptance' | 'failed' | 'refundable';

export interface PaymentEvent {
  payment: any; // Payment details from SDK event
  status: PaymentStatus;
  timestamp: number;
}

// Store for broadcasting payment received events across components
export const paymentReceived = writable<PaymentEvent | null>(null);

// Function to notify all listeners that a payment was received
// Status guide (from Breez SDK docs):
// - 'pending': Show payment as pending (lockup tx broadcast)
// - 'confirmed': Display successful payment feedback (claim tx broadcast/seen)
// - 'complete': Show payment as complete (transaction confirmed)
// - 'fee_acceptance': Allow user to review fees (Bitcoin amountless swap)
// - 'failed': Payment failed
// - 'refundable': Payment failed but needs refund (Bitcoin only)
export function notifyPaymentReceived(payment: any, status: PaymentStatus = 'pending') {
  console.log('[PaymentEvents] Payment received:', { payment, status });

  const event: PaymentEvent = {
    payment,
    status,
    timestamp: Date.now()
  };

  paymentReceived.set(event);

  // Show browser notification for incoming payments
  if (payment?.amountSat) {
    showBrowserNotification(payment.amountSat, status);
  }

  // Clear after 5 seconds for 'confirmed' status (to allow UI transitions)
  // Don't auto-clear for 'pending' or 'fee_acceptance' (they need user interaction)
  if (status === 'confirmed' || status === 'complete') {
    setTimeout(() => {
      paymentReceived.set(null);
    }, 5000);
  }
}
