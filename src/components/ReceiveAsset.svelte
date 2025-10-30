<script>
  import { prepareReceiveAsset, receiveAsset } from "$lib/assetService";
  import { ASSET_IDS, getAssetTicker, formatAssetAmount } from "$lib/assets";
  import Qr from "./Qr.svelte";

  let { onSuccess, onCancel } = $props();

  let selectedAsset = $state(ASSET_IDS.LBTC);
  let amount = $state("");
  let description = $state("");
  let destination = $state("");
  let isGenerating = $state(false);
  let error = $state("");
  let prepareResponse = $state(null);

  const assets = [
    { id: ASSET_IDS.LBTC, name: "Bitcoin", ticker: "BTC", icon: "cryptocurrency:btc" },
    { id: ASSET_IDS.USDT, name: "Tether USD", ticker: "USDT", icon: "cryptocurrency:usdt" }
  ];

  async function generateAddress() {
    error = "";
    isGenerating = true;

    try {
      const payerAmount = amount ? parseFloat(amount) : undefined;

      prepareResponse = await prepareReceiveAsset({
        assetId: selectedAsset,
        payerAmount
      });

      const receiveResponse = await receiveAsset({
        prepareResponse,
        description,
        useDescriptionHash: false
      });

      destination = receiveResponse.destination;

      if (onSuccess) {
        onSuccess({ destination, asset: selectedAsset, amount: payerAmount });
      }
    } catch (e) {
      error = e.message || "Failed to generate receive address";
      console.error("Receive asset error:", e);
    } finally {
      isGenerating = false;
    }
  }

  function reset() {
    destination = "";
    error = "";
    amount = "";
    description = "";
    prepareResponse = null;
  }
</script>

<div class="glass-card max-w-2xl mx-auto">
  <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
    <iconify-icon icon="ph:arrow-down-bold" width="28"></iconify-icon>
    Receive Asset
  </h2>

  {#if !destination}
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
      </div>

      <!-- Amount (Optional) -->
      <div>
        <label class="label">
          <span class="label-text font-semibold">Amount (Optional)</span>
          <span class="label-text-alt">Leave empty for any amount</span>
        </label>
        <input
          type="number"
          bind:value={amount}
          placeholder="0.00"
          class="input input-bordered w-full"
          step="0.00000001"
          min="0"
        />
      </div>

      <!-- Description (Optional) -->
      <div>
        <label class="label">
          <span class="label-text font-semibold">Description (Optional)</span>
        </label>
        <input
          type="text"
          bind:value={description}
          placeholder="What's this for?"
          class="input input-bordered w-full"
        />
      </div>

      {#if error}
        <div class="alert alert-error">
          <iconify-icon icon="mdi:alert-circle" width="24"></iconify-icon>
          <span>{error}</span>
        </div>
      {/if}

      {#if prepareResponse && prepareResponse.feesSat > 0}
        <div class="alert alert-info">
          <iconify-icon icon="mdi:information" width="24"></iconify-icon>
          <span>Estimated fees: {prepareResponse.feesSat} sats</span>
        </div>
      {/if}

      <div class="flex gap-3">
        <button
          class="btn btn-primary flex-1"
          onclick={generateAddress}
          disabled={isGenerating}
        >
          {#if isGenerating}
            <span class="loading loading-spinner"></span>
          {:else}
            <iconify-icon icon="mdi:qrcode" width="24"></iconify-icon>
          {/if}
          Generate Address
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
      <div class="alert alert-success">
        <iconify-icon icon="mdi:check-circle" width="24"></iconify-icon>
        <span>Address generated successfully!</span>
      </div>

      <!-- QR Code -->
      <div class="flex justify-center">
        <Qr text={destination} width={300} />
      </div>

      <!-- Address -->
      <div>
        <label class="label">
          <span class="label-text font-semibold">Address</span>
        </label>
        <div class="flex gap-2">
          <input
            type="text"
            value={destination}
            readonly
            class="input input-bordered flex-1 font-mono text-sm"
          />
          <button
            class="btn btn-square"
            onclick={() => navigator.clipboard.writeText(destination)}
          >
            <iconify-icon icon="mdi:content-copy" width="20"></iconify-icon>
          </button>
        </div>
      </div>

      {#if amount}
        <div class="alert">
          <iconify-icon icon="mdi:information" width="24"></iconify-icon>
          <span>
            Requesting: {amount} {getAssetTicker(selectedAsset)}
          </span>
        </div>
      {/if}

      <button class="btn btn-outline w-full" onclick={reset}>
        Generate Another Address
      </button>
    </div>
  {/if}
</div>
