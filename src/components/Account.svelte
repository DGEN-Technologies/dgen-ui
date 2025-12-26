<script>
  import { scale, fade, fly } from "svelte/transition";
  import { btc, f, sat } from "$lib/utils";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import BalancePlaceholder from "./BalancePlaceholder.svelte";
  import {
    walletBalance,
    walletInfo,
    transactions,
    assetBalances,
    walletStore,
  } from "$lib/stores/wallet";
  import { ASSET_IDS, formatAssetAmount, getAssetTicker } from "$lib/assets";
  import { unitPreference } from "$lib/store";

  let {
    user,
    rate,
    account,
    last = false,
    showBuyBitcoin = $bindable(false),
  } = $props();
  // Following misty-breez pattern: balance comes from SDK, component handles loading state
  let balance = $derived($walletBalance);
  // Show placeholder until initial sync completes
  // This prevents showing 0.0 balance before sync finishes
  let isWalletLoading = $derived(!$walletStore?.didCompleteInitialSync);
  let currency = $derived(user?.currency || "USD");
  let unit = $state(currency); // Default to fiat currency display
  let isHovered = $state(false);
  let mounted = $state(false);

  // Get individual asset balances
  let balances = $derived($assetBalances || []);
  let lbtcBalance = $derived(
    balances.find((b) => b.assetId === ASSET_IDS.LBTC)?.balanceSat || 0,
  );
  let usdtBalance = $derived(
    balances.find((b) => b.assetId === ASSET_IDS.USDT)?.balanceSat || 0,
  );

  // Use the SDK's total balance directly
  // The SDK already calculates the total balance across all assets
  let totalBalance = $derived(balance);

  let refreshing = $state(false);

  async function refreshBalance(e) {
    e.preventDefault();
    e.stopPropagation();
    if (refreshing) return;

    refreshing = true;
    try {
      // await walletStore.refresh();
      // small UX delay to let the user see the animation
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (e) {
      console.error(e);
    } finally {
      refreshing = false;
    }
  }

  onMount(() => {
    mounted = true;
  });

  let displayBalance = $derived(() => {
    const displayTotal = totalBalance;
    if (unit === "btc") return btc(displayTotal);
    if (unit === "sats") return sat(displayTotal);
    // Convert sats to BTC then multiply by rate
    return f((displayTotal / 100000000) * rate, currency);
  });

  let assetIcon = $derived(() => {
    switch (account?.asset) {
      case "bitcoin":
        return "cryptocurrency:btc";
      case "lightning":
        return "tabler:bolt";
      case "liquid":
        return "cryptocurrency:lbtc";
      // case "ecash": // Ecash disabled
      //   return "ph:coins-bold";
      default:
        return "ph:wallet-bold";
    }
  });

  let assetColors = $derived(() => {
    switch (account?.asset) {
      case "bitcoin":
        return {
          gradient: "from-orange-400 to-yellow-500",
          glow: "shadow-orange-500/50",
          border: "border-orange-500/20 hover:border-orange-500/60",
          text: "text-orange-400",
        };
      case "lightning":
        return {
          gradient: "from-dgen-aqua to-dgen-cyan",
          glow: "shadow-dgen-aqua/50",
          border: "border-dgen-aqua/20 hover:border-dgen-aqua/60",
          text: "text-dgen-aqua",
        };
      case "liquid":
        return {
          gradient: "from-blue-400 to-cyan-500",
          glow: "shadow-blue-500/50",
          border: "border-blue-500/20 hover:border-blue-500/60",
          text: "text-blue-400",
        };
      default:
        return {
          gradient: "from-slate-600 to-slate-700",
          glow: "shadow-slate-500/50",
          border: "border-slate-500/20 hover:border-slate-500/60",
          text: "text-slate-400",
        };
    }
  });
</script>

{#if mounted}
  <div
    class="premium-card group border-2 {assetColors()
      .border} relative overflow-visible transition-all duration-500"
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
    in:fly={{ y: 20, duration: 500, delay: 100 }}
  >
    <!-- Animated gradient background -->
    <div
      class="absolute inset-0 bg-gradient-to-br {assetColors()
        .gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-500"
    ></div>

    <!-- Floating particles on hover -->
    {#if isHovered}
      {#each Array(5) as _, i}
        <div
          class="absolute w-1 h-1 bg-white rounded-full opacity-50 animate-float"
          style="left: {20 + i * 15}%; top: {Math.random() *
            100}%; animation-delay: {i * 0.2}s; animation-duration: {2 +
            Math.random()}s"
          in:fade={{ duration: 300 }}
        ></div>
      {/each}
    {/if}

    <!-- Refresh Button -->
    <button
      class="absolute z-10 top-6 right-6 size-10 flex items-center justify-center rounded-full text-white/20 hover:text-white hover:bg-white/10 transition-all duration-300"
      onclick={refreshBalance}
      title="Refresh Balance"
    >
      <iconify-icon
        icon="ph:arrow-clockwise"
        width="20"
        height="20"
        class={refreshing ? "animate-spin" : ""}
      ></iconify-icon>
    </button>

    <div class="relative z-10">
      <!-- Centered Balance Display -->
      <div class="text-center mb-8 mt-4">
        <div class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">
          {#if isWalletLoading}
            <!-- Show shimmer placeholder while wallet is loading (misty-breez pattern) -->
            <BalancePlaceholder />
          {:else if isHovered}
            <span class="hover-balance-glow" in:fade={{ duration: 300 }}>
              {displayBalance()}
            </span>
          {:else}
            <span class="gradient-text">
              {displayBalance()}
            </span>
          {/if}
        </div>

        <!-- Beautiful Toggle for Fiat/BTC/Sats (3 options) -->
        <div class="flex items-center justify-center mt-4">
          <div
            class="relative bg-black/30 backdrop-blur-xl rounded-full p-1.5 border border-white/10"
          >
            <div
              class="absolute top-1.5 bottom-1.5 bg-gradient-to-r {unit ===
              currency
                ? 'from-green-400 to-emerald-500'
                : unit === 'btc'
                  ? 'from-orange-400 to-yellow-500'
                  : 'from-dgen-aqua to-dgen-cyan'} rounded-full transition-all duration-300"
              style="width: calc(33.333% - 4px); left: {unit === currency
                ? '6px'
                : unit === 'btc'
                  ? 'calc(33.333% + 2px)'
                  : 'calc(66.666% - 2px)'};"
            ></div>
            <div class="relative flex gap-1">
              <button
                class="w-14 h-12 sm:px-5 sm:w-auto rounded-full font-semibold transition-all duration-300 relative z-10 {unit ===
                currency
                  ? 'text-white'
                  : 'text-white/60 hover:text-white/80'} flex items-center justify-center"
                onclick={(e) => {
                  e.stopPropagation();
                  unit = currency;
                }}
              >
                <div class="flex items-center justify-center gap-1.5">
                  <span class="text-lg sm:text-xl">$</span>
                  <span class="hidden sm:inline text-sm whitespace-nowrap"
                    >{currency}</span
                  >
                </div>
              </button>
              <button
                class="w-14 h-12 sm:px-5 sm:w-auto rounded-full font-semibold transition-all duration-300 relative z-10 {unit ===
                'btc'
                  ? 'text-white'
                  : 'text-white/60 hover:text-white/80'} flex items-center justify-center"
                onclick={(e) => {
                  e.stopPropagation();
                  unit = "btc";
                }}
              >
                <div class="flex items-center justify-center gap-1.5">
                  <iconify-icon
                    icon="cryptocurrency:btc"
                    class={unit === "btc" ? "text-white" : "text-orange-400"}
                    width="18"
                    height="18"
                    style="min-width: 18px;"
                  ></iconify-icon>
                  <span class="hidden sm:inline text-sm whitespace-nowrap"
                    >BTC</span
                  >
                </div>
              </button>
              <button
                class="w-14 h-12 sm:px-5 sm:w-auto rounded-full font-semibold transition-all duration-300 relative z-10 {unit ===
                'sats'
                  ? 'text-white'
                  : 'text-white/60 hover:text-white/80'} flex items-center justify-center"
                onclick={(e) => {
                  e.stopPropagation();
                  unit = "sats";
                }}
              >
                <div class="flex items-center justify-center gap-1.5">
                  <iconify-icon
                    icon="ph:lightning-fill"
                    class={unit === "sats" ? "text-white" : "text-dgen-aqua"}
                    width="18"
                    height="18"
                    style="min-width: 18px;"
                  ></iconify-icon>
                  <span class="hidden sm:inline text-sm whitespace-nowrap"
                    >sats</span
                  >
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions with liquid effect -->
      <div class="flex justify-center gap-3 mt-6 pt-6 border-t border-white/10">
        <button
          class="glass rounded-xl py-4 sm:py-3 px-3 sm:px-2 font-bold hover:bg-white/10 transition-all duration-300 hover:scale-105 border border-white/20 hover:border-white/40 min-w-0 flex-1 max-w-[150px]"
          onclick={(e) => {
            e.stopPropagation();
            goto(`/${user.username}/receive`);
          }}
        >
          <span
            class="flex flex-col items-center justify-center gap-1.5 sm:gap-1"
          >
            <iconify-icon
              icon="ph:arrow-down-bold"
              width="22"
              class="flex-shrink-0"
            ></iconify-icon>
            <span class="text-xs sm:text-xs truncate w-full hidden sm:block"
              >Receive</span
            >
          </span>
        </button>
        <button
          class="glass rounded-xl py-4 sm:py-3 px-3 sm:px-2 font-bold hover:bg-white/10 transition-all duration-300 hover:scale-105 border border-white/20 hover:border-white/40 min-w-0 flex-1 max-w-[150px]"
          onclick={(e) => {
            e.stopPropagation();
            goto("/send");
          }}
        >
          <span
            class="flex flex-col items-center justify-center gap-1.5 sm:gap-1"
          >
            <iconify-icon
              icon="ph:paper-plane-bold"
              width="22"
              class="flex-shrink-0"
            ></iconify-icon>
            <span class="text-xs sm:text-xs truncate w-full hidden sm:block"
              >Send</span
            >
          </span>
        </button>
        <!-- Buy Bitcoin button commented out -->
        <!-- <button
          class="glass rounded-xl py-4 sm:py-3 px-3 sm:px-2 font-bold hover:bg-white/10 transition-all duration-300 hover:scale-105 border border-white/20 hover:border-white/40 min-w-0 flex-1 max-w-[150px]"
          onclick={(e) => {
            e.stopPropagation();
            showBuyBitcoin = true;
          }}
        >
          <span class="flex flex-col items-center justify-center gap-1.5 sm:gap-1">
            <iconify-icon icon="cryptocurrency:btc" width="22" class="flex-shrink-0"></iconify-icon>
            <span class="text-xs sm:text-xs truncate w-full hidden sm:block">Buy</span>
          </span>
        </button> -->
        <button
          class="glass rounded-xl py-4 sm:py-3 px-3 sm:px-2 font-bold hover:bg-white/10 transition-all duration-300 hover:scale-105 border border-white/20 hover:border-white/40 min-w-0 flex-1 max-w-[150px]"
          onclick={(e) => {
            e.stopPropagation();
            goto("/scan");
          }}
        >
          <span
            class="flex flex-col items-center justify-center gap-1.5 sm:gap-1"
          >
            <iconify-icon icon="ph:scan-bold" width="22" class="flex-shrink-0"
            ></iconify-icon>
            <span class="text-xs sm:text-xs truncate w-full hidden sm:block"
              >Scan</span
            >
          </span>
        </button>
      </div>

      <!-- Asset Details - Flattened for better mobile -->
      <div class="mt-6 pt-6 border-t border-white/10">
        <p class="text-xs opacity-60 mb-4 px-1">Assets</p>

        {#if lbtcBalance > 0 || usdtBalance > 0}
          <div class="space-y-3">
            <!-- Bitcoin Balance -->
            <div class="flex items-center justify-between gap-3 px-1">
              <div class="flex items-center gap-2 min-w-0 flex-shrink">
                <div
                  class="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0"
                >
                  <iconify-icon
                    icon="cryptocurrency:btc"
                    class="text-orange-400"
                    width="16"
                  ></iconify-icon>
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold truncate">BTC</p>
                  <p class="text-xs opacity-60 truncate">Bitcoin</p>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <p class="font-bold text-orange-400 text-sm sm:text-base">
                  {unit === "btc"
                    ? btc(lbtcBalance)
                    : unit === "sats"
                      ? sat(lbtcBalance)
                      : f((lbtcBalance / 100000000) * rate, currency)}
                </p>
                {#if unit === currency}
                  <p class="text-xs opacity-60">{sat(lbtcBalance)}</p>
                {:else}
                  <p class="text-xs opacity-60 truncate">
                    {f((lbtcBalance / 100000000) * rate, currency)}
                  </p>
                {/if}
              </div>
            </div>

            <!-- USDT Balance -->
            <div class="flex items-center justify-between gap-3 px-1">
              <div class="flex items-center gap-2 min-w-0 flex-shrink">
                <div
                  class="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0"
                >
                  <iconify-icon
                    icon="cryptocurrency:usdt"
                    class="text-green-400"
                    width="16"
                  ></iconify-icon>
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold truncate">USDT</p>
                  <p class="text-xs opacity-60 truncate">Tether USD</p>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <p class="font-bold text-green-400 text-sm sm:text-base">
                  {#if unit === "btc"}
                    {(() => {
                      const usdtInUSD = usdtBalance / 100000000;
                      const usdtInBTC = usdtInUSD / rate;
                      return btc(Math.floor(usdtInBTC * 100000000));
                    })()}
                  {:else if unit === "sats"}
                    {(() => {
                      const usdtInUSD = usdtBalance / 100000000;
                      const usdtInBTC = usdtInUSD / rate;
                      return sat(Math.floor(usdtInBTC * 100000000));
                    })()}
                  {:else}
                    ${(usdtBalance / 100000000).toFixed(2)}
                  {/if}
                </p>
                <p class="text-xs opacity-60 truncate">
                  {(usdtBalance / 100000000).toFixed(2)} USDT
                </p>
              </div>
            </div>

            <!-- Total Line -->
            <div class="pt-3 mt-3 border-t border-white/10">
              <div class="flex items-center justify-between px-1">
                <p class="text-sm font-semibold opacity-80">Total Balance</p>
                <p class="font-bold text-base sm:text-lg gradient-text">
                  {displayBalance()}
                </p>
              </div>
            </div>
          </div>
        {:else}
          <p class="text-sm opacity-60 px-1">No assets yet</p>
        {/if}

        <!-- Pending Transactions -->
        {#if $walletInfo?.walletInfo?.pendingReceiveSat || $walletInfo?.walletInfo?.pendingSendSat}
          <div class="mt-4 pt-3 border-t border-dgen-aqua/30">
            {#if $walletInfo.walletInfo.pendingReceiveSat > 0}
              <div class="flex justify-between items-center mb-2 px-1">
                <span class="text-xs sm:text-sm opacity-60"
                  >Pending Receive</span
                >
                <span class="text-green-400 font-bold animate-pulse text-sm">
                  +{sat($walletInfo.walletInfo.pendingReceiveSat)}
                </span>
              </div>
            {/if}
            {#if $walletInfo.walletInfo.pendingSendSat > 0}
              <div class="flex justify-between items-center px-1">
                <span class="text-xs sm:text-sm opacity-60">Pending Send</span>
                <span class="text-dgen-aqua font-bold animate-pulse text-sm">
                  -{sat($walletInfo.walletInfo.pendingSendSat)}
                </span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Corner decoration -->
    <div class="absolute -top-1 -right-1">
      <div
        class="w-20 h-20 bg-gradient-to-br {assetColors()
          .gradient} opacity-10 rounded-full blur-2xl"
      ></div>
    </div>
  </div>
{/if}

<style>
  @keyframes float {
    0%,
    100% {
      transform: translateY(0) translateX(0);
    }
    33% {
      transform: translateY(-10px) translateX(5px);
    }
    66% {
      transform: translateY(5px) translateX(-5px);
    }
  }

  .hover-balance-glow {
    background: linear-gradient(
      45deg,
      #74ebd5 0%,
      #5fe5d0 20%,
      #6aeec7 40%,
      #a0f4e8 60%,
      #5fe5d0 80%,
      #74ebd5 100%
    );
    background-size: 200% 200%;
    animation: glow-shift 3s ease-in-out infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: brightness(1.2);
  }

  @keyframes glow-shift {
    0%,
    100% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
  }
</style>
