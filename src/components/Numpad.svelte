<script>
  import { onMount } from "svelte";
  import Left from "$comp/Left.svelte";
  import { f, s, focus, warning, sat, sats, btc } from "$lib/utils";
  import { t } from "$lib/translations";
  import { fiat as fiatStore, unitPreference } from "$lib/store";

  // ---- Props (Svelte 5 runes) ----
  let {
    amount = $bindable(),
    currency = "USD",
    fiat = $bindable(),
    element,
    rate = $bindable(),
    locale,
    submit = undefined,
    amountFiat = 0,
    skipBalanceCheck = false,  // Add this prop to skip balance validation
    isUSDT = false,  // Flag for USDT amounts (1:1 with USD)
  } = $props();

  // ---- Local state ----
  let fiatDigits = $state("0"); // cents buffer in fiat mode
  let html = $state("0");
  let isUserTyping = $state(false); // Track if user is actively typing
  let isUsingPad = $state(false); // Track if user is using number pad

  // currency info as reactive state
  let decimalChar = $state(".");
  let symbol = $state("");
  let position = $state("before");

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

  // reflect external prop/locale changes
  $effect(() => {
    const info = getCurrencyInfo(locale, currency);
    decimalChar = info.decimal;
    symbol = info.symbol;
    position = info.position;
  });

  function formatFiatFromDigits(digits, dec = ".") {
    let d = digits.replace(/\D+/g, "");
    if (!d) d = "0";
    if (d.length > 15) d = d.slice(0, 15);
    if (d.length === 1) d = "0" + d;
    if (d.length === 2) d = "0" + d;
    const whole = d.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
    const cents = d.slice(-2);
    return `${whole}${dec}${cents}`;
  }

  // --- NEW: normalize sats to remove leading zeros but keep single "0"
  function normalizeSats(str) {
    const digits = (str ?? "").replace(/[^\d]/g, "");
    const noLead = digits.replace(/^0+(?=\d)/, "");
    return noLead || "0";
  }

  const updateByMode = () => {
    if (fiat) {
      const numericFiat =
        parseFloat((fiatDigits || "0").replace(/\D/g, "")) / 100;
      amountFiat = isFinite(numericFiat) ? numericFiat.toFixed(2) : "0.00";

      // For USDT: $1 USD = 1.0 USDT = 100000000 smallest units (1:1 conversion)
      // For Bitcoin: Use market exchange rate
      if (isUSDT) {
        // Convert USD to USDT smallest units (same precision as satoshis: 10^8)
        amount = Math.round(numericFiat * sats);
      } else {
        // Convert USD to satoshis using Bitcoin exchange rate
        amount = numericFiat && rate > 0 ? Math.round((numericFiat * sats) / rate) : 0;
      }
    } else {
      // For non-fiat mode, amount is already set by input handlers
      // Just update the fiat display value

      // For display: convert back to fiat
      if (isUSDT) {
        // For USDT: amount is in smallest units, divide by 10^8 to get USDT (same as USD)
        const fval = amount / sats;
        amountFiat = isFinite(fval) ? fval.toFixed(2) : "0.00";
      } else {
        // For Bitcoin: use exchange rate
        const fval = amount && rate > 0 ? (amount * rate) / sats : 0;
        amountFiat = fval && isFinite(fval) ? fval.toFixed(2) : "0.00";
      }
    }
  };

  const pasted = async () => {
    const txt = (await navigator.clipboard.readText()) ?? "";
    if (fiat) {
      const m = txt.replace(/[^\d.,]/g, "");
      const normalized = m.replace(new RegExp(`[${decimalChar}]`, "g"), ".");
      const val = parseFloat(normalized);
      const cents = isFinite(val) ? Math.round(val * 100) : 0;
      fiatDigits = Math.max(0, cents).toString();
      html = formatFiatFromDigits(fiatDigits, decimalChar);
    } else if ($unitPreference === 'btc' && !isUSDT) {
      // BTC mode - parse as decimal BTC value and display directly
      const m = txt.replace(/[^\d.,]/g, "");
      const normalized = m.replace(new RegExp(`[${decimalChar}]`, "g"), ".");
      const val = parseFloat(normalized);
      if (isFinite(val) && val >= 0) {
        html = val.toString();
        // Clean up display
        if (html.includes('.')) {
          html = html.replace(/\.?0+$/, '');
        }
        if (html === '') html = '0';
      } else {
        html = '0';
      }
      element && (element.textContent = html);
    } else {
      const clean = normalizeSats(txt);
      html = clean;
      element && (element.textContent = html);
    }
    input(null, true);
  };

  let prevHtml = $state("");

  // (kept for completeness; no longer used in sats path)
  function trimTrailingZeros(str) {
    if (!str.includes(".")) return str;
    let out = str.replace(/(\.\d*?[1-9])0+$/, "$1");
    out = out.replace(/\.0*$/, "");
    return out;
  }

  const input = (e, fromPad = false) => {
    // Set flag when user is typing (not using pad)
    if (!fromPad) {
      isUserTyping = true;
      isUsingPad = false;
    } else {
      isUserTyping = false;
      isUsingPad = true;
    }

    if (fiat) {
      if (!fromPad) {
        // When typing manually, allow decimal input temporarily
        const text = element?.textContent ?? "";
        // Check if user is in the middle of typing a decimal
        if (text.includes(decimalChar) || text.includes('.')) {
          // Allow decimal typing - parse and update amount directly
          const numericFiat = parseFloat(text.replace(decimalChar, '.')) || 0;

          // Update amount based on payment type
          if (isUSDT) {
            amount = Math.round(numericFiat * 100000000);
          } else {
            amount = rate > 0 ? Math.round((numericFiat * sats) / rate) : 0;
          }

          const satsEstimate = isUSDT ? amount : (rate > 0 ? Math.round((numericFiat * sats) / rate) : 0);
          if (!skipBalanceCheck && satsEstimate > sats) {
            warning($t("user.receive.lessThan1BTCWarning"));
          }

          amountFiat = numericFiat.toFixed(2);
          html = text;
          prevHtml = html.toString();
          return; // Don't reformat while user is typing decimal
        }
        const raw = text.replace(/[^\d]/g, "");
        fiatDigits = raw || "0";
      }
      const cents = parseInt(fiatDigits || "0") || 0;
      const numericFiat = cents / 100;
      const satsEstimate = rate > 0 ? Math.round((numericFiat * sats) / rate) : 0;
      if (!skipBalanceCheck && satsEstimate > sats && html.length > prevHtml.length) {
        fiatDigits = fiatDigits.slice(0, -1) || "0";
        warning($t("user.receive.lessThan1BTCWarning"));
      }
      html = formatFiatFromDigits(fiatDigits, decimalChar);
      if (fromPad) {
        element && (element.textContent = html);
      }
    } else {
      if (isUSDT) {
        // For USDT in non-fiat mode, allow decimal input (similar to fiat but with USDT units)
        // When using number pad, amount is already set by handleInput, just sync html
        if (!fromPad) {
          // Only parse from element when typing manually
          const text = element?.textContent ?? "";
          const usdtAmount = parseFloat(text) || 0;
          const newAmount = Math.round(usdtAmount * 100000000);
          amount = newAmount; // Convert to smallest units
          html = text; // Update html for display tracking
        }
        // When fromPad is true, html is already set correctly by handleInput
      } else if ($unitPreference === 'btc') {
        // BTC mode with decimal support - work directly with display string
        if (!fromPad) {
          // When typing manually, parse and validate
          const text = element?.textContent ?? "";
          const numericBTC = parseFloat(text.replace(decimalChar, '.')) || 0;
          const newAmount = Math.round(numericBTC * 100000000);

          if (!skipBalanceCheck && newAmount > sats && newAmount > amount) {
            warning($t("user.receive.lessThan1BTCWarning"));
            // Don't update if exceeds balance
            return;
          }

          amount = newAmount;
          html = text;
          prevHtml = html.toString();
          return; // Don't reformat while user is typing
        }
        // When using number pad, amount is already set in handleInput
      } else {
        // Sats mode - integer-only sats, normalize leading zeros
        let clean = normalizeSats(element?.textContent ?? "");
        const maybe = parseInt(clean) || 0;
        if (!skipBalanceCheck && maybe > sats && clean.length > prevHtml.length) {
          clean = normalizeSats(clean.slice(0, -1));
          warning($t("user.receive.lessThan1BTCWarning"));
        }
        amount = parseInt(clean) || 0; // Update amount from the validated input
        html = clean; // Update html for display tracking
        // Only update textContent when using number pad, not when typing
        if (fromPad) {
          element && (element.textContent = html);
        }
      }
    }

    // Save display before updateByMode for numpad usage
    const savedHtml = fromPad && fiat ? html : null;

    if (!isUSDT || fiat) {
      updateByMode();
    }

    // Restore display after updateByMode when using numpad in fiat mode
    if (savedHtml !== null) {
      element && (element.textContent = savedHtml);
    }

    if (!fromPad) {
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

        // Don't clear the typing flag here - it will cause the effect to run
        // The flag will be cleared on the next keystroke or when using the pad
      });
    } else {
      // Clear typing flag when using number pad, then clear pad flag after a brief delay
      isUserTyping = false;
      setTimeout(() => {
        isUsingPad = false;
      }, 100);
    }
    prevHtml = html.toString();
  };

  const handleInput = (value) => {
    if (fiat) {
      if (value === arrow) {
        fiatDigits = fiatDigits.length > 1 ? fiatDigits.slice(0, -1) : "0";
        html = formatFiatFromDigits(fiatDigits, decimalChar);
      } else if (value === decimal) {
        // For fiat mode, decimal is ignored since it's always present in the display
        return;
      } else {
        fiatDigits = (fiatDigits === "0" ? "" : fiatDigits) + value;
        html = formatFiatFromDigits(fiatDigits, decimalChar);
      }
      element && (element.textContent = html);
    } else {
      if (isUSDT) {
        // For USDT, handle decimal input like fiat but show USDT
        // Use same digit buffer approach
        if (value === arrow) {
          fiatDigits = fiatDigits.length > 1 ? fiatDigits.slice(0, -1) : "0";
        } else if (value === decimal) {
          // For USDT, decimal is ignored since it's always present in the display
          return;
        } else {
          fiatDigits = (fiatDigits === "0" ? "" : fiatDigits) + value;
        }
        html = formatFiatFromDigits(fiatDigits, decimalChar);
        element && (element.textContent = html);
        // Convert to smallest units
        const cents = parseInt(fiatDigits || "0") || 0;
        const numericUSDT = cents / 100;
        amount = Math.round(numericUSDT * 100000000);
      } else if ($unitPreference === 'btc') {
        // For Bitcoin BTC mode - work with display string directly (like manual typing)
        if (value === arrow) {
          html = html.length > 1 ? html.slice(0, -1) : "0";
        } else if (value === decimal) {
          // Add decimal point if not already present
          if (!html.includes(decimalChar)) {
            html = html + decimalChar;
          }
        } else {
          // If current is "0" and no decimal, replace with the digit; else append
          if (html === "0") {
            html = value;
          } else {
            html = html + value;
          }
        }
        element && (element.textContent = html);
        // Parse the BTC value and convert to satoshis
        const numericBTC = parseFloat(html.replace(decimalChar, '.')) || 0;
        amount = Math.round(numericBTC * 100000000);
      } else {
        // For Bitcoin sats - decimal button is disabled/ignored since sats are integers
        if (value === arrow) {
          html = html.length > 1 ? html.slice(0, -1) : "0";
        } else if (value === decimal) {
          // For sats mode, decimal is ignored (sats are whole numbers)
          return;
        } else {
          // If current is "0", replace with the digit; else append
          html = html === "0" ? value : html + value;
        }
        // normalize away any accidental leading zeros
        html = normalizeSats(html);
        element && (element.textContent = html);
      }
    }
    input(null, true);
  };

  const select = (e) => {
    const range = document.createRange();
    range.selectNodeContents(e.target);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const blur = () => {
    if (!html) {
      if (fiat) {
        html = formatFiatFromDigits("0", decimalChar);
      } else {
        html = "0";
      }
    }
  };

  const keydown = (e) => {
    // Allow Enter key
    if (e.key === "Enter") {
      e.preventDefault();
      submit?.click?.();
      return;
    }

    // Allow control keys (backspace, delete, arrows, etc.)
    if (
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "Tab" ||
      e.key === "Home" ||
      e.key === "End" ||
      (e.ctrlKey || e.metaKey) // Allow Ctrl/Cmd shortcuts (copy, paste, etc.)
    ) {
      return;
    }

    // Only allow numbers and decimal point
    const char = e.key;
    const isNumber = /^[0-9]$/.test(char);
    const isDecimal = char === "." || char === decimalChar;

    // For fiat, USDT, or BTC mode: allow numbers and one decimal
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
      // For sats mode: only allow numbers (no decimal)
      if (!isNumber) {
        e.preventDefault();
        return;
      }
    }
  };

  // CHANGED: make swap set html for the new mode immediately and keep DOM in sync
  const swap = () => {
    if (fiat) {
      // going -> sats, BTC, or USDT units
      fiat = false;
      if (isUSDT) {
        // For USDT, show as decimal (e.g., "1.50" not "150000000")
        html = ((amount || 0) / 100000000).toFixed(8).replace(/\.?0+$/, '');
        if (!html || html === '') html = '0';
      } else if ($unitPreference === 'btc') {
        // For BTC mode, show as decimal BTC (e.g., "0.00003824" or "9")
        const btcValue = (amount || 0) / 100000000;
        html = btcValue.toString();
        // Remove unnecessary trailing zeros after decimal
        if (html.includes('.')) {
          html = html.replace(/\.?0+$/, '');
        }
        if (!html || html === '' || html === '0.') html = '0';
      } else {
        // For sats mode, show raw satoshis
        html = normalizeSats((amount || 0).toString());
      }
      element && (element.textContent = html);
    } else {
      // going -> fiat
      const cents = Math.round((parseFloat(amountFiat || "0") || 0) * 100);
      fiatDigits = Math.max(0, cents).toString();
      fiat = true;
      html = formatFiatFromDigits(fiatDigits, decimalChar);
      element && (element.textContent = html);
    }
    updateByMode();
    prevHtml = html.toString();

    // Move caret to end after swap
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
    });

    $fiatStore = fiat;
  };

  const arrow = "<";
  const decimal = ".";
  const numPad = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    decimal,
    "0",
    arrow,
  ];

  // Watch for external changes to amount (e.g., from quick amount buttons)
  $effect(() => {
    if (!element || isUserTyping || isUsingPad) {
      return; // Don't run when user is typing or using numpad
    }

    // If amount is cleared/undefined, reset display to 0
    if (!amount || amount === 0) {
      fiatDigits = "0";
      if (fiat) {
        html = formatFiatFromDigits("0", decimalChar);
      } else {
        html = "0";
      }
      element.textContent = html;
      prevHtml = html.toString();
      return;
    }

    // When amount changes externally, update the display
    if (fiat) {
      // In fiat mode, convert to USD and display
      let cents;
      if (isUSDT) {
        // For USDT: amount is in smallest units (10^8), 1:1 with USD
        cents = Math.round((amount / 100000000) * 100);
      } else {
        // For Bitcoin: use exchange rate
        cents = Math.round((amount * rate / 100000000) * 100);
      }
      fiatDigits = Math.max(0, cents).toString();
      html = formatFiatFromDigits(fiatDigits, decimalChar);
      element.textContent = html;
    } else {
      // In sats/BTC/USDT mode (non-fiat), only update display for external changes
      if (isUSDT) {
        // For USDT, show as decimal
        const usdtAmount = (amount || 0) / 100000000;
        const cents = Math.round(usdtAmount * 100);
        fiatDigits = Math.max(0, cents).toString();
        html = formatFiatFromDigits(fiatDigits, decimalChar);
        element.textContent = html;
      } else if ($unitPreference === 'btc') {
        // For BTC mode, show as decimal BTC
        // First check if current html already represents this amount (to preserve trailing decimal/zeros during typing)
        const currentNumeric = parseFloat((html || "0").replace(decimalChar, '.')) || 0;
        const currentAmount = Math.round(currentNumeric * 100000000);

        if (currentAmount === amount) {
          // Current display already represents this amount, don't update
          // This preserves user's typing like "5." or "5.00"
          return;
        }

        const btcValue = (amount || 0) / 100000000;
        html = btcValue.toString();
        // Remove unnecessary trailing zeros after decimal
        if (html.includes('.')) {
          html = html.replace(/\.?0+$/, '');
        }
        if (!html || html === '' || html === '0.') html = '0';
        element.textContent = html;
      } else {
        // For sats mode, show raw satoshis
        html = normalizeSats((amount || 0).toString());
        element.textContent = html;
      }
    }
    prevHtml = html.toString();
  });

  // Reset display when payment type changes (e.g., switching between USDT and Bitcoin)
  $effect(() => {
    // When isUSDT changes, reset the display to avoid showing wrong conversion
    if (element && html !== "0") {
      // Recalculate display for current amount with new payment type
      updateByMode();
    }
  });

  // Track if we've initialized the display
  let initialized = $state(false);

  // Initialize display when element becomes available
  $effect(() => {
    if (!element || initialized) return;

    // Set initial display based on current mode and amount
    if (fiat) {
      // In fiat mode, convert amount to fiat and display
      let cents;
      if (isUSDT) {
        cents = Math.round((amount / 100000000) * 100);
      } else {
        cents = Math.round((amount * rate / 100000000) * 100);
      }
      fiatDigits = Math.max(0, cents).toString();
      html = formatFiatFromDigits(fiatDigits, decimalChar);
    } else {
      // In non-fiat mode, show amount in appropriate format
      if (isUSDT) {
        const usdtAmount = (amount || 0) / 100000000;
        const cents = Math.round(usdtAmount * 100);
        fiatDigits = Math.max(0, cents).toString();
        html = formatFiatFromDigits(fiatDigits, decimalChar);
      } else if ($unitPreference === 'btc') {
        const btcValue = (amount || 0) / 100000000;
        html = btcValue.toString();
        if (html.includes('.')) {
          html = html.replace(/\.?0+$/, '');
        }
        if (!html || html === '' || html === '0.') html = '0';
      } else {
        html = normalizeSats((amount || 0).toString());
      }
    }

    element.textContent = html;
    prevHtml = html.toString();
    initialized = true;
  });

  onMount(() => {
    fiat = $fiatStore;
  });
</script>

<div class="flex justify-center items-center">
  <div class="space-y-5 w-full">
    <div class="text-center">
      <div
        class="text-5xl md:text-6xl font-semibold tracking-widest flex justify-center"
      >
        <div class="my-auto" class:text-5xl={!fiat}>
          {#if fiat}
            {#if position === "before"}{symbol}{/if}
          {:else if isUSDT}
            <iconify-icon
              noobserver
              icon="cryptocurrency:usdt"
              class="text-green-400"
            ></iconify-icon>
          {:else if $unitPreference === 'btc'}
            <iconify-icon
              noobserver
              icon="cryptocurrency:btc"
              class="text-orange-400"
            ></iconify-icon>
          {:else}
            <iconify-icon
              noobserver
              icon="ph:lightning-fill"
              class="text-yellow-300"
            ></iconify-icon>
          {/if}
        </div>

        <!-- contenteditable input -->
        <div
          use:focus
          role="textbox"
          tabindex="0"
          aria-label="Amount input"
          aria-multiline="false"
          contenteditable
          inputmode={fiat || isUSDT || $unitPreference === 'btc' ? "decimal" : "numeric"}
          enterkeyhint="done"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          onpaste={pasted}
          onfocus={(e) => {
            select(e);
          }}
          onblur={blur}
          oninput={input}
          onkeydown={keydown}
          class="outline-none my-auto"
          bind:this={element}
        ></div>

        {#if fiat && position === "after"}{symbol}{/if}
      </div>

      <!-- swap button -->
      <button
        type="button"
        class="flex items-center justify-center text-2xl cursor-pointer mx-auto select-none"
        aria-label="Swap currency display"
        onclick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          swap();
        }}
      >
        {#if fiat}
          {#if isUSDT}
            <iconify-icon
              noobserver
              icon="cryptocurrency:usdt"
              class="text-green-400"
            ></iconify-icon>
            {isFinite(amount) ? (amount / 100000000).toFixed(2) : "0.00"} USDT
          {:else if $unitPreference === 'btc'}
            <iconify-icon
              noobserver
              icon="cryptocurrency:btc"
              class="text-orange-400"
            ></iconify-icon>
            {isFinite(amount) ? btc(amount) : "0.00000000"} BTC
          {:else}
            <iconify-icon
              noobserver
              icon="ph:lightning-fill"
              class="text-yellow-300"
            ></iconify-icon>
            {isFinite(amount) ? s(amount, locale) : "0"}
          {/if}
        {:else}
          {f(amountFiat, currency, locale)}
        {/if}
      </button>
    </div>

    <div class="grid grid-cols-3 gap-2 w-full mx-auto">
      {#each numPad as value}
        {#if value === arrow}
          <button
            type="button"
            class="btn"
            aria-label="Backspace"
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleInput(value);
            }}
          >
            <Left />
          </button>
        {:else if value === decimal}
          <button
            type="button"
            class="btn"
            class:opacity-50={!fiat && !isUSDT && $unitPreference !== 'btc'}
            class:cursor-not-allowed={!fiat && !isUSDT && $unitPreference !== 'btc'}
            aria-label="Decimal point"
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleInput(value);
            }}
          >
            {decimalChar}
          </button>
        {:else}
          <button
            type="button"
            class="btn"
            aria-label={`Key ${value}`}
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleInput(value);
            }}
          >
            {value}
          </button>
        {/if}
      {/each}
    </div>
  </div>
</div>
