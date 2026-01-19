<script>
  import { onMount } from "svelte";
  import { t } from "$lib/translations";
  import { fail, success } from "$lib/utils";
  import {
    isConnected,
    parseInput,
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
  let isAddressValid = $state(false);
  let isValidatingAddress = $state(false);
  let addressError = $state("");
  let feeRate = $state(0);
  let fees = $state(null);
  let feeOptionResponses = $state({});
  let feeOptionLoading = $state({});
  let feeOptionErrors = $state({});
  let lastFeeAddress = $state("");
  let showConfirm = $state(false);
  let preparedRefund = $state(null);
  let refundBroadcasted = $state(false);
  let refundTxId = $state("");

  const absoluteAmount = $derived(Math.abs(amountSat || 0));
  const normalFee = $derived(fees?.halfHourFee ?? fees?.hourFee ?? null);
  let addressValidationToken = 0;

  const feeKey = (rate) => String(rate);

  onMount(async () => {
    try {
      fees = await recommendedFees();
      const defaultFee =
        fees?.halfHourFee ??
        fees?.hourFee ??
        fees?.economyFee ??
        fees?.fastestFee;
      if (typeof defaultFee === "number") {
        feeRate = defaultFee;
      }
    } catch (error) {
      console.error("Failed to get recommended fees:", error);
      fees = null;
      feeRate = 0;
    }
  });

  const getFeeResponse = (rate) => {
    if (!rate) return null;
    const key = feeKey(rate);
    if (feeOptionResponses[key]) {
      return feeOptionResponses[key];
    }
    if (preparedRefund && rate === feeRate) {
      return preparedRefund;
    }
    return null;
  };

  const estimatedFee = () => {
    const response = getFeeResponse(feeRate);
    return response?.txFeeSat ?? null;
  };

  const feeOptions = $derived.by(() => {
    if (!fees) return [];
    return [
      { label: $t("payments.feeSlow") || "Slow", rate: fees.economyFee },
      { label: $t("payments.feeNormal") || "Normal", rate: normalFee },
      { label: $t("payments.feeFast") || "Fast", rate: fees.fastestFee },
    ].filter((option) => Number.isFinite(option.rate));
  });

  const feeOptionsReady = $derived.by(() => {
    if (!isAddressValid || feeOptions.length === 0) return false;
    return feeOptions.every((option) => {
      const key = feeKey(option.rate);
      return feeOptionResponses[key] || feeOptionErrors[key];
    });
  });

  const affordableFeeOptions = $derived.by(() => {
    if (!feeOptionsReady) return [];
    return feeOptions.filter((option) => isFeeAffordable(option.rate));
  });

  const isFeeAffordable = (rate) => {
    if (!rate) return false;
    const response = getFeeResponse(rate);
    if (!response) return false;
    return absoluteAmount >= response.txFeeSat;
  };

  const isRefundAmountValid = () => {
    return feeRate > 0 && isFeeAffordable(feeRate);
  };

  const validateRefundAddress = async (address) => {
    const trimmed = address.trim();
    if (!trimmed) {
      isAddressValid = false;
      addressError = "";
      return;
    }

    const token = (addressValidationToken += 1);
    isValidatingAddress = true;

    try {
      if (!isConnected()) {
        if (token !== addressValidationToken) return;
        isAddressValid = false;
        addressError = "Wallet SDK not connected";
        return;
      }

      const parsed = await parseInput(trimmed);
      if (token !== addressValidationToken) return;
      isAddressValid = parsed?.type === "bitcoinAddress";
      addressError = isAddressValid ? "" : "Enter a valid Bitcoin address";
    } catch (error) {
      if (token !== addressValidationToken) return;
      isAddressValid = false;
      addressError = "Enter a valid Bitcoin address";
    } finally {
      if (token === addressValidationToken) {
        isValidatingAddress = false;
      }
    }
  };

  $effect(() => {
    validateRefundAddress(refundAddress);
  });

  $effect(() => {
    if (refundAddress !== lastFeeAddress) {
      lastFeeAddress = refundAddress;
      feeOptionResponses = {};
      feeOptionLoading = {};
      feeOptionErrors = {};
    }
  });

  const loadFeeOption = async (rate) => {
    if (!rate || !swapAddress || !isAddressValid) return;
    const key = feeKey(rate);
    if (feeOptionResponses[key] || feeOptionLoading[key]) return;

    feeOptionLoading = { ...feeOptionLoading, [key]: true };

    try {
      const response = await prepareRefund({
        swapAddress,
        refundAddress: refundAddress.trim(),
        feeRateSatPerVbyte: rate,
      });
      feeOptionResponses = { ...feeOptionResponses, [key]: response };
    } catch (error) {
      feeOptionErrors = {
        ...feeOptionErrors,
        [key]: error?.message || "Failed to estimate fee",
      };
    } finally {
      feeOptionLoading = { ...feeOptionLoading, [key]: false };
    }
  };

  $effect(() => {
    if (!isAddressValid || !fees) return;
    feeOptions.forEach((option) => {
      loadFeeOption(option.rate);
    });
  });

  $effect(() => {
    if (!feeOptionsReady) return;
    if (affordableFeeOptions.length === 0) {
      feeRate = 0;
      return;
    }
    const selected = affordableFeeOptions.some(
      (option) => option.rate === feeRate,
    );
    if (!selected) {
      const mid =
        affordableFeeOptions[Math.floor(affordableFeeOptions.length / 2)];
      if (mid?.rate !== undefined) {
        feeRate = mid.rate;
      }
    }
  });

  async function prepare() {
    if (!swapAddress) {
      fail("Swap address not found for this refund.");
      return;
    }

    if (!refundAddress || !isAddressValid) {
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
      refundBroadcasted = true;
      refundTxId = result?.refundTxId || "";
    } catch (error) {
      fail(error?.message || "Failed to process refund");
    } finally {
      loading = false;
    }
  }

  function setFeeRate(rate) {
    if (rate === null || rate === undefined) return;
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
              {#if !isAddressValid}
                <div class="text-sm text-secondary">
                  Enter a valid address to load fee options.
                </div>
              {:else if !feeOptionsReady}
                <div class="text-sm text-secondary">
                  Calculating fee options…
                </div>
              {:else if affordableFeeOptions.length === 0}
                <div class="text-sm text-warning">
                  No affordable fee options available.
                </div>
              {:else}
                <div class="grid grid-cols-3 gap-2 mb-2">
                  {#each affordableFeeOptions as option}
                    <button
                      class="btn btn-sm {feeRate === option.rate
                        ? 'btn-primary'
                        : 'btn-outline'}"
                      onclick={() => setFeeRate(option.rate)}
                    >
                      {option.label}<br />
                      {option.rate} sat/vb
                    </button>
                  {/each}
                </div>
              {/if}
            {/if}

            <div class="text-sm text-secondary mt-1">
              {#if estimatedFee()}
                Estimated fee: {estimatedFee()} sats
              {:else if feeRate}
                Calculating fee…
              {:else}
                Select a fee option to continue.
              {/if}
            </div>
          </div>

          {#if refundAddress && !isAddressValid}
            <div class="text-xs text-warning mt-2">
              {addressError || "Enter a valid Bitcoin address"}
            </div>
          {/if}
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
            disabled={loading ||
              isValidatingAddress ||
              !isAddressValid ||
              !isRefundAmountValid()}
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
            {#if estimatedFee()}
              <div>{estimatedFee()} sats ({feeRate} sat/vbyte)</div>
            {:else}
              <div>Calculating fee…</div>
            {/if}
          </div>

          <div>
            <div class="text-sm text-secondary">
              {$t("payments.youWillReceive") || "You will receive"}
            </div>
            <div class="text-xl font-bold">
              {#if estimatedFee()}
                {Math.max(absoluteAmount - estimatedFee(), 0).toLocaleString()} sats
              {:else}
                --
              {/if}
            </div>
          </div>

          {#if refundBroadcasted}
            <div class="alert alert-success">
              <iconify-icon icon="ph:check-circle" width="24"></iconify-icon>
              <div class="text-sm">
                <div>
                  {"Refund broadcast"}
                </div>
                {#if refundTxId}
                  <div class="font-mono break-all">{refundTxId}</div>
                {:else}
                  <div class="text-secondary">Transaction ID unavailable.</div>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <div class="card-actions justify-end mt-6">
          {#if refundBroadcasted}
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
              disabled={loading ||
                isValidatingAddress ||
                !isAddressValid ||
                !isRefundAmountValid()}
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
