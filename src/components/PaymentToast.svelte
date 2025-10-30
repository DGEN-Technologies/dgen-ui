<script>
  import { onMount } from 'svelte';
  import { paymentReceived } from '$lib/stores/paymentEvents';
  import { toast } from '@zerodevx/svelte-toast';

  // Subscribe to payment events
  onMount(() => {
    const unsubscribe = paymentReceived.subscribe((event) => {
      if (!event) return;

      const { payment, status } = event;
      const amountSats = payment?.amountSat || 0;

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
          duration: 5000
        },
        complete: {
          emoji: '✅',
          title: 'Payment Confirmed',
          color: 'from-green-500 to-emerald-600',
          duration: 7000
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

      // Create toast notification
      toast.push({
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
