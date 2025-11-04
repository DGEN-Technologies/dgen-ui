<script>
  import Success from "$comp/Success.svelte";
  import { t } from "$lib/translations";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { paymentReceived } from "$lib/stores/paymentEvents";
  import { page } from "$app/stores";
  import { get } from "svelte/store";
  import { toast } from '@zerodevx/svelte-toast';

  // Get user data from page store
  const pageData = get(page);
  const user = pageData?.data?.user;

  // Subscribe to payment events
  let payment = $state(null);
  let status = $state(null);

  // Read from the store on mount
  onMount(() => {
    // Dismiss all toasts when showing the success page
    toast.pop(0);

    const event = get(paymentReceived);

    if (event) {
      payment = event.payment;
      status = event.status;
    } else {
      // No payment data, redirect to home
      console.log('[PaymentReceived] No payment data, redirecting to home');
      goto(`/${user?.username || ''}`);
      return;
    }

    const handleClick = () => {
      // Clear the payment event when leaving
      paymentReceived.set(null);
      goto(`/${user?.username || ''}`);
    };

    // Auto-redirect after 5 seconds
    const timer = setTimeout(() => {
      // Clear the payment event when leaving
      paymentReceived.set(null);
      goto(`/${user?.username || ''}`);
    }, 5000);

    document.addEventListener('click', handleClick);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  });

  // Get payment details
  const amount = $derived(payment?.amountSat || 0);
  const currency = $derived(user?.currency || 'USD');
  const locale = $derived(user?.language || 'en');

  // Fetch current rate - default to reasonable fallback
  let rate = $state(50000);

  onMount(async () => {
    try {
      const walletService = await import('$lib/walletService');
      if (walletService.isConnected()) {
        const fiatRates = await walletService.fetchFiatRates();
        const userRate = fiatRates.find(r => r.coin.toUpperCase() === currency.toUpperCase());
        if (userRate) rate = userRate.value;
      }
    } catch (e) {
      console.warn('[PaymentReceived] Failed to fetch fiat rates:', e);
    }
  });
</script>

<div class="container px-4 text-center mx-auto min-h-screen flex flex-col items-center justify-center">
  {#if payment}
    {#if status === 'pending'}
      <!-- Show pending indicator -->
      <iconify-icon noobserver icon="ph:clock-bold" class="text-warning" width="160"></iconify-icon>
      <h1 class="text-3xl md:text-4xl font-bold mb-6 mt-8">Payment Detected</h1>
      <div class="text-xl md:text-2xl text-white/80">
        <iconify-icon noobserver icon="ph:lightning-fill" class="text-yellow-300 inline"></iconify-icon>
        {amount.toLocaleString()} sats
      </div>
    {:else}
      <!-- Show success checkmark for confirmed/complete -->
      <Success
        {amount}
        {rate}
        tip={0}
        {currency}
        {locale}
        title={$t("invoice.paymentSuccessful") || "Payment Received!"}
      />
    {/if}

    <div class="flex justify-center mt-8 text-white/60 text-lg">
      {$t("payments.tapAnywhere") || "Tap anywhere to continue"}
    </div>
  {:else}
    <!-- Loading or no payment -->
    <div class="space-y-4">
      <div class="loading loading-spinner loading-lg"></div>
      <p class="text-white/60">Loading payment...</p>
    </div>
  {/if}
</div>
