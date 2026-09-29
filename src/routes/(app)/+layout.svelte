<script>
  import { SvelteToast } from "@zerodevx/svelte-toast";
  import SparkStatusBanner from "$comp/SparkStatusBanner.svelte";
  import { onDestroy, onMount, untrack } from "svelte";
  import { get } from "svelte/store";
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
  import {
    connectRails,
    subscribeRails,
    adapters,
    getLightningAddress,
    registerLightningAddress,
  } from "$lib/rails";
  import {
    setRailState,
    refreshBalances,
    setUnclaimedDeposits,
    railState,
  } from "$lib/stores/rails";
  import { notifyPaymentReceived } from "$lib/stores/paymentEvents";
  import { toLegacyPayment } from "$lib/rails/legacy";

  let { data, children } = $props();

  let { user, subject, token } = $derived(data || {});
  let { theme } = $state(data || {});

  let browserCompatible = $state(false);
  let walletInitError = $state(null);
  let walletInitialized = $state(false); // Track if wallet has been initialized
  let railsUnsubscribe = null;
  let syncDebounceTimer = null;
  let currentUserId = null; // Track current user to detect changes
  let isSecondaryTab = $state(false); // Track if this is a secondary tab (no SDK instance)
  let isSwitchingUsers = $state(false); // Flag to hide stale data during user switch
  let isAcquiringLock = $state(false); // Track if we're currently trying to acquire lock
  let showTabLockBanner = $state(false); // Control banner visibility
  let sdkSuspended = false;
  let sdkResumeInFlight = false;
  let sdkReloadCooldownUntil = 0;
  let sdkReloadCooldownTimer = null;
  let sdkDisconnectTimer = null;

  const isAndroidDevice = () => {
    if (!browser) return false;
    const ua = navigator.userAgent || "";
    const platform = navigator.userAgentData?.platform || "";
    return /Android/i.test(ua) || /Android/i.test(platform);
  };

  $effect(() => ($themeStore = theme));
  $effect(() => (theme = $themeStore));

  $effect(() => {
    if (!browser) return;
    if (!user) return;
    if (isAndroidDevice()) {
      proMode.set(false);
    }
  });

  // Watch for user changes and trigger wallet re-initialization
  $effect(() => {
    if (!browser || !browserCompatible) return;
    if (document.hidden || sdkSuspended) return;

    const userId = user?.id || user?.username;
    if (!userId) return;

    // Simple logic: just initialize if not already initialized
    if (!walletInitialized) {
      initializeBrowserWallet();
    }
  });

  // Refresh rail balances, then broadcast the new Spark balance to other
  // tabs. Only the tab holding the wallet lock receives SDK events, so a
  // secondary tab has no other way to learn a balance changed — see the
  // WALLET_UPDATED handler in tabSync.onMessage above. A broadcast failure
  // must never break payment handling, hence the isolated try/catch.
  const refreshAndBroadcast = async () => {
    await refreshBalances();
    try {
      tabSync.broadcastWalletUpdate(get(railState).spark.balanceSat);
    } catch (e) {
      console.warn("[Layout] Balance broadcast failed:", e);
    }
  };

  const checkBrowserCompatibility = () => {
    if (!browser) return false;

    const hasWebCrypto = window.crypto && window.crypto.subtle;
    const hasIndexedDB = window.indexedDB;
    const hasWasm = typeof WebAssembly === "object";

    if (!window.crypto.subtle) {
      console.warn(
        "Web Crypto API not available. This requires HTTPS or localhost.",
      );
      console.warn(
        "To test on local network, run with: HTTPS=true bun run dev",
      );
    }

    return hasWebCrypto && hasIndexedDB && hasWasm;
  };

  const initializeBrowserWallet = async () => {
    if (!user || !browserCompatible) return;
    if (document.hidden) return;

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
          if (message.type === "WALLET_UPDATED") {
            // Adopt the broadcast figure directly. A secondary tab holds no
            // wallet lock, so it never connects a rail and cannot fetch a
            // balance of its own — the primary tab's broadcast is the only
            // source it has. Calling walletStore.refresh() here discarded it
            // and left this tab showing 0 forever.
            const { adoptBroadcastBalance } = await import("$lib/stores/rails");
            adoptBroadcastBalance(message.balance);
          } else if (message.type === "LOCK_RELEASED") {
            // Try to become primary tab
            isSecondaryTab = false;
            showTabLockBanner = false;
            walletInitialized = false;
            setTimeout(() => initializeBrowserWallet(), 1000);
          } else if (
            message.type === "LOCK_ACQUIRED" &&
            message.tabId !== tabSync.getTabId()
          ) {
            // Another tab took over, we become secondary
            isSecondaryTab = true;
            showTabLockBanner = true;
          }
        });

        return;
      }

      isAcquiringLock = false;
    } catch (error) {
      console.error("[Layout] Error acquiring wallet lock:", error);
      isAcquiringLock = false;
      walletInitError = "Failed to acquire wallet lock";
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
      const walletService = await import("$lib/walletService");
      const userId = user.id || user.username;

      // Get persistent encryption password
      const userPassword = await walletService.getWalletPassword(userId);

      // Check local storage for existing wallet
      let mnemonic = await walletService.getSavedMnemonic(userPassword, userId);

      if (!mnemonic) {
        // Auto-generate wallet for new users
        mnemonic = walletService.generateMnemonic();

        // Initialize and save the new wallet
        await connectRails(mnemonic, userId);
        setRailState(
          "spark",
          adapters.spark.isConnected() ? "connected" : "unavailable",
        );
        setRailState(
          "liquid",
          adapters.liquid.isConnected() ? "connected" : "unavailable",
        );
        await refreshBalances();
        await walletService.saveMnemonic(mnemonic, userPassword, userId);

        // Notify server about new wallet
        try {
          const { post } = await import("$lib/utils");
          const info = await walletService.getWalletInfo();
          if (info) {
            const pubkey =
              info.pubkey || info.nodeState?.id || "breez_liquid_pubkey";
            const fingerprint =
              info.fingerprint || info.nodeState?.id || "breez_liquid_id";
            await post("/wallet/create", {
              pubkey,
              fingerprint,
              type: "liquid",
            });
          }
        } catch (e) {
          console.warn(
            "[Layout] Failed to notify server about auto-generated wallet:",
            e,
          );
        }

        mnemonic = await walletService.getSavedMnemonic(userPassword, userId);
      }

      // Initialize wallet with mnemonic
      await connectRails(mnemonic, userId);
      setRailState(
        "spark",
        adapters.spark.isConnected() ? "connected" : "unavailable",
      );
      setRailState(
        "liquid",
        adapters.liquid.isConnected() ? "connected" : "unavailable",
      );
      await refreshBalances();

      // connectRails degrades the rails independently and throws only when
      // BOTH fail, so this must not abort on Liquid alone. It used to test
      // walletService.isConnected(), which is Liquid: a Liquid outage threw
      // past the rail event subscription below, leaving a perfectly healthy
      // Spark wallet with no listener, no balance updates, no deposit claims
      // and a wallet-wide error banner — while Lightning and on-chain Bitcoin,
      // which live on Spark, were fine. The per-rail state set above is what
      // the UI reads to explain a partial outage.
      if (!adapters.spark.isConnected() && !adapters.liquid.isConnected()) {
        throw new Error("Failed to connect to any payment rail");
      }

      // Initialize transaction event handling FIRST to catch dataSynced events
      const { initTransactionEventHandling } = await import(
        "$lib/transactionService"
      );
      try {
        await initTransactionEventHandling();
      } catch (error) {
        console.warn(
          "[Layout] Could not initialize transaction event handling:",
          error,
        );
      }

      // Subscribe to rail events (balances, payments, deposits needing claim)
      // AFTER connection (only if not already registered)
      try {
        if (!railsUnsubscribe) {
          railsUnsubscribe = await subscribeRails((event) => {
            if (event.type === "depositsNeedClaim") {
              setUnclaimedDeposits(event.count);
              return;
            }
            if (event.type === "balanceChanged" || event.type === "synced") {
              void refreshAndBroadcast();
              return;
            }
            if (
              event.type === "paymentSucceeded" ||
              event.type === "paymentPending" ||
              event.type === "paymentFailed"
            ) {
              void refreshAndBroadcast();
              // Balances are not the payments list. Without this the payment
              // that just arrived does not appear in history until something
              // else happens to refresh it.
              void transactions.refresh();
              // Hand over the NORMALISED payment, not `raw`.
              //
              // Every consumer of this event reads `amountSat` — the
              // payment-received screen and the toast both do. A raw Spark
              // payment has no such field; it carries `amount` as a bigint.
              // So a Lightning receive rendered as "0.00000000 BTC" while a
              // Liquid one looked fine, because raw Liquid payments DO have
              // amountSat. toLegacyPayment keeps the legacy aliases and
              // `raw` alongside the normalised names, so nothing downstream
              // loses a field it was reading.
              // Only INCOMING payments produce a "payment received" notice.
              // Without this guard, paying an invoice announced "⚡ Payment
              // Received" for the amount just spent, and on the receive screen
              // it played the success animation for an outgoing send. The
              // Liquid handler in stores/wallet.ts has always guarded on
              // direction; this one did not.
              //
              // A failed payment also has to report "failed", not "pending":
              // paymentEvents only auto-clears confirmed/complete, so a failed
              // send previously sat on screen as "Payment Pending" forever.
              if (event.payment.direction === "receive") {
                notifyPaymentReceived(
                  toLegacyPayment(event.payment),
                  event.type === "paymentSucceeded"
                    ? "confirmed"
                    : event.type === "paymentFailed"
                      ? "failed"
                      : "pending",
                );
              }
            }
          });
        }
      } catch (e) {
        console.error("[Layout] Failed to subscribe to rails:", e);
      }

      // walletStore and transactions are imported at module scope. Re-declaring
      // them here with `const` shadowed those bindings for this entire block —
      // including the rail-event callback above, which reads `transactions`.
      // Any payment arriving before this line executed threw
      // "Cannot access 'transactions' before initialization" inside the SDK's
      // event dispatch, losing the payment from the list and the toast.

      // Initialize the wallet store, which will:
      // 1. Get wallet info
      // 2. Start event listening for payment events
      await walletStore.init(userPassword, userId);

      initBrowserSDK();

      // Auto-register Lightning Address for new users (non-blocking)
      // This runs in background and doesn't block the UI
      autoRegisterLightningAddressInBackground().catch((error) => {
        console.warn(
          "[Layout] Background LN address registration failed (non-critical):",
          error,
        );
      });
    } catch (error) {
      console.error("[Layout] Browser wallet initialization failed:", error);
      walletInitError = error?.message || "Failed to initialize wallet";
      // Reset initialized flag on error to allow retry
      walletInitialized = false;
      isAcquiringLock = false;
    }
  };

  /**
   * Auto-register Lightning Address in background after wallet initialization
   * This ensures new users get their Lightning Address set up automatically
   * without having to visit the receive page
   */
  const autoRegisterLightningAddressInBackground = async () => {
    if (!user?.id) return;

    // Already has Lightning Address - skip
    if (user.lightningAddress) {
      console.log("[Layout] User already has Lightning Address");
      lnAddressStore.initialize(
        user.lnurl,
        user.lightningAddress,
        user.bip353Address,
      );
      return;
    }

    console.log("[Layout] Auto-registering Lightning Address for new user...");
    lnAddressStore.setLoading();

    try {
      const walletService = await import("$lib/walletService");

      // Wait for SDK to be ready (max 10 seconds)
      let attempts = 0;
      while (!walletService.isConnected() && attempts < 40) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        attempts++;
      }

      if (!walletService.isConnected()) {
        console.log("[Layout] SDK not ready for LN address registration");
        lnAddressStore.reset();
        return;
      }

      console.log("[Layout] SDK ready, proceeding with auto-registration");

      // Use current origin (HTTPS) and route through backend proxy
      const currentOrigin = browser ? window.location.origin : PUBLIC_DGEN_URL;
      const webhookUrl = new URL("/api/backend/api/v1/notify", currentOrigin);
      webhookUrl.searchParams.set("user", user.id);

      // Try recovery first - this checks if current seed already has a registered address
      console.log("[Layout] Attempting recovery first...");
      // Spark resolves ownership from the wallet's identity key, so this is
      // a plain read — no signing, no webhook argument.
      const recovered = await getLightningAddress();

      if (recovered && recovered.lightningAddress) {
        console.log("[Layout] Recovered existing address");

        lnAddressStore.setSuccess(
          recovered.lnurl,
          recovered.lightningAddress || "",
          recovered.bip353Address,
        );

        // Save to user profile
        const { post } = await import("$lib/utils");
        const { invalidate } = await import("$app/navigation");
        await post("/user", {
          lightningAddress: recovered.lightningAddress,
          lnurl: recovered.lnurl,
          bip353Address: recovered.bip353Address,
        });

        user.lightningAddress = recovered.lightningAddress;
        user.lnurl = recovered.lnurl;
        user.bip353Address = recovered.bip353Address;

        // Invalidate to refresh all user data across the app
        await invalidate("app:user");

        return;
      }

      // No existing address for this seed
      // Clear stale database address if one exists (from previous seed)
      if (user.lightningAddress) {
        console.log("[Layout] Clearing stale database address");
        const { post } = await import("$lib/utils");
        await post("/user", {
          lightningAddress: null,
          lnurl: null,
          bip353Address: null,
        });
        user.lightningAddress = null;
        user.lnurl = null;
        user.bip353Address = null;
      }

      // Register new address with retry logic
      console.log("[Layout] No existing address found, registering new one...");

      // Use formatted username from user account
      const baseUsername = walletService.formatUsername(user.username);
      console.log("[Layout] Auto-registering with formatted username");

      // No silent discriminator suffix any more: on a DGEN-owned domain the
      // namespace is exclusive, so a taken name is surfaced rather than
      // quietly turning alice into alice473.
      const result = await registerLightningAddress(baseUsername);

      console.log("[Layout] Auto-registration successful");

      lnAddressStore.setSuccess(
        result.lnurl,
        result.lightningAddress || "",
        result.bip353Address,
      );

      // Save to user profile
      const { post } = await import("$lib/utils");
      const { invalidate } = await import("$app/navigation");
      await post("/user", {
        lightningAddress: result.lightningAddress,
        lnurl: result.lnurl,
        bip353Address: result.bip353Address,
      });

      user.lightningAddress = result.lightningAddress;
      user.lnurl = result.lnurl;
      user.bip353Address = result.bip353Address;

      // Invalidate to refresh all user data across the app
      await invalidate("app:user");
    } catch (e) {
      console.error("[Layout] Auto-registration failed:", e);
      lnAddressStore.setError(e instanceof Error ? e : new Error(String(e)));
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
        console.error("[Layout] Failed to take over lock");
        warning("Failed to take over wallet. Please try again.");
      }
    } catch (error) {
      console.error("[Layout] Error during takeover:", error);
      warning("Error taking over wallet. Please try refreshing the page.");
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
      console.log(
        "[Layout] Other tab appears inactive, attempting takeover...",
      );
      await handleTakeover();
    } else {
      console.log("[Layout] Other tab is still active");
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
      document.addEventListener("visibilitychange", handleVisibilityForSdk);

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

  const handleVisibilityForSdk = async () => {
    if (!browser) return;
    if (!user || !browserCompatible) return;

    const walletService = await import("$lib/walletService");

    if (document.hidden) {
      if (sdkSuspended) return;
      if (!walletService.isConnected()) {
        sdkSuspended = true;
        walletInitialized = false;
        if (railsUnsubscribe) {
          try {
            await railsUnsubscribe();
          } catch (e) {
            console.warn("[Layout] Failed to unsubscribe rails on hide:", e);
          }
          railsUnsubscribe = null;
        }
        return;
      }
      if (sdkDisconnectTimer) return;

      sdkDisconnectTimer = setTimeout(async () => {
        sdkDisconnectTimer = null;
        if (!document.hidden) return;

        sdkSuspended = true;
        try {
          await walletService.disconnect();
        } catch (error) {
          console.warn("[Layout] Failed to disconnect SDK on hide:", error);
        }

        if (railsUnsubscribe) {
          try {
            await railsUnsubscribe();
          } catch (e) {
            console.warn("[Layout] Failed to unsubscribe rails on hide:", e);
          }
          railsUnsubscribe = null;
        }
        walletInitialized = false;

        try {
          const { walletStore, transactions } = await import(
            "$lib/stores/wallet"
          );
          walletStore.reset();
          transactions.reset();
        } catch (error) {
          console.warn(
            "[Layout] Failed to reset wallet stores on hide:",
            error,
          );
        }
      }, 30000);

      return;
    }

    if (sdkDisconnectTimer) {
      clearTimeout(sdkDisconnectTimer);
      sdkDisconnectTimer = null;
    }

    // Resume when the wallet is not up — not only when it was suspended.
    //
    // A tab that FIRST LOADED while hidden never initialised at all: both the
    // $effect above and initializeBrowserWallet() bail on document.hidden, and
    // document.hidden is not reactive, so nothing re-runs them when the tab is
    // finally looked at. Such a tab has sdkSuspended === false, so gating on
    // that alone left it on "Loading" forever until a manual reload — no
    // balance, no rails, and no tab-lock banner either, because it never even
    // reached the lock. Opening the app in a background tab is enough to hit
    // this: a middle-click, "open in new tab", or a browser restoring a
    // session on startup.
    //
    // A secondary tab has walletInitialized === true, so it still returns here
    // and does not re-attempt a lock it legitimately lost.
    if ((!sdkSuspended && walletInitialized) || sdkResumeInFlight) return;
    sdkResumeInFlight = true;
    let resumeSucceeded = false;
    try {
      await initializeBrowserWallet();
      const walletService = await import("$lib/walletService");
      if (!walletService.isConnected()) {
        const now = Date.now();
        if (now >= sdkReloadCooldownUntil) {
          sdkReloadCooldownUntil = now + 30000;
          if (sdkReloadCooldownTimer) {
            clearTimeout(sdkReloadCooldownTimer);
          }
          sdkReloadCooldownTimer = setTimeout(() => {
            sdkReloadCooldownTimer = null;
            sdkReloadCooldownUntil = 0;
          }, 30000);
          resumeSucceeded = true;
          window.location.reload();
        }
        return;
      }
      resumeSucceeded = true;
    } catch (error) {
      console.warn("[Layout] Failed to resume SDK on show:", error);
      const now = Date.now();
      if (now >= sdkReloadCooldownUntil) {
        sdkReloadCooldownUntil = now + 30000;
        if (sdkReloadCooldownTimer) {
          clearTimeout(sdkReloadCooldownTimer);
        }
        sdkReloadCooldownTimer = setTimeout(() => {
          sdkReloadCooldownTimer = null;
          sdkReloadCooldownUntil = 0;
        }, 30000);
        resumeSucceeded = true;
        window.location.reload();
        return;
      }
    } finally {
      sdkResumeInFlight = false;
      if (resumeSucceeded) {
        sdkSuspended = false;
      }
    }
  };

  let checkSocket = () => {
    counter++;
    const isOpen = socket?.readyState === 1;
    let lost = !isOpen || !$last || Date.now() - $last > 30000;
    if (lost && token) {
      connect(token).catch((error) => {
        console.warn("[Layout] Socket reconnect failed:", error);
      });
    }
    if (counter > 5 && token && isOpen) {
      void send("heartbeat", token);
      counter = 0;
    }

    checkTimer = setTimeout(checkSocket, 1000);
  };

  onDestroy(async () => {
    if (browser) {
      if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
        syncDebounceTimer = null;
      }
      if (sdkDisconnectTimer) {
        clearTimeout(sdkDisconnectTimer);
        sdkDisconnectTimer = null;
      }
      if (sdkReloadCooldownTimer) {
        clearTimeout(sdkReloadCooldownTimer);
        sdkReloadCooldownTimer = null;
      }
      close();
      clearTimeout(checkTimer);

      // Clean up tab sync (releases lock and broadcasts to other tabs)
      tabSync.cleanup();

      // Clean up rail event subscriptions
      if (railsUnsubscribe) {
        try {
          await railsUnsubscribe();
          railsUnsubscribe = null;
        } catch (e) {
          console.error("[Layout] Failed to unsubscribe rails:", e);
        }
      }

      document.removeEventListener("visibilitychange", handleVisibilityForSdk);
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
  <div
    class="fixed top-4 left-4 right-4 bg-red-500 text-white p-3 rounded-lg z-50"
  >
    Wallet initialization failed: {walletInitError}
  </div>
{/if}

{#if browser && !browserCompatible}
  <div
    class="fixed top-4 left-4 right-4 bg-yellow-500 text-white p-3 rounded-lg z-50"
  >
    Browser wallet not supported. Missing: Web Crypto API, IndexedDB, or
    WebAssembly.
  </div>
{/if}

{#if browser && isAcquiringLock && !showTabLockBanner}
  <div
    class="fixed top-4 left-4 bg-yellow-500 text-white p-2 sm:p-3 rounded-lg z-50 flex items-center gap-2 shadow-lg max-w-xs sm:max-w-sm"
  >
    <iconify-icon
      icon="mdi:loading"
      width="16"
      class="flex-shrink-0 animate-spin"
    ></iconify-icon>
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
  {#if browser && $proMode}
    <div class="lightning-container">
      {#each Array.from({ length: 6 }) as _, i}
        <div
          class="lightning-bolt"
          style="left: {10 + i * 15}%; animation-delay: {i * 3 +
            Math.random() * 2}s; animation-duration: {2 + Math.random()}s"
        >
          <iconify-icon
            icon="ph:lightning-fill"
            width="24"
            class="text-cyan-400"
          ></iconify-icon>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Particle System -->
  {#if browser}
    <div class="particles">
      {#each Array.from({ length: $proMode ? 16 : 12 }) as _, i}
        <div
          class="particle"
          style="left: {Math.random() * 100}%; animation-delay: {Math.random() *
            20}s; animation-duration: {15 + Math.random() * 10}s"
        ></div>
      {/each}
    </div>
  {/if}
</div>

<div
  class="min-h-dvh bg-transparent relative z-10"
  data-theme={theme}
  class:pro-mode={$proMode}
>
  <AppHeader {user} {subject} />
  <SparkStatusBanner />
  <main class="pb-4 pro-mode-inherit">
    {#if !$loading && !isSwitchingUsers}
      {@render children?.()}
    {/if}
  </main>
</div>
