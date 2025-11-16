<script>
  import { onMount } from "svelte";
  import { parseInput, prepareSendPayment, sendPayment, prepareLnurlPay, lnurlPay, fetchLightningLimits, isConnected } from "$lib/walletService";
  import { fail } from "$lib/utils";
  import { goto } from "$app/navigation";
  import Spinner from "./Spinner.svelte";
  import { t } from "$lib/translations";
  import { walletBalance } from "$lib/stores/wallet";

  let { payreq } = $props();

  let initializing = $state(true);
  let loading = $state(false);
  let parsed = $state(null);
  let error = $state("");
  let preparedPayment = $state(null);
  let isLightningAddress = $state(false);
  let amountSat = $state(1000); // Default amount for Lightning addresses
  let comment = $state("");
  let limits = $state(null);
  let minSendable = $state(0);
  let maxSendable = $state(0);

  onMount(async () => {
    if (payreq) {
      // Wait for SDK to be initialized
      await waitForSDK();
      await parsePayment();
    }
  });

  async function waitForSDK() {
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds max

    while (!isConnected() && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    if (!isConnected()) {
      error = "Wallet is still initializing. Please wait a moment and try again.";
      initializing = false;
      return false;
    }

    initializing = false;
    return true;
  }

  async function parsePayment() {
    try {
      loading = true;
      error = "";

      console.log('[SendLightning] Attempting to parse:', payreq);

      // Parse the payment request using browser SDK
      const result = await parseInput(payreq);
      parsed = result;

      console.log('[SendLightning] Parsed result:', parsed);
      console.log('[SendLightning] Parsed type:', parsed?.type);

      // Handle based on type
      if (parsed?.type === 'invoice' || parsed?.invoice) {
        // Handle regular Lightning invoice
        isLightningAddress = false;

        if (!parsed.invoice.amountMsat) {
          error = "Invoice does not specify an amount";
          loading = false;
          return;
        }

        const prepareRequest = {
          destination: parsed.invoice.bolt11,
          amount: {
            type: 'bitcoin',
            receiverAmountSat: Math.floor(parsed.invoice.amountMsat / 1000)
          }
        };

        preparedPayment = await prepareSendPayment(prepareRequest);
      } else if (parsed?.type === 'lnUrlPay' || parsed?.lnUrlPay) {
        // Handle Lightning Address / LNURL-Pay
        isLightningAddress = true;

        // Fetch network limits
        const limitsResponse = await fetchLightningLimits();
        limits = limitsResponse;

        // Get the data object - could be at parsed.data or parsed.lnUrlPay.data
        const lnUrlData = parsed.data || parsed.lnUrlPay?.data;

        // Calculate sendable range (msat to sat)
        const lnurlMinSat = Math.floor(lnUrlData.minSendable / 1000);
        const lnurlMaxSat = Math.floor(lnUrlData.maxSendable / 1000);
        const networkMinSat = Number(limitsResponse.send.minSat);
        const networkMaxSat = Number(limitsResponse.send.maxSat);

        minSendable = Math.min(Math.max(networkMinSat, lnurlMinSat), networkMaxSat);
        maxSendable = Math.max(networkMinSat, Math.min(networkMaxSat, lnurlMaxSat));

        // Set default amount to minimum
        amountSat = minSendable;

        console.log('[SendLightning] LNURL-Pay detected, amount range:', minSendable, '-', maxSendable);
        console.log('[SendLightning] LNURL data:', lnUrlData);
      } else if (parsed?.type === 'bolt12Offer' || parsed?.offer) {
        // Handle BOLT12 Offer (Lightning addresses registered with Breez return this)
        isLightningAddress = true;

        // Fetch network limits
        const limitsResponse = await fetchLightningLimits();
        limits = limitsResponse;

        const networkMinSat = Number(limitsResponse.send.minSat);
        const networkMaxSat = Number(limitsResponse.send.maxSat);

        minSendable = networkMinSat;
        maxSendable = networkMaxSat;

        // Set default amount to a reasonable value
        amountSat = Math.max(1000, networkMinSat);

        console.log('[SendLightning] BOLT12 offer detected (Lightning address), amount range:', minSendable, '-', maxSendable);
      } else {
        error = `Unsupported payment type: ${parsed?.type || 'unknown'}`;
      }
    } catch (e) {
      console.error("[SendLightning] Failed to parse payment:", e);
      console.error("[SendLightning] Input that failed:", payreq);

      // Provide more helpful error messages
      if (e.message?.includes("Unrecognized input type")) {
        error = `This lightning address could not be recognized. It may not be registered or active. Please verify the address and try again.`;
      } else if (e.message?.includes("SDK not initialized")) {
        error = "Wallet is still connecting. Please wait a moment and try again.";
      } else if (e.message?.includes("rate limit") || e.message?.includes("429") || e.message?.includes("Too Many Requests")) {
        error = "Network is experiencing high traffic. Please wait a moment and try again.";
      } else if (e.message?.includes("unreachable")) {
        error = "Network error occurred. This is often temporary - please try again in a moment.";
      } else {
        error = e.message || "Failed to parse payment request";
      }
    } finally {
      loading = false;
    }
  }

  async function prepareLightningAddressPayment() {
    if (!parsed?.lnUrlPay && !parsed?.offer) return;

    try {
      loading = true;
      error = "";

      // Validate amount
      if (amountSat < minSendable || amountSat > maxSendable) {
        error = `Amount must be between ${formatSats(minSendable)} and ${formatSats(maxSendable)} sats`;
        loading = false;
        return;
      }

      if (parsed.type === 'lnUrlPay' || parsed.lnUrlPay) {
        // Prepare LNURL payment
        const lnUrlData = parsed.data || parsed.lnUrlPay?.data;
        const prepareRequest = {
          data: lnUrlData,
          amount: {
            type: 'bitcoin',
            receiverAmountSat: BigInt(amountSat)
          },
          comment: comment || undefined,
          validateSuccessActionUrl: false
        };

        preparedPayment = await prepareLnurlPay(prepareRequest);
        console.log('[SendLightning] LNURL payment prepared:', preparedPayment);
      } else if (parsed.type === 'bolt12Offer' || parsed.offer) {
        // Prepare BOLT12 payment
        const prepareRequest = {
          destination: parsed.offer.offer,
          amount: {
            type: 'bitcoin',
            receiverAmountSat: amountSat
          }
        };

        preparedPayment = await prepareSendPayment(prepareRequest);
        console.log('[SendLightning] BOLT12 payment prepared:', preparedPayment);
      }
    } catch (e) {
      console.error("Failed to prepare payment:", e);

      // Provide helpful error messages
      if (e.message?.includes("rate limit") || e.message?.includes("429") || e.message?.includes("Too Many Requests")) {
        error = "Network is experiencing high traffic. Please wait a moment and try again.";
      } else if (e.message?.includes("unreachable")) {
        error = "Network error occurred. This is often temporary - please try again in a moment.";
      } else {
        error = e.message || "Failed to prepare payment";
      }
    } finally {
      loading = false;
    }
  }

  async function executeSend() {
    if (!preparedPayment) {
      error = "Payment not prepared";
      return;
    }

    try {
      loading = true;
      error = "";

      let result;

      if (parsed?.type === 'lnUrlPay' || parsed?.lnUrlPay) {
        // Execute LNURL payment
        const lnurlPayRequest = {
          prepareResponse: preparedPayment
        };
        result = await lnurlPay(lnurlPayRequest);
        console.log('[SendLightning] LNURL payment result:', result);

        // Navigate to success page
        if (result?.payment?.txId) {
          await goto(`/payment/${result.payment.txId}`);
        } else {
          await goto('/payments');
        }
      } else {
        // Execute regular Lightning payment or BOLT12 payment
        const sendRequest = {
          prepareResponse: preparedPayment
        };
        result = await sendPayment(sendRequest);
        console.log('[SendLightning] Payment result:', result);

        // Navigate to success page using txId or paymentHash
        const paymentId = result.payment.txId || result.payment.details?.paymentHash;
        if (paymentId) {
          await goto(`/payment/${paymentId}`);
        } else {
          await goto('/payments');
        }
      }
    } catch (e) {
      console.error("Payment failed:", e);
      error = e.message || "Payment failed";
    } finally {
      loading = false;
    }
  }

  function formatSats(sats) {
    return new Intl.NumberFormat().format(sats);
  }
</script>

<div class="container px-4 max-w-xl mx-auto text-center space-y-4">
  {#if error}
    <div class="alert alert-error">
      <span>{error}</span>
    </div>
  {/if}

  {#if initializing}
    <div class="flex flex-col items-center gap-4 py-12">
      <Spinner />
      <p class="text-white/60">Initializing wallet...</p>
    </div>
  {:else if loading && !parsed}
    <div class="flex flex-col items-center gap-4 py-12">
      <Spinner />
      <p class="text-white/60">Processing payment...</p>
    </div>
  {:else if parsed || error}
    <div class="space-y-6">
      {#if parsed}
        <div>
          <h1 class="text-2xl font-bold mb-2">
            {isLightningAddress ? 'Send to Lightning Address' : `${$t("payments.send")} Lightning Payment`}
          </h1>
          <p class="text-white/60">
            {isLightningAddress ? 'Enter amount and confirm' : 'Confirm payment details'}
          </p>
        </div>
      {:else if error}
        <div>
          <h1 class="text-2xl font-bold mb-2 text-red-400">Payment Error</h1>
          <p class="text-white/60">Unable to process this payment request</p>
        </div>
      {/if}

      {#if parsed}
        <div class="glass rounded-2xl p-6 space-y-4">
          {#if isLightningAddress}
          <!-- Lightning Address Payment -->
          <div class="text-left">
            <p class="text-sm text-white/60 mb-1">Lightning Address</p>
            <p class="break-all font-mono text-sm">{payreq}</p>
          </div>

          <div class="text-left">
            <label class="text-sm text-white/60 mb-2 block">Amount (sats)</label>
            <input
              type="number"
              bind:value={amountSat}
              min={minSendable}
              max={maxSendable}
              class="input w-full"
              onchange={prepareLightningAddressPayment}
              disabled={loading}
            />
            <p class="text-xs text-white/40 mt-1">
              Min: {formatSats(minSendable)} | Max: {formatSats(maxSendable)}
            </p>
          </div>

          {#if parsed.lnUrlPay?.data?.commentAllowed > 0}
            <div class="text-left">
              <label class="text-sm text-white/60 mb-2 block">Comment (optional)</label>
              <input
                type="text"
                bind:value={comment}
                maxlength={parsed.lnUrlPay.data.commentAllowed}
                class="input w-full"
                placeholder="Add a message..."
                disabled={loading}
              />
            </div>
          {/if}

          {#if preparedPayment?.feesSat !== undefined}
            <div class="pt-2 border-t border-white/10">
              <p class="text-sm text-white/60 mb-1">Network Fee</p>
              <p class="font-mono">⚡ {formatSats(Number(preparedPayment.feesSat))} sats</p>
            </div>
          {/if}
        {:else}
          <!-- Regular Invoice Payment -->
          {#if parsed.invoice?.amountMsat}
            <div>
              <p class="text-sm text-white/60 mb-1">Amount</p>
              <p class="text-3xl font-bold">⚡ {formatSats(Math.floor(parsed.invoice.amountMsat / 1000))}</p>
              <p class="text-sm text-white/60">sats</p>
            </div>
          {/if}

          {#if parsed.invoice?.description}
            <div class="text-left">
              <p class="text-sm text-white/60 mb-1">Description</p>
              <p class="break-words">{parsed.invoice.description}</p>
            </div>
          {/if}

          {#if preparedPayment?.feesSat}
            <div>
              <p class="text-sm text-white/60 mb-1">Network Fee</p>
              <p class="font-mono">⚡ {formatSats(preparedPayment.feesSat)} sats</p>
            </div>
          {/if}
        {/if}

          <div class="pt-4 border-t border-white/10">
            <p class="text-sm text-white/60 mb-1">Your Balance</p>
            <p class="text-xl font-bold">⚡ {formatSats($walletBalance)} sats</p>
          </div>
        </div>
      {/if}

      <div class="space-y-3">
        {#if error && !parsed}
          <!-- Show retry button when parse fails -->
          <button
            class="btn btn-primary w-full"
            onclick={parsePayment}
            disabled={loading}
          >
            {#if loading}
              <Spinner />
            {:else}
              Retry
            {/if}
          </button>
        {:else if parsed && isLightningAddress && !preparedPayment}
          <button
            class="btn btn-primary w-full"
            onclick={prepareLightningAddressPayment}
            disabled={loading || !amountSat || amountSat < minSendable || amountSat > maxSendable}
          >
            {#if loading}
              <Spinner />
            {:else}
              {error ? 'Retry' : 'Prepare Payment'}
            {/if}
          </button>
        {:else if parsed}
          <button
            class="btn btn-primary w-full"
            onclick={executeSend}
            disabled={loading || !preparedPayment}
          >
            {#if loading}
              <Spinner />
            {:else}
              Send Payment
            {/if}
          </button>
        {/if}

        <button
          class="btn btn-ghost w-full"
          onclick={() => history.back()}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </div>
  {:else}
    <div class="glass rounded-2xl p-6">
      <p class="text-white/60">Invalid payment request</p>
    </div>
  {/if}
</div>

<style>
  .input {
    @apply bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white;
    @apply focus:border-blue-400 focus:outline-none;
  }

  .btn {
    @apply px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2;
  }

  .btn-primary {
    @apply bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600;
  }

  .btn-ghost {
    @apply bg-white/5 hover:bg-white/10;
  }

  .btn:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .alert {
    @apply p-4 rounded-lg;
  }

  .alert-error {
    @apply bg-red-500/20 border border-red-500/50 text-red-400;
  }

  .glass {
    backdrop-filter: blur(12px);
  }
</style>
