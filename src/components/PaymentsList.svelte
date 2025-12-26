<script>
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { get } from "svelte/store";
  import { t } from "$lib/translations";
  import { f, s, sats, loc, btc } from "$lib/utils";
  import { format } from "date-fns";
  import locales from "$lib/locales";
  import {
    transactionStore,
    currentTransactionPage,
    isLoadingTransactions,
    initTransactionEventHandling,
  } from "$lib/transactionService";
  import Avatar from "$comp/Avatar.svelte";
  import { unitPreference } from "$lib/store";

  let { user, initialFilter = {} } = $props();
  let locale = $derived(user ? locales[user.language] : locales["en"]);
  let currency = $derived(user?.currency || "USD");
  let unit = $state(currency); // Default to fiat currency display
  let rate = $state(50000); // Default rate, will be fetched from SDK

  // Filter state
  let typeFilter = $state("all"); // all, send, receive
  let fromTimestamp = $state(null);
  let toTimestamp = $state(null);
  let showDateDialog = $state(false);
  let tempFromDate = $state("");
  let tempToDate = $state("");

  // Pagination state
  let currentPage = $state(1);
  let itemsPerPage = $state(50);

  // Loading states
  let isInitialLoad = $state(true);

  // Virtual scrolling for performance
  let visibleStart = $state(0);
  let visibleEnd = $state(50);
  let containerHeight = $state(0);
  let scrollTop = $state(0);

  // Initialize on mount
  onMount(async () => {
    // Wait for SDK to be ready
    const waitForSdk = async () => {
      try {
        const { isConnected } = await import("$lib/walletService");
        let attempts = 0;
        while (!isConnected() && attempts < 20) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          attempts++;
        }
        return isConnected();
      } catch (error) {
        console.warn("[PaymentsList] Error checking SDK connection:", error);
        return false;
      }
    };

    const sdkReady = await waitForSdk();

    if (sdkReady) {
      // Fetch current fiat rate
      try {
        const walletService = await import("$lib/walletService");
        const fiatRates = await walletService.fetchFiatRates();
        const usdRate = fiatRates.find(
          (r) => r.coin.toUpperCase() === currency.toUpperCase(),
        );
        if (usdRate) rate = usdRate.value;
      } catch (error) {
        console.warn("[PaymentsList] Failed to fetch fiat rates:", error);
      }

      // Event handling is now initialized in layout.svelte to catch early dataSynced events
      // Wait for initial sync to complete before loading transactions
      // This ensures we get proper payment metadata (Lightning, Bitcoin) instead of placeholder "liquid" type
      const { walletStore } = await import("$lib/stores/wallet");

      // Check if initial sync is already complete
      const currentState = get(walletStore);
      if (!currentState.didCompleteInitialSync) {
        // Wait for initial sync by waiting for the synced event
        await new Promise((resolve) => {
          const unsubscribe = walletStore.subscribe((state) => {
            if (state.didCompleteInitialSync) {
              unsubscribe();
              resolve();
            }
          });

          // Timeout after 30 seconds
          setTimeout(() => {
            unsubscribe();
            resolve();
          }, 30000);
        });
      }

      // Load initial transactions - force refresh to get data with proper metadata
      try {
        await transactionStore.loadTransactions(true);
      } catch (error) {
        console.error(
          "[PaymentsList] Failed to load initial transactions:",
          error,
        );
      }
    } else {
      console.warn("[PaymentsList] SDK not ready, showing empty state");
    }

    isInitialLoad = false;

    // Set up auto-refresh every 30 seconds - silently in background
    const refreshInterval = setInterval(async () => {
      if (!document.hidden) {
        try {
          const { isConnected } = await import("$lib/walletService");
          if (isConnected()) {
            // Refresh silently without showing notification
            await transactionStore.loadTransactions(true);
          }
        } catch (error) {
          console.warn("[PaymentsList] Error during auto-refresh:", error);
        }
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  });

  // Apply filters when they change
  $effect(() => {
    // Track dependencies
    typeFilter;
    fromTimestamp;
    toTimestamp;

    const filter = {
      type: typeFilter !== "all" ? typeFilter : undefined,
      startDate: fromTimestamp ? new Date(fromTimestamp * 1000) : undefined,
      endDate: toTimestamp ? new Date(toTimestamp * 1000) : undefined,
    };

    // Apply the filter to store
    transactionStore.applyFilter(filter);

    // Always reload when filter changes to get fresh data from SDK
    transactionStore.loadTransactions(true);
  });

  // Update pagination when page changes
  $effect(() => {
    transactionStore.setPagination({
      page: currentPage,
      limit: itemsPerPage,
    });
  });

  // Clear date filter
  const clearDateFilter = async () => {
    fromTimestamp = null;
    toTimestamp = null;
    tempFromDate = "";
    tempToDate = "";
    // The effect will trigger reload automatically
  };

  // Apply date filter from dialog
  const applyDateFilter = () => {
    if (tempFromDate) {
      // Parse date string as local time (YYYY-MM-DD format)
      const [year, month, day] = tempFromDate.split("-").map(Number);
      const fromDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      fromTimestamp = Math.floor(fromDate.getTime() / 1000);
    } else {
      fromTimestamp = null;
    }

    if (tempToDate) {
      // Parse date string as local time (YYYY-MM-DD format)
      const [year, month, day] = tempToDate.split("-").map(Number);
      const toDate = new Date(year, month - 1, day, 23, 59, 59, 999);
      toTimestamp = Math.floor(toDate.getTime() / 1000);
    } else {
      toTimestamp = null;
    }

    showDateDialog = false;
  };

  // Format date range for display
  const formatDateRange = () => {
    if (!fromTimestamp && !toTimestamp) return "";

    const formatDate = (timestamp) => {
      const date = new Date(timestamp * 1000);
      return format(date, "MMM d, yyyy", { locale });
    };

    if (fromTimestamp && toTimestamp) {
      return `${formatDate(fromTimestamp)} - ${formatDate(toTimestamp)}`;
    } else if (fromTimestamp) {
      return `From ${formatDate(fromTimestamp)}`;
    } else {
      return `Until ${formatDate(toTimestamp)}`;
    }
  };

  // Format payment for display
  const formatPayment = (payment) => {
    // Detect payment type first to determine which amount field to use
    let paymentIcon = "lightning"; // default
    let paymentTypeLabel = "Lightning";
    let assetType = null; // null for non-Liquid, 'lbtc' or 'usdt' for Liquid
    let isUSDT = false;
    const details = payment.details; // Define details at function scope

    if (details) {
      const detailsType = details.type;

      // Breez SDK uses a discriminated union for PaymentDetails with these types:
      // - type="lightning": Lightning payment (has swapId, invoice, paymentHash, etc.)
      // - type="bitcoin": Bitcoin on-chain payment (has swapId, bitcoinAddress)
      // - type="liquid": Direct Liquid payment (has destination, assetId)

      // Check the discriminated union type field
      if (detailsType === "bitcoin") {
        // Bitcoin on-chain payment (swap from Liquid to BTC)
        paymentIcon = "bitcoin";
        paymentTypeLabel = "Bitcoin";
      } else if (detailsType === "lightning") {
        // Lightning payment (swap from/to Liquid)
        paymentIcon = "lightning";
        paymentTypeLabel = "Lightning";
      } else if (detailsType === "liquid") {
        // Direct Liquid payment
        paymentIcon = "liquid";

        // Check if it's USDT or LBTC based on assetId
        if (
          details.assetId ===
          "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2"
        ) {
          paymentTypeLabel = "USDT";
          assetType = "usdt";
          isUSDT = true;
        } else {
          paymentTypeLabel = "Liquid";
          assetType = "lbtc";
        }
      }
      // Fallback detection if type is missing (shouldn't happen but just in case)
      else {
        // Try to infer from other fields
        if ("bitcoinAddress" in details || "swapId" in details) {
          // Check if it has bitcoin-specific fields
          if ("bitcoinAddress" in details) {
            paymentIcon = "bitcoin";
            paymentTypeLabel = "Bitcoin";
          } else {
            // Has swapId but no bitcoin address - likely Lightning
            paymentIcon = "lightning";
            paymentTypeLabel = "Lightning";
          }
        } else if ("destination" in details) {
          // Has destination - likely Liquid
          paymentIcon = "liquid";
          if (
            details.assetId ===
            "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2"
          ) {
            paymentTypeLabel = "USDT";
            assetType = "usdt";
            isUSDT = true;
          } else {
            paymentTypeLabel = "Liquid";
            assetType = "lbtc";
          }
        } else {
          // Default fallback to Lightning
          paymentIcon = "lightning";
          paymentTypeLabel = "Lightning";
        }
      }
    }

    // For USDT payments, use assetInfo.amount from details
    let amount;
    if (isUSDT && details?.assetInfo?.amount !== undefined) {
      // SDK provides the actual USDT amount as a decimal in assetInfo.amount
      // Convert to smallest unit (multiply by 10^8)
      const usdtAmount = Math.round(details.assetInfo.amount * 100000000);
      amount = payment.paymentType === "receive" ? usdtAmount : -usdtAmount;
    } else {
      amount =
        payment.paymentType === "receive"
          ? payment.amountSat
          : -payment.amountSat;
    }

    // Get timestamp - SDK uses paymentTime in seconds
    const timestamp = payment.paymentTime || payment.timestamp || 0;
    let formattedTime = "--";
    let formattedDate = "--";

    if (timestamp && timestamp > 0) {
      // Convert to milliseconds if in seconds (less than year 2200 in seconds)
      const date =
        timestamp > 10000000000
          ? new Date(timestamp)
          : new Date(timestamp * 1000);
      formattedTime = format(date, "h:mm a", { locale });
      formattedDate = format(date, "MMM d, yy", { locale });
    }

    // For USDT, format amount differently
    let displayValue, fiatValue;
    if (assetType === "usdt") {
      // USDT amounts are in smallest unit (like sats), divide by 10^8
      const usdtAmount = Math.abs(amount) / 100000000;
      displayValue = `${usdtAmount.toFixed(2)} USDT`;
      fiatValue = `$${usdtAmount.toFixed(2)}`; // USDT is pegged to USD
    } else {
      // Store both BTC and sats formatted values for flexible display
      const btcValue = btc(Math.abs(amount));
      const satsValue = s(Math.abs(amount));
      displayValue = satsValue; // default to sats for compatibility
      fiatValue = f((Math.abs(amount) / sats) * rate, currency, locale);
    }

    return {
      ...payment,
      displayAmount: amount,
      paymentIcon,
      paymentTypeLabel,
      assetType,
      isLightning: paymentIcon === "lightning",
      formattedTime,
      formattedDate,
      fiatAmount: fiatValue,
      btcAmount: assetType === "usdt" ? null : btc(Math.abs(amount)),
      satsAmount: displayValue,
      isUsdt: assetType === "usdt",
    };
  };

  // Handle virtual scrolling
  const handleScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.target;
    const scrollPercentage = scrollTop / (scrollHeight - clientHeight);

    // Update visible range based on scroll position
    const totalItems = $currentTransactionPage?.totalCount || 0;
    const itemHeight = 80; // Approximate height of each item
    const visibleItems = Math.ceil(clientHeight / itemHeight);

    visibleStart = Math.floor(scrollPercentage * (totalItems - visibleItems));
    visibleEnd = visibleStart + visibleItems + 5; // Buffer for smooth scrolling
  };

  // Export to CSV - Export ALL transactions, not just current page
  const exportCSV = async () => {
    // Get ALL transactions from the store
    const storeState = get(transactionStore);
    const allTx =
      storeState.filteredTransactions.length > 0
        ? storeState.filteredTransactions
        : storeState.allTransactions;

    if (allTx.length === 0) {
      alert("No transactions to export");
      return;
    }

    // Get current fiat rate for better accuracy
    const currentRate = storeState.fiatRates.get("USD") || 50000;

    const headers = [
      "Date",
      "Time",
      "Type",
      "Asset",
      "Direction",
      "Status",
      "Amount (sats)",
      "Fee (sats)",
      "Net Amount (sats)",
      "Amount (USD)",
      "Description",
      "Payment Hash",
      "Preimage",
      "Destination",
      "Asset ID",
    ];

    const rows = allTx.map((tx) => {
      // Get timestamp - Breez SDK uses paymentTime in seconds
      const timestamp = tx.paymentTime || tx.timestamp || 0;
      let date = null;

      if (timestamp > 0) {
        // If timestamp is in seconds (typical for Breez SDK)
        date = new Date(timestamp * 1000);
      }

      // Detect payment type and asset (matching formatPayment logic)
      let typeDisplay = "Lightning";
      let assetType = null;
      let assetLabel = "";
      let isUSDT = false;
      let assetId = "";

      if (tx.details) {
        const detailsType = tx.details.type;
        if (detailsType === "bitcoin") {
          typeDisplay = "Bitcoin";
          assetLabel = "BTC";
        } else if (detailsType === "lightning") {
          typeDisplay = "Lightning";
          assetLabel = "BTC";
        } else if (detailsType === "liquid") {
          typeDisplay = "Liquid";

          // Check if it's USDT or LBTC based on assetId
          if (tx.details.assetId) {
            assetId = tx.details.assetId;
            // USDT asset ID
            if (
              tx.details.assetId ===
              "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2"
            ) {
              assetType = "usdt";
              assetLabel = "USDT";
              isUSDT = true;
            } else {
              assetType = "lbtc";
              assetLabel = "L-BTC";
            }
          } else {
            assetType = "lbtc";
            assetLabel = "L-BTC";
          }
        }
        // Fallback detection
        else if (tx.details.swapInfo || tx.details.bitcoinAddress) {
          typeDisplay = "Bitcoin";
          assetLabel = "BTC";
        } else if (tx.details.destination?.startsWith("lq")) {
          typeDisplay = "Liquid";
          assetLabel = "L-BTC";
        }
      }

      // Calculate amounts - handle USDT differently
      let amount, fee, netAmount, fiatAmount;

      if (isUSDT && tx.details?.assetInfo?.amount !== undefined) {
        // USDT: use assetInfo.amount (already in USDT decimal)
        const usdtAmount = tx.details.assetInfo.amount;
        amount = tx.paymentType === "receive" ? usdtAmount : -usdtAmount;
        fee = tx.feesSat || 0; // Fee is still in sats
        netAmount = amount; // USDT amount stays as-is
        fiatAmount = Math.abs(usdtAmount); // USDT is pegged to USD
      } else {
        // BTC/Lightning/L-BTC: use amountSat
        amount = tx.paymentType === "receive" ? tx.amountSat : -tx.amountSat;
        fee = tx.feesSat || 0;
        netAmount = tx.paymentType === "receive" ? amount : amount - fee;
        fiatAmount = (Math.abs(amount) / sats) * currentRate;
      }

      // Format direction
      const direction = tx.paymentType === "receive" ? "Received" : "Sent";

      // Format status
      const status =
        tx.status === "complete"
          ? "Complete"
          : tx.status === "pending"
            ? "Pending"
            : tx.status === "failed"
              ? "Failed"
              : tx.status;

      return [
        date ? format(date, "yyyy-MM-dd", { locale }) : "",
        date ? format(date, "HH:mm:ss", { locale }) : "",
        typeDisplay,
        assetLabel,
        direction,
        status,
        amount,
        fee,
        netAmount,
        fiatAmount.toFixed(2),
        (tx.details?.description || tx.description || "").replace(/"/g, '""'),
        tx.details?.paymentHash || tx.paymentHash || "",
        tx.details?.preimage || "",
        tx.details?.destination || "",
        assetId,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dgen_transactions_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    // Show success message
    console.log(`Exported ${allTx.length} transactions to CSV`);
  };

  // Reactive page data
  let pageData = $derived($currentTransactionPage);
  let payments = $derived(
    pageData?.transactions
      .filter((p) => {
        // Filter out transactions with 0 or very small amounts
        // Check both the original amountSat and any USDT amounts
        if (
          p.details?.type === "liquid" &&
          p.details?.assetInfo?.amount !== undefined
        ) {
          // For USDT/Liquid, check the assetInfo amount
          return p.details.assetInfo.amount > 0;
        }
        // For BTC/Lightning, check amountSat
        return p.amountSat > 0;
      })
      .map(formatPayment) || [],
  );
  let totalPages = $derived(pageData?.totalPages || 0);
  let isLoading = $derived($isLoadingTransactions);
</script>

<div class="min-h-screen">
  <div
    class="container mx-auto max-w-4xl px-2 sm:px-4 py-3 sm:py-6 space-y-3 sm:space-y-6"
  >
    <!-- Header -->
    <div class="text-center mb-3 sm:mb-6">
      <h1 class="text-2xl sm:text-4xl md:text-5xl font-bold mb-2">
        <span
          class="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent"
        >
          Transaction History
        </span>
      </h1>
    </div>

    <!-- Unified Control Panel -->
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-2.5 space-y-2.5">
        <!-- Filters Row -->
        <div class="flex items-center gap-1.5 text-xs">
          <!-- Type Filter Dropdown -->
          <div class="dropdown dropdown-bottom shrink-0">
            <label
              tabindex="0"
              class="inline-flex items-center gap-1 px-2 py-1 bg-base-300/50 border border-white/10 hover:bg-base-300 rounded cursor-pointer transition-colors"
            >
              <iconify-icon icon="ph:funnel" width="12"></iconify-icon>
              <span
                >{typeFilter === "all"
                  ? "All"
                  : typeFilter === "send"
                    ? "Sent"
                    : "Received"}</span
              >
              <iconify-icon icon="ph:caret-down" width="10"></iconify-icon>
            </label>
            <ul
              tabindex="0"
              class="dropdown-content menu p-1 shadow-xl bg-base-300 rounded-box w-32 mt-1 border border-white/10 z-50 text-xs"
            >
              <li>
                <button
                  onclick={() => (typeFilter = "all")}
                  class:active={typeFilter === "all"}>All</button
                >
              </li>
              <li>
                <button
                  onclick={() => (typeFilter = "send")}
                  class:active={typeFilter === "send"}>Sent</button
                >
              </li>
              <li>
                <button
                  onclick={() => (typeFilter = "receive")}
                  class:active={typeFilter === "receive"}>Received</button
                >
              </li>
            </ul>
          </div>

          <!-- Calendar Date Picker -->
          <button
            onclick={() => (showDateDialog = true)}
            class="inline-flex items-center gap-1 px-2 py-1 bg-base-300/50 border border-white/10 hover:bg-base-300 rounded transition-colors shrink-0"
          >
            <iconify-icon icon="ph:calendar" width="12"></iconify-icon>
            <span class="hidden sm:inline">Date Range</span>
          </button>

          <!-- Active Date Filter Display -->
          {#if fromTimestamp || toTimestamp}
            <div
              class="inline-flex items-center gap-1 px-2 py-1 bg-base-300/50 border border-white/10 rounded text-base-content"
            >
              <iconify-icon icon="ph:calendar" width="12"></iconify-icon>
              <span>{formatDateRange()}</span>
              <button onclick={clearDateFilter} class="hover:text-error ml-0.5">
                <iconify-icon icon="ph:x" width="12"></iconify-icon>
              </button>
            </div>
          {/if}

          <div class="flex-1"></div>

          <!-- Action Buttons - grouped together to prevent wrapping -->
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              onclick={exportCSV}
              class="inline-flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded transition-colors"
              disabled={payments.length === 0}
              title="Export to CSV"
            >
              <iconify-icon icon="ph:download-simple" width="12"></iconify-icon>
              <span class="hidden sm:inline">Export</span>
            </button>

            <button
              onclick={async () => {
                await transactionStore.loadTransactions(true);
              }}
              class="inline-flex items-center px-2 py-1 hover:bg-white/10 rounded transition-colors"
              class:animate-spin={isLoading}
              disabled={isLoading}
              title="Refresh transactions"
            >
              <iconify-icon icon="ph:arrow-clockwise" width="12"></iconify-icon>
            </button>
          </div>
        </div>

        <!-- Currency Toggle (3 options: Fiat/BTC/Sats) -->
        <div
          class="flex items-center justify-center border-t border-white/10 pt-2.5"
        >
          <div class="flex items-center gap-2 text-xs">
            <span class="text-white/50 font-medium">Display:</span>
            <div
              class="relative bg-black/30 backdrop-blur-xl rounded-full p-0.5 border border-white/10"
            >
              <div
                class="absolute top-0.5 bottom-0.5 bg-gradient-to-r {unit ===
                currency
                  ? 'from-green-400 to-emerald-500'
                  : unit === 'btc'
                    ? 'from-orange-400 to-yellow-500'
                    : 'from-dgen-aqua to-dgen-cyan'} rounded-full transition-all duration-300"
                style="width: calc(33.333% - 2px); left: {unit === currency
                  ? '2px'
                  : unit === 'btc'
                    ? 'calc(33.333% + 0px)'
                    : 'calc(66.666% - 2px)'};"
              ></div>
              <div class="relative flex">
                <button
                  class="px-2 py-1 rounded-full font-semibold transition-all duration-300 relative z-10 {unit ===
                  currency
                    ? 'text-white'
                    : 'text-white/60 hover:text-white/80'} flex-1"
                  onclick={() => (unit = currency)}
                >
                  <div class="flex items-center justify-center gap-0.5">
                    <span class="text-sm">$</span>
                    <span>{currency}</span>
                  </div>
                </button>
                <button
                  class="px-2 py-1 rounded-full font-semibold transition-all duration-300 relative z-10 {unit ===
                  'btc'
                    ? 'text-white'
                    : 'text-white/60 hover:text-white/80'} flex-1"
                  onclick={() => (unit = "btc")}
                >
                  <div class="flex items-center justify-center gap-0.5">
                    <iconify-icon
                      icon="cryptocurrency:btc"
                      class={unit === "btc" ? "text-white" : "text-orange-400"}
                      width="11"
                    ></iconify-icon>
                    <span>BTC</span>
                  </div>
                </button>
                <button
                  class="px-2 py-1 rounded-full font-semibold transition-all duration-300 relative z-10 {unit ===
                  'sats'
                    ? 'text-white'
                    : 'text-white/60 hover:text-white/80'} flex-1"
                  onclick={() => (unit = "sats")}
                >
                  <div class="flex items-center justify-center gap-0.5">
                    <iconify-icon
                      icon="ph:lightning-fill"
                      class={unit === "sats"
                        ? "text-yellow-400"
                        : "text-dgen-aqua"}
                      width="11"
                    ></iconify-icon>
                    <span>sats</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Stats (moved below toggle) -->
    {#if payments.length > 0}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
        <!-- Total Received -->
        <div class="card bg-green-500/10 border border-green-500/30">
          <div class="card-body p-3 sm:p-4">
            <div class="flex items-center gap-2 sm:gap-3">
              <div class="text-green-400 flex-shrink-0">
                <iconify-icon
                  icon="ph:arrow-down-bold"
                  width="24"
                  class="sm:w-8"
                ></iconify-icon>
              </div>
              <div class="min-w-0">
                <div class="text-xs sm:text-sm text-white/60">
                  Total Received
                </div>
                <div
                  class="text-base sm:text-xl font-bold text-green-400 truncate"
                >
                  {#if unit === currency}
                    {f(
                      (payments
                        .filter((p) => p.displayAmount > 0 && !p.isUsdt)
                        .reduce((sum, p) => sum + p.displayAmount, 0) /
                        sats) *
                        rate,
                      currency,
                      locale,
                    )}
                  {:else if unit === "btc"}
                    {btc(
                      payments
                        .filter((p) => p.displayAmount > 0 && !p.isUsdt)
                        .reduce((sum, p) => sum + p.displayAmount, 0),
                    )} BTC
                  {:else}
                    {s(
                      payments
                        .filter((p) => p.displayAmount > 0 && !p.isUsdt)
                        .reduce((sum, p) => sum + p.displayAmount, 0),
                    )} sats
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Total Sent -->
        <div class="card bg-red-500/10 border border-red-500/30">
          <div class="card-body p-3 sm:p-4">
            <div class="flex items-center gap-2 sm:gap-3">
              <div class="text-red-400 flex-shrink-0">
                <iconify-icon icon="ph:arrow-up-bold" width="24" class="sm:w-8"
                ></iconify-icon>
              </div>
              <div class="min-w-0">
                <div class="text-xs sm:text-sm text-white/60">Total Sent</div>
                <div
                  class="text-base sm:text-xl font-bold text-red-400 truncate"
                >
                  {#if unit === currency}
                    {f(
                      (Math.abs(
                        payments
                          .filter((p) => p.displayAmount < 0 && !p.isUsdt)
                          .reduce((sum, p) => sum + p.displayAmount, 0),
                      ) /
                        sats) *
                        rate,
                      currency,
                      locale,
                    )}
                  {:else if unit === "btc"}
                    {btc(
                      Math.abs(
                        payments
                          .filter((p) => p.displayAmount < 0 && !p.isUsdt)
                          .reduce((sum, p) => sum + p.displayAmount, 0),
                      ),
                    )} BTC
                  {:else}
                    {s(
                      Math.abs(
                        payments
                          .filter((p) => p.displayAmount < 0 && !p.isUsdt)
                          .reduce((sum, p) => sum + p.displayAmount, 0),
                      ),
                    )} sats
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Date Range Dialog -->
    {#if showDateDialog}
      <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onclick={() => (showDateDialog = false)}
      >
        <div
          class="bg-base-200 rounded-2xl p-6 max-w-md w-full mx-4 border border-white/10"
          onclick={(e) => e.stopPropagation()}
        >
          <h3 class="text-xl font-bold mb-4">Select Date Range</h3>

          <div class="space-y-4">
            <div>
              <label class="label">
                <span class="label-text">Start Date</span>
              </label>
              <input
                type="date"
                bind:value={tempFromDate}
                class="input input-bordered w-full"
                max={tempToDate || new Date().toISOString().split("T")[0]}
              />
            </div>

            <div>
              <label class="label">
                <span class="label-text">End Date</span>
              </label>
              <input
                type="date"
                bind:value={tempToDate}
                class="input input-bordered w-full"
                min={tempFromDate}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          <div class="flex gap-2 mt-6">
            <button
              onclick={() => {
                tempFromDate = "";
                tempToDate = "";
                clearDateFilter();
              }}
              class="btn btn-ghost flex-1"
            >
              Clear
            </button>
            <button onclick={applyDateFilter} class="btn btn-primary flex-1">
              Apply
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Transactions List -->
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-0">
        {#if isInitialLoad}
          <!-- Loading State -->
          <div class="flex flex-col items-center gap-4 py-12">
            <div class="loading loading-spinner loading-lg"></div>
            <p class="text-white/60">Loading transactions...</p>
          </div>
        {:else if payments.length === 0}
          <!-- Empty State -->
          <div class="flex flex-col items-center gap-4 py-12">
            <iconify-icon icon="ph:receipt-x" width="64" class="text-white/20"
            ></iconify-icon>
            <div class="text-center">
              <h3 class="text-lg font-semibold mb-2">No transactions found</h3>
              <p class="text-sm text-white/60">
                {#if typeFilter !== "all" || fromTimestamp || toTimestamp}
                  Try adjusting your filters
                {:else}
                  Your transaction history will appear here
                {/if}
              </p>
            </div>
          </div>
        {:else}
          <!-- Transaction Items with Virtual Scrolling -->
          <div
            class="divide-y divide-white/5 max-h-[600px] overflow-y-auto transaction-scroll"
            onscroll={handleScroll}
          >
            {#each payments as payment, i}
              <div
                class="px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors group"
                onclick={() => goto(`/payment/${payment.id}`)}
                onkeydown={(e) =>
                  e.key === "Enter" && goto(`/payment/${payment.id}`)}
                role="button"
                tabindex="0"
              >
                <div class="flex items-center gap-4">
                  <!-- Icon -->
                  <div class="flex-shrink-0">
                    {#if payment.paymentIcon === "lightning"}
                      <div
                        class="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center"
                      >
                        <iconify-icon
                          icon="ph:lightning-fill"
                          width="24"
                          class="text-yellow-400"
                        ></iconify-icon>
                      </div>
                    {:else if payment.paymentIcon === "liquid"}
                      {#if payment.assetType === "usdt"}
                        <div
                          class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center"
                        >
                          <iconify-icon
                            icon="cryptocurrency:usdt"
                            width="24"
                            class="text-green-400"
                          ></iconify-icon>
                        </div>
                      {:else}
                        <div
                          class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center"
                        >
                          <iconify-icon
                            icon="ph:drop-fill"
                            width="24"
                            class="text-blue-400"
                          ></iconify-icon>
                        </div>
                      {/if}
                    {:else}
                      <div
                        class="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center"
                      >
                        <iconify-icon
                          icon="cryptocurrency:btc"
                          width="24"
                          class="text-orange-400"
                        ></iconify-icon>
                      </div>
                    {/if}
                  </div>

                  <!-- Main Content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <!-- Amount -->
                      <span
                        class="font-semibold {payment.displayAmount < 0
                          ? 'text-red-400'
                          : 'text-green-400'}"
                      >
                        {#if payment.isUsdt}
                          {payment.displayAmount < 0
                            ? "-"
                            : "+"}{payment.satsAmount}
                        {:else if unit === currency}
                          {payment.displayAmount < 0
                            ? "-"
                            : "+"}{payment.fiatAmount}
                        {:else if unit === "btc"}
                          {payment.displayAmount < 0
                            ? "-"
                            : "+"}{payment.btcAmount} BTC
                        {:else}
                          {payment.displayAmount < 0
                            ? "-"
                            : "+"}{payment.satsAmount} sats
                        {/if}
                      </span>

                      <!-- Status Badge -->
                      {#if payment.status === "pending" || payment.status === "waitingFeeAcceptance"}
                        <span
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/30 text-xs font-medium text-amber-300 shadow-lg shadow-amber-500/10"
                        >
                          <span class="relative flex h-2 w-2">
                            <span
                              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"
                            ></span>
                            <span
                              class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"
                            ></span>
                          </span>
                          Pending
                        </span>
                      {:else if payment.status === "waitingConfirmation"}
                        <span
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 text-xs font-medium text-blue-300 shadow-lg shadow-blue-500/10"
                        >
                          <span class="relative flex h-2 w-2">
                            <span
                              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
                            ></span>
                            <span
                              class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"
                            ></span>
                          </span>
                          Confirming
                        </span>
                      {:else if payment.status === "refundable"}
                        <span
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-400/30 text-xs font-medium text-orange-300"
                        >
                          <iconify-icon
                            icon="ph:arrow-counter-clockwise"
                            width="12"
                          ></iconify-icon>
                          Refundable
                        </span>
                      {:else if payment.status === "refundPending"}
                        <span
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-400/30 text-xs font-medium text-orange-300"
                        >
                          <span class="relative flex h-2 w-2">
                            <span
                              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"
                            ></span>
                            <span
                              class="relative inline-flex rounded-full h-2 w-2 bg-orange-500"
                            ></span>
                          </span>
                          Refunding
                        </span>
                      {:else if payment.status === "refunded"}
                        <span
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-400/30 text-xs font-medium text-blue-300"
                        >
                          <iconify-icon icon="ph:arrow-u-up-left" width="12"
                          ></iconify-icon>
                          Refunded
                        </span>
                      {:else if payment.status === "failed"}
                        <span
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-400/30 text-xs font-medium text-red-300"
                        >
                          <iconify-icon icon="ph:x-circle" width="12"
                          ></iconify-icon>
                          Failed
                        </span>
                      {/if}
                    </div>

                    <!-- Description or Type -->
                    <div class="text-sm text-white/60 truncate">
                      {#if payment.details?.description && payment.details.description !== "Liquid transfer"}
                        {payment.details.description}
                      {:else}
                        {payment.paymentTypeLabel}
                        {payment.paymentType === "receive"
                          ? "received"
                          : "sent"}
                      {/if}
                    </div>

                    <!-- Waiting Fee Acceptance Status -->
                    {#if payment.status === "waitingFeeAcceptance"}
                      <div class="text-xs text-amber-300/80 mt-0.5">
                        Waiting for fee acceptance
                      </div>
                    {/if}

                    <!-- Secondary Amount -->
                    <div class="text-xs text-white/40">
                      {#if payment.isUsdt}
                        {payment.paymentTypeLabel} on Liquid
                      {:else if unit === currency}
                        ≈ {payment.satsAmount} sats
                      {:else if unit === "btc"}
                        ≈ {payment.fiatAmount}
                      {:else}
                        ≈ {payment.fiatAmount}
                      {/if}
                    </div>

                    <!-- Fee Display (like misty-breez) - only show for completed non-USDT payments with fees -->
                    {#if !payment.isUsdt && payment.feesSat > 0 && payment.status !== "pending" && payment.status !== "waitingConfirmation"}
                      <div class="text-xs text-white/30 mt-0.5">
                        Fee: {s(payment.feesSat)} sats
                      </div>
                    {/if}
                  </div>

                  <!-- Time -->
                  <div class="flex-shrink-0 text-right text-sm">
                    <div class="text-white/60">{payment.formattedTime}</div>
                    <div class="text-white/40 text-xs">
                      {payment.formattedDate}
                    </div>
                  </div>

                  <!-- Action Arrow -->
                  <div
                    class="flex-shrink-0 text-white/20 group-hover:text-white/60 transition-colors"
                  >
                    <iconify-icon icon="ph:caret-right" width="20"
                    ></iconify-icon>
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <!-- Pagination -->
          {#if totalPages > 1}
            <div class="px-4 py-4 border-t border-white/10">
              <div
                class="flex flex-col sm:flex-row items-center justify-between gap-4"
              >
                <div class="text-sm text-white/60">
                  Page {currentPage} of {totalPages}
                  ({pageData.totalCount} total)
                </div>

                <div class="flex items-center gap-2">
                  <button
                    onclick={() => (currentPage = Math.max(1, currentPage - 1))}
                    disabled={!pageData?.hasPrevious}
                    class="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/5 flex items-center gap-2"
                  >
                    <iconify-icon icon="ph:caret-left" width="20"
                    ></iconify-icon>
                    <span class="hidden sm:inline">Previous</span>
                  </button>

                  <!-- Page Numbers -->
                  {#if totalPages <= 7}
                    {#each Array(totalPages) as _, i}
                      <button
                        onclick={() => (currentPage = i + 1)}
                        class="px-3 py-2 rounded-lg border transition-all {currentPage ===
                        i + 1
                          ? 'bg-gradient-to-br from-dgen-cyan to-dgen-aqua text-white border-dgen-aqua font-semibold'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'}"
                      >
                        {i + 1}
                      </button>
                    {/each}
                  {:else}
                    <!-- Smart pagination with ellipsis -->
                    {#if currentPage > 3}
                      <button
                        onclick={() => (currentPage = 1)}
                        class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all"
                        >1</button
                      >
                      <span class="px-2 text-white/40">...</span>
                    {/if}

                    {#each Array(Math.min(5, totalPages)) as _, i}
                      {@const pageNum = Math.max(
                        1,
                        Math.min(currentPage - 2 + i, totalPages - 4) + i,
                      )}
                      {#if pageNum > 0 && pageNum <= totalPages}
                        <button
                          onclick={() => (currentPage = pageNum)}
                          class="px-3 py-2 rounded-lg border transition-all {currentPage ===
                          pageNum
                            ? 'bg-gradient-to-br from-dgen-cyan to-dgen-aqua text-white border-dgen-aqua font-semibold'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'}"
                        >
                          {pageNum}
                        </button>
                      {/if}
                    {/each}

                    {#if currentPage < totalPages - 2}
                      <span class="px-2 text-white/40">...</span>
                      <button
                        onclick={() => (currentPage = totalPages)}
                        class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all"
                      >
                        {totalPages}
                      </button>
                    {/if}
                  {/if}

                  <button
                    onclick={() =>
                      (currentPage = Math.min(totalPages, currentPage + 1))}
                    disabled={!pageData?.hasNext}
                    class="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/5 flex items-center gap-2"
                  >
                    <span class="hidden sm:inline">Next</span>
                    <iconify-icon icon="ph:caret-right" width="20"
                    ></iconify-icon>
                  </button>
                </div>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  /* Smooth scrolling for virtual list */
  .transaction-scroll {
    scroll-behavior: smooth;
    scrollbar-gutter: stable;
    overflow-y: scroll; /* Force scrollbar to always show */
  }

  /* Prevent scrollbar flickering on hover */
  .transaction-scroll::-webkit-scrollbar {
    width: 10px;
  }

  .transaction-scroll::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 5px;
  }

  .transaction-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 5px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .transaction-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
    background-clip: padding-box;
  }

  /* Firefox scrollbar styling */
  .transaction-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0.2);
  }

  /* Loading animation */
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .animate-pulse {
    animation: pulse 2s infinite;
  }
</style>
