<script>
  import { run } from "svelte/legacy";
  import {
    btc,
    loc,
    post,
    copy,
    fail,
    f,
    get,
    types,
    sat,
    s,
    sats,
  } from "$lib/utils";
  import { tick, onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { last, showQr, amountPrompt } from "$lib/store";
  import Avatar from "$comp/Avatar.svelte";
  import InvoiceData from "$comp/InvoiceData.svelte";
  import InvoiceActions from "$comp/InvoiceActions.svelte";
  import SetAmount from "$comp/SetAmount.svelte";
  import SetMemo from "$comp/SetMemo.svelte";
  import SetType from "$comp/SetType.svelte";
  import WalletRequiredWarning from "$comp/WalletRequiredWarning.svelte";
  import Qr from "$comp/Qr.svelte";
  import Success from "$comp/Success.svelte";
  import { t } from "$lib/translations";
  import { goto, invalidate } from "$app/navigation";
  import { page } from "$app/stores";
  import {
    getWalletInfo,
    prepareReceivePayment,
    receivePayment,
    fetchOnchainLimits,
    fetchLightningLimits,
    setupLightningAddress,
  } from "$lib/walletService";
  import { lnAddressStore, hasValidAddress, isLoading as isLnAddressLoading } from "$lib/stores/lightningAddress";
  import { walletStore, transactions } from "$lib/stores/wallet";
  import { paymentReceived } from "$lib/stores/paymentEvents";
  import { PUBLIC_DGEN_URL } from "$env/static/public";

  let { data } = $props();

  let showOptions;

  let id = $state();
  let { rate, subject, user, text, isMockMode } = $derived(data);
  let locale = loc(user);

  let { currency, username } = subject;
  let hash = $state("");
  let invoiceText = $state(""); // Don't use the text from server, it's just username@host
  let qr;

  let aid = subject.id;
  // Use state for mutable invoice data
  let invoiceType = $state(types.lightning);
  let invoiceMemo = $state("");
  let invoiceAddressType = $state();
  let selectedAsset = $state("lbtc"); // "lbtc" or "usdt" for Liquid payments

  let invoice = $derived({
    aid,
    type: invoiceType,
    address_type: invoiceAddressType,
    items: [],
    rate,
    text: invoiceText || "",
    uid: subject.id,
    user: subject,
    amount: amount,
    memo: invoiceMemo,
    tip: tip,
    selectedAsset: selectedAsset, // Pass selected asset to components
  });
  let amount = $state(),
    amountFiat,
    tip = $state();

  let updating = $state(false);
  let lastError = $state(null);
  let walletInitialized = $state(true); // Assume initialized by default
  let walletSkipped = $state(false);
  let onchainLimits = $state(null);
  let lightningLimits = $state(null);
  let fetchingLimits = $state(false);
  let showMoreOptions = $state(false); // Controls "More deposit options" panel
  let showMoreOptionsExpanded = $state(false); // Controls expanded vs collapsed state
  let showLightningAddress = $state(false); // Controls Lightning Address special view
  let autoRegisteringAddress = $state(false);
  let showEditModal = $state(false);

  // Payment received animation state
  let showingSuccess = $state(false);
  let receivedPayment = $state(null);

  // Derived state for Lightning Address
  let lightningAddress = $derived($lnAddressStore.lnAddress);
  let hasLightningAddress = $derived($hasValidAddress);
  let registrationError = $derived($lnAddressStore.error);

  // Auto-register Lightning Address if not already registered
  // Uses username from user account, with automatic retry on collision
  const autoRegisterLightningAddress = async () => {
    lnAddressStore.setLoading();

    try {
      const { isConnected, formatUsername, registerLightningAddress, recoverLightningAddress } = await import('$lib/walletService');

      // Wait for SDK to be ready
      let attempts = 0;
      while (!isConnected() && attempts < 40) {
        await new Promise(resolve => setTimeout(resolve, 250));
        attempts++;
      }

      if (!isConnected()) {
        console.log('[Lightning Address] SDK failed to initialize, cannot auto-register');
        lnAddressStore.reset();
        autoRegisteringAddress = false;
        return;
      }

      console.log('[Lightning Address] SDK ready, proceeding with auto-registration');

      const serverOrigin = PUBLIC_DGEN_URL;
      const webhookUrl = new URL('/api/v1/notify', serverOrigin);
      webhookUrl.searchParams.set('user', user.id);

      // Try recovery first - this checks if current seed already has a registered address
      console.log('[Lightning Address] Attempting recovery first...');
      const recovered = await recoverLightningAddress(webhookUrl.toString());

      if (recovered && recovered.lightningAddress) {
        console.log('[Lightning Address] Recovered existing address:', recovered.lightningAddress);

        lnAddressStore.setSuccess(
          recovered.lnurl,
          recovered.lightningAddress || '',
          recovered.bip353Address
        );

        // Save to user profile (update database if it changed)
        await post('/user', {
          lightningAddress: recovered.lightningAddress,
          lnurl: recovered.lnurl,
          bip353Address: recovered.bip353Address
        });

        user.lightningAddress = recovered.lightningAddress;
        user.lnurl = recovered.lnurl;
        user.bip353Address = recovered.bip353Address;

        return;
      }

      // No existing address for this seed
      // Clear stale database address if one exists (from previous seed)
      if (user.lightningAddress) {
        console.log('[Lightning Address] Clearing stale database address:', user.lightningAddress);
        await post('/user', {
          lightningAddress: null,
          lnurl: null,
          bip353Address: null
        });
        user.lightningAddress = null;
        user.lnurl = null;
        user.bip353Address = null;
      }

      // Register new address with retry logic
      console.log('[Lightning Address] No existing address found, registering new one...');

      // Use formatted username from user account
      const baseUsername = formatUsername(user.username);
      console.log('[Lightning Address] Auto-registering with username:', baseUsername);

      // registerLightningAddress now includes automatic retry with discriminators
      const result = await registerLightningAddress(
        baseUsername,
        webhookUrl.toString()
      );

      console.log('[Lightning Address] Auto-registration successful:', result.lightningAddress);

      // Log if username was modified with discriminator
      if (result.usernameModified) {
        console.log('[Lightning Address] Username was modified from', result.requestedUsername, 'to', result.actualUsername);
      }

      lnAddressStore.setSuccess(
        result.lnurl,
        result.lightningAddress || '',
        result.bip353Address
      );

      // Save to user profile
      await post('/user', {
        lightningAddress: result.lightningAddress,
        lnurl: result.lnurl,
        bip353Address: result.bip353Address
      });

      user.lightningAddress = result.lightningAddress;
      user.lnurl = result.lnurl;
      user.bip353Address = result.bip353Address;

    } catch (e) {
      console.error('[Lightning Address] Auto-registration failed:', e);
      lnAddressStore.setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      autoRegisteringAddress = false;
    }
  };

  // Track which payment IDs we've already shown to avoid duplicates
  let shownPaymentIds = $state(new Set());

  // Subscribe to payment events
  $effect(() => {
    if ($paymentReceived && browser) {
      const paymentId = $paymentReceived.payment?.id || $paymentReceived.payment?.txId || $paymentReceived.timestamp;

      // Only show if we haven't shown this payment before
      if (!shownPaymentIds.has(paymentId)) {
        console.log('[Receive] Payment received event:', $paymentReceived);
        shownPaymentIds.add(paymentId);
        receivedPayment = $paymentReceived;
        showingSuccess = true;

        // Auto-dismiss and navigate after 2.5 seconds
        setTimeout(() => {
          showingSuccess = false;
          // Clear the payment event from store to prevent re-triggering
          paymentReceived.set(null);
          // Navigate to home or stay on page
          goto(`/${username}`);
        }, 2500);
      }
    }
  });

  // Check wallet status and fetch limits on mount
  onMount(async () => {
    if (user?.id === subject?.id) {
      // IMPORTANT: Don't initialize from database address - it might be stale
      // Each seed = unique Lightning address
      // Always verify via recovery first, then show address only if it works for THIS seed

      // Set loading state immediately
      autoRegisteringAddress = true;
      lnAddressStore.setLoading();

      // Start registration/recovery process
      // This will try recovery first, and register new if needed
      autoRegisterLightningAddress();

      try {
        // Import and check if SDK is connected
        const { isConnected } = await import('$lib/walletService');
        walletInitialized = isConnected();

        // Fetch payment limits if wallet initialized
        if (walletInitialized) {
          fetchingLimits = true;
          try {
            [onchainLimits, lightningLimits] = await Promise.all([
              fetchOnchainLimits(),
              fetchLightningLimits()
            ]);
          } catch (e) {
            console.error("Failed to fetch payment limits:", e);
          } finally {
            fetchingLimits = false;
          }
        } else {
          console.log("SDK not connected yet, will become available when ready");
        }
      } catch (e) {
        console.log("Wallet SDK initializing in background:", e);
        walletInitialized = false;
      }
    }

    // Periodically check if SDK becomes ready
    const checkInterval = setInterval(async () => {
      if (!walletInitialized) {
        const { isConnected } = await import('$lib/walletService');
        if (isConnected()) {
          walletInitialized = true;
          console.log("SDK connected - wallet ready for use");

          // Fetch limits now that SDK is ready
          try {
            [onchainLimits, lightningLimits] = await Promise.all([
              fetchOnchainLimits(),
              fetchLightningLimits()
            ]);
          } catch (e) {
            console.error("Failed to fetch payment limits:", e);
          }

          clearInterval(checkInterval);
        }
      } else {
        clearInterval(checkInterval);
      }
    }, 500);

    // Cleanup
    return () => clearInterval(checkInterval);
  });

  let update = async (showOptions = false) => {
    // Check if already updating - prevent duplicate calls
    if (updating) {
      return;
    }

    updating = true;
    lastError = null; // Clear previous error

    // Clear previous invoice/QR to provide immediate feedback
    invoiceText = "";
    hash = "";
    id = "";

    // For Liquid/Bitcoin/Lightning, wait for SDK to be ready
    if ([types.liquid, types.bitcoin, types.lightning].includes(invoiceType)) {
      if (!walletInitialized) {
        // Wait for SDK to initialize (max 10 seconds)
        const { isConnected } = await import('$lib/walletService');
        let attempts = 0;
        while (!isConnected() && attempts < 40) {
          await new Promise(resolve => setTimeout(resolve, 250));
          attempts++;
        }

        walletInitialized = isConnected();

        if (!walletInitialized) {
          updating = false;
          fail("Wallet SDK failed to initialize. Please refresh the page.");
          return;
        }
      }
    }
    invoiceText = "";
    hash = "";

    try {
      // Use browser SDK for all payment types
      if (invoiceType === types.lightning) {
        if (!amount || amount <= 0) {
          fail("Lightning invoices require an amount");
          return;
        }

        const prepareRequest = {
          paymentMethod: 'lightning',  // Use 'lightning' like wasm-example-app
          amount: {
            type: 'bitcoin',
            payerAmountSat: amount
          }
        };

        const prepareResponse = await prepareReceivePayment(prepareRequest);

        const receiveRequest = {
          prepareResponse,
          description: invoiceMemo || ""
        };

        // Add timeout to prevent infinite hanging
        const receivePromise = receivePayment(receiveRequest);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Invoice generation timed out after 30 seconds")), 30000)
        );

        const receiveResponse = await Promise.race([receivePromise, timeoutPromise]);

        invoiceText = receiveResponse.destination;
        id = receiveResponse.destination; // Use destination as ID
        hash = "";
      }
      // Bitcoin on-chain address generation
      else if (invoiceType === types.bitcoin) {
        const prepareRequest = {
          paymentMethod: 'bitcoinAddress',
          amount: amount > 0 ? {
            type: 'bitcoin',
            payerAmountSat: amount
          } : undefined
        };
        
        const prepareResponse = await prepareReceivePayment(prepareRequest);
        
        const receiveRequest = {
          prepareResponse,
          description: invoiceMemo || ""
        };
        
        const receiveResponse = await receivePayment(receiveRequest);
        invoiceText = receiveResponse.destination; // BIP21 URI
        
        // Extract just the address from BIP21 URI for display
        const addressMatch = invoiceText.match(/^bitcoin:([^?]+)/);
        hash = addressMatch ? addressMatch[1] : invoiceText;
        id = hash; // Use address as ID
      }
      // Liquid address generation (LBTC or USDT)
      else if (invoiceType === types.liquid) {
        // For Liquid, there are no hard limits, but amount should be greater than broadcast fees
        // The SDK docs state: "There are no limits, but the payer amount should be greater than broadcast fees when specified"
        // Amount is OPTIONAL - if not specified, creates address that can receive any amount

        // Step 1: Prepare receive payment (calculate fees, validate)
        let prepareRequest;

        if (selectedAsset === 'usdt') {
          // Receiving USDT
          // For Liquid assets, payerAmount is OPTIONAL
          // If not specified, it creates an amountless BIP21 URI
          const usdtAssetId = 'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2';

          prepareRequest = {
            paymentMethod: 'liquidAddress',
            amount: {
              type: 'asset',
              assetId: usdtAssetId,
              ...(amount && amount > 0 && { payerAmount: amount })
            }
          };
        } else {
          // Receiving LBTC (default)
          // For LBTC, payerAmountSat is OPTIONAL
          // If not specified, it creates an address that can receive any amount
          prepareRequest = {
            paymentMethod: 'liquidAddress',
            amount: amount && amount > 0 ? {
              type: 'bitcoin',  // For LBTC
              payerAmountSat: amount
            } : undefined  // Don't pass amount object at all - generates plain address
          };
        }

        const prepareResponse = await prepareReceivePayment(prepareRequest);

        // Validate that amount is greater than broadcast fees (only if amount was specified)
        if (amount && amount > 0 && prepareResponse.feesSat > 0) {
          // For USDT, convert amount back to sats for comparison
          const amountInSats = selectedAsset === 'usdt'
            ? amount  // amount is already in smallest unit (like sats)
            : amount;

          if (amountInSats <= prepareResponse.feesSat) {
            fail(`Amount must be greater than broadcast fees (${sat(prepareResponse.feesSat)})`);
            return;
          }
        }

        // Step 2: Generate the actual address/BIP21 URI
        const receiveRequest = {
          prepareResponse,
          description: invoiceMemo || "",
          useDescriptionHash: false
        };

        const receiveResponse = await receivePayment(receiveRequest);
        invoiceText = receiveResponse.destination; // BIP21 URI with amount

        // Extract plain address from BIP21 URI for display
        // Format: liquidnetwork:lq1...?amount=0.00010000&label=Description
        const liquidMatch = invoiceText.match(/^liquidnetwork:([^?]+)/);
        hash = liquidMatch ? liquidMatch[1] : invoiceText;
        id = hash; // Use address as ID for tracking
      }
      // For other types that aren't supported yet
      else {
        const result = await post(`/invoice`, {
          invoice,
          user: { username, currency },
        });

        if (!result || !result.id) {
          fail("Failed to create invoice");
          return;
        }

        ({ id } = result);

        if (invoiceType === types.bolt12) {
          invoiceText = result.text || "";
          hash = "";
        } else if ([types.bitcoin, types.liquid, types.usdt].includes(invoiceType)) {
          hash = result.hash || "";
          invoiceText = result.text || "";
        }

      }

      // Reset updating flag BEFORE UI updates to prevent race conditions
      updating = false;

      // Refresh wallet data immediately after creating invoice (like wasm-example-app)
      // This ensures the invoice appears in the transaction list right away
      try {
        await walletStore.refresh();
        await transactions.refresh();
      } catch (e) {
        console.error("[UPDATE] Failed to refresh wallet data:", e);
      }

      if (invoiceText) {
        $showQr = false;
        await tick();
        $showQr = true;
      }
    } catch (e) {
      console.error("Failed to create invoice:", e);

      // Provide user-friendly error messages for common issues
      const errorMsg = e.message || String(e);
      if (errorMsg.includes("Could not contact servers") || errorMsg.includes("TimedOut") || errorMsg.includes("network")) {
        lastError = "Network error - Breez servers are unreachable. Please try again.";
        fail(lastError);
      } else {
        lastError = errorMsg;
        fail(errorMsg);
      }

      // Reset updating flag on error
      updating = false;
    }
  };

  let settingType = $state();
  let toggleType = () => (settingType = !settingType);
  let setType = async (type, address_type) => {
    $showQr = true;
    settingType = false;

    // If we're already processing, force reset and allow type switch
    // This allows users to cancel ongoing operations
    if (updating) {
      updating = false;
    }

    // Clear existing invoice data when switching types
    hash = "";
    invoiceText = "";
    id = undefined;

    // Update the invoice type
    invoiceAddressType = address_type;
    invoiceType = type;

    // Lightning ALWAYS requires an amount (can't create BOLT11 without it)
    // So always show amount modal for Lightning, regardless of toggle
    if (type === types.lightning) {
      settingAmountFromOptions = true;
      toggleAmount(); // Always show the amount modal for Lightning
    }
    // Bitcoin on-chain - NEVER show amount modal, just generate address immediately
    // Amount is optional, user can specify later if needed
    else if (type === types.bitcoin) {
      // Always generate address without amount (amount is optional)
      amount = undefined;
      await update();
    }
    // Liquid requires selecting an asset first (Bitcoin or USDT)
    // Just switch to Liquid view and show asset selection buttons
    // The asset buttons will trigger the amount modal when clicked
    else if (type === types.liquid) {
      // Don't auto-generate - user needs to select asset and amount
    }
    // LNURL/Lightning Address is static - just show the address
    else if (type === "lnurl") {
      // Get the domain from the URL config
      const domain = window.location.hostname;
      invoiceText = `${username}@${domain}`;
      hash = "";
      $showQr = true;
      updating = false;
    }
    // USDT and BOLT12 don't require an amount
    else {
      if (typeof newAmount !== "undefined") amount = newAmount;
      await update(); // Create new USDT address or BOLT12 offer
    }
  };

  let setAmount = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (typeof $amountPrompt === "undefined") $amountPrompt = true;

    // Make sure we have a valid amount
    if (!newAmount || newAmount <= 0) {
      fail("Please enter an amount");
      // Don't close dialog - keep user on numberpad
      return;
    }

    // Check minimum for Bitcoin on-chain
    if (invoiceType === types.bitcoin && newAmount < 25000) {
      fail("Below minimum: 0.00025 BTC (25,000 sats)");
      // Don't close dialog - keep user on numberpad until valid amount
      return;
    }

    // Only close the dialog if validation passed
    settingAmount = false;

    amount = newAmount;
    tip = null;

    // If coming from More Options, create Lightning invoice
    if (settingAmountFromOptions) {
      settingAmountFromOptions = false;
      // Don't call setType again, just update
      await update();
      return;
    }

    // Otherwise create invoice immediately
    await update();
  };

  let newAmount = $state(0);
  let settingAmount = $state();
  let settingAmountFromOptions = $state(false);
  let fiat = $state(true);
  let toggleAmount = () => (settingAmount = !settingAmount);

  let setMemo = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    settingMemo = false;
    invoiceMemo = memo;
    // Always preserve amount when setting memo
    if (typeof newAmount !== "undefined" && newAmount > 0) {
      amount = newAmount;
    }
    // amount is already preserved in the derived invoice
    await update();
  };

  let memo = $state();
  let settingMemo = $state();
  let toggleMemo = () => (settingMemo = !settingMemo);

  let link = $derived(
    [types.bitcoin, types.liquid, types.usdt].includes(invoiceType)
      ? invoiceText
      : invoiceType === "lnurl"
        ? `lightning:${invoiceText}`
        : `lightning:${invoiceText}`,
  );
  let txt = $derived(
    [types.bitcoin, types.liquid, types.usdt].includes(invoiceType) ? hash : invoiceText,
  );

  onMount(() => {
    // Set showQr to true initially
    $showQr = true;

    let address_type = $page.url.searchParams.get("address_type");
    let showParam = $page.url.searchParams.get("show");

    if (showParam === "lightning-address") {
      // Coming from profile page - show Lightning Address
      showMoreOptions = true;
      showMoreOptionsExpanded = false;
      showLightningAddress = true;
      invoiceType = "lnurl";
    } else if (address_type) {
      setType(types.bitcoin, address_type);
    } else {
      // Default to Lightning BOLT11 - let user set amount when ready
      invoiceType = types.lightning;
      settingAmountFromOptions = false;
      // Don't auto-show amount modal - let user explore deposit options first
    }

    // Listen for needAmount event from InvoiceTypes
    const handleNeedAmount = (event) => {
      if (!amount && !settingAmount) {
        settingAmountFromOptions = true;
        toggleAmount();
      }
    };
    window.addEventListener("needAmount", handleNeedAmount);

    return () => {
      window.removeEventListener("needAmount", handleNeedAmount);
    };
  });
</script>

<div class="min-h-screen relative">
  <!-- Payment Success Overlay -->
  {#if showingSuccess && receivedPayment}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg">
      <Success
        amount={receivedPayment.payment?.amountSat || 0}
        {rate}
        tip={0}
        currency={user.currency || 'USD'}
        {locale}
        title={$t("invoice.paymentSuccessful") || "Payment Received!"}
      />
    </div>
  {/if}

  <!-- Content Container -->
  <div class="invoice container mx-auto max-w-xl px-4 py-4 sm:py-6 relative z-10">
    <!-- Title with epic glow effect -->
    <div class="text-center mb-4 sm:mb-6 animate-fadeInUp">
      <div class="relative inline-block">
        <h1 class="text-4xl md:text-5xl font-bold mb-2">
          <span class="gradient-text">Receive</span>
        </h1>
      </div>

      <!-- More deposit options - Collapsed compact buttons -->
      {#if showMoreOptions && !showMoreOptionsExpanded}
        <div class="flex justify-center mt-4">
          <button
            class="text-base text-white/60 hover:text-white transition-all duration-300 flex items-center gap-2 hover:gap-3"
            onclick={() => {
              showMoreOptionsExpanded = true;
              showLightningAddress = false;
            }}
          >
            <span class="text-lg md:text-2xl font-semibold">More deposit options</span>
            <iconify-icon icon="ph:caret-down-bold" width="16"></iconify-icon>
          </button>
        </div>

        <!-- Compact payment method buttons (70% size = 30% smaller) -->
        <div class="flex flex-wrap justify-center gap-2 mt-4 px-4">
          <!-- Liquid Button -->
          <button
            class="premium-card border-2 transition-all duration-300 hover:scale-105 flex items-center gap-2 px-4 py-3"
            class:border-blue-400={invoiceType === types.liquid && !showLightningAddress}
            class:bg-blue-400={invoiceType === types.liquid && !showLightningAddress}
            class:bg-opacity-20={invoiceType === types.liquid && !showLightningAddress}
            class:shadow-lg={invoiceType === types.liquid && !showLightningAddress}
            class:shadow-blue-400={invoiceType === types.liquid && !showLightningAddress}
            class:border-white={invoiceType !== types.liquid || showLightningAddress}
            class:border-opacity-20={invoiceType !== types.liquid || showLightningAddress}
            class:hover:border-blue-400={invoiceType !== types.liquid || showLightningAddress}
            class:hover:border-opacity-60={invoiceType !== types.liquid || showLightningAddress}
            onclick={() => {
              // Switch to Liquid - just set type, don't auto-generate
              showLightningAddress = false;
              invoiceType = types.liquid;
              // Clear invoice data to show asset picker
              invoiceText = '';
              hash = '';
              id = undefined;
            }}
            style="transform: scale(0.7);"
          >
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
              <iconify-icon icon="ph:drop-fill" class="text-white" width="18"></iconify-icon>
            </div>
            <span class="font-bold text-white text-sm">Liquid</span>
          </button>

          <!-- Bitcoin Button -->
          <button
            class="premium-card border-2 transition-all duration-300 hover:scale-105 flex items-center gap-2 px-4 py-3"
            class:border-orange-400={invoiceType === types.bitcoin && !showLightningAddress}
            class:bg-orange-400={invoiceType === types.bitcoin && !showLightningAddress}
            class:bg-opacity-20={invoiceType === types.bitcoin && !showLightningAddress}
            class:shadow-lg={invoiceType === types.bitcoin && !showLightningAddress}
            class:shadow-orange-400={invoiceType === types.bitcoin && !showLightningAddress}
            class:border-white={invoiceType !== types.bitcoin || showLightningAddress}
            class:border-opacity-20={invoiceType !== types.bitcoin || showLightningAddress}
            class:hover:border-orange-400={invoiceType !== types.bitcoin || showLightningAddress}
            class:hover:border-opacity-60={invoiceType !== types.bitcoin || showLightningAddress}
            onclick={() => {
              // Switch to Bitcoin
              showLightningAddress = false;
              newAmount = undefined;
              amount = undefined;
              setType(types.bitcoin);
            }}
            style="transform: scale(0.7);"
          >
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <img src="/images/bitcoin.svg" class="w-5 h-5" alt="Bitcoin" />
            </div>
            <span class="font-bold text-white text-sm">Bitcoin</span>
          </button>

          <!-- Lightning Button -->
          <button
            class="premium-card border-2 transition-all duration-300 hover:scale-105 flex items-center gap-2 px-4 py-3"
            class:border-dgen-aqua={showLightningAddress}
            class:bg-dgen-aqua={showLightningAddress}
            class:bg-opacity-20={showLightningAddress}
            class:shadow-lg={showLightningAddress}
            class:shadow-dgen-aqua={showLightningAddress}
            class:border-white={!showLightningAddress}
            class:border-opacity-20={!showLightningAddress}
            class:hover:border-dgen-aqua={!showLightningAddress}
            class:hover:border-opacity-60={!showLightningAddress}
            onclick={() => {
              // Switch to Lightning Address view
              showLightningAddress = true;
              invoiceType = "lnurl";
              // Clear any existing invoice data
              invoiceText = '';
              hash = '';
              id = undefined;
            }}
            style="transform: scale(0.7);"
          >
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-dgen-aqua to-cyan-500 flex items-center justify-center">
              <iconify-icon icon="ph:at-bold" class="text-white" width="18"></iconify-icon>
            </div>
            <span class="font-bold text-white text-sm">Lightning</span>
          </button>
        </div>
      {/if}

      <!-- More deposit options button (when collapsed state not yet activated) -->
      {#if !showMoreOptions && !showLightningAddress}
        <div class="flex justify-center mt-4">
          <button
            class="text-base text-white/60 hover:text-white transition-all duration-300 flex items-center gap-2 hover:gap-3"
            onclick={() => {
              showMoreOptions = true;
              showMoreOptionsExpanded = true;
            }}
          >
            <span class="text-lg md:text-2xl font-semibold">More deposit options</span>
            <iconify-icon icon="ph:caret-down-bold" width="16"></iconify-icon>
          </button>
        </div>
      {/if}

      <!-- Payment Method Selection (Lightning Address, Bitcoin, Liquid) - EXPANDED view -->
      {#if showMoreOptionsExpanded && !showLightningAddress}
      <div class="space-y-4 mt-5">
        <!-- Payment Method Cards -->
        <div class="grid grid-cols-1 gap-3 px-2">
          <!-- Liquid Network -->
          <button
            class="glass rounded-2xl p-4 transition-all duration-300 border-2 text-left group hover:scale-[1.02]"
            class:border-blue-400={invoiceType === types.liquid}
            class:bg-blue-400={invoiceType === types.liquid}
            class:bg-opacity-10={invoiceType === types.liquid}
            class:shadow-lg={invoiceType === types.liquid}
            class:shadow-blue-400={invoiceType === types.liquid}
            class:shadow-opacity-20={invoiceType === types.liquid}
            class:border-white={invoiceType !== types.liquid}
            class:border-opacity-20={invoiceType !== types.liquid}
            class:hover:border-blue-400={invoiceType !== types.liquid}
            class:hover:border-opacity-60={invoiceType !== types.liquid}
            onclick={() => {
              // Collapse to compact buttons and generate Liquid invoice
              showMoreOptionsExpanded = false;
              showLightningAddress = false;
              newAmount = undefined;
              amount = undefined;
              setType(types.liquid);
            }}
          >
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                <iconify-icon icon="ph:drop-fill" class="text-white" width="24"></iconify-icon>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-bold text-white text-lg">Liquid Network</h3>
                  <span class="badge badge-sm bg-blue-400/20 text-blue-400 border-blue-400/30 whitespace-nowrap">L-BTC • USDT</span>
                </div>
                <p class="text-sm text-white/70 leading-relaxed">Fast. Receive Bitcoin or USDT stablecoins.</p>
                <div class="flex items-center gap-3 mt-2 text-xs">
                  <span class="text-blue-400 flex items-center gap-1">
                    <iconify-icon icon="ph:eye-slash-bold" width="14"></iconify-icon>
                    Private
                  </span>
                  <span class="text-cyan-400 flex items-center gap-1">
                    <iconify-icon icon="ph:clock-bold" width="14"></iconify-icon>
                    ~2 min
                  </span>
                </div>
              </div>
              {#if invoiceType === types.liquid}
                <iconify-icon icon="ph:check-circle-fill" class="text-blue-400 flex-shrink-0" width="24"></iconify-icon>
              {/if}
            </div>
          </button>

          <!-- Bitcoin On-Chain -->
          <button
            class="glass rounded-2xl p-4 transition-all duration-300 border-2 text-left group hover:scale-[1.02]"
            class:border-orange-400={invoiceType === types.bitcoin}
            class:bg-orange-400={invoiceType === types.bitcoin}
            class:bg-opacity-10={invoiceType === types.bitcoin}
            class:shadow-lg={invoiceType === types.bitcoin}
            class:shadow-orange-400={invoiceType === types.bitcoin}
            class:shadow-opacity-20={invoiceType === types.bitcoin}
            class:border-white={invoiceType !== types.bitcoin}
            class:border-opacity-20={invoiceType !== types.bitcoin}
            class:hover:border-orange-400={invoiceType !== types.bitcoin}
            class:hover:border-opacity-60={invoiceType !== types.bitcoin}
            onclick={() => {
              // Collapse to compact buttons and generate Bitcoin invoice
              showMoreOptionsExpanded = false;
              showLightningAddress = false;
              newAmount = undefined;
              amount = undefined;
              setType(types.bitcoin);
            }}
          >
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                <img src="/images/bitcoin.svg" class="w-7 h-7" alt="Bitcoin" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start sm:items-center justify-between sm:justify-start gap-2 mb-1">
                  <h3 class="font-bold text-white text-lg">
                    Bitcoin<br class="sm:hidden" /> <span class="text-sm sm:inline">(on-chain)</span>
                  </h3>
                  <span class="badge badge-sm bg-orange-400/20 text-orange-400 border-orange-400/30 flex-shrink-0">Taproot</span>
                </div>
                <p class="text-sm text-white/70 leading-relaxed">Secure main blockchain. Best for larger amounts.</p>
                <div class="flex items-center gap-3 mt-2 text-xs">
                  <span class="text-orange-400 flex items-center gap-1">
                    <iconify-icon icon="ph:shield-checkered-bold" width="14"></iconify-icon>
                    Most secure
                  </span>
                  <span class="text-white/50 flex items-center gap-1">
                    <iconify-icon icon="ph:hourglass-bold" width="14"></iconify-icon>
                    ~10-60+ min
                  </span>
                </div>
              </div>
              {#if invoiceType === types.bitcoin}
                <iconify-icon icon="ph:check-circle-fill" class="text-orange-400 flex-shrink-0" width="24"></iconify-icon>
              {/if}
            </div>
          </button>

          <!-- Lightning Address -->
          <button
            class="glass rounded-2xl p-4 transition-all duration-300 border-2 text-left group hover:scale-[1.02]"
            class:border-dgen-aqua={invoiceType === "lnurl"}
            class:bg-dgen-aqua={invoiceType === "lnurl"}
            class:bg-opacity-10={invoiceType === "lnurl"}
            class:shadow-lg={invoiceType === "lnurl"}
            class:shadow-dgen-aqua={invoiceType === "lnurl"}
            class:shadow-opacity-20={invoiceType === "lnurl"}
            class:border-white={invoiceType !== "lnurl"}
            class:border-opacity-20={invoiceType !== "lnurl"}
            class:hover:border-dgen-aqua={invoiceType !== "lnurl"}
            class:hover:border-opacity-60={invoiceType !== "lnurl"}
            onclick={() => {
              // Show Lightning Address view
              showMoreOptionsExpanded = false;
              showLightningAddress = true;
              invoiceType = "lnurl"; // Track selection for collapsed view
            }}
          >
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-dgen-aqua to-cyan-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                <iconify-icon icon="ph:at-bold" class="text-white" width="24"></iconify-icon>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-bold text-white text-lg">Lightning Address</h3>
                  <span class="badge badge-sm bg-dgen-aqua/20 text-dgen-aqua border-dgen-aqua/30">Static</span>
                </div>
                <p class="text-sm text-white/70 leading-relaxed">Lightning only. Requires you to be online to receive.</p>
                <div class="flex items-center gap-3 mt-2 text-xs">
                  <span class="text-dgen-aqua flex items-center gap-1">
                    <iconify-icon icon="ph:infinity-bold" width="14"></iconify-icon>
                    Reusable
                  </span>
                </div>
              </div>
              {#if invoiceType === "lnurl"}
                <iconify-icon icon="ph:check-circle-fill" class="text-dgen-aqua flex-shrink-0" width="24"></iconify-icon>
              {/if}
            </div>
          </button>
        </div>

        <!-- Asset selection for Liquid - Show after Liquid is selected -->
        {#if invoiceType === types.liquid && !invoiceText}
          <div class="px-2">
            <div class="glass rounded-xl p-4 border border-blue-400 border-opacity-30 bg-blue-400 bg-opacity-5">
              <p class="text-sm font-semibold text-white text-opacity-90 mb-3">Select asset to receive:</p>
              <div class="grid grid-cols-2 gap-3">
                <button
                  class="rounded-xl p-3 transition-all duration-300 border-2 text-center group hover:scale-105"
                  class:border-orange-500={selectedAsset === 'lbtc'}
                  class:bg-orange-500={selectedAsset === 'lbtc'}
                  class:bg-opacity-20={selectedAsset === 'lbtc'}
                  class:border-white={selectedAsset !== 'lbtc'}
                  class:border-opacity-20={selectedAsset !== 'lbtc'}
                  class:hover:border-orange-400={selectedAsset !== 'lbtc'}
                  class:hover:border-opacity-60={selectedAsset !== 'lbtc'}
                  onclick={async () => {
                    // Collapse to compact buttons
                    showMoreOptionsExpanded = false;
                    showLightningAddress = false;
                    selectedAsset = 'lbtc';
                    newAmount = undefined;
                    amount = undefined;
                    // LBTC amount is OPTIONAL - generate address immediately without amount
                    await update();
                  }}
                >
                  <div class="flex flex-col items-center gap-2">
                    <iconify-icon icon="cryptocurrency:btc" width="32" class="text-orange-400"></iconify-icon>
                    <div>
                      <div class="font-bold text-white">Bitcoin</div>
                      <div class="text-xs text-white/60">L-BTC</div>
                    </div>
                  </div>
                </button>
                <button
                  class="rounded-xl p-3 transition-all duration-300 border-2 text-center group hover:scale-105"
                  class:border-green-500={selectedAsset === 'usdt'}
                  class:bg-green-500={selectedAsset === 'usdt'}
                  class:bg-opacity-20={selectedAsset === 'usdt'}
                  class:border-white={selectedAsset !== 'usdt'}
                  class:border-opacity-20={selectedAsset !== 'usdt'}
                  class:hover:border-green-400={selectedAsset !== 'usdt'}
                  class:hover:border-opacity-60={selectedAsset !== 'usdt'}
                  onclick={async () => {
                    // Collapse to compact buttons
                    showMoreOptionsExpanded = false;
                    showLightningAddress = false;
                    selectedAsset = 'usdt';
                    newAmount = undefined;
                    amount = undefined;
                    // USDT amount is OPTIONAL - generate address immediately without amount
                    await update();
                  }}
                >
                  <div class="flex flex-col items-center gap-2">
                    <iconify-icon icon="cryptocurrency:usdt" width="32" class="text-green-400"></iconify-icon>
                    <div>
                      <div class="font-bold text-white">Tether</div>
                      <div class="text-xs text-white/60">USDt</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
      {/if}

    </div>

    <!-- Main content card with glassmorphism -->
    <div
      class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-dgen-aqua/40 transition-all duration-500 space-y-4 animate-scaleIn"
    >
      {#if showMoreOptions && showLightningAddress}
        <!-- Lightning Address View (when clicked from More deposit options) -->
        <div class="space-y-4">
          {#if autoRegisteringAddress}
            <div class="text-center py-12">
              <div class="flex justify-center mb-4">
                <div class="w-16 h-16 rounded-full bg-dgen-aqua/20 flex items-center justify-center">
                  <span class="loading loading-spinner loading-lg text-dgen-aqua"></span>
                </div>
              </div>
              <p class="text-lg text-white/80 font-medium">Setting up your Lightning Address</p>
              <p class="text-sm text-white/50 mt-2">This will only take a moment...</p>
            </div>
          {:else if !hasLightningAddress && registrationError}
            <!-- Registration Failed - Show nice error UI -->
            <div class="text-center py-8 px-4">
              <div class="flex justify-center mb-4">
                <div class="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <iconify-icon icon="ph:warning-bold" class="text-orange-400" width="32"></iconify-icon>
                </div>
              </div>
              <p class="text-lg text-white/90 font-semibold mb-2">Lightning Address Setup Issue</p>
              <p class="text-sm text-white/60 mb-6 max-w-sm mx-auto">
                We couldn't set up your Lightning Address automatically. This might be due to network connectivity.
              </p>

              <button
                class="btn glass border-2 border-dgen-aqua/40 hover:border-dgen-aqua hover:bg-dgen-aqua/20 transition-all group mb-4"
                onclick={() => {
                  autoRegisteringAddress = true;
                  autoRegisterLightningAddress();
                }}
              >
                <iconify-icon icon="ph:arrows-clockwise-bold" width="20" class="group-hover:rotate-180 transition-transform duration-500"></iconify-icon>
                <span class="font-semibold">Try Again</span>
              </button>

              <div class="text-xs text-white/40 mt-4">
                You can still receive payments using the options below
              </div>
            </div>
          {:else if lightningAddress}
            <!-- Lightning Address Label -->
            <div class="text-center mb-2">
              <p class="text-sm text-white/60 uppercase tracking-wide font-semibold">Lightning Address</p>
            </div>

            <!-- QR Code - Larger and more prominent -->
            <div class="flex justify-center">
              <div class="bg-white p-4 rounded-2xl shadow-2xl shadow-dgen-aqua/20">
                <Qr text={lightningAddress} width={280} />
              </div>
            </div>

            <!-- Warning: Lightning Only -->
            <div class="mx-4 mt-4">
              <div class="alert bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl">
                <div class="flex gap-3 items-start">
                  <iconify-icon icon="ph:warning-bold" class="text-yellow-400 flex-shrink-0" width="20"></iconify-icon>
                  <div class="text-sm text-white/80 space-y-1">
                    <div>
                      <span class="font-semibold text-yellow-400">Lightning payments only.</span>
                      <span class="text-white/70">For other options (Bitcoin, Liquid, USDT), use the back button below.</span>
                    </div>
                    <div class="text-white/60 text-xs pt-1">
                      If your wallet doesn't support Lightning addresses, go back to get a BOLT11 invoice instead.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Lightning Address Display - More prominent -->
            <div class="text-center px-4">
              <button
                class="group w-full"
                onclick={() => {
                  copy(lightningAddress);
                }}
              >
                <div class="font-mono text-xl sm:text-2xl text-white break-all mb-2 group-hover:text-dgen-aqua transition-colors">
                  {lightningAddress}
                </div>
                <div class="text-xs text-white/50 group-hover:text-white/70 transition-colors flex items-center justify-center gap-1">
                  <iconify-icon icon="ph:copy-bold" width="14"></iconify-icon>
                  Tap to copy
                </div>
              </button>
            </div>

            <!-- Share Button -->
            <div class="px-4 pt-2">
              <button
                class="btn w-full glass hover:bg-dgen-aqua/20 border-2 border-dgen-aqua/30 hover:border-dgen-aqua/60 transition-all group"
                onclick={() => {
                  copy(lightningAddress);
                }}
              >
                <iconify-icon icon="ph:share-network-bold" width="20" class="group-hover:scale-110 transition-transform"></iconify-icon>
                <span class="font-semibold">Share Address</span>
              </button>
            </div>

            <!-- Customize username link - subtle -->
            <div class="text-center pt-4 pb-12">
              <button
                class="text-base text-white hover:text-white/90 transition-colors flex items-center justify-center gap-1 mx-auto font-semibold"
                onclick={() => showEditModal = true}
              >
                <iconify-icon icon="ph:pencil-simple-bold" width="18"></iconify-icon>
                Customize username
              </button>
            </div>
          {:else}
            <!-- Fallback: No Lightning Address yet, no error, not loading -->
            <!-- This shouldn't normally happen but provides graceful fallback -->
            <div class="text-center py-8 px-4">
              <div class="flex justify-center mb-4">
                <div class="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <iconify-icon icon="ph:question-bold" class="text-purple-400" width="32"></iconify-icon>
                </div>
              </div>
              <p class="text-lg text-white/90 font-semibold mb-2">Setting up...</p>
              <p class="text-sm text-white/60 mb-6 max-w-sm mx-auto">
                Your Lightning Address is being configured. Click below to receive payments now.
              </p>
            </div>
          {/if}
        </div>
      {:else if showMoreOptions && invoiceType === types.liquid && !invoiceText}
        <!-- Liquid Asset Picker (shown below compact buttons) -->
        <div class="px-4 py-6">
          <div class="glass rounded-xl p-4 border border-blue-400 border-opacity-30 bg-blue-400 bg-opacity-5">
            <p class="text-sm font-semibold text-white text-opacity-90 mb-3">Select asset to receive:</p>
            <div class="grid grid-cols-2 gap-3">
              <button
                class="rounded-xl p-3 transition-all duration-300 border-2 text-center group hover:scale-105"
                class:border-orange-500={selectedAsset === 'lbtc'}
                class:bg-orange-500={selectedAsset === 'lbtc'}
                class:bg-opacity-20={selectedAsset === 'lbtc'}
                class:border-white={selectedAsset !== 'lbtc'}
                class:border-opacity-20={selectedAsset !== 'lbtc'}
                class:hover:border-orange-400={selectedAsset !== 'lbtc'}
                class:hover:border-opacity-60={selectedAsset !== 'lbtc'}
                onclick={async () => {
                  // Stay in collapsed state
                  showLightningAddress = false;
                  selectedAsset = 'lbtc';
                  newAmount = undefined;
                  amount = undefined;
                  // LBTC amount is OPTIONAL - generate address immediately without amount
                  await update();
                }}
              >
                <div class="flex flex-col items-center gap-2">
                  <iconify-icon icon="cryptocurrency:btc" width="32" class="text-orange-400"></iconify-icon>
                  <div>
                    <div class="font-bold text-white">Bitcoin</div>
                    <div class="text-xs text-white/60">L-BTC</div>
                  </div>
                </div>
              </button>
              <button
                class="rounded-xl p-3 transition-all duration-300 border-2 text-center group hover:scale-105"
                class:border-green-500={selectedAsset === 'usdt'}
                class:bg-green-500={selectedAsset === 'usdt'}
                class:bg-opacity-20={selectedAsset === 'usdt'}
                class:border-white={selectedAsset !== 'usdt'}
                class:border-opacity-20={selectedAsset !== 'usdt'}
                class:hover:border-green-400={selectedAsset !== 'usdt'}
                class:hover:border-opacity-60={selectedAsset !== 'usdt'}
                onclick={async () => {
                  // Stay in collapsed state
                  showLightningAddress = false;
                  selectedAsset = 'usdt';
                  newAmount = undefined;
                  amount = undefined;
                  // USDT amount is OPTIONAL - generate address immediately without amount
                  await update();
                }}
              >
                <div class="flex flex-col items-center gap-2">
                  <iconify-icon icon="cryptocurrency:usdt" width="32" class="text-green-400"></iconify-icon>
                  <div>
                    <div class="font-bold text-white">Tether</div>
                    <div class="text-xs text-white/60">USDt</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      {:else if showMoreOptions && (invoiceType === types.bitcoin || invoiceType === types.liquid) && invoiceText}
        <!-- Show invoice data below compact buttons for Bitcoin/Liquid -->
        <InvoiceData
          {locale}
          {link}
          {qr}
          {txt}
          {invoice}
          {amount}
          {amountFiat}
          {currency}
          {tip}
          {rate}
          showQr={$showQr}
          t={$t}
          {updating}
          {lastError}
          {update}
          {onchainLimits}
          {lightningLimits}
        />

        <InvoiceActions
          bind:newAmount
          {setAmount}
          {toggleType}
          {setType}
          {toggleAmount}
          {toggleMemo}
          {user}
          {invoice}
          {copy}
          {link}
          type={invoiceType}
          bind:showQr={$showQr}
          {txt}
          t={$t}
        />
      {:else}
        <!-- Lightning Invoice BOLT11 View (DEFAULT) -->
      <InvoiceData
        {locale}
        {link}
        {qr}
        {txt}
        {invoice}
        {amount}
        {amountFiat}
        {currency}
        {tip}
        {rate}
        showQr={$showQr}
        t={$t}
        {updating}
        {lastError}
        {update}
        {onchainLimits}
        {lightningLimits}
      />

      <InvoiceActions
        bind:newAmount
        {setAmount}
        {toggleType}
        {setType}
        {toggleAmount}
        {toggleMemo}
        {user}
        {invoice}
        {copy}
        {link}
        type={invoiceType}
        bind:showQr={$showQr}
        {txt}
        t={$t}
      />

      <!-- Transaction History button - only show for default Lightning view -->
      {#if !showMoreOptions}
        <div class="text-center pt-6 pb-2">
          <button
            class="text-base text-white hover:text-white/90 transition-colors flex items-center justify-center gap-2 mx-auto font-semibold"
            onclick={() => goto('/payments')}
          >
            <iconify-icon icon="ph:clock-counter-clockwise-bold" width="18"></iconify-icon>
            Transaction History
          </button>
        </div>
      {/if}
      {/if}
    </div>

  </div>
</div>

<SetAmount
  bind:newAmount
  bind:fiat
  {currency}
  locale={loc(user)}
  {rate}
  {settingAmount}
  {setAmount}
  {toggleAmount}
  t={$t}
  invoiceType={invoiceType}
  selectedAsset={selectedAsset}
  {onchainLimits}
  {lightningLimits}
/>

<SetMemo bind:memo {settingMemo} {setMemo} {toggleMemo} t={$t} />

<SetType
  {aid}
  {invoice}
  {user}
  type={invoiceType}
  {settingType}
  {setType}
  {toggleType}
  t={$t}
  bind:newAmount
  {setAmount}
/>

<!-- Edit Username Modal -->
{#if showEditModal}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onclick={() => showEditModal = false}>
    <div class="glass rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border-2 border-white/20 animate-slideUp" onclick={(e) => e.stopPropagation()}>
      <div class="p-6 space-y-6">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">Customize Username</h3>
          <button class="btn btn-sm btn-circle glass" onclick={() => showEditModal = false}>
            <iconify-icon icon="ph:x-bold" width="20"></iconify-icon>
          </button>
        </div>

        <div class="space-y-4">
          <p class="text-sm text-white/70">
            You can customize your Lightning Address username. Your current address is:
          </p>

          <div class="glass rounded-lg p-3 border border-white/20 text-center">
            <div class="font-mono text-sm text-white/80 break-all">{lightningAddress}</div>
          </div>

          <button
            class="btn btn-primary w-full"
            onclick={() => {
              showEditModal = false;
              goto('/settings/lightning-address');
            }}
          >
            <iconify-icon icon="ph:pencil-bold" width="20"></iconify-icon>
            Edit in Settings
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Back button when in "More deposit options" (expanded or compact) -->
{#if showMoreOptions}
  <div class="fixed bottom-6 left-0 right-0 z-10 flex justify-center pointer-events-none px-4">
    <button
      class="glass border-2 border-white/30 hover:border-white/50 hover:bg-white/20 shadow-xl rounded-full px-4 py-2 font-medium text-sm transition-all pointer-events-auto flex items-center gap-2"
      onclick={() => {
        // If showing Lightning Address or an invoice, go back to expanded options menu
        if (showLightningAddress || invoiceText) {
          showLightningAddress = false;
          showMoreOptionsExpanded = true;
          invoiceText = '';
          hash = '';
          id = undefined;
          amount = undefined;
          newAmount = undefined;
          // Reset to Lightning to show default "Set Amount" view in main content
          invoiceType = types.lightning;
        } else {
          // If in expanded options menu, go back to Lightning Invoice
          showMoreOptions = false;
          showMoreOptionsExpanded = false;
          invoiceType = types.lightning;
          settingAmountFromOptions = false;
        }
      }}
    >
      <iconify-icon icon="ph:arrow-left-bold" width="16"></iconify-icon>
      <span>Back</span>
    </button>
  </div>
{/if}
