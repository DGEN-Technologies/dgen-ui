<script>
  import { onMount } from 'svelte';
  import { PUBLIC_DGEN_URL, PUBLIC_DGEN_NETWORK } from '$env/static/public';
  import { walletInfo } from '$lib/stores/wallet';

  export let show = false;
  export let amount = 100000;

  let loading = false;
  let loadingPrice = false;
  let error = null;
  let success = false;
  let step = 'input'; // 'input' or 'review'

  // State for USD input mode
  let inputMode = 'usd'; // 'usd' or 'sats'
  let usdAmount = 100; // Default $100 USD
  let btcPrice = null; // Will be fetched from SDK

  // Limits and fees state
  let currentLimits = null;
  let preparedFees = null;
  let usdLimits = { min: 0, max: 0 };

  // Track if we've already fetched data for this session
  let hasFetchedData = false;

  // Check if SDK is initialized (following Balance component pattern)
  $: sdkInitialized = $walletInfo !== null;

  // Fetch data when modal is shown AND SDK is initialized
  $: if (show && sdkInitialized && !hasFetchedData && !loadingPrice) {
    fetchBtcPriceAndLimits();
  }

  // Reset state when modal closes
  $: if (!show) {
    hasFetchedData = false;
    error = null;
    preparedFees = null;
    loadingPrice = false;
    step = 'input';
  }


  // Fetch real-time BTC price from SDK and limits
  async function fetchBtcPriceAndLimits() {
    // Prevent duplicate fetches
    if (hasFetchedData || loadingPrice) return;

    loadingPrice = true;
    error = null;

    try {
      const walletService = await import('$lib/walletService');

      // Check network - only mainnet is supported for buying Bitcoin
      if (PUBLIC_DGEN_NETWORK !== 'mainnet') {
        error = 'Buy Bitcoin is only available on mainnet';
        loadingPrice = false;
        hasFetchedData = true;
        return;
      }

      // Fetch fiat rates from SDK
      console.log('[BuyBitcoin] Fetching fiat rates...');
      const rates = await walletService.fetchFiatRates();
      const usdRate = rates.find(rate => rate.coin === 'USD');

      if (usdRate) {
        btcPrice = usdRate.value;
        console.log('[BuyBitcoin] Current BTC price:', btcPrice);
      } else {
        throw new Error('Failed to fetch USD exchange rate');
      }

      // Fetch onchain limits
      console.log('[BuyBitcoin] Fetching onchain limits...');
      currentLimits = await walletService.fetchOnchainLimits();
      console.log('[BuyBitcoin] Limits:', currentLimits);

      // Calculate USD limits
      usdLimits.min = (currentLimits.receive.minSat / 100000000) * btcPrice;
      usdLimits.max = (currentLimits.receive.maxSat / 100000000) * btcPrice;

      hasFetchedData = true;

    } catch (e) {
      console.error('[BuyBitcoin] Error fetching data:', e);
      error = e.message || 'Failed to load Bitcoin price and limits';
      // Mark as fetched even on error to prevent infinite retry loop
      hasFetchedData = true;
    } finally {
      loadingPrice = false;
    }
  }

  // Calculate sats from USD or USD from sats based on input mode
  // Ensure amount is always a multiple of 1000
  $: if (btcPrice && inputMode === 'usd') {
    const rawAmount = Math.round((usdAmount / btcPrice) * 100000000);
    amount = Math.round(rawAmount / 1000) * 1000; // Round to nearest 1000
  } else if (btcPrice) {
    amount = Math.round(amount / 1000) * 1000; // Ensure it's a multiple of 1000
    usdAmount = (amount / 100000000) * btcPrice;
  }

  // Validate amount is within limits
  $: amountValid = currentLimits && amount >= currentLimits.receive.minSat && amount <= currentLimits.receive.maxSat;
  $: amountError = currentLimits && amount < currentLimits.receive.minSat
    ? `Minimum: ${currentLimits.receive.minSat.toLocaleString()} sats ($${usdLimits.min.toFixed(2)})`
    : currentLimits && amount > currentLimits.receive.maxSat
    ? `Maximum: ${currentLimits.receive.maxSat.toLocaleString()} sats ($${usdLimits.max.toFixed(2)})`
    : null;

  $: continueDisabled = loading || !btcPrice || !amountValid || !currentLimits;

  // Track if we're processing to prevent double-calls
  let isProcessing = false;

  async function handleBuy() {
    if (isProcessing) return;

    isProcessing = true;
    loading = true;
    error = null;
    preparedFees = null;

    try {
      const walletService = await import('$lib/walletService');

      // Ensure amount is a multiple of 1000 (required by Moonpay API)
      if (amount % 1000 !== 0) {
        amount = Math.round(amount / 1000) * 1000;
      }

      // Validate amount against limits
      if (!currentLimits) {
        throw new Error('Limits not loaded. Please refresh and try again.');
      }

      if (amount < currentLimits.receive.minSat) {
        throw new Error(`Minimum amount is ${currentLimits.receive.minSat.toLocaleString()} sats ($${usdLimits.min.toFixed(2)} USD)`);
      }
      if (amount > currentLimits.receive.maxSat) {
        throw new Error(`Maximum amount is ${currentLimits.receive.maxSat.toLocaleString()} sats ($${usdLimits.max.toFixed(2)} USD)`);
      }

      // Prepare the buy Bitcoin request to get fees
      const prepareRequest = {
        provider: "moonpay",
        amountSat: amount
      };

      console.log('[BuyBitcoin] Preparing buy request:', prepareRequest);
      const prepareRes = await walletService.prepareBuyBitcoin(prepareRequest);
      console.log('[BuyBitcoin] Prepare response:', prepareRes);

      // Store fees to show user
      preparedFees = prepareRes.feesSat;

      // Show fees to user and wait for confirmation
      loading = false;
      step = 'review';

    } catch (e) {
      console.error('[BuyBitcoin] Error:', e);

      // Parse error message for better UX
      let errorMsg = e.message || 'Failed to prepare Bitcoin purchase';
      if (errorMsg.includes('TimedOut') || errorMsg.includes('Could not contact servers') || errorMsg.includes('error sending request')) {
        errorMsg = 'Network timeout. Please check your connection and try again.';
      }

      error = errorMsg;
      loading = false;
    } finally {
      isProcessing = false;
    }
  }

  async function confirmBuy() {
    if (!preparedFees) return;

    loading = true;
    error = null;

    try {
      const walletService = await import('$lib/walletService');

      // Re-prepare to get fresh prepareResponse
      const prepareRequest = {
        provider: "moonpay",
        amountSat: amount
      };

      const prepareRes = await walletService.prepareBuyBitcoin(prepareRequest);

      // Buy Bitcoin - generate the URL with redirect
      const buyRequest = {
        prepareResponse: prepareRes,
        redirectUrl: `${window.location.origin}/${window.location.pathname.split('/')[1] || ''}`
      };

      console.log('[BuyBitcoin] Executing buy:', buyRequest);
      const buyUrl = await walletService.buyBitcoin(buyRequest);

      if (buyUrl) {
        console.log('[BuyBitcoin] Navigating to URL:', buyUrl);
        // Use window.location.href instead of window.open for iOS Safari compatibility
        // iOS Safari blocks popups from async operations, so we navigate in the same tab
        window.location.href = buyUrl;
      }
    } catch (e) {
      console.error('[BuyBitcoin] Error:', e);

      // Parse error message for better UX
      let errorMsg = e.message || 'Failed to initiate Bitcoin purchase';
      if (errorMsg.includes('TimedOut') || errorMsg.includes('Could not contact servers') || errorMsg.includes('error sending request')) {
        errorMsg = 'Network timeout. Please check your connection and try again.';
      }

      error = errorMsg;
    } finally {
      loading = false;
    }
  }

  function cancelPrepare() {
    preparedFees = null;
    error = null;
    step = 'input';
  }
</script>

{#if show}
  <!-- Modal with iOS-compatible styling - SIMPLE VERSION -->
  <div style="position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(0,0,0,0.7); z-index: 2147483647 !important; display: flex; align-items: center; justify-content: center;">
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; max-width: 450px; width: 90%; margin: 20px; border-radius: 16px; border: 2px solid rgba(255,255,255,0.2); position: relative; z-index: 2147483647 !important;">

      <div class="text-center mb-6">
        <div class="text-2xl font-bold mb-2 gradient-text">Buy Bitcoin</div>
        <div class="text-gray-300">Purchase Bitcoin with fiat currency</div>
        {#if step === 'input'}
          <div class="text-sm text-yellow-400 mt-2">
            ⚠️ Enable popups on your web browser to complete purchase via Moonpay
          </div>
        {/if}
      </div>

      {#if !sdkInitialized}
        <!-- SDK not initialized yet -->
        <div class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mb-4"></div>
          <div class="text-gray-300">Initializing wallet...</div>
          <div class="text-xs text-gray-400 mt-2 mb-4">Please wait while we connect to your wallet</div>
          <button
            type="button"
            class="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
            on:click={() => show = false}
          >
            Cancel
          </button>
        </div>
      {:else if loadingPrice}
        <div class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mb-4"></div>
          <div class="text-gray-300 mb-4">Loading Bitcoin price and limits...</div>
          <button
            type="button"
            class="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
            on:click={() => {
              loadingPrice = false;
              show = false;
            }}
          >
            Cancel
          </button>
        </div>
      {:else if error && !btcPrice}
        <!-- Error state - show error prominently when we have no data -->
        <div class="text-center py-8">
          <div class="mb-4 p-4 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg text-red-300">
            <div class="flex items-start gap-2 justify-center">
              <iconify-icon icon="ph:warning-circle" class="flex-shrink-0 mt-0.5" width="20"></iconify-icon>
              <div class="flex-1 text-left">
                <div class="font-semibold mb-1">Failed to load</div>
                <div class="text-sm">{error}</div>
              </div>
            </div>
          </div>
          <div class="flex gap-3">
            <button
              type="button"
              class="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              on:click={() => show = false}
            >
              Close
            </button>
            <button
              type="button"
              class="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-lg transition-colors"
              on:click={() => {
                hasFetchedData = false;
                error = null;
                loadingPrice = false;
                fetchBtcPriceAndLimits();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      {:else if step === 'input'}
        <!-- Step 1: Amount Input -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-300 mb-2">
            {inputMode === 'usd' ? 'USD Amount' : 'Bitcoin Amount (sats)'}
          </label>
          <div class="relative">
            {#if inputMode === 'usd'}
              <div class="relative">
                <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  bind:value={usdAmount}
                  min={usdLimits.min}
                  max={usdLimits.max}
                  step="1"
                  class="w-full pl-8 pr-4 py-3 bg-black bg-opacity-30 border border-white border-opacity-20 rounded-lg text-white"
                  placeholder="100"
                  disabled={!btcPrice}
                />
              </div>
              <div class="text-xs text-gray-400 mt-1">
                {#if btcPrice}
                  ≈ {amount.toLocaleString()} sats
                {:else}
                  Loading price...
                {/if}
              </div>
            {:else}
              <input
                type="number"
                bind:value={amount}
                min={currentLimits?.receive.minSat || 10000}
                max={currentLimits?.receive.maxSat}
                step="1000"
                class="w-full px-4 py-3 bg-black bg-opacity-30 border border-white border-opacity-20 rounded-lg text-white"
                placeholder="100000"
                disabled={!btcPrice}
              />
              <div class="text-xs text-gray-400 mt-1">
                {#if btcPrice}
                  ≈ ${usdAmount.toFixed(2)} USD
                {:else}
                  Loading price...
                {/if}
              </div>
            {/if}
          </div>

          <!-- Show limits info -->
          {#if currentLimits && btcPrice}
            <div class="text-xs text-gray-400 mt-2">
              Limits: {currentLimits.receive.minSat.toLocaleString()} - {currentLimits.receive.maxSat.toLocaleString()} sats
              (${usdLimits.min.toFixed(2)} - ${usdLimits.max.toFixed(2)} USD)
            </div>
          {/if}

          <!-- Show amount validation error -->
          {#if amountError}
            <div class="text-xs text-red-400 mt-2">
              {amountError}
            </div>
          {/if}

          <!-- Toggle between USD and sats -->
          <div class="flex items-center justify-center mt-3">
            <button
              type="button"
              class="text-xs text-blue-400 hover:text-blue-300 transition-colors underline"
              on:click={() => inputMode = inputMode === 'usd' ? 'sats' : 'usd'}
              disabled={!btcPrice}
            >
              Switch to {inputMode === 'usd' ? 'Bitcoin (sats)' : 'USD'} input
            </button>
          </div>
        </div>

        {#if error}
          <div class="mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg text-red-300 text-sm">
            <div class="flex items-start gap-2">
              <iconify-icon icon="ph:warning-circle" class="flex-shrink-0 mt-0.5" width="16"></iconify-icon>
              <div class="flex-1">
                <div>{error}</div>
                {#if error.includes('Network timeout') || error.includes('not connected')}
                  <button
                    type="button"
                    class="mt-2 px-3 py-1 text-xs bg-red-500/30 hover:bg-red-500/40 rounded transition-colors"
                    on:click={() => {
                      error = null;
                      handleBuy();
                    }}
                  >
                    Retry
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        {#if success}
          <div class="mb-4 p-3 bg-green-500 bg-opacity-20 border border-green-500 rounded-lg text-green-300 text-sm">
            Opening purchase page...
          </div>
        {/if}

        <div class="flex gap-3">
          <button
            type="button"
            class="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
            on:click={() => {
              loading = false;
              isProcessing = false;
              show = false;
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={continueDisabled}
            on:click={handleBuy}
          >
            {#if loading}
              Loading...
            {:else}
              Continue
            {/if}
          </button>
        </div>
      {:else if step === 'review'}
        <!-- Step 2: Fee Confirmation -->
        <div class="mb-6 space-y-4">
          <div class="p-4 bg-blue-500 bg-opacity-10 border border-blue-500 rounded-lg">
            <div class="text-sm text-gray-300 mb-3">Review your purchase:</div>

            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Amount:</span>
                <span class="text-white font-semibold">
                  {amount.toLocaleString()} sats
                  <span class="text-gray-400 text-sm">(${ (amount / 100000000 * btcPrice).toFixed(2)})</span>
                </span>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-gray-400">Network Fees:</span>
                <span class="text-white font-semibold">
                  {preparedFees.toLocaleString()} sats
                  <span class="text-gray-400 text-sm">(${ (preparedFees / 100000000 * btcPrice).toFixed(2)})</span>
                </span>
              </div>

              <div class="border-t border-gray-600 pt-2 mt-2">
                <div class="flex justify-between items-center">
                  <span class="text-gray-300 font-medium">You will receive:</span>
                  <span class="text-green-400 font-bold">
                    {(amount - preparedFees).toLocaleString()} sats
                    <span class="text-gray-400 text-sm">(${ ((amount - preparedFees) / 100000000 * btcPrice).toFixed(2)})</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="text-xs text-gray-400 text-center">
            You will be redirected to Moonpay to complete your purchase
          </div>
        </div>

        {#if error}
          <div class="mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg text-red-300 text-sm">
            <div class="flex items-start gap-2">
              <iconify-icon icon="ph:warning-circle" class="flex-shrink-0 mt-0.5" width="16"></iconify-icon>
              <div class="flex-1">
                <div>{error}</div>
                {#if error.includes('Network timeout')}
                  <button
                    type="button"
                    class="mt-2 px-3 py-1 text-xs bg-red-500/30 hover:bg-red-500/40 rounded transition-colors"
                    on:click={() => {
                      error = null;
                      confirmBuy();
                    }}
                  >
                    Retry
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        {#if success}
          <div class="mb-4 p-3 bg-green-500 bg-opacity-20 border border-green-500 rounded-lg text-green-300 text-sm">
            Opening purchase page...
          </div>
        {/if}

        <div class="flex gap-3">
          <button
            type="button"
            class="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
            on:click={() => {
              if (loading) {
                // Cancel loading operation
                loading = false;
                show = false;
              } else {
                // Go back to input
                cancelPrepare();
              }
            }}
          >
            {loading ? 'Cancel' : 'Back'}
          </button>
          <button
            type="button"
            class="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
            style="min-width: 140px;"
            disabled={loading}
            on:click={confirmBuy}
          >
            {#if loading}
              <span class="inline-flex items-center gap-2">
                <div class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Processing
              </span>
            {:else}
              Confirm & Buy
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}