<script>
  import { btc, f, sat } from "$lib/utils";
  import { walletBalance, walletInfo, walletStore, isWalletLoading } from "$lib/stores/wallet";
  import { unitPreference } from "$lib/store";
  import { onMount } from "svelte";
  import BalancePlaceholder from "$comp/BalancePlaceholder.svelte";

  let { user, account, rate } = $props();

  // Following misty-breez pattern: check walletInfo != null for loading state
  let walletIsLoading = $derived(
    account?.browserManaged && $walletInfo === null
  );

  // Use browser SDK balance if account is browser managed, otherwise use server balance
  let balance = $derived(account?.browserManaged ? $walletBalance : (account?.balance || 0));
  let currency = $derived(user?.currency || "USD");
  let unit = $derived(currency); // Default to fiat currency display
  let isLoading = $state(false);

  // Debug logging
  $effect(() => {
    if (account?.browserManaged) {
      console.log('[Balance] State:', {
        walletInfo: $walletInfo,
        walletIsLoading,
        balance: $walletBalance
      });
    }
  });

  let displayBalance = $derived.by(() => {
    if (unit === "sats") return sat(balance);
    if (unit === "btc") return btc(balance) + ' BTC';
    // Convert sats to BTC then multiply by rate
    return f((balance / 100000000) * rate, currency);
  });

  const refreshBalance = async () => {
    if (!account?.browserManaged) return;

    isLoading = true;
    try {
      const { walletStore } = await import("$lib/stores/wallet");
      await walletStore.refresh();
    } catch (e) {
      console.error("Failed to refresh wallet balance:", e);
    } finally {
      isLoading = false;
    }
  };

  onMount(async () => {
    if (account?.browserManaged) {
      await refreshBalance();
    }
  });
</script>

<div class="glass-card relative overflow-hidden group">
  <!-- Animated gradient background -->
  <div
    class="absolute inset-0 bg-gradient-primary opacity-10 group-hover:opacity-20 transition-opacity duration-500"
  ></div>

  <!-- Floating particles effect -->
  <div class="absolute inset-0 overflow-hidden">
    <div
      class="floating absolute w-2 h-2 bg-accent rounded-full opacity-30"
      style="top: 20%; left: 10%;"
    ></div>
    <div
      class="floating absolute w-3 h-3 bg-primary rounded-full opacity-20"
      style="top: 60%; left: 80%; animation-delay: 1s;"
    ></div>
    <div
      class="floating absolute w-2 h-2 bg-secondary rounded-full opacity-25"
      style="top: 80%; left: 30%; animation-delay: 2s;"
    ></div>
  </div>

  <div class="relative z-10">
    <div class="flex items-center justify-between mb-4">
      <span class="text-sm uppercase tracking-wider opacity-70">
        {account?.name || "Balance"}
      </span>
      <div class="flex items-center gap-2">
        {#if account?.browserManaged}
          <button
            onclick={refreshBalance}
            class="btn btn-ghost btn-xs btn-circle"
            class:animate-spin={isLoading}
            disabled={isLoading}
            title="Refresh balance"
          >
            <iconify-icon icon="ph:arrow-clockwise" width="16"></iconify-icon>
          </button>
        {/if}
        {#if account?.asset === "bitcoin"}
          <div
            class="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center"
          >
            <iconify-icon
              icon="cryptocurrency:btc"
              class="text-white"
              width="20"
            ></iconify-icon>
          </div>
        {:else if account?.asset === "lightning"}
          <div
            class="w-8 h-8 rounded-full bg-gradient-accent flex items-center justify-center"
          >
            <iconify-icon icon="tabler:bolt" class="text-white" width="20"
            ></iconify-icon>
          </div>
        {/if}
      </div>
    </div>

    <div class="balance-display animate-fadeInUp">
      {#if walletIsLoading}
        <!-- Show shimmer placeholder while wallet is initializing (misty-breez pattern) -->
        <BalancePlaceholder />
      {:else if isLoading}
        <div class="flex items-center gap-2">
          <span class="loading loading-spinner loading-sm"></span>
          <span class="text-base opacity-60">Refreshing...</span>
        </div>
      {:else}
        {displayBalance()}
      {/if}
    </div>

    <div class="flex items-center gap-2 mt-4">
      <div class="text-sm opacity-60">
        {#if unit !== currency}
          ≈ {f((balance / 100000000) * rate, currency)}
        {/if}
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex gap-3 mt-6">
      <button
        class="flex-1 btn btn-sm bg-gradient-primary text-white border-0 hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
      >
        <iconify-icon icon="ph:arrow-down-bold" width="18"></iconify-icon>
        Receive
      </button>
      <button
        class="flex-1 btn btn-sm bg-gradient-accent text-white border-0 hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
      >
        <iconify-icon icon="ph:arrow-up-bold" width="18"></iconify-icon>
        Send
      </button>
    </div>
  </div>
</div>

<style>
  .balance-display {
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1.2;
  }

  @media (min-width: 640px) {
    .balance-display {
      font-size: 3rem;
    }
  }
</style>
