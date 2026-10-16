<script>
  import { onMount } from "svelte";
  import { t } from "$lib/translations";
  import Spinner from "$comp/Spinner.svelte";
  import { page } from "$app/stores";
  import { s } from "$lib/utils";
  import { goto } from "$app/navigation";
  import { rate } from "$lib/store";
  import { walletBalance } from "$lib/stores/wallet";
  import { prepareSend, sendPayment } from "$lib/rails";

  import Amount from "$comp/Amount.svelte";

  let { data } = $props();

  // Get params from server
  let { address, amount } = $derived(data);

  // State for UI
  let loading = $state(true);
  let submitting = $state(false);
  let error = $state("");
  let preparedPayment = $state(null);

  // Spark prices all three confirmation speeds in a single prepare, so
  // changing speed is a local read — no re-prepare, no second round trip.
  // `medium` matches what Spark uses when no speed is sent, so the figure on
  // screen before the user touches anything is the one they would be charged.
  const SPEEDS = [
    { key: "slow", label: "Economy" },
    { key: "medium", label: "Normal" },
    { key: "fast", label: "Priority" },
  ];
  let selectedSpeed = $state("medium");

  // The route still carries a legacy sat/vB segment from the Liquid era.
  // Spark quotes a flat fee per speed instead of taking a rate, so the
  // parameter is ignored rather than silently applied to something it does
  // not mean.
  let onchainFees = $derived(preparedPayment?.onchainFees ?? null);
  let fee = $derived(
    onchainFees
      ? (onchainFees[selectedSpeed] ?? 0)
      : (preparedPayment?.feeSat ?? 0),
  );

  // User's currency from page store
  let currency = $derived($page.data.user?.currency || "USD");

  // Initialize on mount
  onMount(async () => {
    await prepareOnchainPayment(0);
  });

  // Prepare the onchain payment with timeout and retry
  async function prepareOnchainPayment(retryCount = 0) {
    const maxRetries = 2;
    const timeout = 15000; // 15 second timeout

    try {
      loading = true;
      error = "";

      // Prepare the send via the rail router. The router sends the Bitcoin
      // address to Spark, whose prepare returns a quote covering all three
      // confirmation speeds at once — the chosen speed is applied at send.
      const prepareTimeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Payment preparation timeout - network may be slow or rate limited",
              ),
            ),
          timeout,
        ),
      );

      preparedPayment = await Promise.race([
        prepareSend(address.trim(), amount),
        prepareTimeoutPromise,
      ]);
      console.log("Prepare response:", preparedPayment);
    } catch (e) {
      console.error("Onchain payment preparation error:", e);
      const errorMsg = e.message || "Failed to prepare payment";

      // Check if this is a retryable error (timeout, rate limit, network issue)
      const isRetryable =
        errorMsg.includes("timeout") ||
        errorMsg.includes("429") ||
        errorMsg.includes("Too Many Requests") ||
        errorMsg.includes("rate limit") ||
        errorMsg.includes("network");

      if (isRetryable && retryCount < maxRetries) {
        console.log(
          `Retrying payment preparation (${retryCount + 1}/${maxRetries})...`,
        );
        // Exponential backoff: 2s, 4s
        const backoffMs = 2000 * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
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

      // Send the onchain payment at the speed the user picked. Spark falls
      // back to medium when no speed is supplied, which is the same tier the
      // screen defaults to.
      const payment = await sendPayment(preparedPayment, selectedSpeed);
      console.log("Payment response:", payment);

      // Check if payment was successful
      if (payment?.id) {
        // Navigate to success page
        await goto(`/sent/${payment.id}`);
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
        <button type="button" class="btn btn-secondary" onclick={goBack}>
          Back
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

    <Amount {amount} rate={$rate} {currency} />

    <div class="text-center">
      <h2 class="text-secondary text-lg">{$t("payments.networkFee")}</h2>

      <div class="flex flex-col gap-2 items-center">
        {#if onchainFees}
          <div class="flex flex-wrap gap-2 justify-center text-sm">
            {#each SPEEDS as speed (speed.key)}
              <button
                type="button"
                onclick={() => (selectedSpeed = speed.key)}
                aria-pressed={selectedSpeed === speed.key}
                class="px-3 py-1 rounded {selectedSpeed === speed.key
                  ? 'bg-accent text-white'
                  : 'bg-gray-200 text-black dark:bg-gray-700 dark:text-white'}"
              >
                {speed.label} ({s(onchainFees[speed.key])} sats)
              </button>
            {/each}
          </div>
        {/if}

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
    <div class="flex items-center justify-between mb-4">
      <button
        type="button"
        class="btn btn-ghost btn-sm gap-2"
        onclick={() => window.history.back()}
      >
        <iconify-icon icon="ph:arrow-left-bold" width="20"></iconify-icon>
        Back
      </button>
      <div class="flex-1"></div>
    </div>
  {/if}
</div>

<style>
  .no-transition {
    view-transition-name: fee;
  }
</style>
