<script>
  import { SvelteToast } from "@zerodevx/svelte-toast";
  import { onDestroy, onMount, untrack } from "svelte";
  import { PUBLIC_DGEN_URL } from "$env/static/public";
  import { close, connect, send, socket } from "$lib/socket";
  import {
    last,
    invoice,
    request,
    ndef,
    nfcEnabled,
    passwordPrompt,
    selectSigner,
    password,
    pin,
    theme as themeStore,
    proMode,
  } from "$lib/store";
  import { initBrowserSDK } from "../../hooks.client";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import LoadingSplash from "$comp/LoadingSplash.svelte";
  import AppHeader from "$comp/AppHeader.svelte";
  // import Nostr from "$comp/Nostr.svelte"; // NOSTR DISABLED
  import Password from "$comp/Password.svelte";
  import PaymentToast from "$comp/PaymentToast.svelte";
  import TabLockBanner from "$comp/TabLockBanner.svelte";
  import { warning } from "$lib/utils";
  import Cookies from "js-cookie";
  import { t, locale, loading } from "$lib/translations";
  import { goto, afterNavigate, preloadData } from "$app/navigation";
  import { PUBLIC_DOMAIN } from "$env/static/public";
  import { lnAddressStore } from "$lib/stores/lightningAddress";
  import { walletStore, transactions } from "$lib/stores/wallet";
  import { tabSync } from "$lib/tabSync";

  let { data, children } = $props();

  let { user, subject, token } = $derived(data || {});
  let { theme } = $state(data || {});

  let browserCompatible = $state(false);
  let walletInitError = $state(null);
  let walletInitialized = $state(false); // Track if wallet has been initialized
  let walletEventListenerId = null;
  let lastSyncTime = 0;
  let syncDebounceTimer = null;
  let currentUserId = null; // Track current user to detect changes
  let isSecondaryTab = $state(false); // Track if this is a secondary tab (no SDK instance)
  let isSwitchingUsers = $state(false); // Flag to hide stale data during user switch
  let isAcquiringLock = $state(false); // Track if we're currently trying to acquire lock
  let showTabLockBanner = $state(false); // Control banner visibility

  $effect(() => ($themeStore = theme));
  $effect(() => (theme = $themeStore));

  // Watch for user changes and trigger wallet re-initialization
  $effect(() => {
    if (!browser || !browserCompatible) return;

    const userId = user?.id || user?.username;
    if (!userId) return;

    // Simple logic: just initialize if not already initialized
    if (!walletInitialized) {
      initializeBrowserWallet();
    }
  });

  const checkBrowserCompatibility = () => {
    if (!browser) return false;
    
    const hasWebCrypto = window.crypto && window.crypto.subtle;
    const hasIndexedDB = window.indexedDB;
    const hasWasm = typeof WebAssembly === 'object';
    
    if (!window.crypto.subtle) {
      console.warn('Web Crypto API not available. This requires HTTPS or localhost.');
      console.warn('To test on local network, run with: HTTPS=true bun run dev');
    }
    
    return hasWebCrypto && hasIndexedDB && hasWasm;
  };

  const initializeBrowserWallet = async () => {
    if (!user || !browserCompatible) return;

    const userId = user.id || user.username;

    if (walletInitialized) return;

    try {
      // Show loading state while trying to acquire lock
      isAcquiringLock = true;

      // Try to acquire wallet lock with retries (prevents duplicate SDK instances)
      // This will retry up to 3 times with 1 second delays to handle page refresh race conditions
      const lockAcquired = await tabSync.tryAcquireWalletLock(3, 1000);

      if (!lockAcquired) {
        isSecondaryTab = true;
        showTabLockBanner = true;
        walletInitialized = true; // Mark as initialized but don't init SDK
        isAcquiringLock = false;

        // Listen for wallet updates from primary tab
        tabSync.onMessage(async (message) => {
          if (message.type === 'WALLET_UPDATED') {
            // Refresh wallet data from shared storage if needed
            const { walletStore } = await import('$lib/stores/wallet');
            await walletStore.refresh();
          } else if (message.type === 'LOCK_RELEASED') {
            // Try to become primary tab
            isSecondaryTab = false;
            showTabLockBanner = false;
            walletInitialized = false;
            setTimeout(() => initializeBrowserWallet(), 1000);
          } else if (message.type === 'LOCK_ACQUIRED' && message.tabId !== tabSync.getTabId()) {
            // Another tab took over, we become secondary
            isSecondaryTab = true;
            showTabLockBanner = true;
          }
        });

        return;
      }

      isAcquiringLock = false;
    } catch (error) {
      console.error('[Layout] Error acquiring wallet lock:', error);
      isAcquiringLock = false;
      walletInitError = 'Failed to acquire wallet lock';
      return;
    }

    // Mark as initialized immediately to prevent multiple calls
    walletInitialized = true;
    isSecondaryTab = false;
    showTabLockBanner = false;
    isSwitchingUsers = false; // Clear flag - wallet is now initialized for new user

    try {
      walletInitError = null;

      // Import wallet service and cross-device sync
      const walletService = await import('$lib/walletService');
      const userId = user.id || user.username;

      // Get persistent encryption password
      const userPassword = await walletService.getWalletPassword(userId);

      // Check local storage for existing wallet
      let mnemonic = await walletService.getSavedMnemonic(userPassword, userId);

      if (!mnemonic) {
        // Auto-generate wallet for new users
        mnemonic = walletService.generateMnemonic();

        // Initialize and save the new wallet
        await walletService.initWallet(mnemonic, userId);
        await walletService.saveMnemonic(mnemonic, userPassword, userId);

        // Notify server about new wallet
        try {
          const { post } = await import('$lib/utils');
          const info = await walletService.getWalletInfo();
          if (info) {
            const pubkey = info.pubkey || info.nodeState?.id || "breez_liquid_pubkey";
            const fingerprint = info.fingerprint || info.nodeState?.id || "breez_liquid_id";
            await post("/wallet/create", {
              pubkey,
              fingerprint,
              type: "liquid"
            });
          }
        } catch (e) {
          console.warn('[Layout] Failed to notify server about auto-generated wallet:', e);
        }

        mnemonic = await walletService.getSavedMnemonic(userPassword, userId);
      }

      // Initialize wallet with mnemonic
      await walletService.initWallet(mnemonic, userId);

      // Check if connected successfully
      if (!walletService.isConnected()) {
        throw new Error('Failed to connect to wallet SDK');
      }

      // Initialize transaction event handling FIRST to catch dataSynced events
      const { initTransactionEventHandling } = await import('$lib/transactionService');
      try {
        await initTransactionEventHandling();
      } catch (error) {
        console.warn('[Layout] Could not initialize transaction event handling:', error);
      }

      // Setup event listener for SDK events AFTER connection (only if not already registered)
      try {
        if (!walletEventListenerId) {
          walletEventListenerId = await walletService.addEventListener(async (event) => {

          // Handle synced events with debouncing
          if (event.type === 'synced') {
            const now = Date.now();

            // Prevent rapid successive syncs (within 10 seconds)
            if (now - lastSyncTime < 10000) {
              return;
            }

            lastSyncTime = now;

            // Clear any pending refresh
            if (syncDebounceTimer) {
              clearTimeout(syncDebounceTimer);
            }

            // Debounce the refresh to avoid rapid successive calls
            syncDebounceTimer = setTimeout(async () => {
              try {
                // Refresh wallet data only (deduplication prevents unnecessary updates)
                const { walletStore } = await import('$lib/stores/wallet');
                await walletStore.refresh();

                // Mark initial sync as complete
                walletStore.update(state => ({ ...state, didCompleteInitialSync: true }));

                // Get updated balance and broadcast to other tabs (only if changed)
                const info = await walletService.getWalletInfo();
                const balance = info?.walletInfo?.balanceSat || 0;

                // Broadcast wallet update to other tabs
                tabSync.broadcastWalletUpdate(balance);

                // Refresh transactions through transactionService to respect filters
                const { transactionStore } = await import('$lib/transactionService');
                await transactionStore.loadTransactions(true);
              } catch (e) {
                console.error('[Layout] Error refreshing after sync:', e);
              }
            }, 1000); // Wait 1 second before refreshing
          }

          // Handle payment events
          if (event.type === 'paymentSucceeded') {
            // Get payment details from event
            // @ts-ignore - Breez SDK event structure
            const payment = event.details;
            console.log('[Payment] Received payment:', payment?.amountSat, 'sats');

            // Broadcast to payment events store for UI components to react
            if (payment && payment.paymentType === 'receive') {
              const { notifyPaymentReceived } = await import('$lib/stores/paymentEvents');
              notifyPaymentReceived(payment);
            }

            const { walletStore, transactions } = await import('$lib/stores/wallet');
            await walletStore.refresh();
            await transactions.refresh();
          }

          if (event.type === 'paymentFailed') {
            const { walletStore, transactions } = await import('$lib/stores/wallet');
            await walletStore.refresh();
            await transactions.refresh();
          }
          });
        }
      } catch (e) {
        console.error('[Layout] Failed to add event listener:', e);
      }
      
      // SDK is connected - initialize wallet store but don't load data yet
      // Wait for dataSynced event to ensure payment types are correct
      const { walletStore, transactions } = await import('$lib/stores/wallet');

      // Set initial connecting state (like misty-breez)
      walletStore.set({
        isUnlocked: true,
        isInitialized: true,
        isConnecting: true, // Keep connecting state until data syncs
        didCompleteInitialSync: false, // Will be set to true on 'dataSynced' event
        info: null,
        error: null
      });

      initBrowserSDK();

    } catch (error) {
      console.error('[Layout] Browser wallet initialization failed:', error);
      walletInitError = error?.message || 'Failed to initialize wallet';
      // Reset initialized flag on error to allow retry
      walletInitialized = false;
      isAcquiringLock = false;
    }
  };

  /**
   * Handle user requesting to take over the lock from another tab
   */
  async function handleTakeover() {
    try {
      isAcquiringLock = true;

      // Force takeover the lock
      const success = await tabSync.forceTakeover();

      if (success) {
        // Reset state and reinitialize wallet
        isSecondaryTab = false;
        showTabLockBanner = false;
        walletInitialized = false;

        // Reinitialize the wallet with the lock
        await initializeBrowserWallet();
      } else {
        console.error('[Layout] Failed to take over lock');
        warning('Failed to take over wallet. Please try again.');
      }
    } catch (error) {
      console.error('[Layout] Error during takeover:', error);
      warning('Error taking over wallet. Please try refreshing the page.');
    } finally {
      isAcquiringLock = false;
    }
  }

  /**
   * Handle user requesting to check if other tab is still active
   */
  async function handleRefresh() {
    const lockInfo = tabSync.getLockInfo();

    if (!lockInfo.isAlive) {
      // Other tab appears dead, try to take over
      console.log('[Layout] Other tab appears inactive, attempting takeover...');
      await handleTakeover();
    } else {
      console.log('[Layout] Other tab is still active');
      // Could show a toast here if desired
    }
  }

  afterNavigate(() => {
    if (page?.url?.pathname) {
      document.cookie = `pathname=${page.url.pathname}; path=/; max-age=86400`;
    }
    if (user) {
      preloadData(`/${user.username}`);
      preloadData(`/${user.username}/receive`);
      preloadData("/payments");
      preloadData("/send");
    }
  });

  onMount(async () => {
    if (browser) {
      // Initialize tab sync service first
      await tabSync.init();

      browserCompatible = checkBrowserCompatibility();

      // Note: initializeBrowserWallet() is now called by $effect above
      // to handle both initial load and user switching

      checkSocket();
      $pin = Cookies.get("pin");

      // Enable NFC scanning for mobile devices
      if (window.NDEFReader) {
        try {
          $ndef = new NDEFReader();
          await $ndef.scan();

          $nfcEnabled = true;
          console.log("NFC scanning enabled");

          $ndef.addEventListener("readingerror", (e) => {
            console.log("NFC read error:", e);
            warning("NFC read error. Please try again.");
          });

          $ndef.addEventListener("reading", ({ message, serialNumber }) => {
            console.log("NFC message received:", message);

            for (const record of message.records) {
              // Handle URL records (most common for payments)
              if (record.recordType === "url") {
                const textDecoder = new TextDecoder();
                const url = textDecoder.decode(record.data);
                console.log("NFC URL detected:", url);

                // Handle Lightning/Bitcoin URLs
                if (
                  url.includes("lightning:") ||
                  url.includes("bitcoin:") ||
                  url.startsWith("lnbc")
                ) {
                  goto(`/send/${encodeURIComponent(url)}`);
                } else if (url.startsWith("http")) {
                  // Handle web URLs that might contain payment info
                  const paymentMatch = url.match(
                    /\/(lightning:|bitcoin:|lnbc)([^\/]*)/,
                  );
                  if (paymentMatch) {
                    goto(`/send/${encodeURIComponent(paymentMatch[0])}`);
                  } else {
                    goto(`/send/${encodeURIComponent(url)}`);
                  }
                } else {
                  goto(`/send/${encodeURIComponent(url)}`);
                }
                break; // Process first valid record
              }
              // Handle text records
              else if (record.recordType === "text" && record.data) {
                const textDecoder = new TextDecoder();
                const text = textDecoder.decode(record.data);
                console.log("NFC text detected:", text);

                // Check if it's a Lightning invoice or Bitcoin address
                if (
                  text.startsWith("lnbc") ||
                  text.startsWith("bitcoin:") ||
                  text.startsWith("lightning:")
                ) {
                  goto(`/send/${encodeURIComponent(text)}`);
                }
              }
            }
          });
        } catch (error) {
          // NFC not available or permission denied - that's okay
        }
      }
    }
  });

  let checkTimer,
    counter = 0;

  let checkSocket = () => {
    counter++;
    let lost = socket?.readyState !== 1 || !$last || Date.now() - $last > 30000;
    if (lost && token) connect(token);
    if (counter > 5 && token) {
      send("heartbeat", token);
      counter = 0;
    }

    checkTimer = setTimeout(checkSocket, 1000);
  };

  onDestroy(async () => {
    if (browser) {
      close();
      clearTimeout(checkTimer);

      // Clean up tab sync (releases lock and broadcasts to other tabs)
      tabSync.cleanup();

      // Clean up wallet event listener
      if (walletEventListenerId) {
        try {
          const ws = await import('$lib/walletService');
          await ws.removeEventListener(walletEventListenerId);
          walletEventListenerId = null;
        } catch (e) {
          console.error('[Layout] Failed to remove event listener:', e);
        }
      }
    }
  });
</script>

{#if browser && user && $passwordPrompt}
  <Password {user} />
{/if}

{#if browser}
  <!-- <Nostr /> --> <!-- NOSTR DISABLED -->
{/if}

{#if walletInitError}
  <div class="fixed top-4 left-4 right-4 bg-red-500 text-white p-3 rounded-lg z-50">
    Wallet initialization failed: {walletInitError}
  </div>
{/if}

{#if browser && !browserCompatible}
  <div class="fixed top-4 left-4 right-4 bg-yellow-500 text-white p-3 rounded-lg z-50">
    Browser wallet not supported. Missing: Web Crypto API, IndexedDB, or WebAssembly.
  </div>
{/if}

{#if browser && isAcquiringLock && !showTabLockBanner}
  <div class="fixed top-4 left-4 bg-yellow-500 text-white p-2 sm:p-3 rounded-lg z-50 flex items-center gap-2 shadow-lg max-w-xs sm:max-w-sm">
    <iconify-icon icon="mdi:loading" width="16" class="flex-shrink-0 animate-spin"></iconify-icon>
    <span class="text-xs sm:text-sm">Initializing wallet...</span>
  </div>
{/if}

{#if browser && showTabLockBanner && isSecondaryTab}
  <TabLockBanner onTakeover={handleTakeover} onRefresh={handleRefresh} />
{/if}

<svelte:head>
  {#if subject}
    <title>DGEN Wallet - {subject.username}</title>
    <meta
      name="lightning"
      content={`lnurlp:${subject.username}@${PUBLIC_DOMAIN}`}
    />
  {:else}
    <title>DGEN Wallet</title>
  {/if}

  {#if subject?.profile}
    <meta
      name="og:image"
      content={`${PUBLIC_DGEN_URL}/public/${subject.profile}.webp`}
    />
  {:else}
    <meta property="og:image" content="/images/logo.webp" />
  {/if}
</svelte:head>

<SvelteToast options={{ reversed: true, intro: { y: 192 } }} />
<PaymentToast />

<!-- Global animated background for all pages -->
<div class="fixed inset-0 w-full h-full bg-gradient-dark overflow-hidden">
  <!-- Animated background mesh with aurora effect -->
  <div class="absolute inset-0 overflow-hidden">
    <div class="absolute inset-0 aurora-bg opacity-5"></div>
    <div
      class="absolute top-0 left-0 w-96 h-96 bg-dgen-aqua rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
    ></div>
    <div
      class="absolute top-0 right-0 w-96 h-96 bg-dgen-cyan rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 2s;"
    ></div>
    <div
      class="absolute bottom-0 left-20 w-96 h-96 bg-dgen-teal rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 4s;"
    ></div>
    {#if $proMode}
    <div
      class="absolute top-1/2 right-1/4 w-96 h-96 bg-dgen-aqua rounded-full mix-blend-screen filter blur-3xl opacity-15 blob"
      style="animation-delay: 6s;"
    ></div>
    {/if}
  </div>

  <!-- Cyber Grid overlay -->
  <div class="absolute inset-0 cyber-grid opacity-20"></div>

  <!-- Lightning Bolts (Pro Mode Only) -->
  {#if $proMode}
  <div class="lightning-container">
    {#each Array.from({length: 6}) as _, i}
      <div
        class="lightning-bolt"
        style="left: {10 + i * 15}%; animation-delay: {i * 3 + Math.random() * 2}s; animation-duration: {2 + Math.random()}s"
      >
        <iconify-icon icon="ph:lightning-fill" width="24" class="text-cyan-400"></iconify-icon>
      </div>
    {/each}
  </div>
  {/if}

  <!-- Particle System -->
  <div class="particles">
    {#each Array.from({length: $proMode ? 16 : 12}) as _, i}
      <div
        class="particle"
        style="left: {Math.random() * 100}%; animation-delay: {Math.random() *
          20}s; animation-duration: {15 + Math.random() * 10}s"
      ></div>
    {/each}
  </div>
</div>

<div class="min-h-dvh bg-transparent relative z-10" data-theme={theme} class:pro-mode={$proMode}>
  <AppHeader {user} {subject} />
  <main class="pb-4 pro-mode-inherit">
    {#if !$loading && !isSwitchingUsers}
      {@render children?.()}
    {/if}
  </main>
</div>
