<script>
  import { tick, onMount } from "svelte";
  import { t } from "$lib/translations";
  import Icon from "$comp/Icon.svelte";
  import Numpad from "$comp/Numpad.svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { rate } from "$lib/store";
  import { loc, fail, s } from "$lib/utils";
  import { assetBalances, walletBalance } from "$lib/stores/wallet";
  import { ASSET_IDS } from "$lib/assets";

  let { data } = $props();

  let { user } = data;
  let { address } = $page.params;
  let { currency, username } = user;
  let locale = loc(user);

  // Get asset type from query params, make it reactive
  let asset = $state($page.url.searchParams.get("asset") || "lbtc");

  // Parse the address onMount to check if it's a BIP21 URI with embedded amount
  let parsedInput = $state(null);
  let autoAmount = $state(0);
  let isLoadingSDK = $state(true);

  onMount(async () => {
    try {
      // Wait for SDK to be ready
      const { isConnected, parseInput } = await import("$lib/walletService");

      // Poll until SDK is ready (with timeout)
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max

      while (!isConnected() && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!isConnected()) {
        console.warn('[Send Liquid] SDK not ready after timeout');
        isLoadingSDK = false;
        return;
      }

      parsedInput = await parseInput(address);

      console.log("[Send Liquid] Full parsed input:", parsedInput);
      console.log("[Send Liquid] Parsed input type:", parsedInput?.type);

      // Check if BIP21 has embedded amount
      if (parsedInput && parsedInput.type === 'liquidAddress') {
        console.log("[Send Liquid] It's a liquid address");
        console.log("[Send Liquid] Full address object:", parsedInput.address);

        const addr = parsedInput.address;

        // Try different possible amount fields
        const possibleAmount = addr?.amountSat || addr?.amount || addr?.payerAmountSat || addr?.receiverAmountSat;
        console.log("[Send Liquid] Possible amount found:", possibleAmount);

        if (possibleAmount) {
          autoAmount = typeof possibleAmount === 'number' ? possibleAmount : (possibleAmount * 100000000);
          console.log("[Send Liquid] Auto-navigating with amount:", autoAmount);

          // Auto-navigate to confirmation if amount is present
          if (autoAmount > 0) {
            goto(`/send/liquid/${address}/${autoAmount}?asset=${asset}`);
          }
        } else {
          console.log("[Send Liquid] No embedded amount found in BIP21");
        }
      }
    } catch (e) {
      console.error("[Send Liquid] Failed to parse input:", e);
    } finally {
      isLoadingSDK = false;
    }
  });

  // Get balance from wallet store based on asset type
  let balances = $derived($assetBalances || []);
  let balance = $derived(() => {
    if (asset === 'usdt') {
      const usdtBal = balances.find(b => b.assetId === ASSET_IDS.USDT);
      return usdtBal?.balanceSat || 0;
    } else {
      const lbtcBal = balances.find(b => b.assetId === ASSET_IDS.LBTC);
      return lbtcBal?.balanceSat || 0;
    }
  });

  let amount = $state(0);
  let a = $state(0);
  let submit = $state(),
    fiat = $state();
  $effect(() => ($rate = data.rate));
  $effect(() => (amount = a));

  let setMax = async (e) => {
    e.preventDefault();
    fiat = false;

    // For USDT, we need to handle the balance differently since Numpad expects
    // the amount in smallest units, but for USDT we show it as decimal
    if (asset === 'usdt') {
      // Set the amount in smallest units (same as balance)
      amount = balance();
    } else {
      amount = balance();
    }

    await tick();
    submit.click();
  };
</script>

<div class="container px-4 max-w-xl mx-auto space-y-5 text-center">
  <!-- Back Button -->
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

  <h1 class="text-3xl md:text-4xl font-semibold mb-2">
    Send via Liquid
  </h1>

  <div class="text-xl text-secondary break-all">{address}</div>

  {#if isLoadingSDK}
    <!-- Loading State -->
    <div class="flex flex-col items-center gap-4 py-12">
      <div class="loading loading-spinner loading-lg"></div>
      <p class="text-white/60">Initializing wallet...</p>
    </div>
  {:else}

  <!-- Asset Selection Buttons -->
  <div class="flex gap-3 justify-center">
    <button
      type="button"
      class="btn flex-1 max-w-xs {asset === 'lbtc' ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500' : 'btn-outline'}"
      onclick={() => asset = 'lbtc'}
    >
      <iconify-icon icon="cryptocurrency:lbtc" width="24"></iconify-icon>
      L-BTC
    </button>
    <button
      type="button"
      class="btn flex-1 max-w-xs {asset === 'usdt' ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' : 'btn-outline'}"
      onclick={() => asset = 'usdt'}
    >
      <iconify-icon icon="cryptocurrency:usdt" width="24"></iconify-icon>
      USDT
    </button>
  </div>

  {#if asset === "usdt"}
    <div class="glass border-2 border-green-400/30 rounded-xl p-4 space-y-2">
      <div class="flex items-center justify-center gap-2 text-green-400">
        <span class="text-2xl font-bold">₮</span>
        <span class="text-lg">Tether (USDT) on Liquid Network</span>
      </div>
      <p class="text-sm text-white/60">
        You are sending USDT tokens on the Liquid Network
      </p>
    </div>
  {:else}
    <div class="glass border-2 border-orange-400/30 rounded-xl p-4 space-y-2">
      <div class="flex items-center justify-center gap-2 text-orange-400">
        <iconify-icon icon="cryptocurrency:lbtc" width="24"></iconify-icon>
        <span class="text-lg">Liquid Bitcoin (L-BTC)</span>
      </div>
      <p class="text-sm text-white/60">
        You are sending L-BTC on the Liquid Network
      </p>
    </div>
  {/if}

  <Numpad
    bind:amount={a}
    bind:fiat
    {currency}
    {submit}
    bind:rate={$rate}
    {locale}
    skipBalanceCheck={true}
    isUSDT={asset === 'usdt'}
  />

  <div class="flex justify-center gap-2">
    <button
      type="button"
      class="btn !w-auto grow"
      onclick={setMax}
      onkeydown={setMax}
    >
      {#if asset === 'usdt'}
        Max {(balance() / 100000000).toFixed(2)} USDT
      {:else}
        Max ⚡️{s(balance())}
      {/if}
    </button>

    <button
      use:focus
      bind:this={submit}
      type="button"
      class="btn !w-auto grow {asset === 'usdt' ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' : 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'}"
      disabled={!amount || amount <= 0}
      onclick={() => goto(`/send/liquid/${address}/${amount}?asset=${asset}`)}
    >
      {$t("payments.next")}
    </button>
  </div>
  {/if}
</div>