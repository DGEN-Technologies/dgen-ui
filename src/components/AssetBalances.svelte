<script>
  import { assetBalances } from "$lib/stores/wallet";
  import { formatAssetAmount, getAssetTicker } from "$lib/assets";
  import { onMount } from "svelte";

  let isLoading = $state(false);
  let balances = $derived($assetBalances);

  onMount(async () => {
    isLoading = true;
    try {
      const { walletStore } = await import("$lib/stores/wallet");
      await walletStore.refresh();
    } catch (e) {
      console.error("Failed to refresh asset balances:", e);
    } finally {
      isLoading = false;
    }
  });
</script>

{#if balances.length > 0}
  <div class="glass-card">
    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
      <iconify-icon icon="mdi:wallet-outline" width="24"></iconify-icon>
      Asset Balances
    </h3>

    {#if isLoading}
      <div class="flex items-center justify-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {:else}
      <div class="space-y-3">
        {#each balances as assetBalance}
          <div class="asset-item">
            <div class="flex items-center justify-between p-4 rounded-lg bg-base-200/50 hover:bg-base-200 transition-colors">
              <div class="flex items-center gap-3">
                {#if getAssetTicker(assetBalance.assetId) === 'BTC'}
                  <div class="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                    <iconify-icon icon="cryptocurrency:btc" class="text-white" width="24"></iconify-icon>
                  </div>
                {:else if getAssetTicker(assetBalance.assetId) === 'USDT'}
                  <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <iconify-icon icon="cryptocurrency:usdt" class="text-green-500" width="24"></iconify-icon>
                  </div>
                {:else}
                  <div class="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center">
                    <iconify-icon icon="mdi:coin" width="24"></iconify-icon>
                  </div>
                {/if}
                <div>
                  <div class="font-semibold">
                    {assetBalance.name || 'Unknown Asset'}
                  </div>
                  <div class="text-sm opacity-60">
                    {assetBalance.ticker || 'N/A'}
                  </div>
                </div>
              </div>
              <div class="text-right">
                <div class="font-bold text-lg">
                  {formatAssetAmount(assetBalance.balanceSat, assetBalance.assetId, false)}
                </div>
                <div class="text-sm opacity-60">
                  {assetBalance.ticker || ''}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .asset-item {
    animation: fadeInUp 0.3s ease-out forwards;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
