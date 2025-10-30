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
    class="fixed inset-0 bg-black/80 backdrop-blur-lg overflow-y-auto h-full w-full z-50 flex items-center justify-center"
  >
    <div
      class="relative mx-auto p-6 sm:p-8 w-full max-w-xl min-w-[90vw] sm:min-w-[500px] premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-dgen-aqua/40 transition-all duration-500 space-y-5 animate-scaleIn"
    >
      <!-- Modal Header -->
      <div class="text-center space-y-2 pb-4 border-b border-white/10">
        <h3 class="text-xl sm:text-2xl font-bold text-white flex items-center justify-center gap-2">
          {#if invoiceType === 'lightning'}
            <iconify-icon icon="ph:lightning-fill" class="text-yellow-400" width="28"></iconify-icon>
          {:else if invoiceType === 'bitcoin'}
            <iconify-icon icon="cryptocurrency:btc" class="text-orange-400" width="28"></iconify-icon>
          {:else if invoiceType === 'liquid'}
            {#if selectedAsset === 'usdt'}
              <iconify-icon icon="cryptocurrency:usdt" class="text-green-400" width="28"></iconify-icon>
            {:else}
              <iconify-icon icon="ph:drop-fill" class="text-blue-400" width="28"></iconify-icon>
            {/if}
          {/if}
          <span>{modalTitle()}</span>
        </h3>
        <p class="text-sm text-white/60 flex items-center justify-center gap-2">
          {#if invoiceType === 'lightning'}
            <iconify-icon icon="ph:clock-bold" width="14"></iconify-icon>
          {:else if invoiceType === 'bitcoin'}
            <iconify-icon icon="ph:hourglass-bold" width="14"></iconify-icon>
          {:else if invoiceType === 'liquid'}
            <iconify-icon icon="ph:timer-bold" width="14"></iconify-icon>
          {/if}
          <span>{minimumMessage()}</span>
        </p>
      </div>

      <form onsubmit={setAmount} class="space-y-5">
        <!-- Quick Amount Shortcuts -->
        {#if invoiceType === 'bitcoin'}
          <!-- For Bitcoin on-chain: Show only the minimum amount button -->
          <div class="space-y-2">
            <p class="text-xs text-white/50 text-center">Quick minimum amount:</p>
            <button
              type="button"
              class="glass w-full rounded-lg py-3 px-4 text-sm font-semibold hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all hover:scale-105 flex flex-col items-center gap-1"
              onclick={() => {
                // Set to minimum 0.00025 BTC = 25,000 sats
                newAmount = 25000;
              }}
            >
              <span class="text-base">0.00025 BTC</span>
              <span class="text-xs text-white/60">(click this to auto-populate the minimum amount)</span>
            </button>
          </div>
        {:else}
          <!-- For other payment types: Show quick dollar amounts -->
          <div class="space-y-2">
            <p class="text-xs text-white/50 text-center">Quick amounts:</p>
            <div class="grid grid-cols-4 gap-2">
              {#each quickAmountsDollars as dollarAmount}
                <button
                  type="button"
                  class="glass rounded-lg py-2 px-3 text-sm font-semibold hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all hover:scale-105"
                  onclick={() => {
                    // Convert dollar amount to appropriate units
                    if (invoiceType === 'liquid' && selectedAsset === 'usdt') {
                      // For USDT: $1 USD = 100000000 smallest units (10^8)
                      newAmount = Math.round(dollarAmount * 100000000);
                    } else {
                      // For Bitcoin: convert USD to sats using exchange rate
                      // dollarAmount * 100,000,000 / rate = sats
                      newAmount = Math.round((dollarAmount * 100000000) / rate);
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
        <div class="w-full flex flex-wrap gap-3">
          <button
            bind:this={submit}
            type="submit"
            onclick={setAmount}
            class="btn-gradient flex-1 hover:shadow-lg hover:shadow-dgen-cyan/30 flex items-center justify-center gap-2"
          >
            <iconify-icon icon="ph:check-bold" width="20"></iconify-icon>
            <span class="font-semibold">{t("payments.ok")}</span>
          </button>
          <button
            type="button"
            class="btn glass flex-1 hover:bg-white/10 border border-white/20 hover:border-white/40 flex items-center justify-center gap-2"
            onclick={toggleAmount}
            onkeydown={toggleAmount}
          >
            <iconify-icon icon="ph:x-bold" width="20"></iconify-icon>
            <span class="font-semibold">{t("payments.cancel")}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
