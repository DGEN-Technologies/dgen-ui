<script>
  import Numpad from "$comp/Numpad.svelte";
  import { sat } from "$lib/utils";

  let submit = $state();

  let {
    currency = $bindable("USD"),
    fiat = $bindable(true),
    locale = $bindable("en-US"),
    rate = $bindable(0),
    settingAmount,
    setAmount,
    newAmount = $bindable(0),
    toggleAmount,
    t,
    invoiceType,
    selectedAsset,
    onchainLimits,
    lightningLimits,
  } = $props();

  // Determine what message to show based on payment type
  let minimumMessage = $derived(() => {
    if (invoiceType === 'lightning') {
      if (lightningLimits) {
        const min = sat(lightningLimits.receive.minSat);
        const max = sat(lightningLimits.receive.maxSat);
        return `Min: ${min} • Max: ${max} • Instant`;
      }
      return 'Minimum: 100 sats • Instant settlement';
    } else if (invoiceType === 'bitcoin') {
      if (onchainLimits) {
        const min = sat(onchainLimits.receive.minSat);
        const max = sat(onchainLimits.receive.maxSat);
        return `Min: ${min} • Max: ${max} • Settles in ~10-60+ min`;
      }
      return 'Minimum BTC deposit is 0.00025 BTC (25,000 Sats) • Settles in ~10-60+ min';
    } else if (invoiceType === 'liquid') {
      if (selectedAsset === 'usdt') {
        return 'Enter USDT amount (e.g., 10 for $10)';
      } else {
        return 'Liquid Bitcoin • Settles in ~2 min';
      }
    }
    return 'Enter the amount to receive';
  });

  let modalTitle = $derived(() => {
    if (invoiceType === 'lightning') {
      return 'Lightning Invoice Amount';
    } else if (invoiceType === 'bitcoin') {
      return 'Bitcoin On-Chain Amount';
    } else if (invoiceType === 'liquid') {
      if (selectedAsset === 'usdt') {
        return 'Liquid USDT Amount';
      } else {
        return 'Liquid Bitcoin Amount';
      }
    }
    return 'Set Amount';
  });

  // Quick amount shortcuts - always $5, $25, $50, $100
  // These are USD dollar values that get converted to sats/USDT units
  let quickAmountsDollars = [5, 25, 50, 100];
</script>

{#if settingAmount}
  <div
    class="fixed inset-0 bg-black/80 backdrop-blur-lg z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden"
  >
    <div
      class="relative w-full max-w-xl max-h-[100vh] flex flex-col premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-dgen-aqua/40 transition-all duration-500 animate-scaleIn rounded-lg"
    >
      <!-- Scrollable content area -->
      <div class="overflow-y-auto flex-1 p-4 sm:p-8">
        <div class="space-y-4">
        <!-- Modal Header -->
        <div class="text-center space-y-1 pb-4 border-b border-white/10">
          <h3 class="text-lg sm:text-2xl font-bold text-white flex items-center justify-center gap-2 flex-wrap">
          {#if invoiceType === 'lightning'}
            <iconify-icon icon="ph:lightning-fill" class="text-yellow-400" width="24"></iconify-icon>
          {:else if invoiceType === 'bitcoin'}
            <iconify-icon icon="cryptocurrency:btc" class="text-orange-400" width="24"></iconify-icon>
          {:else if invoiceType === 'liquid'}
            {#if selectedAsset === 'usdt'}
              <iconify-icon icon="cryptocurrency:usdt" class="text-green-400" width="24"></iconify-icon>
            {:else}
              <iconify-icon icon="ph:drop-fill" class="text-blue-400" width="24"></iconify-icon>
            {/if}
          {/if}
          <span class="truncate">{modalTitle()}</span>
        </h3>
        <p class="text-xs sm:text-sm text-white/60 flex items-center justify-center gap-1 flex-wrap">
          {#if invoiceType === 'lightning'}
            <iconify-icon icon="ph:clock-bold" width="12"></iconify-icon>
          {:else if invoiceType === 'bitcoin'}
            <iconify-icon icon="ph:hourglass-bold" width="12"></iconify-icon>
          {:else if invoiceType === 'liquid'}
            <iconify-icon icon="ph:timer-bold" width="12"></iconify-icon>
          {/if}
          <span class="truncate">{minimumMessage()}</span>
        </p>
      </div>

      <!-- Quick Amount Shortcuts -->
      {#if invoiceType === 'bitcoin'}
        <!-- For Bitcoin on-chain: Show only the minimum amount button -->
        <div class="space-y-2">
          <p class="text-xs text-white/50 text-center px-2">Quick minimum amount:</p>
          <button
            type="button"
            class="glass w-full rounded-lg py-3 px-3 text-sm sm:text-base font-semibold hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all hover:scale-105 flex flex-col items-center justify-center gap-1"
            onclick={() => {
              // Set to minimum 0.00025 BTC = 25,000 sats
              newAmount = 25000;
            }}
          >
            <span>0.00025 BTC</span>
            <span class="text-xs text-white/60">(auto-populate minimum)</span>
          </button>
        </div>
      {:else}
        <!-- For other payment types: Show quick dollar amounts -->
        <div class="space-y-2">
          <p class="text-xs text-white/50 text-center px-2">Quick amounts:</p>
          <div class="grid grid-cols-4 gap-2">
            {#each quickAmountsDollars as dollarAmount}
              <button
                type="button"
                class="glass rounded-lg py-3 px-2 text-sm font-semibold hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all hover:scale-105 flex items-center justify-center aspect-square"
                title="${dollarAmount}"
                onclick={() => {
                  // Convert dollar amount to appropriate units
                  if (invoiceType === 'liquid' && selectedAsset === 'usdt') {
                    // For USDT: $1 USD = 100000000 smallest units (10^8)
                    newAmount = Math.round(dollarAmount * 100000000);
                  } else {
                    // For Bitcoin: convert USD to sats using exchange rate
                    // dollarAmount * 100,000,000 / rate = sats
                    let calculatedSats = Math.round((dollarAmount * 100000000) / rate);

                    // For Bitcoin on-chain, enforce minimum of 25,000 sats
                    if (invoiceType === 'bitcoin') {
                      newAmount = Math.max(calculatedSats, 25000);
                    } else {
                      newAmount = calculatedSats;
                    }
                  }
                }}
              >
                ${dollarAmount}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <Numpad
        bind:amount={newAmount}
        bind:fiat
        {currency}
        {rate}
        {submit}
        {locale}
        skipBalanceCheck={true}
        isUSDT={invoiceType === 'liquid' && selectedAsset === 'usdt'}
      />
        </div>
      </div>

      <!-- Fixed button area at bottom -->
      <div class="flex-shrink-0 p-4 sm:p-6 border-t border-white/10 flex flex-col gap-2 sm:flex-row sm:gap-3 sm:items-center">
        <button
          bind:this={submit}
          type="submit"
          onclick={setAmount}
          class="flex-1 btn btn-gradient hover:shadow-lg hover:shadow-dgen-cyan/30 flex items-center justify-center gap-2 sm:gap-3"
        >
          <iconify-icon icon="ph:check-bold" width="20"></iconify-icon>
          <span class="font-semibold">{t("payments.ok")}</span>
        </button>
        <button
          type="button"
          class="rounded-lg px-4 py-2 font-semibold text-sm glass hover:bg-white/10 border border-white/20 hover:border-white/40 flex items-center justify-center gap-1 transition-all"
          onclick={toggleAmount}
          onkeydown={toggleAmount}
        >
          <iconify-icon icon="ph:x-bold" width="16"></iconify-icon>
          <span>{t("payments.cancel")}</span>
        </button>
      </div>
    </div>
  </div>
{/if}
