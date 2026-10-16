<script>
  import { onDestroy, onMount } from "svelte";
  import { parseInput, isConnected } from "$lib/walletService";
  import { prepareSend, sendPayment } from "$lib/rails";
  import { fail, loc, sats } from "$lib/utils";
  import { goto } from "$app/navigation";
  import Spinner from "./Spinner.svelte";
  import Numpad from "./Numpad.svelte";
  import { t } from "$lib/translations";
  import { walletBalance } from "$lib/stores/wallet";
  import { sendGateStore } from "$lib/sendGate";
  import { mapTxError } from "$lib/txErrors";

  let { payreq, rate = 0, currency = "USD" } = $props();

  let initializing = $state(true);
  let loading = $state(false);
  let paymentStartTime = $state(null);
  let pendingTimeoutWarning = $state(false);
  let pendingWarningTimerId = $state(null);
  let parsed = $state(null);
  let error = $state("");
  let preparedPayment = $state(null);
  let isLightningAddress = $state(false);
  let isAmountlessInvoice = $state(false);
  let amountSat = $state(1000); // Default amount for Lightning addresses

  // The amount that `preparedPayment` was actually quoted for. The Numpad
  // stays editable after Prepare, so without this a user could prepare 1,000
  // sats, change the field to 5,000, and send — the screen showing 5,000
  // while the SDK executes the 1,000-sat quote it still holds. Sending a
  // different amount than the one on screen is the worst thing a wallet can
  // do, so the prepared quote is discarded the moment the amount moves.
  let preparedForAmountSat = $state(null);
  let preparedIsStale = $derived(
    preparedForAmountSat !== null &&
      Math.trunc(amountSat) !== preparedForAmountSat,
  );

  $effect(() => {
    if (preparedIsStale) {
      preparedPayment = null;
      preparedForAmountSat = null;
    }
  });
  let comment = $state("");
  // Spark reports fees and constraints at prepare time, so these are only
  // populated when the destination itself carries a sendable range (LNURL);
  // otherwise they stay wide open and the actual bounds are enforced by
  // prepareSend/sendPayment.
  let minSendable = $state(1);
  let maxSendable = $state(Infinity);
  let gateWaiting = $derived($sendGateStore.status === "waiting");
  let lnUrlData = $derived(
    parsed?.type === "lnUrlPay" ? parsed.data : parsed?.lnUrlPay?.data,
  );
  const devLog = (...args) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  };

  onMount(async () => {
    if (payreq) {
      // Wait for SDK to be initialized
      await waitForSDK();
      await parsePayment();
    }
  });

  onDestroy(() => {
    if (pendingWarningTimerId) {
      clearTimeout(pendingWarningTimerId);
      pendingWarningTimerId = null;
    }
  });

  async function waitForSDK() {
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds max

    while (!isConnected() && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }

    if (!isConnected()) {
      error =
        "Wallet is still initializing. Please wait a moment and try again.";
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
      preparedPayment = null;
      isLightningAddress = false;
      isAmountlessInvoice = false;
      minSendable = 1;
      maxSendable = Infinity;

      devLog("[SendLightning] Attempting to parse payment input");

      // Parse the payment request using browser SDK
      const result = await parseInput(payreq);
      parsed = result;

      devLog("[SendLightning] Parsed type:", parsed?.type);

      // Handle based on type
      if (
        parsed?.type === "invoice" ||
        parsed?.type === "bolt11" ||
        parsed?.invoice
      ) {
        // Handle regular Lightning invoice
        isLightningAddress = false;

        if (!parsed.invoice.amountMsat) {
          isAmountlessInvoice = true;
          amountSat = 1000;

          devLog(
            "[SendLightning] Amountless invoice detected, awaiting amount",
          );
          loading = false;
          return;
        }

        preparedPayment = await prepareSend(
          parsed.invoice.bolt11,
          Math.floor(parsed.invoice.amountMsat / 1000),
        );
      } else if (parsed?.type === "lnUrlPay" || parsed?.lnUrlPay) {
        // Handle Lightning Address / LNURL-Pay
        isLightningAddress = true;
        isAmountlessInvoice = false;

        // Get the data object - could be at parsed.data or parsed.lnUrlPay.data
        const lnUrlData = parsed.data || parsed.lnUrlPay?.data;

        // Sendable range comes from the LNURL data itself; Spark enforces
        // its own network limits at prepare time rather than a standing
        // limits call.
        minSendable = Math.floor(lnUrlData.minSendable / 1000);
        maxSendable = Math.floor(lnUrlData.maxSendable / 1000);

        // Set default amount to minimum
        amountSat = minSendable;

        devLog(
          "[SendLightning] LNURL-Pay detected, amount range:",
          minSendable,
          "-",
          maxSendable,
        );
      } else if (parsed?.type === "bolt12Offer" || parsed?.offer) {
        // Spark parses a BOLT12 offer but cannot pay one: SendPaymentMethod
        // has no BOLT12 variant, so prepareSendPayment rejects it. Say so
        // here rather than letting the user pick an amount, press Send, and
        // meet a raw SDK error at the last step.
        error =
          "BOLT12 offers aren't supported yet. Ask the recipient for a Lightning invoice or their Lightning address instead.";
        devLog("[SendLightning] BOLT12 offer rejected — unsupported by Spark");
      } else {
        error = `Unsupported payment type: ${parsed?.type || "unknown"}`;
      }
    } catch (e) {
      console.error("[SendLightning] Failed to parse payment:", e);

      // Provide more helpful error messages
      if (e.message?.includes("Unrecognized input type")) {
        error = `This lightning address could not be recognized. It may not be registered or active. Please verify the address and try again.`;
      } else if (e.message?.includes("SDK not initialized")) {
        error =
          "Wallet is still connecting. Please wait a moment and try again.";
      } else if (
        e.message?.includes("rate limit") ||
        e.message?.includes("429") ||
        e.message?.includes("Too Many Requests")
      ) {
        error =
          "Network is experiencing high traffic. Please wait a moment and try again.";
      } else if (e.message?.includes("unreachable")) {
        error =
          "Network error occurred. This is often temporary - please try again in a moment.";
      } else {
        error = e.message || "Failed to parse payment request";
      }
    } finally {
      loading = false;
    }
  }

  async function prepareLightningAddressPayment() {
    if (
      !parsed?.lnUrlPay &&
      parsed?.type !== "lnUrlPay" &&
      !isAmountlessInvoice
    )
      return;

    try {
      loading = true;
      error = "";
      const safeAmountSat = Math.trunc(amountSat);

      // Validate amount
      if (safeAmountSat < minSendable || safeAmountSat > maxSendable) {
        error = `Amount must be between ${formatSats(minSendable)} and ${formatSats(maxSendable)} sats`;
        loading = false;
        return;
      }

      if (parsed.type === "lnUrlPay" || parsed.lnUrlPay) {
        if (!lnUrlData) {
          throw new Error("Missing LNURL pay data");
        }
        // Prepare LNURL payment. Spark's prepareSendPayment accepts a
        // Lightning address or LNURL directly as `{ type: "input" }`, so
        // the original `payreq` string is passed straight through.
        preparedPayment = await prepareSend(payreq, safeAmountSat);
        preparedForAmountSat = safeAmountSat;
        devLog("[SendLightning] LNURL payment prepared");
      } else if (isAmountlessInvoice && parsed?.invoice) {
        preparedPayment = await prepareSend(
          parsed.invoice.bolt11,
          safeAmountSat,
        );
        preparedForAmountSat = safeAmountSat;
        devLog("[SendLightning] Amountless invoice prepared");
      }
    } catch (e) {
      console.error("Failed to prepare payment:", e);

      // Provide helpful error messages
      if (
        e.message?.includes("rate limit") ||
        e.message?.includes("429") ||
        e.message?.includes("Too Many Requests")
      ) {
        error =
          "Network is experiencing high traffic. Please wait a moment and try again.";
      } else if (e.message?.includes("unreachable")) {
        error =
          "Network error occurred. This is often temporary - please try again in a moment.";
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
      paymentStartTime = Date.now();
      pendingTimeoutWarning = false;
      // Start timeout check for pending payment
      if (pendingWarningTimerId) {
        clearTimeout(pendingWarningTimerId);
      }
      pendingWarningTimerId = setTimeout(
        () => {
          if (
            loading &&
            paymentStartTime &&
            Date.now() - paymentStartTime > 5 * 60 * 1000
          ) {
            pendingTimeoutWarning = true;
          }
        },
        5 * 60 * 1000,
      );

      let result;

      if (parsed?.type === "lnUrlPay" || parsed?.lnUrlPay) {
        // Execute LNURL payment
        result = await sendPayment(preparedPayment);
        devLog("[SendLightning] LNURL payment sent");

        // Navigate to success page
        if (result?.id) {
          await goto(`/payment/${result.id}`);
        } else {
          await goto("/payments");
        }
      } else {
        // Execute regular Lightning payment
        result = await sendPayment(preparedPayment);
        devLog("[SendLightning] Lightning payment sent");

        // Navigate to success page
        if (result?.id) {
          await goto(`/payment/${result.id}`);
        } else {
          await goto("/payments");
        }
      }
    } catch (e) {
      console.error("Payment failed:", e);
      const message = e instanceof Error ? e.message : String(e || "");
      error = mapTxError(message, "Payment failed");
    } finally {
      loading = false;
      if (pendingWarningTimerId) {
        clearTimeout(pendingWarningTimerId);
        pendingWarningTimerId = null;
      }
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
  {#if gateWaiting}
    <div class="alert alert-info">
      <span>Waiting for previous transaction to propagate…</span>
    </div>
  {/if}
  {#if pendingTimeoutWarning}
    <div class="alert alert-error">
      <span
        >Warning: Payment has been pending for more than 5 minutes. You may
        retry or cancel.</span
      >
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
            {isLightningAddress
              ? "Send to Lightning Address"
              : isAmountlessInvoice
                ? "Set Amount for Invoice"
                : `${$t("payments.send")} Lightning Payment`}
          </h1>
          <p class="text-white/60">
            {isLightningAddress || isAmountlessInvoice
              ? "Enter amount and confirm"
              : "Confirm payment details"}
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
              <Numpad
                bind:amount={amountSat}
                {rate}
                {currency}
                skipBalanceCheck={true}
              />
              <p class="text-xs text-white/40 mt-2 text-center">
                Min: {formatSats(minSendable)} | Max: {formatSats(maxSendable)}
              </p>
            </div>

            {#if lnUrlData?.commentAllowed > 0}
              <div class="text-left">
                <label class="text-sm text-white/60 mb-2 block"
                  >Comment (optional)</label
                >
                <input
                  type="text"
                  bind:value={comment}
                  maxlength={lnUrlData.commentAllowed}
                  class="input w-full"
                  placeholder="Add a message..."
                  disabled={loading}
                />
              </div>
            {/if}

            {#if preparedPayment?.feeSat !== undefined}
              <div class="pt-2 border-t border-white/10">
                <p class="text-sm text-white/60 mb-1">Network Fee</p>
                <p class="font-mono">
                  ⚡ {formatSats(Number(preparedPayment.feeSat))} sats
                </p>
              </div>
            {/if}
          {:else if isAmountlessInvoice}
            <!-- Amountless Invoice Payment -->
            <div class="text-left">
              <p class="text-sm text-white/60 mb-1">Invoice</p>
              <p class="break-all font-mono text-sm">{payreq}</p>
            </div>

            <div class="text-left">
              <Numpad
                bind:amount={amountSat}
                {rate}
                {currency}
                skipBalanceCheck={true}
              />
              <p class="text-xs text-white/40 mt-2 text-center">
                Min: {formatSats(minSendable)} | Max: {formatSats(maxSendable)}
              </p>
            </div>

            {#if parsed.invoice?.description}
              <div class="text-left">
                <p class="text-sm text-white/60 mb-1">Description</p>
                <p class="break-words">{parsed.invoice.description}</p>
              </div>
            {/if}
          {:else}
            <!-- Regular Invoice Payment -->
            {#if parsed.invoice?.amountMsat}
              <div>
                <p class="text-sm text-white/60 mb-1">Amount</p>
                <p class="text-3xl font-bold">
                  ⚡ {formatSats(Math.floor(parsed.invoice.amountMsat / 1000))}
                </p>
                <p class="text-sm text-white/60">sats</p>
              </div>
            {/if}

            {#if parsed.invoice?.description}
              <div class="text-left">
                <p class="text-sm text-white/60 mb-1">Description</p>
                <p class="break-words">{parsed.invoice.description}</p>
              </div>
            {/if}

            {#if preparedPayment?.feeSat}
              <div>
                <p class="text-sm text-white/60 mb-1">Network Fee</p>
                <p class="font-mono">
                  ⚡ {formatSats(preparedPayment.feeSat)} sats
                </p>
              </div>
            {/if}
          {/if}

          <div class="pt-4 border-t border-white/10">
            <p class="text-sm text-white/60 mb-1">Your Balance</p>
            <p class="text-xl font-bold">
              ⚡ {formatSats($walletBalance)} sats
            </p>
          </div>
        </div>
      {/if}

      <div class="space-y-3">
        {#if parsed && (isLightningAddress || isAmountlessInvoice) && !preparedPayment}
          <button
            class="btn btn-primary w-full"
            onclick={prepareLightningAddressPayment}
            disabled={loading ||
              !amountSat ||
              amountSat < minSendable ||
              amountSat > maxSendable}
          >
            {#if loading}
              <Spinner />
            {:else}
              Prepare Payment
            {/if}
          </button>
        {:else if parsed}
          <button
            class="btn btn-primary w-full"
            onclick={executeSend}
            disabled={loading || !preparedPayment || gateWaiting}
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
  .alert-info {
    @apply bg-blue-500/20 border border-blue-500/50 text-blue-200;
  }

  .glass {
    backdrop-filter: blur(12px);
  }
</style>
