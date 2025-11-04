<script>
  import { onMount } from 'svelte';
  import { paymentReceived } from '$lib/stores/paymentEvents';
  import { toast } from '@zerodevx/svelte-toast';

  // Track active toast IDs for dismissal
  let activeToastId = null;
  let lastPaymentId = null;

  // Subscribe to payment events
  onMount(() => {
    const unsubscribe = paymentReceived.subscribe((event) => {
      if (!event) {
        // Clear active toast when payment event is cleared
        if (activeToastId !== null) {
          toast.pop(activeToastId);
          activeToastId = null;
        }
        return;
      }

      const { payment, status } = event;
      const amountSats = payment?.amountSat || 0;
      const paymentId = payment?.id || payment?.paymentHash || `${amountSats}-${Date.now()}`;

      // Dismiss previous toast if showing a new payment or status change
      if (activeToastId !== null && (paymentId !== lastPaymentId || status === 'complete' || status === 'confirmed')) {
        toast.pop(activeToastId);
        activeToastId = null;
      }

      lastPaymentId = paymentId;

      // Different styles and messages based on status
      const statusConfig = {
        pending: {
          emoji: '🔔',
          title: 'Payment Pending',
          color: 'from-yellow-500 to-orange-500',
          duration: 5000
        },
        confirmed: {
          emoji: '⚡',
          title: 'Payment Received',
          color: 'from-emerald-500 to-teal-500',
          duration: 3000  // Shorter duration since we'll navigate to success page
        },
        complete: {
          emoji: '✅',
          title: 'Payment Confirmed',
          color: 'from-green-500 to-emerald-600',
          duration: 3000  // Shorter duration since we'll navigate to success page
        },
        fee_acceptance: {
          emoji: '⚠️',
          title: 'Fee Approval Needed',
          color: 'from-amber-500 to-orange-500',
          duration: 10000
        },
        failed: {
          emoji: '❌',
          title: 'Payment Failed',
          color: 'from-red-500 to-pink-500',
          duration: 5000
        },
        refundable: {
          emoji: '🔄',
          title: 'Refund Available',
          color: 'from-blue-500 to-cyan-500',
          duration: 8000
        }
      };

      const config = statusConfig[status] || statusConfig.confirmed;

      // Don't show toast for confirmed/complete if we're navigating to payment-received page
      // The green checkmark page will show the success
      if ((status === 'confirmed' || status === 'complete') &&
          (window.location.pathname.includes('/receive') ||
           window.location.pathname.includes('/invoice'))) {
        return;
      }

      // Create toast notification
      activeToastId = toast.push({
        msg: `${config.emoji} ${config.title}: ${amountSats.toLocaleString()} sats`,
        theme: {
          '--toastBackground': `linear-gradient(135deg, ${config.color.split(' ')[0].replace('from-', 'var(--color-')}), ${config.color.split(' ')[1].replace('to-', 'var(--color-')}))`,
          '--toastColor': 'white',
          '--toastBarBackground': 'rgba(255, 255, 255, 0.5)'
        },
        duration: config.duration,
        initial: 0,
        next: 1,
        pausable: true
      });
    });

    return unsubscribe;
  });
</script>
