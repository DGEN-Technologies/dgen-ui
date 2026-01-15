<script>
  import { onMount } from "svelte";
  import { t } from "$lib/translations";
  import { fail, success } from "$lib/utils";
  import {
    prepareRefund,
    recommendedFees,
    refundSwap,
  } from "$lib/walletService";
  import { refundablesStore } from "$lib/stores/refundables";

  let {
    swapAddress,
    amountSat,
    lastRefundTxId = "",
    onSuccess = null,
    onCancel = null,
  } = $props();

  let loading = $state(false);
  let refundAddress = $state("");
  let feeRate = $state(1);
  let fees = $state(null);
  let showConfirm = $state(false);
  let preparedRefund = $state(null);
  let refundTxId = $state("");

  const absoluteAmount = $derived(Math.abs(amountSat || 0));

  onMount(async () => {
    try {
      fees = await recommendedFees();
      if (fees?.economyFee) {
        feeRate = fees.economyFee;
      } else if (fees?.hourFee) {
        feeRate = fees.hourFee;
      }
    } catch (error) {
      console.error("Failed to get recommended fees:", error);
      fees = {
        economyFee: 1,
        hourFee: 3,
        fastestFee: 5,
      };
      feeRate = 1;
    }
  });

  const estimatedFee = () => {
    if (preparedRefund?.txFeeSat) {
      return preparedRefund.txFeeSat;
    }
    return Math.round(feeRate * 200);
  };

  async function prepare() {
    if (!swapAddress) {
      fail("Swap address not found for this refund.");
      return;
    }

    if (!refundAddress) {
      fail(
        $t("payments.refundAddressRequired") ||
          "Please enter a Bitcoin address",
      );
      return;
    }

    loading = true;
    try {
      preparedRefund = await prepareRefund({
        swapAddress,
        refundAddress,
        feeRateSatPerVbyte: feeRate,
      });
      showConfirm = true;
    } catch (error) {
      fail(error?.message || "Failed to prepare refund");
    } finally {
      loading = false;
    }
  }

  async function confirmRefund() {
    loading = true;
    try {
      const result = await refundSwap({
        swapAddress,
        refundAddress,
        feeRateSatPerVbyte: feeRate,
      });

      success(
        $t("payments.refundSuccess") ||
          "Refund transaction broadcast successfully!",
      );
      refundablesStore.refresh();
      refundTxId = result?.refundTxId || "";
    } catch (error) {
      fail(error?.message || "Failed to process refund");
    } finally {
      loading = false;
    }
  }

  function setFeeRate(rate) {
    feeRate = rate;
    preparedRefund = null;
  }

  function handleDone() {
    if (typeof onSuccess === "function") {
      onSuccess({ refundTxId });
    }
  }
</script>

<div class="container mx-auto max-w-lg px-4 space-y-6">
  <h1 class="text-3xl font-semibold text-center mb-8">
    {$t("payments.refund") || "Refund Payment"}
  </h1>

  {#if !showConfirm}
    <div class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title">
          {$t("payments.refundDetails") || "Refund Details"}
        </h2>

        <div class="space-y-4">
          <div>
            <label class="label">
              <span class="label-text">{$t("payments.amount") || "Amount"}</span
              >
            </label>
            <div class="text-2xl font-bold">
              {absoluteAmount.toLocaleString()} sats
            </div>
          </div>

          {#if lastRefundTxId}
            <div class="text-sm text-secondary break-all">
              Last refund attempt: {lastRefundTxId}
            </div>
          {/if}

          <div>
            <label class="label">
              <span class="label-text"
                >{$t("payments.refundTo") || "Refund to Bitcoin address"}</span
              >
            </label>
            <input
              type="text"
              bind:value={refundAddress}
              placeholder="bc1q..."
              class="input input-bordered w-full"
              disabled={loading}
            />
          </div>

          <div>
            <label class="label">
              <span class="label-text"
                >{$t("payments.feeRate") || "Network Fee Rate"} (sat/vbyte)</span
              >
            </label>

            {#if fees}
              <div class="grid grid-cols-3 gap-2 mb-2">
                <button
                  class="btn btn-sm {feeRate === fees.economyFee
                    ? 'btn-primary'
                    : 'btn-outline'}"
                  onclick={() => setFeeRate(fees.economyFee)}
                >
                  {$t("payments.feeSlow") || "Slow"}<br />
                  {fees.economyFee} sat/vb
                </button>
                <button
                  class="btn btn-sm {feeRate === fees.hourFee
                    ? 'btn-primary'
                    : 'btn-outline'}"
                  onclick={() => setFeeRate(fees.hourFee)}
                >
                  {$t("payments.feeNormal") || "Normal"}<br />
                  {fees.hourFee} sat/vb
                </button>
                <button
                  class="btn btn-sm {feeRate === fees.fastestFee
                    ? 'btn-primary'
                    : 'btn-outline'}"
                  onclick={() => setFeeRate(fees.fastestFee)}
                >
                  {$t("payments.feeFast") || "Fast"}<br />
                  {fees.fastestFee} sat/vb
                </button>
              </div>
            {/if}

            <input
              type="number"
              bind:value={feeRate}
              min="1"
              max="500"
              class="input input-bordered w-full"
              disabled={loading}
            />
            <div class="text-sm text-secondary mt-1">
              Estimated fee: ~{estimatedFee()} sats
            </div>
          </div>
        </div>

        <div class="card-actions justify-end mt-6">
          {#if onCancel}
            <button class="btn btn-ghost" onclick={onCancel} disabled={loading}>
              {$t("common.cancel") || "Cancel"}
            </button>
          {/if}
          <button
            class="btn btn-primary"
            onclick={prepare}
            disabled={loading || !refundAddress}
          >
            {#if loading}
              <span class="loading loading-spinner"></span>
            {/if}
            {$t("common.continue") || "Continue"}
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title">
          {$t("payments.confirmRefund") || "Confirm Refund"}
        </h2>

        <div class="space-y-4">
          <div class="alert alert-info">
            <iconify-icon icon="ph:info" width="24"></iconify-icon>
            <span>
              {$t("payments.refundWarning") ||
                "Please verify the refund address is correct. This transaction cannot be reversed."}
            </span>
          </div>

          <div>
            <div class="text-sm text-secondary">
              {$t("payments.refundTo") || "Refund to"}
            </div>
            <div class="font-mono text-sm break-all">{refundAddress}</div>
          </div>

          <div>
            <div class="text-sm text-secondary">
              {$t("payments.amount") || "Amount"}
            </div>
            <div class="text-xl font-bold">
              {absoluteAmount.toLocaleString()} sats
            </div>
          </div>

          <div>
            <div class="text-sm text-secondary">
              {$t("payments.networkFee") || "Network Fee"}
            </div>
            <div>~{estimatedFee()} sats ({feeRate} sat/vbyte)</div>
          </div>

          <div>
            <div class="text-sm text-secondary">
              {$t("payments.youWillReceive") || "You will receive"}
            </div>
            <div class="text-xl font-bold">
              ~{Math.max(absoluteAmount - estimatedFee(), 0).toLocaleString()} sats
            </div>
          </div>

          {#if refundTxId}
            <div class="alert alert-success">
              <iconify-icon icon="ph:check-circle" width="24"></iconify-icon>
              <div class="text-sm">
                <div>
                  {$t("payments.refundBroadcast") || "Refund broadcast"}
                </div>
                <div class="font-mono break-all">{refundTxId}</div>
              </div>
            </div>
          {/if}
        </div>

        <div class="card-actions justify-end mt-6">
          {#if refundTxId}
            <button
              class="btn btn-primary"
              onclick={handleDone}
              disabled={loading}
            >
              Done
            </button>
          {:else}
            <button
              class="btn btn-ghost"
              onclick={() => (showConfirm = false)}
              disabled={loading}
            >
              {$t("common.back") || "Back"}
            </button>
            <button
              class="btn btn-primary"
              onclick={confirmRefund}
              disabled={loading}
            >
              {#if loading}
                <span class="loading loading-spinner"></span>
              {/if}
              {$t("payments.confirmRefund") || "Confirm Refund"}
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
