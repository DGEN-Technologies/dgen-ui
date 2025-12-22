<script>
  import { onMount } from "svelte";
  import Left from "$comp/Left.svelte";
  import { f, s, focus, warning, sat, sats, btc } from "$lib/utils";
  import { t } from "$lib/translations";
  import { fiat as fiatStore, unitPreference } from "$lib/store";

  // ---- Props ----
  let {
    amount = $bindable(),
    currency = "USD",
    fiat = $bindable(),
    element,
    rate = $bindable(),
    locale,
    submit = undefined,
    skipBalanceCheck = false,
    isUSDT = false,
  } = $props();

  // ---- Simple state ----
  let displayValue = $state("0");
  let amountFiat = $state("0.00"); // Local state for fiat display
  let decimalChar = $state(".");
  let symbol = $state("");
  let position = $state("before");
  let isUserInput = $state(false); // Flag to prevent effect from overwriting user input

  // Get currency formatting info
  function getCurrencyInfo(locale = "en-US", currency) {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const parts = formatter.formatToParts(123456.78);
    const { value: decimal } = parts.find((p) => p.type === "decimal");
    const currencyPart = parts.find((p) => p.type === "currency");
    const sym = currencyPart ? currencyPart.value : "";
    const firstNumberIndex = parts.findIndex((p) => p.type === "integer");
    const currencyIndex = parts.findIndex((p) => p.type === "currency");
    const pos = currencyIndex < firstNumberIndex ? "before" : "after";
    return { symbol: sym, position: pos, decimal };
  }

  // Update currency info when locale/currency changes
  $effect(() => {
    const info = getCurrencyInfo(locale, currency);
    decimalChar = info.decimal;
    symbol = info.symbol;
    position = info.position;
  });

  // Convert display value to satoshis
  function displayToSats(display) {
    const numeric = parseFloat(display.replace(decimalChar, '.')) || 0;

    if (fiat) {
      // Fiat -> Satoshis
      if (isUSDT) {
        return Math.round(numeric * 100000000);
      } else {
        return rate > 0 ? Math.round((numeric * sats) / rate) : 0;
      }
    } else {
      // Direct crypto input
      if (isUSDT || $unitPreference === 'btc') {
        return Math.round(numeric * 100000000);
      } else {
        // Sats mode - already in sats
        return Math.round(numeric);
      }
    }
  }

  // Convert satoshis to display value
  function satsToDisplay(sats) {
    if (fiat) {
      // Satoshis -> Fiat (round to 2 decimal places to avoid floating point errors)
      if (isUSDT) {
        const fiatValue = sats / 100000000;
        return (Math.round(fiatValue * 100) / 100).toString();
      } else {
        const fiatValue = rate > 0 ? (sats * rate) / 100000000 : 0;
        return (Math.round(fiatValue * 100) / 100).toString();
      }
    } else {
      // Satoshis -> Crypto
      if (isUSDT || $unitPreference === 'btc') {
        const val = (sats / 100000000).toString();
        return val.replace(/\.?0+$/, '') || "0";
      } else {
        // Sats mode
        return sats.toString();
      }
    }
  }

  // Update amount when display changes
  function updateAmount() {
    const newAmount = displayToSats(displayValue);

    // Check balance
    if (!skipBalanceCheck && newAmount > sats) {
      warning($t("user.receive.lessThan1BTCWarning"));
      return false;
    }

    amount = newAmount;
    lastInternalAmount = newAmount; // Track this as our own update

    // Update fiat display value
    if (isUSDT) {
      amountFiat = (amount / 100000000).toFixed(2);
    } else {
      amountFiat = rate > 0 ? ((amount * rate) / 100000000).toFixed(2) : "0.00";
    }

    return true;
  }

  // Track if amount changed externally
  let lastInternalAmount = $state(amount);

  // Handle numpad button press
  function handleInput(value) {
    isUserInput = true;

    if (value === "clear") {
      displayValue = "0";
    } else if (value === "backspace") {
      displayValue = displayValue.length > 1 ? displayValue.slice(0, -1) : "0";
    } else if (value === ".") {
      // Only allow decimal in appropriate modes
      if ((fiat || isUSDT || $unitPreference === 'btc') && !displayValue.includes(decimalChar)) {
        displayValue = displayValue + decimalChar;
      }
    } else {
      // Number key
      if (displayValue === "0") {
        displayValue = value;
      } else {
        // Limit fiat to 2 decimal places
        if (fiat && displayValue.includes(decimalChar)) {
          const parts = displayValue.split(decimalChar);
          if (parts[1] && parts[1].length >= 2) {
            return; // Don't add more digits after 2 decimal places
          }
        }
        displayValue = displayValue + value;
      }
    }

    element && (element.textContent = displayValue);
    updateAmount();

    // Clear flag after a short delay
    setTimeout(() => {
      isUserInput = false;
    }, 100);
  }

  // Handle manual typing
  function handleManualInput() {
    isUserInput = true;

    let text = element?.textContent ?? "0";

    // Limit fiat to 2 decimal places
    if (fiat && text.includes(decimalChar)) {
      const parts = text.split(decimalChar);
      if (parts[1] && parts[1].length > 2) {
        text = parts[0] + decimalChar + parts[1].substring(0, 2);
        element.textContent = text;
      }
    }

    displayValue = text || "0";
    updateAmount();

    // Move cursor to end
    queueMicrotask(() => {
      const node = element?.childNodes?.[0];
      if (!node) return;
      const range = document.createRange();
      const sel = getSelection();
      const L = node.length ?? node.textContent?.length ?? 0;
      range.setStart(node, L);
      range.setEnd(node, L);
      sel.removeAllRanges();
      sel.addRange(range);

      // Clear flag after cursor is moved
      setTimeout(() => {
        isUserInput = false;
      }, 100);
    });
  }

  // Handle paste
  async function handlePaste() {
    isUserInput = true;

    const txt = (await navigator.clipboard.readText()) ?? "";
    const clean = txt.replace(/[^\d.,]/g, "").replace(new RegExp(`[${decimalChar}]`, "g"), ".");
    const val = parseFloat(clean);
    if (isFinite(val) && val >= 0) {
      displayValue = val.toString();

      // Limit fiat to 2 decimal places
      if (fiat && displayValue.includes('.')) {
        const parts = displayValue.split('.');
        if (parts[1] && parts[1].length > 2) {
          displayValue = parts[0] + '.' + parts[1].substring(0, 2);
        }
      } else if (displayValue.includes('.')) {
        displayValue = displayValue.replace(/\.?0+$/, '');
      }

      if (displayValue === '') displayValue = '0';
    } else {
      displayValue = '0';
    }
    element && (element.textContent = displayValue);
    updateAmount();

    setTimeout(() => {
      isUserInput = false;
    }, 100);
  }

  // Keyboard validation
  function handleKeydown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit?.click?.();
      return;
    }

    // Allow control keys
    if (
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "Tab" ||
      e.key === "Home" ||
      e.key === "End" ||
      (e.ctrlKey || e.metaKey)
    ) {
      return;
    }

    const char = e.key;
    const isNumber = /^[0-9]$/.test(char);
    const isDecimal = char === "." || char === decimalChar;

    // Allow decimals in fiat/BTC/USDT modes
    if (fiat || isUSDT || $unitPreference === 'btc') {
      if (!isNumber && !isDecimal) {
        e.preventDefault();
        return;
      }
      // Prevent multiple decimals
      if (isDecimal && element?.textContent?.includes(decimalChar)) {
        e.preventDefault();
        return;
      }
    } else {
      // Sats mode: only numbers
      if (!isNumber) {
        e.preventDefault();
        return;
      }
    }
  }

  // Swap between display modes
  function swap() {
    isUserInput = false; // Clear user input flag when swapping

    if (fiat) {
      // Fiat -> Crypto
      fiat = false;
      if (!isUSDT) {
        unitPreference.set('sats');
      }
    } else if (!isUSDT && $unitPreference === 'sats') {
      // Sats -> BTC
      unitPreference.set('btc');
    } else {
      // Back to fiat
      fiat = true;
    }

    // Update display for new mode
    displayValue = satsToDisplay(amount);
    element && (element.textContent = displayValue);
    $fiatStore = fiat;
  }

  // Watch for external amount changes
  $effect(() => {
    // Skip if user is actively typing
    if (isUserInput) {
      return;
    }

    // Skip if this was our own update
    if (amount === lastInternalAmount) {
      return;
    }

    lastInternalAmount = amount;

    // Update display for external change
    displayValue = satsToDisplay(amount || 0);
    if (element) {
      element.textContent = displayValue;
    }

    // Update fiat display
    if (isUSDT) {
      amountFiat = ((amount || 0) / 100000000).toFixed(2);
    } else {
      amountFiat = rate > 0 ? (((amount || 0) * rate) / 100000000).toFixed(2) : "0.00";
    }
  });

  // Initialize
  onMount(() => {
    fiat = $fiatStore;
    displayValue = satsToDisplay(amount || 0);
    if (element) {
      element.textContent = displayValue;
    }

    // Initialize fiat display
    if (isUSDT) {
      amountFiat = ((amount || 0) / 100000000).toFixed(2);
    } else {
      amountFiat = rate > 0 ? (((amount || 0) * rate) / 100000000).toFixed(2) : "0.00";
    }
  });
</script>

<div class="flex justify-center items-center">
  <div class="space-y-5 w-full">
    <div class="text-center">
      <div class="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight flex justify-center">
        <div class="my-auto flex items-center gap-1">
          {#if fiat}
            {#if position === "before"}{symbol}{/if}
          {:else if isUSDT}
            <iconify-icon noobserver icon="cryptocurrency:usdt" class="text-green-400" width="32" height="32"></iconify-icon>
          {:else if $unitPreference === 'btc'}
            <iconify-icon noobserver icon="cryptocurrency:btc" class="text-orange-400" width="32" height="32"></iconify-icon>
          {:else}
            <iconify-icon noobserver icon="ph:lightning-fill" class="text-yellow-300" width="32" height="32"></iconify-icon>
          {/if}
        </div>

        <div
          use:focus
          role="textbox"
          tabindex="0"
          aria-label="Amount input"
          contenteditable
          inputmode={fiat || isUSDT || $unitPreference === 'btc' ? "decimal" : "numeric"}
          enterkeyhint="done"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          onpaste={handlePaste}
          onfocus={(e) => {
            const range = document.createRange();
            range.selectNodeContents(e.target);
            const sel = getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }}
          oninput={handleManualInput}
          onkeydown={handleKeydown}
          class="outline-none my-auto"
          bind:this={element}
        ></div>

        {#if fiat && position === "after"}{symbol}{/if}
      </div>

      <!-- Currency toggle -->
      <button
        type="button"
        class="flex flex-col items-center justify-center cursor-pointer w-full select-none gap-1 group mt-2"
        onclick={swap}
      >
        {#if isUSDT}
          <div class="flex items-center justify-center gap-2 text-xs sm:text-sm w-full">
            <span class={fiat ? "text-white/80 font-semibold" : "text-white/40"}>
              {f(amountFiat, currency, locale)}
            </span>
            <iconify-icon noobserver icon="ph:arrows-left-right-bold" class="text-white/40 group-hover:text-white/60" width="12"></iconify-icon>
            <span class="{!fiat ? 'text-white/80 font-semibold' : 'text-white/40'} flex items-center gap-1">
              <iconify-icon noobserver icon="cryptocurrency:usdt" class="text-green-400" width="12"></iconify-icon>
              {isFinite(amount) ? (amount / 100000000).toFixed(2) : "0.00"} USDT
            </span>
          </div>
        {:else}
          <div class="flex items-center justify-center gap-2 text-xs sm:text-sm w-full">
            <span class={fiat ? "text-white/80 font-semibold" : "text-white/40"}>
              {f(amountFiat, currency, locale)}
            </span>
            <span class="text-white/20">•</span>
            <span class="{!fiat && $unitPreference === 'sats' ? 'text-white/80 font-semibold' : 'text-white/40'} flex items-center gap-1">
              <iconify-icon noobserver icon="ph:lightning-fill" class="text-yellow-300" width="12"></iconify-icon>
              {isFinite(amount) ? s(amount, locale) : "0"}
            </span>
            <span class="text-white/20">•</span>
            <span class="{!fiat && $unitPreference === 'btc' ? 'text-white/80 font-semibold' : 'text-white/40'} flex items-center gap-1">
              <iconify-icon noobserver icon="cryptocurrency:btc" class="text-orange-400" width="12"></iconify-icon>
              {isFinite(amount) ? btc(amount) : "0.00000000"}
            </span>
          </div>
        {/if}
        <div class="text-[10px] text-white/40 group-hover:text-white/60 transition-colors flex items-center justify-center gap-1 w-full">
          <iconify-icon noobserver icon="ph:hand-tap-bold" width="10"></iconify-icon>
          Tap to switch
        </div>
      </button>
    </div>

    <!-- Clear button (full width) -->
    <button
      type="button"
      class="btn w-full bg-red-500/10 hover:bg-red-500/20 text-red-400"
      onclick={() => handleInput("clear")}
    >
      Clear
    </button>

    <!-- Numpad 3x4 grid -->
    <div class="grid grid-cols-3 gap-2 w-full mx-auto">
      <!-- Row 1: 1 2 3 -->
      {#each ["1", "2", "3"] as value}
        <button type="button" class="btn" onclick={() => handleInput(value)}>
          {value}
        </button>
      {/each}

      <!-- Row 2: 4 5 6 -->
      {#each ["4", "5", "6"] as value}
        <button type="button" class="btn" onclick={() => handleInput(value)}>
          {value}
        </button>
      {/each}

      <!-- Row 3: 7 8 9 -->
      {#each ["7", "8", "9"] as value}
        <button type="button" class="btn" onclick={() => handleInput(value)}>
          {value}
        </button>
      {/each}

      <!-- Row 4: . 0 ← -->
      <button
        type="button"
        class="btn"
        class:opacity-50={!fiat && !isUSDT && $unitPreference !== 'btc'}
        class:cursor-not-allowed={!fiat && !isUSDT && $unitPreference !== 'btc'}
        onclick={() => handleInput(".")}
      >
        {decimalChar}
      </button>

      <button type="button" class="btn" onclick={() => handleInput("0")}>
        0
      </button>

      <button type="button" class="btn" onclick={() => handleInput("backspace")}>
        <Left />
      </button>
    </div>
  </div>
</div>
