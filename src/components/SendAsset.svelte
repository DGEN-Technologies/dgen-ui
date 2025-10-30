<script>
  import { prepareSendAsset, sendAsset } from "$lib/assetService";
  import { ASSET_IDS, getAssetTicker, formatAssetAmount, supportsAssetFees } from "$lib/assets";
  import { assetBalances } from "$lib/stores/wallet";

  let { onSuccess, onCancel } = $props();

  let selectedAsset = $state(ASSET_IDS.LBTC);
  let destination = $state("");
  let amount = $state("");
  let payerNote = $state("");
  let estimateAssetFees = $state(false);
  let useAssetFees = $state(false);
  let isPreparingPayment = $state(false);
  let isSending = $state(false);
  let error = $state("");
  let prepareResponse = $state(null);
  let fromAsset = $state("");

  const assets = [
    { id: ASSET_IDS.LBTC, name: "Bitcoin", ticker: "BTC", icon: "cryptocurrency:btc" },
    { id: ASSET_IDS.USDT, name: "Tether USD", ticker: "USDT", icon: "cryptocurrency:usdt" }
  ];

  let balances = $derived($assetBalances);
  let selectedAssetBalance = $derived(
    balances.find(b => b.assetId === selectedAsset)?.balanceSat || 0
  );

  $effect(() => {
    // Update estimateAssetFees when asset changes
    if (supportsAssetFees(selectedAsset)) {
      estimateAssetFees = true;
    } else {
      estimateAssetFees = false;
      useAssetFees = false;
    }
  });

  async function preparePayment() {
    error = "";
    isPreparingPayment = true;
    prepareResponse = null;

    try {
      const receiverAmount = parseFloat(amount);
      if (!receiverAmount || receiverAmount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      if (!destination) {
        throw new Error("Please enter a destination address");
      }

      prepareResponse = await prepareSendAsset({
        destination,
        toAsset: selectedAsset,
        receiverAmount,
        estimateAssetFees,
        fromAsset: fromAsset || undefined
      });

      // If asset fees are available and not already set, enable them
      if (prepareResponse.estimatedAssetFees && !useAssetFees) {
        useAssetFees = true;
      }
    } catch (e) {
      error = e.message || "Failed to prepare payment";
      console.error("Prepare payment error:", e);
    } finally {
      isPreparingPayment = false;
    }
  }

  async function confirmSend() {
    if (!prepareResponse) return;

    error = "";
    isSending = true;

    try {
      const result = await sendAsset({
        prepareResponse,
        useAssetFees,
        payerNote
      });

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (e) {
      error = e.message || "Failed to send payment";
      console.error("Send payment error:", e);
    } finally {
      isSending = false;
    }
  }

  function reset() {
    prepareResponse = null;
    error = "";
  }
</script>

<div class="glass-card max-w-2xl mx-auto">
  <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
    <iconify-icon icon="ph:arrow-up-bold" width="28"></iconify-icon>
    Send Asset
  </h2>

  {#if !prepareResponse}
    <div class="space-y-6">
      <!-- Asset Selection -->
      <div>
        <label class="label">
          <span class="label-text font-semibold">Select Asset</span>
        </label>
        <div class="grid grid-cols-2 gap-3">
          {#each assets as asset}
            <button
              class="btn btn-outline {selectedAsset === asset.id ? 'btn-primary' : ''}"
              onclick={() => selectedAsset = asset.id}
            >
              <iconify-icon icon={asset.icon} width="24"></iconify-icon>
              {asset.ticker}
            </button>
          {/each}
        </div>
        <div class="text-sm opacity-60 mt-2">
          Available: {formatAssetAmount(selectedAssetBalance, selectedAsset)}
        </div>
      </div>

      <!-- Destination Address -->
      <div>
        <label class="label">
          <span class="label-text font-semibold">Destination Address</span>
        </label>
        <input
          type="text"
          bind:value={destination}
          placeholder="Liquid address or BIP21 URI"
          class="input input-bordered w-full font-mono text-sm"
        />
      </div>

      <!-- Amount -->
      <div>
        <label class="label">
          <span class="label-text font-semibold">Amount</span>
        </label>
        <div class="join w-full">
          <input
            type="number"
            bind:value={amount}
            placeholder="0.00"
            class="input input-bordered join-item flex-1"
            step="0.00000001"
            min="0"
          />
          <button class="btn join-item" disabled>
            {getAssetTicker(selectedAsset)}
          </button>
        </div>
      </div>

      <!-- From Asset (for swapping) -->
      <div>
        <label class="label">
          <span class="label-text font-semibold">Pay From Asset (Optional)</span>
          <span class="label-text-alt">Leave empty to use same asset</span>
        </label>
        <select bind:value={fromAsset} class="select select-bordered w-full">
          <option value="">Same as destination asset</option>
          {#each balances as balance}
            {#if balance.assetId !== selectedAsset}
              <option value={balance.assetId}>
                {balance.ticker || balance.name} - {formatAssetAmount(balance.balanceSat, balance.assetId)}
              </option>
            {/if}
          {/each}
        </select>
      </div>

      <!-- Payer Note (Optional) -->
      <div>
        <label class="label">
          <span class="label-text font-semibold">Note (Optional)</span>
        </label>
        <input
          type="text"
          bind:value={payerNote}
          placeholder="Add a note for your records"
          class="input input-bordered w-full"
        />
      </div>

      {#if supportsAssetFees(selectedAsset)}
        <div class="form-control">
          <label class="label cursor-pointer">
            <span class="label-text">Estimate fees in asset currency</span>
            <input type="checkbox" bind:checked={estimateAssetFees} class="checkbox" />
          </label>
        </div>
      {/if}

      {#if error}
        <div class="alert alert-error">
          <iconify-icon icon="mdi:alert-circle" width="24"></iconify-icon>
          <span>{error}</span>
        </div>
      {/if}

      <div class="flex gap-3">
        <button
          class="btn btn-primary flex-1"
          onclick={preparePayment}
          disabled={isPreparingPayment || !destination || !amount}
        >
          {#if isPreparingPayment}
            <span class="loading loading-spinner"></span>
          {:else}
            <iconify-icon icon="mdi:arrow-right" width="24"></iconify-icon>
          {/if}
          Continue
        </button>
        {#if onCancel}
          <button class="btn btn-ghost" onclick={onCancel}>
            Cancel
          </button>
        {/if}
      </div>
    </div>
  {:else}
    <div class="space-y-6">
      <div class="alert alert-info">
        <iconify-icon icon="mdi:information" width="24"></iconify-icon>
        <span>Review your payment details</span>
      </div>

      <!-- Payment Summary -->
      <div class="bg-base-200 rounded-lg p-4 space-y-3">
        <div class="flex justify-between">
          <span class="opacity-60">Asset:</span>
          <span class="font-semibold">{getAssetTicker(selectedAsset)}</span>
        </div>
        <div class="flex justify-between">
          <span class="opacity-60">Amount:</span>
          <span class="font-semibold">{amount} {getAssetTicker(selectedAsset)}</span>
        </div>
        {#if prepareResponse.feesSat}
          <div class="flex justify-between">
            <span class="opacity-60">Network Fees:</span>
            <span class="font-semibold">{prepareResponse.feesSat} sats</span>
          </div>
        {/if}
        {#if prepareResponse.estimatedAssetFees}
          <div class="flex justify-between">
            <span class="opacity-60">Asset Fees:</span>
            <span class="font-semibold">~{prepareResponse.estimatedAssetFees} {getAssetTicker(selectedAsset)}</span>
          </div>
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">Pay fees in {getAssetTicker(selectedAsset)}</span>
              <input type="checkbox" bind:checked={useAssetFees} class="checkbox" />
            </label>
          </div>
        {/if}
        {#if prepareResponse.exchangeAmountSat}
          <div class="flex justify-between">
            <span class="opacity-60">Exchange Amount:</span>
            <span class="font-semibold">{prepareResponse.exchangeAmountSat} sats</span>
          </div>
        {/if}
        <div class="divider my-2"></div>
        <div class="flex justify-between text-sm">
          <span class="opacity-60">Destination:</span>
          <span class="font-mono text-xs break-all">{destination.slice(0, 20)}...{destination.slice(-20)}</span>
        </div>
      </div>

      {#if error}
        <div class="alert alert-error">
          <iconify-icon icon="mdi:alert-circle" width="24"></iconify-icon>
          <span>{error}</span>
        </div>
      {/if}

      <div class="flex gap-3">
        <button class="btn btn-ghost flex-1" onclick={reset}>
          Back
        </button>
        <button
          class="btn btn-primary flex-1"
          onclick={confirmSend}
          disabled={isSending}
        >
          {#if isSending}
            <span class="loading loading-spinner"></span>
          {:else}
            <iconify-icon icon="mdi:send" width="24"></iconify-icon>
          {/if}
          Send Payment
        </button>
      </div>
    </div>
  {/if}
</div>
