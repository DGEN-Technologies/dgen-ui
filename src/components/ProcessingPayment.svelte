<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as walletService from '$lib/walletService';
  import type { SdkEvent, Payment } from '@breeztech/breez-sdk-liquid/web';

  interface ProcessingPaymentProps {
    paymentType: 'lightning' | 'bitcoin' | 'liquid';
    isSend: boolean;
    expectedDestination?: string;
    expectedInvoice?: string;
    onSuccess?: (payment: Payment) => void;
    onFailure?: (error: any) => void;
    onClose?: () => void;
  }

  let {
    paymentType = 'lightning',
    isSend = true,
    expectedDestination,
    expectedInvoice,
    onSuccess,
    onFailure,
    onClose
  }: ProcessingPaymentProps = $props();

  let currentState = $state<'processing' | 'pending' | 'confirming' | 'success' | 'failed'>('processing');
  let statusMessage = $state('Processing payment...');
  let eventListenerId = $state<string | null>(null);
  let timeoutId: ReturnType<typeof setTimeout>;

  // Payment state tracking
  const TIMEOUT_DURATION = 30000; // 30 seconds

  onMount(async () => {
    try {
      // Set up event listener to track payment progress
      eventListenerId = await walletService.addEventListener(handlePaymentEvent);

      // Set timeout for payment processing
      timeoutId = setTimeout(() => {
        if (currentState !== 'success' && currentState !== 'failed') {
          handleTimeout();
        }
      }, TIMEOUT_DURATION);
    } catch (error) {
      console.error('[ProcessingPayment] Failed to set up event listener:', error);
      handleFailure(error);
    }
  });

  onDestroy(() => {
    // Clean up event listener
    if (eventListenerId) {
      walletService.removeEventListener(eventListenerId);
    }

    // Clear timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });

  function handlePaymentEvent(event: SdkEvent): void {
    console.log('[ProcessingPayment] Received event:', event.type);

    // Filter events for our payment
    const payment = (event as any).details as Payment | undefined;

    // Check if this event is for our payment
    if (payment) {
      const matchesDestination = !expectedDestination || payment.destination === expectedDestination;
      const matchesInvoice = !expectedInvoice || payment.details?.invoice === expectedInvoice;

      if (!matchesDestination && !matchesInvoice) {
        return; // Not our payment
      }
    }

    switch (event.type) {
      case 'paymentPending':
        currentState = 'pending';
        if (isSend) {
          statusMessage = paymentType === 'lightning'
            ? 'Lockup transaction broadcast...'
            : paymentType === 'bitcoin'
            ? 'Sending to swap service...'
            : 'Transaction broadcast...';
        } else {
          statusMessage = 'Payment detected...';
        }
        break;

      case 'paymentWaitingConfirmation':
        currentState = 'confirming';
        statusMessage = 'Waiting for confirmation...';

        // For Liquid payments, this is essentially success
        if (paymentType === 'liquid') {
          setTimeout(() => handleSuccess(payment), 1000);
        }
        break;

      case 'paymentSucceeded':
        handleSuccess(payment);
        break;

      case 'paymentFailed':
        handleFailure(payment || 'Payment failed');
        break;

      case 'paymentRefundPending':
        currentState = 'pending';
        statusMessage = 'Refunding payment...';
        break;

      case 'paymentRefunded':
        currentState = 'success';
        statusMessage = 'Payment refunded successfully';
        setTimeout(() => {
          onSuccess?.(payment);
          onClose?.();
        }, 2000);
        break;
    }
  }

  function handleSuccess(payment?: Payment): void {
    currentState = 'success';
    statusMessage = isSend ? 'Payment sent!' : 'Payment received!';

    // Clear timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Auto-close after showing success
    setTimeout(() => {
      if (payment) {
        onSuccess?.(payment);
      }
      onClose?.();
    }, 2250);
  }

  function handleFailure(error: any): void {
    currentState = 'failed';
    statusMessage = typeof error === 'string' ? error : 'Payment failed';

    // Clear timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    setTimeout(() => {
      onFailure?.(error);
      onClose?.();
    }, 2000);
  }

  function handleTimeout(): void {
    // For Lightning payments, timeout is acceptable - payment might still succeed
    if (paymentType === 'lightning' && currentState === 'confirming') {
      handleSuccess();
    } else {
      handleFailure('Payment timeout - please check transaction history');
    }
  }
</script>

<div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
  <div class="bg-base-200 rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10 shadow-2xl">
    <div class="flex flex-col items-center gap-6">
      <!-- Icon/Animation -->
      {#if currentState === 'success'}
        <div class="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center animate-scale-in">
          <iconify-icon icon="ph:check-circle-fill" width="48" class="text-green-400"></iconify-icon>
        </div>
      {:else if currentState === 'failed'}
        <div class="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center animate-scale-in">
          <iconify-icon icon="ph:x-circle-fill" width="48" class="text-red-400"></iconify-icon>
        </div>
      {:else}
        <div class="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
          <div class="loading loading-spinner loading-lg text-primary"></div>
        </div>
      {/if}

      <!-- Status Message -->
      <div class="text-center">
        <h3 class="text-2xl font-bold mb-2">
          {#if currentState === 'success'}
            Success!
          {:else if currentState === 'failed'}
            Failed
          {:else if currentState === 'confirming'}
            Confirming
          {:else if currentState === 'pending'}
            Pending
          {:else}
            Processing
          {/if}
        </h3>
        <p class="text-white/60">{statusMessage}</p>
      </div>

      <!-- Progress Indicator -->
      {#if currentState !== 'success' && currentState !== 'failed'}
        <div class="w-full bg-white/10 rounded-full h-2">
          <div
            class="bg-gradient-to-r from-cyan-400 to-purple-500 h-2 rounded-full transition-all duration-500"
            style="width: {currentState === 'processing' ? '30%' : currentState === 'pending' ? '60%' : '90%'}"
          ></div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  @keyframes scale-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .animate-scale-in {
    animation: scale-in 0.3s ease-out;
  }
</style>
