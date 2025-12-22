<script>
  import { t } from "$lib/translations";
  import { s, sat } from "$lib/utils";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import {
    prepareSendPayment,
    sendPayment,
    parseInput,
  } from "$lib/walletService";
  import { ASSET_IDS } from "$lib/assets";
  import { onMount } from "svelte";

  let { data } = $props();
  let { user } = data;

  // Get params from URL
  let address = $page.params.address;
  let amount = $page.params.amount;
  let asset = $page.url.searchParams.get("asset") || "lbtc";

  let loading = $state(false);
  let preparing = $state(true);
  let error = $state(null);
  let prepareResponse = $state(null);
  let parsedDestination = $state(null);

  // Parse and prepare on mount - following misty-breez pattern
  onMount(async () => {
    try {
      const timeout = 15000; // 15 second timeout

      // Step 1: Parse the input to validate and get details
      console.log("Parsing destination:", address);

      const parseTimeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Request timeout - network may be slow or rate limited",
              ),
            ),
          timeout,
        ),
      );

      parsedDestination = await Promise.race([
        parseInput(address),
        parseTimeoutPromise,
      ]);
      console.log("Parsed destination:", parsedDestination);

      // Step 2: Prepare the send payment (get fees, validate)
      const amountSat = parseInt(amount);

      // Determine payment type based on parsed input
      if (parsedDestination.type === "liquidAddress") {
        // Liquid address send - check asset type
        let prepareRequest;

        if (asset === "usdt") {
          // Sending USDT
          const usdtAssetId =
            "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2";
          prepareRequest = {
            destination: address,
            amount: {
              type: "asset",
              toAsset: usdtAssetId,
              receiverAmount: amountSat / 100000000, // Convert from smallest unit to USDT amount
              estimateAssetFees: true, // Estimate fees in USDT
            },
          };
        } else {
          // Sending LBTC (default)
          prepareRequest = {
            destination: address,
            amount: {
              type: "bitcoin", // For LBTC
              receiverAmountSat: amountSat,
            },
          };
        }

        console.log("Preparing Liquid send:", prepareRequest);

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

        prepareResponse = await Promise.race([
          prepareSendPayment(prepareRequest),
          prepareTimeoutPromise,
        ]);
        console.log("Prepare response:", prepareResponse);

        if (prepareResponse.feesSat) {
          console.log("Estimated fees:", prepareResponse.feesSat, "sats");
        }
      } else {
        error = `Invalid destination type: ${parsedDestination.type}. Expected liquidAddress.`;
      }
    } catch (e) {
      console.error("Failed to prepare payment:", e);
      error =
        e.message || "Failed to prepare payment. Please try again in a moment.";
    } finally {
      preparing = false;
    }
  });

  let send = async () => {
    if (!prepareResponse) {
      error = "Payment not prepared";
      return;
    }

    loading = true;
    error = null;

    try {
      // Step 3: Execute the send payment
      // For USDT, use asset fees if available
      const useAssetFees =
        asset === "usdt" && prepareResponse.estimatedAssetFees ? true : false;

      const sendRequest = {
        prepareResponse,
        useAssetFees,
      };

      console.log("Sending payment...", { useAssetFees });
      const sendResponse = await sendPayment(sendRequest);
      console.log("Payment sent:", sendResponse);

      if (sendResponse.payment) {
        // Success - redirect to payment details or home
        const paymentId = sendResponse.payment.id || sendResponse.payment.txId;
        if (paymentId) {
          goto(`/payment/${paymentId}`);
        } else {
          goto(`/`); // Navigate to home on success
        }
      } else {
        error = "Failed to send payment";
      }
    } catch (e) {
      console.error("Send payment error:", e);
      error = e.message || "Failed to send transaction";
    } finally {
      loading = false;
    }
  };

  let cancel = () => {
    goto("/send");
  };
</script>

<div class="container px-4 max-w-xl mx-auto space-y-5 text-center">
  <h1 class="text-3xl md:text-4xl font-semibold mb-2">
    Confirm {asset === "usdt" ? "USDT" : "L-BTC"} Send
  </h1>

  {#if preparing}
    <div class="glass border-2 border-white/20 rounded-xl p-6 space-y-4">
      <div class="flex items-center justify-center gap-3">
        <span class="loading loading-spinner loading-lg"></span>
        <span class="text-lg">Preparing payment...</span>
      </div>
    </div>
  {:else}
    <div class="glass border-2 border-white/20 rounded-xl p-6 space-y-4">
      <div class="space-y-2">
        <p class="text-sm text-white/60">Sending to</p>
        <p class="text-lg break-all font-mono">{address}</p>
      </div>

      <div class="divider my-2"></div>

      <div class="space-y-2">
        <p class="text-sm text-white/60">Amount</p>
        <div class="text-3xl font-bold">
          {#if asset === "usdt"}
            <span class="text-green-400">
              <span class="text-2xl">₮</span>
              {(parseInt(amount) / 100000000).toFixed(2)} USDT
            </span>
          {:else}
            <span class="text-cyan-400">
              <iconify-icon icon="cryptocurrency:lbtc" width="32"
              ></iconify-icon>
              {s(amount)}
            </span>
          {/if}
        </div>
      </div>

      {#if prepareResponse?.feesSat || prepareResponse?.estimatedAssetFees}
        <div class="divider my-2"></div>
        <div class="space-y-2">
          <p class="text-sm text-white/60">Network Fee</p>
          {#if prepareResponse.estimatedAssetFees}
            <div class="text-xl font-semibold text-green-400">
              ~{prepareResponse.estimatedAssetFees} USDT
            </div>
          {:else}
            <div class="text-xl font-semibold text-orange-400">
              {sat(prepareResponse.feesSat)}
            </div>
          {/if}
        </div>

        <div class="divider my-2"></div>
        <div class="space-y-2 bg-base-200 rounded-lg p-3">
          <p class="text-sm text-white/60">Total Amount</p>
          {#if asset === "usdt"}
            <div class="text-2xl font-bold text-primary">
              ₮ {(
                (parseInt(amount) +
                  (prepareResponse.estimatedAssetFees
                    ? Math.floor(prepareResponse.estimatedAssetFees * 100000000)
                    : prepareResponse.feesSat)) /
                100000000
              ).toFixed(2)} USDT
            </div>
            <p class="text-xs text-white/40">
              {(parseInt(amount) / 100000000).toFixed(2)} USDT + {prepareResponse.estimatedAssetFees
                ? `~${prepareResponse.estimatedAssetFees} USDT`
                : `${(prepareResponse.feesSat / 100000000).toFixed(2)} USDT`} fee
            </p>
          {:else}
            <div class="text-2xl font-bold text-primary">
              {sat(parseInt(amount) + prepareResponse.feesSat)}
            </div>
            <p class="text-xs text-white/40">
              {sat(amount)} + {sat(prepareResponse.feesSat)} fee
            </p>
          {/if}
        </div>
      {/if}

      {#if asset === "usdt"}
        <div
          class="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mt-4"
        >
          <p class="text-sm text-green-400">
            Sending USDT (Tether) on Liquid Network
          </p>
        </div>
      {:else}
        <div
          class="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mt-4"
        >
          <p class="text-sm text-cyan-400">Sending L-BTC on Liquid Network</p>
        </div>
      {/if}
    </div>
  {/if}

  {#if error}
    <div class="alert alert-error">
      <iconify-icon icon="mdi:alert-circle" width="24"></iconify-icon>
      <span>{error}</span>
    </div>
    <div class="flex gap-3">
      <button type="button" class="btn flex-1" onclick={cancel}> Back </button>
      <button
        type="button"
        class="btn flex-1 btn-accent"
        onclick={() => window.location.reload()}
      >
        Retry
      </button>
    </div>
  {:else}
    <div class="flex gap-3">
      <button
        type="button"
        class="btn flex-1"
        onclick={cancel}
        disabled={loading || preparing}
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn flex-1 {asset === 'usdt'
          ? 'bg-green-500 hover:bg-green-600'
          : 'btn-accent'}"
        onclick={send}
        disabled={loading || preparing || !prepareResponse}
      >
        {#if loading}
          <span class="loading loading-spinner"></span>
          Sending...
        {:else}
          Send {asset === "usdt" ? "USDT" : "L-BTC"}
        {/if}
      </button>
    </div>
  {/if}
</div>
