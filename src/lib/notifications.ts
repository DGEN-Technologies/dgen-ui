/**
 * Browser Notifications Service
 * Handles both browser Notification API and toast notifications
 */

import { browser } from '$app/environment';

export type NotificationPermission = 'granted' | 'denied' | 'default';

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!browser || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermission;
  }

  return Notification.permission as NotificationPermission;
}

/**
 * Check current notification permission
 */
export function getNotificationPermission(): NotificationPermission {
  if (!browser || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission as NotificationPermission;
}

/**
 * Check if notifications are enabled by user preference
 */
function areNotificationsEnabled(): boolean {
  if (!browser) return false;
  const pref = localStorage.getItem('notifications_enabled');
  return pref === 'true';
}

/**
 * Show a browser notification
 */
export function showBrowserNotification(title: string, options?: NotificationOptions): Notification | null {
  if (!browser || !('Notification' in window)) {
    return null;
  }

  if (!areNotificationsEnabled()) {
    return null;
  }

  if (Notification.permission !== 'granted') {
    return null;
  }

  try {
    return new Notification(title, {
      icon: '/images/icon.png',
      badge: '/images/badge.png',
      ...options
    });
  } catch (error) {
    console.error('[Notifications] Failed to show notification:', error);
    return null;
  }
}

/**
 * Show payment received notification
 */
export function notifyPaymentReceived(amountSats: number, status: 'pending' | 'confirmed' | 'complete'): void {
  if (!browser) return;

  const statusText = {
    pending: 'Pending',
    confirmed: 'Received',
    complete: 'Confirmed'
  }[status];

  const emoji = status === 'complete' ? '✅' : status === 'confirmed' ? '⚡' : '🔔';

  const title = `${emoji} Payment ${statusText}`;
  const body = `${amountSats.toLocaleString()} sats`;

  showBrowserNotification(title, {
    body,
    tag: 'payment-received',
    requireInteraction: status === 'complete', // Require user action for completed payments
    data: {
      amountSats,
      status,
      timestamp: Date.now()
    }
  });
}

/**
 * Show payment sent notification
 */
export function notifyPaymentSent(amountSats: number, status: string): void {
  if (!browser) return;

  const title = `⚡ Payment Sent`;
  const body = `${amountSats.toLocaleString()} sats`;

  showBrowserNotification(title, {
    body,
    tag: 'payment-sent',
    data: {
      amountSats,
      status,
      timestamp: Date.now()
    }
  });
}

/**
 * Check if notifications are supported
 */
export function isNotificationSupported(): boolean {
  return browser && 'Notification' in window;
}
