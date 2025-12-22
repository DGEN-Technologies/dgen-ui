<script>
  import { onMount } from "svelte";
  import { t } from "$lib/translations";
  import Spinner from "$comp/Spinner.svelte";
  import { page } from "$app/stores";
  import { s } from "$lib/utils";
  import { goto } from "$app/navigation";
  import { rate } from "$lib/store";
  import { walletBalance } from "$lib/stores/wallet";
  import { fetchOnchainLimits, preparePayOnchain, payOnchain, recommendedFees } from "$lib/walletService";
  
  import Amount from "$comp/Amount.svelte";
  
  let { data } = $props();
  
  // Get params from server
  let { address, amount } = $derived(data);
  let feeRate = $state(data.feeRate || 10);
  
  // State for UI
  let loading = $state(true);
  let submitting = $state(false);
  let error = $state("");
  let preparedPayment = $state(null);
  let limits = $state(null);
  let fee = $state(0);
  let fees = $state({
    hourFee: 5,      // Economy
    halfHourFee: 10, // Normal  
    fastestFee: 20,  // Priority
  });
  
  // User's currency from page store
  let currency = $derived($page.data.user?.currency || 'USD');
  
  // Initialize on mount
  onMount(async () => {
    await fetchRecommendedFees();
    await prepareOnchainPayment();
  });
  
  // Fetch recommended fees from SDK with timeout
  async function fetchRecommendedFees() {
    try {
      // Add 10 second timeout for fee fetching
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Fee fetch timeout')), 10000)
      );

      const recommended = await Promise.race([
        recommendedFees(),
        timeoutPromise
      ]);

      console.log("Recommended fees from SDK:", recommended);

      // Update our fee presets with actual recommended values
      fees = {
        hourFee: Number(recommended.hourFee) || 5,       // Economy
        halfHourFee: Number(recommended.halfHourFee) || 10,  // Normal
        fastestFee: Number(recommended.fastestFee) || 20,   // Priority
      };

      // Set default fee rate to normal (halfHourFee)
      if (!feeRate) {
        feeRate = fees.halfHourFee;
      }
    } catch (e) {
      console.error("Failed to fetch recommended fees:", e);
      // Keep default values if fetch fails
    }
  }
  
  // Prepare the onchain payment with timeout and retry
  async function prepareOnchainPayment(retryCount = 0) {
    const maxRetries = 2;
    const timeout = 15000; // 15 second timeout

    try {
      loading = true;
      error = "";

      // Fetch onchain limits with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout - network may be slow or rate limited')), timeout)
      );

      limits = await Promise.race([
        fetchOnchainLimits(),
        timeoutPromise
      ]);
      console.log("Onchain limits:", limits);

      // Validate amount against limits
      if (amount < limits.send.minSat) {
        error = `Minimum amount is ${limits.send.minSat} sats`;
        loading = false;
        return;
      }
      if (amount > limits.send.maxSat) {
        error = `Maximum amount is ${limits.send.maxSat} sats`;
        loading = false;
        return;
      }

      // Prepare onchain payment with optional fee rate
      const prepareRequest = {
        amount: {
          type: 'bitcoin',
          receiverAmountSat: amount
        },
        ...(feeRate && { feeRateSatPerVbyte: feeRate })
      };

      console.log("Prepare request:", prepareRequest);

      const prepareTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Payment preparation timeout - network may be slow or rate limited')), timeout)
      );

      preparedPayment = await Promise.race([
        preparePayOnchain(prepareRequest),
        prepareTimeoutPromise
      ]);
      console.log("Prepare response:", preparedPayment);

      // Extract fee information
      fee = preparedPayment.totalFeesSat || 0;

    } catch (e) {
      console.error("Onchain payment preparation error:", e);
      const errorMsg = e.message || "Failed to prepare payment";

      // Check if this is a retryable error (timeout, rate limit, network issue)
      const isRetryable =
        errorMsg.includes('timeout') ||
        errorMsg.includes('429') ||
        errorMsg.includes('Too Many Requests') ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('network');

      if (isRetryable && retryCount < maxRetries) {
        console.log(`Retrying payment preparation (${retryCount + 1}/${maxRetries})...`);
        // Exponential backoff: 2s, 4s
        const backoffMs = 2000 * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return prepareOnchainPayment(retryCount + 1);
      }

      error = errorMsg + (isRetryable ? ". Please try again in a moment." : "");
    } finally {
      loading = false;
    }
  }
  
  // Execute the onchain payment
  async function executePayment() {
    if (!preparedPayment) {
      error = "Payment not prepared";
      return;
    }
    
    try {
      submitting = true;
      error = "";
      
      // Send the onchain payment
      const payRequest = {
        address: address.trim(),
        prepareResponse: preparedPayment
      };
      
      console.log("Pay request:", payRequest);
      const response = await payOnchain(payRequest);
      console.log("Payment response:", response);
      
      // Check if payment was successful
      if (response.payment) {
        // Navigate to success page
        await goto(`/sent/${response.payment.id}`);
      } else {
        throw new Error("Payment failed - no payment ID returned");
      }
      
    } catch (e) {
      console.error("Problem sending onchain Bitcoin:", e);
      error = e.message || "Payment failed";
    } finally {
      submitting = false;
    }
  }
  
  // Update fee rate and re-prepare
  async function setFee(newRate) {
    feeRate = newRate;
    await prepareOnchainPayment();
  }
  
  let goBack = () => window.history.back();
</script>

<div
  class="container px-4 max-w-xl mx-auto space-y-5 text-center no-transition"
>
  <h1 class="text-3xl md:text-4xl font-semibold mb-2">{$t("payments.send")}</h1>

  {#if error}
    <div class="flex flex-col items-center gap-4 mb-5">
      <div class="text-red-600 text-center">{error}</div>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-secondary"
          onclick={goBack}
        >
          Back
        </button>
        <button
          type="button"
          class="btn btn-accent"
          onclick={() => prepareOnchainPayment()}
        >
          Retry
        </button>
      </div>
    </div>
  {:else if loading}
    <div class="flex flex-col items-center gap-4">
      <Spinner />
      <p class="text-secondary">Preparing payment...</p>
    </div>
  {:else if preparedPayment}
    <div class="text-xl text-secondary break-all">{address}</div>

    <Amount
      amount={amount}
      rate={$rate}
      {currency}
    />

    <div class="text-center">
      <h2 class="text-secondary text-lg">{$t("payments.networkFee")}</h2>

      <div class="flex flex-col gap-2 items-center">
        {#if fees}
          <div class="flex flex-wrap gap-2 justify-center text-sm">
            <button 
              type="button"
              onclick={() => setFee(fees.hourFee || 5)}
              class="px-3 py-1 rounded {feeRate === fees.hourFee ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}"
            >
              Economy ({fees.hourFee || 5} sat/vB)
            </button>
            <button 
              type="button"
              onclick={() => setFee(fees.halfHourFee || 10)}
              class="px-3 py-1 rounded {feeRate === fees.halfHourFee ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}"
            >
              Normal ({fees.halfHourFee || 10} sat/vB)
            </button>
            <button 
              type="button"
              onclick={() => setFee(fees.fastestFee || 20)}
              class="px-3 py-1 rounded {feeRate === fees.fastestFee ? 'bg-accent text-white' : 'bg-gray-200 dark:bg-gray-700'}"
            >
              Priority ({fees.fastestFee || 20} sat/vB)
            </button>
          </div>
        {/if}
        
        <div class="flex items-center gap-2">
          <input 
            type="number" 
            bind:value={feeRate}
            onchange={() => setFee(feeRate)}
            min="1"
            max="1000"
            step="1"
            class="w-24 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center"
            placeholder="Custom"
          />
          <span class="text-sm text-secondary">sat/vB</span>
        </div>
        
        <Amount amount={fee} rate={$rate} {currency} />
      </div>
    </div>

    <div class="text-center pt-4 border-t border-white/10">
      <p class="text-sm text-secondary mb-1">Your Balance</p>
      <p class="text-xl font-bold">⚡ {s($walletBalance)} sats</p>
    </div>

    <div class="flex justify-center gap-2">
      <button
        type="button"
        class="btn btn-accent"
        onclick={executePayment}
        disabled={submitting || !preparedPayment}
      >
        {#if submitting}
          <Spinner />
        {:else}
          {$t("payments.send")}
        {/if}
      </button>
    </div>
  {/if}
</div>

<style>
  .no-transition {
    view-transition-name: fee;
  }
</style>