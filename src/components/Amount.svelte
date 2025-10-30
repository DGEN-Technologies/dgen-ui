<script>
  import { copy, s, f, btc } from "$lib/utils";
  import { fiat, unitPreference } from "$lib/store";
  import { types } from "$lib/utils";

  const {
    align,
    amount,
    locale,
    tip,
    rate,
    currency,
    locked = false,
    selectedAsset = 'lbtc',
    invoiceType,
    showAllUnits = false, // When true, show BTC + sats + fiat all at once (for success screens)
  } = $props();

  const isUSDT = $derived(invoiceType === types.liquid && selectedAsset === 'usdt');
  const icon = $derived(locked ? "ph:lock-fill" : isUSDT ? "cryptocurrency:usdt" : $unitPreference === 'btc' ? "cryptocurrency:btc" : "ph:lightning-fill");
  const iconColor = $derived(isUSDT ? "text-green-400" : $unitPreference === 'btc' ? "text-orange-400" : "text-yellow-300");

  // Convert satoshis/smallest units to fiat value
  const toFiat = (sats, exchangeRate) => {
    if (!exchangeRate) return 0;
    if (isUSDT) {
      // For USDT: amount is in smallest units, divide by 10^8 to get USDT (which equals USD)
      return sats / 100000000; // 1:1 with USD
    }
    return (sats / 100000000) * exchangeRate; // Convert sats to BTC then to fiat
  };

  // Format the primary display amount
  const displayAmount = $derived(() => {
    if (isUSDT) {
      // For USDT, show USDT amount (not satoshis)
      return (amount / 100000000).toFixed(2) + ' USDT';
    }
    // Show BTC or sats based on user preference
    if ($unitPreference === 'btc') {
      return btc(amount) + ' BTC';
    }
    return s(amount, locale); // Show satoshis
  });
</script>

{#if typeof amount !== "undefined"}
  <div>
    {#if showAllUnits && !isUSDT}
      <!-- Success screen: Show BTC + sats + fiat all together -->
      <div class="space-y-3">
        <!-- BTC Amount -->
        <h2
          class="text-2xl md:text-3xl font-semibold flex items-center gap-1 cursor-copy"
          class:justify-center={align !== "left"}
          onclick={() => copy(btc(amount))}
          onkeydown={(e) => e.key === "Enter" && copy(btc(amount))}
          role="button"
          tabindex="0"
          aria-label="Copy BTC amount"
        >
          <iconify-icon noobserver icon="cryptocurrency:btc" class="text-orange-400"></iconify-icon>
          <span>{btc(amount)} BTC</span>
          {#if tip}
            <span class="text-lg ml-2">+{btc(tip)} BTC</span>
          {/if}
        </h2>

        <!-- Sats Amount -->
        <h3
          class="text-xl md:text-2xl font-medium flex items-center gap-1 cursor-copy text-white/90"
          class:justify-center={align !== "left"}
          onclick={() => copy(amount)}
          onkeydown={(e) => e.key === "Enter" && copy(amount)}
          role="button"
          tabindex="0"
          aria-label="Copy sats amount"
        >
          <iconify-icon noobserver icon="ph:lightning-fill" class="text-yellow-300"></iconify-icon>
          <span>{s(amount, locale)}</span>
          {#if tip}
            <span class="text-base ml-2">+{s(tip, locale)}</span>
          {/if}
        </h3>

        <!-- Fiat Amount -->
        <div
          class="text-lg md:text-xl flex items-center gap-1 cursor-copy text-secondary"
          class:justify-center={align !== "left"}
          onclick={() => copy(toFiat(amount, rate).toFixed(2))}
          onkeydown={(e) => e.key === "Enter" && copy(toFiat(amount, rate).toFixed(2))}
          role="button"
          tabindex="0"
          aria-label="Copy fiat amount"
        >
          <span>{f(toFiat(amount, rate), currency, locale)}</span>
          {#if tip}
            <span class="text-base ml-2">+{f(toFiat(tip, rate), currency, locale)}</span>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Normal display: Show either BTC or sats based on preference + fiat below -->
      <h2
        class="text-2xl md:text-3xl font-semibold flex items-end cursor-copy"
        class:justify-center={align !== "left"}
      >
        <div
          class="flex items-center gap-1"
          onclick={() => copy(isUSDT ? (amount / 100000000).toFixed(2) : amount)}
          onkeydown={(e) => e.key === "Enter" && copy(isUSDT ? (amount / 100000000).toFixed(2) : amount)}
          role="button"
          tabindex="0"
          aria-label="Copy amount"
        >
          <iconify-icon noobserver {icon} class={iconColor}
          ></iconify-icon>{displayAmount()}
        </div>

        {#if tip}
          <div class="flex items-center text-lg ml-2">
            <div>+</div>
            <iconify-icon noobserver {icon} class={iconColor}
            ></iconify-icon>
            <div>{isUSDT ? (tip / 100000000).toFixed(2) + ' USDT' : ($unitPreference === 'btc' ? btc(tip) + ' BTC' : s(tip, locale))}</div>
          </div>
        {/if}
      </h2>
      <div
        class="flex text-secondary md:text-lg cursor-copy items-center gap-1"
        class:justify-center={align !== "left"}
        onclick={() => copy(toFiat(amount, rate).toFixed(2))}
        onkeydown={(e) =>
          e.key === "Enter" && copy(toFiat(amount, rate).toFixed(2))}
        role="button"
        tabindex="0"
        aria-label="Copy fiat amount"
      >
        {f(toFiat(amount, rate), currency, locale)}
        {#if tip}
          <span class="text-base">
            +{f(toFiat(tip, rate), currency, locale)}
          </span>
        {/if}
      </div>
    {/if}
  </div>
{/if}
