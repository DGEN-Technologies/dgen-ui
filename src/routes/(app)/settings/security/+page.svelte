<script>
  import { getContext, onMount } from "svelte";
  import { tick } from "svelte";
  import { t } from "$lib/translations";
  import Pin from "$comp/Pin.svelte";
  import Qr from "$comp/Qr.svelte";
  import Spinner from "$comp/Spinner.svelte";
  import { copy, post, success, fail, get } from "$lib/utils";
  import { save, pin as current } from "$lib/store";
  import { invalidate, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";

  import { env } from "$env/dynamic/public";
  
  let { data } = $props();
  let { user, token: authToken } = $derived(data || {});
  let { id } = $derived(user || {});
  let { haspin } = $derived(user || {});
  
  // State for wallet actions
  let showGenerateNew = $state(false);
  let generatingNewSeed = $state(false);
  let newGeneratedSeed = $state("");
  let showNewSeedPhrase = $state(false);

  let confirming2fa = $state(),
    disabling2fa = $state(),
    importing = $state(),
    newNsec = $state(),
    nsec = $state(),
    otp = $state(),
    pin = $state(null),
    revealNsec = $state(),
    twoFaToken = $state(null),
    setting2fa = $state(),
    settingPin = $state(),
    verify = $state(null),
    showRestore = $state(false),
    restoreMnemonic = $state(""),
    restoring = $state(false),
    showSeedPhrase = $state(false),
    revealedSeedPhrase = $state(""),
    revealingSeed = $state(false),
    localNotification = $state(""),
    confirmRestoreWallet = $state(false),
    confirmGenerateNew = $state(false),
    confirmRevealSeed = $state(false);

  let toggleImporting = () => {
    revealNsec = false;
    importing = !importing;
  };

  let toggleNsec = async () => {
    try {
      nsec = await getNsec(user);
      revealNsec = !revealNsec;
      importing = false;
    } catch (e) {
      console.log(e);
    }
  };

  let checkPin = async () => {
    try {
      if (pin?.length > 5 && pin === verify) {
        $current = pin;
        pin = null;
        verify = null;
        $save.click();
        settingPin = false;
        verifying = false;
      } else {
        fail("Pin mismatch, try again");
        pin = null;
        verify = null;
        verifying = false;
        settingPin = true;
      }
    } catch (e) {
      console.log(e);
      fail("Problem setting PIN");
    }
  };

  let reset = () => {
    twoFaToken = null;
    return true;
  };

  let disablingPin = $state(false);

  let togglePin = async () => {
    if (haspin) {
      try {
        disablingPin = true;
        await tick();
        $save.click();
      } catch (e) {
        console.log(e);
        fail("Failed to disable pin");
      }
    } else {
      settingPin = true;
      disablingPin = false;
    }
  };

  let startEnabling2fa = async () => {
    reset();
    try {
      if (!otp) otp = await post("/otpsecret", { pin: $current });
    } catch (e) {
      console.log(e);
    }

    setting2fa = true;
  };

  let startDisabling2fa = () => (disabling2fa = true);
  let startConfirming2fa = () => (confirming2fa = true);
  let cancel = () => {
    pin = null;
    twoFaToken = null;
    verify = null;
    verifying = false;
    settingPin = false;
    setting2fa = false;
    confirming2fa = false;
    disabling2fa = false;
  };

  let enable2fa = async (twoFa) => {
    try {
      if (setting2fa && twoFaToken && twoFaToken.length === 6) {
        await post("/enable2fa", { token: twoFaToken });
        success("2FA enabled");
        user.twofa = 1;
        cancel();
      }
    } catch (e) {
      console.log(e);
      fail("Failed to enable 2FA, try again");
      twoFaToken = null;
    }
  };

  let disable2fa = async () => {
    try {
      if (disabling2fa && twoFaToken && twoFaToken.length === 6) {
        await post("/disable2fa", { token: twoFaToken });
        success("2FA disabled");
        user.twofa = null;
        cancel();
      }
    } catch (e) {
      console.log(e);
      fail("Failed to disable 2FA, try again");
      twoFaToken = null;
    }
  };
  let verifying = $derived(pin?.length > 5);

  let restoreWallet = async () => {
    if (!restoreMnemonic.trim()) {
      fail("Please enter your 12-word seed phrase");
      return;
    }

    // Validate mnemonic format (should be 12 words)
    const words = restoreMnemonic.trim().split(/\s+/);
    if (words.length !== 12) {
      fail("Seed phrase must be exactly 12 words");
      return;
    }

    restoring = true;
    try {
      const mnemonic = restoreMnemonic.trim();
      
      // Validate mnemonic using bip39
      const bip39 = await import('bip39');
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error("Invalid seed phrase");
      }
      
      // Initialize wallet FIRST (following wasm-example pattern)
      const { initWallet, saveMnemonic, getWalletInfo } = await import('$lib/walletService');
      const { walletStore } = await import('$lib/stores/wallet');

      // Get persistent encryption password
      const { getWalletPassword } = await import('$lib/walletService');
      const userPassword = await getWalletPassword(user.id || user.username);

      // Try to initialize wallet with mnemonic
      await initWallet(mnemonic, user.id || user.username);

      // Only save mnemonic AFTER successful connection with password encryption
      await saveMnemonic(mnemonic, userPassword, user.id || user.username);
      
      // Wait a moment for SDK to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Don't manually sync - let the SDK handle it automatically
      success("Wallet restored! Loading wallet data...");
      try {
        // Just wait a moment for the SDK to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Refresh the wallet store
        await walletStore.refresh();
        
        // Also refresh transactions
        const { transactions } = await import('$lib/stores/wallet');
        await transactions.refresh();
        
        const info = await getWalletInfo();
        if (info && info.balanceSat) {
          success(`Wallet restored! Balance: ${info.balanceSat.toLocaleString()} sats`);
        }
      } catch (syncError) {
        console.error("Sync error:", syncError);
      }
      
      // Notify server that wallet has been restored (missing step!)
      try {
        const { post } = await import('$lib/utils');
        const walletData = await getWalletInfo();
        if (walletData) {
          const pubkey = walletData.pubkey || walletData.nodeState?.id || "breez_liquid_pubkey";
          const fingerprint = walletData.fingerprint || walletData.nodeState?.id || "breez_liquid_id";
          
          await post("/wallet/create", {
            pubkey,
            fingerprint,
            type: "liquid"
          });
          console.log('[Restore] Server notified of wallet restoration');
        }
      } catch (serverError) {
        console.warn('[Restore] Failed to notify server of restoration:', serverError);
        // Don't fail the restore - wallet is working locally
      }
      
      success("Wallet restored successfully!");
      restoreMnemonic = "";
      showRestore = false;
      
      // Clear old revealed seed phrase since we have a new wallet
      showSeedPhrase = false;
      revealedSeedPhrase = "";
      
      // Wallet has been restored
      
      // Important: The wallet is now initialized and connected
      // We need to ensure it stays connected during navigation
      
      // Trigger wallet store refresh to update balance immediately
      const walletStores = await import('$lib/stores/wallet');
      await walletStores.walletStore.refresh();
      await walletStores.transactions.refresh();
      
      // Use a full page navigation to ensure layout re-initializes properly
      // This is necessary because SPA navigation doesn't re-run layout initialization
      // and the wallet SDK needs to be reconnected in the new layout context
      setTimeout(() => {
        window.location.href = user?.username ? `/${user.username}` : '/';
      }, 500);
    } catch (e) {
      console.error("Restore error:", e);
      // Clear any saved mnemonic on failure (wasm-example pattern)
      try {
        const { clearMnemonic, getWalletPassword } = await import('$lib/walletService');
        const userPassword = await getWalletPassword(user?.id || user?.username);
        await clearMnemonic(userPassword, user?.id || user?.username);
      } catch (clearError) {
        console.error("Failed to clear mnemonic:", clearError);
      }
      fail(e.message || "Failed to restore wallet. Please check your seed phrase.");
    } finally {
      restoring = false;
    }
  };

  let toggleRestore = () => {
    showRestore = !showRestore;
    if (!showRestore) {
      restoreMnemonic = "";
    }
  };

  // Check wallet status on mount
  async function revealSeedPhrase() {
    // First confirmation: Privacy warning
    if (!confirmRevealSeed) {
      confirmRevealSeed = true;
      return;
    }

    if (revealingSeed) {
      return;
    }

    try {
      revealingSeed = true;
      confirmRevealSeed = false; // Reset for next time

      // Get persistent encryption password
      const { getSavedMnemonic, isConnected, getWalletPassword } = await import('$lib/walletService');
      const userPassword = await getWalletPassword(user?.id || user?.username);

      // First check - try to get mnemonic immediately
      let mnemonic = await getSavedMnemonic(userPassword, user?.id || user?.username);

      // If no mnemonic and SDK not connected, wait a moment for wallet to initialize
      if (!mnemonic && !isConnected()) {
        // Show a friendly loading message
        const loadingToast = document.createElement('div');
        loadingToast.className = 'fixed bottom-4 right-4 bg-blue-500/90 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        const container = document.createElement('div');
        container.className = 'flex items-center gap-2';
        const icon = document.createElement('iconify-icon');
        icon.setAttribute('icon', 'ph:spinner');
        icon.setAttribute('class', 'animate-spin');
        icon.setAttribute('width', '20');
        const text = document.createElement('span');
        text.textContent = 'Loading your wallet...';
        container.appendChild(icon);
        container.appendChild(text);
        loadingToast.appendChild(container);
        document.body.appendChild(loadingToast);

        // Wait up to 5 seconds for wallet to initialize
        let attempts = 0;
        const maxAttempts = 10; // 10 attempts x 500ms = 5 seconds max

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
          mnemonic = await getSavedMnemonic(userPassword, user?.id || user?.username);

          if (mnemonic) {
            break;
          }
          attempts++;
        }

        // Remove loading toast
        loadingToast.remove();
      }

      if (mnemonic) {
        revealedSeedPhrase = mnemonic;
        showSeedPhrase = true;

        // Show warning about seed security
        setTimeout(() => {
          const notification = document.createElement('div');
          notification.className = 'fixed bottom-4 right-4 bg-yellow-500/90 text-white px-6 py-3 rounded-lg shadow-lg z-50';
          notification.textContent = '⚠️ Keep your seed phrase secure. Never share it with anyone!';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 5000);
        }, 100);
      } else {
        throw new Error("Wallet is still initializing. Please wait a moment and try again.");
      }
    } catch (e) {
      const errorMessage = e.message || "Failed to reveal seed phrase. Please unlock your wallet first.";
      fail(errorMessage);
    } finally {
      revealingSeed = false;
    }
  }
  
  function hideSeedPhrase() {
    showSeedPhrase = false;
    revealedSeedPhrase = "";
  }
  
  async function copySeedPhrase() {
    if (revealedSeedPhrase) {
      copy(revealedSeedPhrase);
      // Use local notification instead of global success to avoid triggering "Settings saved"
      localNotification = "Seed phrase copied to clipboard. Keep it safe!";
      setTimeout(() => {
        localNotification = "";
      }, 3000);
    }
  }

  async function generateNewSeed() {
    if (generatingNewSeed) return;
    
    try {
      generatingNewSeed = true;
      
      // Generate new mnemonic
      const bip39 = await import('bip39');
      const newMnemonic = bip39.generateMnemonic();
      
      // Import wallet functions
      const { saveMnemonic, initWallet, disconnect, getWalletPassword } = await import('$lib/walletService');
      const userId = user?.id || user?.username;

      // Get persistent encryption password
      const userPassword = await getWalletPassword(userId);

      // First disconnect existing wallet if any
      await disconnect();

      // Initialize wallet with new mnemonic FIRST
      await initWallet(newMnemonic, userId);

      // Only save new mnemonic AFTER successful connection with password encryption
      await saveMnemonic(newMnemonic, userPassword, userId);
      
      // Wait for SDK to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh wallet store
      const walletStoresGen = await import('$lib/stores/wallet');
      await walletStoresGen.walletStore.refresh();
      await walletStoresGen.transactions.refresh();
      
      // Notify server about new wallet
      try {
        const { post } = await import('$lib/utils');
        const { getWalletInfo } = await import('$lib/walletService');
        const walletData = await getWalletInfo();
        if (walletData) {
          const pubkey = walletData.pubkey || walletData.nodeState?.id || "breez_liquid_pubkey";
          const fingerprint = walletData.fingerprint || walletData.nodeState?.id || "breez_liquid_id";
          
          await post("/wallet/create", {
            pubkey,
            fingerprint,
            type: "liquid"
          });
          console.log('[Generate] Server notified of new wallet creation');
        }
      } catch (serverError) {
        console.warn('[Generate] Failed to notify server:', serverError);
      }
      
      // Store the new seed for display
      newGeneratedSeed = newMnemonic;
      showNewSeedPhrase = true;
      showGenerateNew = false;
      
      // Clear old revealed seed phrase since we have a new wallet
      showSeedPhrase = false;
      revealedSeedPhrase = "";
      
      // Wallet has been generated
      
      success("New wallet generated! Make sure to back up your new seed phrase!");
      
      // Show warning notification
      setTimeout(() => {
        const notification = document.createElement('div');
        notification.className = 'fixed bottom-4 right-4 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        notification.textContent = '⚠️ IMPORTANT: Write down your new seed phrase NOW! You won\'t be able to see it again.';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 10000);
      }, 100);
      
    } catch (e) {
      console.error("Generate new seed error:", e);
      fail(e.message || "Failed to generate new seed phrase");
    } finally {
      generatingNewSeed = false;
    }
  }

  function hideNewSeedPhrase() {
    showNewSeedPhrase = false;
    newGeneratedSeed = "";
  }

  async function copyNewSeedPhrase() {
    if (newGeneratedSeed) {
      copy(newGeneratedSeed);
      localNotification = "New seed phrase copied to clipboard. Keep it safe!";
      setTimeout(() => {
        localNotification = "";
      }, 3000);
    }
  }

  // Auto-lock timeout state
  let lockTimeout = $state(15 * 60); // Default 15 minutes in seconds

  onMount(async () => {
    // Load current lock timeout
    const { getLockTimeout } = await import('$lib/walletService');
    lockTimeout = getLockTimeout() / 1000; // Convert ms to seconds

    // Check if we should auto-open restore section
    if (window.location.hash === '#restore-wallet') {
      showRestore = true;
      // Scroll to the section after a short delay
      setTimeout(() => {
        document.getElementById('restore-wallet')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }

    // Check if we should auto-scroll to recovery phrase section
    if (window.location.hash === '#recovery-phrase') {
      // Scroll to the section after a short delay
      setTimeout(() => {
        document.getElementById('recovery-phrase')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }

    // Check if we should auto-reveal the seed phrase (from backup reminder)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autoReveal') === 'true') {
      // Scroll to recovery phrase section first
      setTimeout(() => {
        document.getElementById('recovery-phrase')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Then auto-reveal after a short delay
        setTimeout(() => {
          if (!showSeedPhrase) {
            revealSeedPhrase();
          }
        }, 500);
      }, 200);
    }
  });

  // Handle lock timeout change
  async function updateLockTimeout() {
    try {
      const { setLockTimeout } = await import('$lib/walletService');
      setLockTimeout(lockTimeout * 1000); // Convert seconds to ms
      success(`Auto-lock set to ${formatLockTime(lockTimeout)}`);
    } catch (e) {
      fail('Failed to update auto-lock timeout');
    }
  }

  // Format lock timeout for display
  function formatLockTime(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${seconds / 60} minutes`;
    return `${seconds / 3600} hour${seconds / 3600 > 1 ? 's' : ''}`;
  }

  $effect(() => verify && checkPin());
  $effect(() => setting2fa && enable2fa(twoFaToken));
  $effect(() => disabling2fa && disable2fa(twoFaToken));
</script>

<input type="hidden" name="newpin" value={disablingPin ? "delete" : pin} />

<div class="space-y-8">
  <!-- ============================================================ -->
  <!--  ACCESS & SECURITY SECTION                                   -->
  <!-- ============================================================ -->
  <div class="space-y-4 mb-6">
    <h2 class="text-2xl font-bold gradient-text flex items-center gap-3">
      <iconify-icon icon="ph:shield-check-bold" width="32"></iconify-icon>
      Access & Security
    </h2>
    <p class="text-white/60 text-sm">Manage how you secure and access your wallet</p>
  </div>

  <div class="space-y-6">
  <!-- PIN Security Section -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-red-500/40 transition-all duration-500 animate-scaleIn"
  >
    <div class="flex items-start gap-4">
      <div
        class="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 shadow-lg shadow-red-500/30 flex-shrink-0"
      >
        <iconify-icon icon="ph:lock-key" class="text-white flex-shrink-0" width="32" height="32" style="min-width: 32px; min-height: 32px;"
        ></iconify-icon>
      </div>
      <div class="flex-1">
        <h3 class="text-xl font-bold gradient-text mb-2">
          {verifying
            ? $t("user.settings.verifyPIN")
            : $t("user.settings.securityPIN")}
        </h3>
        <p class="text-white/60 mb-4">
          {$t("user.settings.securityPINDescription")}
        </p>
        <button
          type="button"
          class="px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center gap-2"
          style="background: linear-gradient(135deg, {haspin ? '#EF4444' : '#F87171'} 0%, {haspin ? '#DC2626' : '#EF4444'} 100%); color: white;"
          onclick={togglePin}
        >
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
               style="background: linear-gradient(135deg, {haspin ? '#DC2626' : '#EF4444'} 0%, {haspin ? '#EF4444' : '#F87171'} 100%);"></div>
          <iconify-icon
            noobserver
            icon={haspin ? "ph:lock-key-open-bold" : "ph:lock-key-bold"}
            width="24"
            class="relative z-10 group-hover:rotate-12 transition-transform duration-300"
          ></iconify-icon>
          <span class="relative z-10">
            {haspin
              ? $t("user.settings.disablePIN")
              : $t("user.settings.enablePIN")}
          </span>
        </button>
      </div>
    </div>
  </div>

  <!-- 2FA Section -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-purple-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.1s;"
  >
    <div class="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
      <div
        class="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/30 flex-shrink-0"
      >
        <iconify-icon icon="ph:device-mobile" class="text-white flex-shrink-0" width="28" height="28" style="min-width: 28px; min-height: 28px;"
        ></iconify-icon>
      </div>
      <div class="flex-1 min-w-0 w-full">
        <h3 class="text-lg sm:text-xl font-bold gradient-text mb-2">
          {$t("user.settings.twofa")}
        </h3>
        <p class="text-white/60 mb-4 text-sm sm:text-base">
          {$t("user.settings.twofaDescription")}
        </p>

        {#if setting2fa}
          <a href={otp.uri} class="block max-w-xs mx-auto sm:max-w-none">
            <Qr text={otp.uri} />
          </a>

          <div
            class="text-center my-4 glass rounded-2xl p-3 sm:p-4 border border-purple-500/30"
          >
            <div class="text-white/60 mb-2 text-xs sm:text-sm">
              {$t("user.settings.accountId")}
            </div>
            <b class="text-dgen-aqua text-base sm:text-xl font-mono break-all">{otp.secret}</b>
          </div>

          <button
            type="button"
            class="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
            style="background: linear-gradient(135deg, #74EBD5 0%, #9688DD 100%); color: white;"
            onclick={startConfirming2fa}
          >
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                 style="background: linear-gradient(135deg, #9688DD 0%, #74EBD5 100%);"></div>
            <iconify-icon
              noobserver
              icon="ph:check-circle-bold"
              width="20"
              class="relative z-10 group-hover:rotate-12 transition-transform duration-300 flex-shrink-0"
            ></iconify-icon>
            <span class="relative z-10">Confirm Setup</span>
          </button>
        {:else if user.twofa}
          <button
            type="button"
            class="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
            style="background: linear-gradient(135deg, #F87171 0%, #EF4444 100%); color: white;"
            onclick={startDisabling2fa}
          >
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                 style="background: linear-gradient(135deg, #EF4444 0%, #F87171 100%);"></div>
            <iconify-icon
              noobserver
              icon="ph:shield-slash-bold"
              width="20"
              class="relative z-10 group-hover:rotate-12 transition-transform duration-300 flex-shrink-0"
            ></iconify-icon>
            <span class="relative z-10"
              >{$t("user.settings.twofaDisable")}</span
            >
          </button>
        {:else}
          <button
            type="button"
            class="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
            style="background: linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%); color: white;"
            onclick={startEnabling2fa}
          >
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                 style="background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%);"></div>
            <iconify-icon
              noobserver
              icon="ph:shield-check-bold"
              width="20"
              class="relative z-10 group-hover:rotate-12 transition-transform duration-300 flex-shrink-0"
            ></iconify-icon>
            <span class="relative z-10"
              >{$t("user.settings.twofaSetup")}</span
            >
          </button>
        {/if}

      </div>
    </div>
  </div>

  <!-- Auto-Lock Timeout Section -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-blue-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.15s;"
  >
    <div class="flex items-start gap-4">
      <div
        class="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/30 flex-shrink-0"
      >
        <iconify-icon icon="ph:timer-bold" class="text-white flex-shrink-0" width="32" height="32" style="min-width: 32px; min-height: 32px;"
        ></iconify-icon>
      </div>
      <div class="flex-1">
        <h3 class="text-xl font-bold gradient-text mb-2">
          {$t("user.settings.autoLock")}
        </h3>
        <p class="text-white/60 mb-4">
          {$t("user.settings.autoLockDescription")}
        </p>

        <div class="space-y-3">
          <select
            bind:value={lockTimeout}
            onchange={updateLockTimeout}
            class="w-full glass rounded-2xl border-2 border-white/20 focus:border-blue-500/50 bg-white/5 p-3 text-white"
          >
            <option value={30} class="bg-gray-800 text-white">30 {$t("user.settings.seconds")}</option>
            <option value={5 * 60} class="bg-gray-800 text-white">5 {$t("user.settings.minutes")}</option>
            <option value={15 * 60} class="bg-gray-800 text-white">15 {$t("user.settings.minutes")}</option>
            <option value={30 * 60} class="bg-gray-800 text-white">30 {$t("user.settings.minutes")}</option>
            <option value={60 * 60} class="bg-gray-800 text-white">1 {$t("user.settings.hour")}</option>
            <option value={8 * 60 * 60} class="bg-gray-800 text-white">8 {$t("user.settings.hours")}</option>
          </select>

          <p class="text-white/40 text-sm">
            Your wallet will automatically lock after {formatLockTime(lockTimeout)} of inactivity.
          </p>
        </div>
      </div>
    </div>
  </div>
  </div>

  <!-- ============================================================ -->
  <!--  WALLET RECOVERY SECTION                                     -->
  <!-- ============================================================ -->
  <div class="space-y-4 mb-6">
    <h2 class="text-2xl font-bold gradient-text flex items-center gap-3">
      <iconify-icon icon="ph:key-bold" width="32"></iconify-icon>
      Wallet Recovery
    </h2>
    <p class="text-white/60 text-sm">Manage your wallet seed phrase and recovery options</p>
  </div>

  <!-- Wallet Setup Section removed - all users have auto-generated wallets -->

  <!-- Reveal Seed Phrase Section - ALWAYS visible since all users have wallets -->
  <div class="space-y-6 animate-scaleIn">
    <div
      id="recovery-phrase"
      class="premium-card backdrop-blur-xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border-2 border-emerald-500/30 hover:border-emerald-500/50 transition-all duration-300"
    >
      <div class="flex items-start gap-4">
        <div
          class="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30 flex items-center justify-center flex-shrink-0"
        >
          <iconify-icon
            noobserver
            icon="ph:key-bold"
            width="28"
            height="28"
            class="text-white flex-shrink-0"
            style="min-width: 28px; min-height: 28px;"
          ></iconify-icon>
        </div>
        <div class="flex-1">
          <h3 class="text-xl font-bold gradient-text mb-2">
            Recovery Phrase
          </h3>
          <p class="text-white/60 mb-4">
            View your 12-word recovery phrase. Keep it safe - anyone with these words can access your wallet.
          </p>
          
          {#if !showSeedPhrase}
            {#if !confirmRevealSeed}
              <button
                type="button"
                onclick={revealSeedPhrase}
                disabled={revealingSeed}
                class="px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white;"
              >
                <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                     style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);"></div>
                <iconify-icon
                  noobserver
                  icon="ph:eye-bold"
                  width="24"
                  class="relative z-10 group-hover:scale-110 transition-transform duration-300"
                ></iconify-icon>
                <span class="relative z-10">Reveal Recovery Phrase</span>
              </button>
            {:else}
              <!-- Privacy Confirmation -->
              <div class="space-y-4 animate-scaleIn">
                <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <div class="flex items-start gap-3">
                    <iconify-icon
                      icon="ph:eye-slash-bold"
                      class="text-yellow-400 mt-1"
                      width="24"
                    ></iconify-icon>
                    <div>
                      <p class="font-bold text-yellow-400 text-lg uppercase">Privacy Warning</p>
                      <p class="text-white/80 text-sm mt-2">
                        Before revealing your recovery phrase, please ensure:
                      </p>
                      <ul class="text-white/80 text-sm mt-2 ml-4 list-disc space-y-1">
                        <li>No one is looking at your screen</li>
                        <li>You are in a private place</li>
                        <li>No cameras are nearby or recording</li>
                        <li>Your screen is not being shared or recorded</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div class="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onclick={revealSeedPhrase}
                    disabled={revealingSeed}
                    class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white;"
                  >
                    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                         style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);"></div>
                    {#if revealingSeed}
                      <Spinner />
                    {:else}
                      <iconify-icon
                        noobserver
                        icon="ph:check-circle-bold"
                        width="24"
                        class="relative z-10"
                      ></iconify-icon>
                      <span class="relative z-10">I'm in a Private Place, Continue</span>
                    {/if}
                  </button>

                  <button
                    type="button"
                    onclick={() => confirmRevealSeed = false}
                    disabled={revealingSeed}
                    class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white;"
                  >
                    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                         style="background: linear-gradient(135deg, #4B5563 0%, #6B7280 100%);"></div>
                    <iconify-icon
                      noobserver
                      icon="ph:x-circle-bold"
                      width="24"
                      class="relative z-10"
                    ></iconify-icon>
                    <span class="relative z-10">Cancel</span>
                  </button>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Display Revealed Seed Phrase -->
  {#if showSeedPhrase && revealedSeedPhrase}
    <div
      class="premium-card backdrop-blur-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border-2 border-emerald-500/50 animate-scaleIn"
    >
      <div class="space-y-4">
        <!-- Warning -->
        <div class="bg-red-500/20 border-2 border-red-500/50 rounded-xl p-4">
          <div class="flex items-start gap-3">
            <iconify-icon
              noobserver
              icon="ph:warning-circle-bold"
              class="text-red-400 mt-1"
              width="28"
            ></iconify-icon>
            <div>
              <p class="text-red-400 font-bold text-lg mb-2">
                ⚠️ IMPORTANT - BACKUP YOUR RECOVERY PHRASE!
              </p>
              <p class="text-white text-sm">
                This is your recovery phrase for this wallet. Write these words down on paper and keep them safe. Never share them with anyone - anyone with these words can access your wallet.
              </p>
            </div>
          </div>
        </div>
        
        <!-- Seed Phrase Display -->
        <div class="bg-black/40 rounded-xl p-4 border-2 border-emerald-500/30">
          <h4 class="text-white font-bold mb-3 text-center">Your Recovery Phrase</h4>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
            {#each revealedSeedPhrase.split(' ') as word, i}
              <div class="bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-lg p-2 sm:p-3 border border-emerald-500/30 min-w-0">
                <span class="text-emerald-400 text-xs block">#{i + 1}</span>
                <div class="font-mono text-white text-sm sm:text-base mt-1 break-all font-bold">{word}</div>
              </div>
            {/each}
          </div>
          
          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onclick={copySeedPhrase}
              class="flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
              style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white;"
            >
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                   style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);"></div>
              <iconify-icon
                noobserver
                icon="ph:copy-bold"
                width="20"
                class="relative z-10"
              ></iconify-icon>
              <span class="relative z-10">Copy Phrase</span>
            </button>
            
            <button
              type="button"
              onclick={hideSeedPhrase}
              class="flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
              style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white;"
            >
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                   style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);"></div>
              <iconify-icon
                noobserver
                icon="ph:check-circle-bold"
                width="20"
                class="relative z-10"
              ></iconify-icon>
              <span class="relative z-10">I've Written It Down</span>
            </button>
          </div>
        </div>
        
        <div class="text-center text-white/60 text-sm">
          After closing this, you can click "Reveal Recovery Phrase" above to view it again.
        </div>
      </div>
    </div>
  {/if}

  <!-- Wallet Import/Replace Section - Always available -->
  <div
      id="restore-wallet"
      class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-amber-500/40 transition-all duration-500 animate-scaleIn"
      style="animation-delay: 0.1s;"
    >
      <div class="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
      <div
        class="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 flex-shrink-0"
      >
        <iconify-icon icon="ph:arrows-clockwise-bold" class="text-white flex-shrink-0" width="28" height="28" style="min-width: 28px; min-height: 28px;"
        ></iconify-icon>
      </div>
      <div class="flex-1 min-w-0 w-full">
        <h3 class="text-lg sm:text-xl font-bold gradient-text mb-2">
          Replace Wallet (Advanced)
        </h3>
        <p class="text-white/60 mb-4 text-sm sm:text-base">
          Import a different wallet using a 12-word seed phrase. This will completely replace your current wallet. Only use this if you want to switch to a different wallet.
        </p>

        {#if !showRestore}
          <button
            onclick={toggleRestore}
            class="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
            style="background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%); color: white;"
          >
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                 style="background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%);"></div>
            <iconify-icon
              noobserver
              icon="ph:arrows-clockwise-bold"
              width="20"
              class="relative z-10 group-hover:rotate-180 transition-transform duration-500 flex-shrink-0"
            ></iconify-icon>
            <span class="relative z-10">Import from Seed Phrase</span>
          </button>
        {:else}
          <div class="space-y-4 animate-scaleIn">
            <div class="bg-red-500/20 border-2 border-red-500/50 rounded-xl p-3 sm:p-4">
              <div class="flex items-start gap-2 sm:gap-3">
                <iconify-icon
                  icon="ph:warning-bold"
                  class="text-red-400 mt-1 flex-shrink-0"
                  width="24"
                ></iconify-icon>
                <div class="min-w-0">
                  <p class="font-bold text-red-400 text-sm sm:text-base uppercase tracking-wide mb-2">
                    ⚠️ Warning - This Will Replace Your Wallet!
                  </p>
                  <p class="text-white/90 text-xs sm:text-sm mb-2">
                    Importing a seed will create a completely new wallet. Your old seed phrase will still work if you need to restore it later.
                  </p>
                  <p class="text-white/80 text-xs sm:text-sm font-semibold mb-1">Only proceed if:</p>
                  <ul class="text-white/80 text-xs sm:text-sm space-y-1 ml-4 list-disc">
                    <li>You've lost your original seed phrase and can't restore it, OR</li>
                    <li>You want to start fresh with a new wallet, OR</li>
                    <li>You understand this creates a separate wallet (not linked to your old one)</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Lightning Address Warning -->
            {#if user?.lightningAddress}
            <div class="bg-amber-500/20 border-2 border-amber-500/50 rounded-xl p-3 sm:p-4">
              <div class="flex items-start gap-2 sm:gap-3">
                <iconify-icon
                  icon="ph:lightning-bold"
                  class="text-amber-400 mt-1 flex-shrink-0"
                  width="24"
                ></iconify-icon>
                <div class="min-w-0">
                  <p class="font-bold text-amber-400 text-sm sm:text-base uppercase tracking-wide mb-2 break-words">
                    ⚡ NEW SEED = NEW LIGHTNING ADDRESS
                  </p>
                  <p class="text-white/90 text-xs sm:text-sm font-semibold mb-2 break-all">
                    Current: <span class="font-mono">{user.lightningAddress}</span>
                  </p>
                  <p class="text-white/80 text-xs sm:text-sm">
                    Each seed has its own unique Lightning address. The imported seed will have a different Lightning address. Your current address is tied to your current seed only.
                  </p>
                </div>
              </div>
            </div>
            {/if}

            <div class="space-y-2">
              <label for="restore-mnemonic" class="text-white/80 text-sm font-medium">
                Enter your 12-word seed phrase:
              </label>
              <textarea
                id="restore-mnemonic"
                bind:value={restoreMnemonic}
                placeholder="Enter your 12 words separated by spaces..."
                class="w-full h-24 p-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all resize-none font-mono text-sm"
                disabled={restoring}
              ></textarea>
              <p class="text-white/40 text-xs">
                Example: word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12
              </p>
            </div>

            {#if !confirmRestoreWallet}
              <div class="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onclick={() => confirmRestoreWallet = true}
                  disabled={restoring || !restoreMnemonic.trim()}
                  class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white;"
                >
                  <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                       style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);"></div>
                  <iconify-icon
                    noobserver
                    icon="ph:check-circle-bold"
                    width="24"
                    class="relative z-10 group-hover:rotate-12 transition-transform duration-300"
                  ></iconify-icon>
                  <span class="relative z-10">Restore Wallet</span>
                </button>

                <button
                  type="button"
                  onclick={toggleRestore}
                  disabled={restoring}
                  class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white;"
                >
                  <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                       style="background: linear-gradient(135deg, #4B5563 0%, #6B7280 100%);"></div>
                  <iconify-icon
                    noobserver
                    icon="ph:x-circle-bold"
                    width="24"
                    class="relative z-10 group-hover:rotate-90 transition-transform duration-300"
                  ></iconify-icon>
                  <span class="relative z-10">Cancel</span>
                </button>
              </div>
            {:else}
              <!-- EXTRA CONFIRMATION with BIG LETTERS -->
              <div class="space-y-4 animate-scaleIn">
                <div class="bg-red-500/20 border-2 border-red-500/50 rounded-xl p-3 sm:p-4">
                  <div class="flex items-start gap-2 sm:gap-3">
                    <iconify-icon
                      icon="ph:warning-bold"
                      class="text-red-400 mt-1 flex-shrink-0"
                      width="24"
                    ></iconify-icon>
                    <div class="min-w-0">
                      <p class="font-bold text-red-400 text-base sm:text-xl md:text-2xl uppercase tracking-wide mb-2 sm:mb-3 break-words">
                        ⚠️ ARE YOU ABSOLUTELY SURE?
                      </p>
                      <p class="text-white/90 text-sm sm:text-base font-semibold">
                        This action will REPLACE your current wallet completely!
                      </p>
                      <p class="text-white/80 text-xs sm:text-sm mt-2">
                        Make sure you have backed up your existing wallet's recovery phrase before continuing. This cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Lightning Address Warning -->
                {#if user?.lightningAddress}
                <div class="bg-amber-500/20 border-2 border-amber-500/50 rounded-xl p-3 sm:p-4">
                  <div class="flex items-start gap-2 sm:gap-3">
                    <iconify-icon
                      icon="ph:lightning-bold"
                      class="text-amber-400 mt-1 flex-shrink-0"
                      width="24"
                    ></iconify-icon>
                    <div class="min-w-0">
                      <p class="font-bold text-amber-400 text-sm sm:text-base uppercase tracking-wide mb-2 break-words">
                        ⚡ NEW SEED = NEW LIGHTNING ADDRESS
                      </p>
                      <p class="text-white/90 text-xs sm:text-sm font-semibold mb-2 break-all">
                        Current: <span class="font-mono">{user.lightningAddress}</span>
                      </p>
                      <p class="text-white/80 text-xs sm:text-sm">
                        Each seed has its own unique Lightning address. The imported seed will have a different Lightning address. Your current address is tied to your current seed only.
                      </p>
                    </div>
                  </div>
                </div>
                {/if}

                <div class="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onclick={restoreWallet}
                    disabled={restoring || !restoreMnemonic.trim()}
                    class="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white;"
                  >
                    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                         style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);"></div>
                    {#if restoring}
                      <iconify-icon
                        icon="ph:spinner"
                        width="20"
                        class="animate-spin relative z-10 flex-shrink-0"
                      ></iconify-icon>
                      <span class="relative z-10">Restoring...</span>
                    {:else}
                      <iconify-icon
                        noobserver
                        icon="ph:warning-circle-bold"
                        width="20"
                        class="relative z-10 flex-shrink-0"
                      ></iconify-icon>
                      <span class="relative z-10 uppercase text-xs sm:text-sm">YES, REPLACE MY WALLET</span>
                    {/if}
                  </button>

                  <button
                    type="button"
                    onclick={() => confirmRestoreWallet = false}
                    disabled={restoring}
                    class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white;"
                  >
                    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                         style="background: linear-gradient(135deg, #4B5563 0%, #6B7280 100%);"></div>
                    <iconify-icon
                      noobserver
                      icon="ph:x-circle-bold"
                      width="24"
                      class="relative z-10"
                    ></iconify-icon>
                    <span class="relative z-10">Go Back</span>
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Local notification for seed phrase actions -->
  {#if localNotification}
    <div class="fixed bottom-20 right-4 bg-green-500/90 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-scaleIn">
      {localNotification}
    </div>
  {/if}


  <!-- Generate New Seed Section - Always available since all users have wallets -->
  <div
    id="generate-new-seed"
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-purple-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.2s;"
  >
      <div class="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
        <div
          class="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/30 flex-shrink-0"
        >
          <iconify-icon icon="ph:sparkle-bold" class="text-white flex-shrink-0" width="28" height="28" style="min-width: 28px; min-height: 28px;"
          ></iconify-icon>
        </div>
        <div class="flex-1 min-w-0 w-full">
          <h3 class="text-lg sm:text-xl font-bold gradient-text mb-2">
            Generate New Seed
          </h3>
          <p class="text-white/60 mb-4 text-sm sm:text-base">
            Generate a brand new wallet with a fresh seed phrase. This replaces the wallet on this device/browser only. Your original wallet can still be restored later with its seed phrase if needed.
          </p>

          {#if !showGenerateNew}
            <button
              onclick={() => showGenerateNew = true}
              class="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
              style="background: linear-gradient(135deg, #A855F7 0%, #EC4899 100%); color: white;"
            >
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                   style="background: linear-gradient(135deg, #EC4899 0%, #A855F7 100%);"></div>
              <iconify-icon
                noobserver
                icon="ph:sparkle-bold"
                width="20"
                class="relative z-10 group-hover:rotate-12 transition-transform duration-500 flex-shrink-0"
              ></iconify-icon>
              <span class="relative z-10">Generate New Wallet</span>
            </button>
          {:else}
            <div class="space-y-4 animate-scaleIn">
              <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 sm:p-4">
                <div class="flex items-start gap-2 sm:gap-3">
                  <iconify-icon
                    icon="ph:warning-bold"
                    class="text-red-400 mt-1 flex-shrink-0"
                    width="20"
                  ></iconify-icon>
                  <div class="min-w-0">
                    <p class="font-bold text-red-400 text-sm sm:text-base">Warning - This Will Replace Your Wallet!</p>
                    <p class="text-white/80 text-xs sm:text-sm mt-1">
                      Generating a new seed will create a completely new wallet. Your old seed phrase will still work if you need to restore it later. Only proceed if:
                    </p>
                    <ul class="text-white/80 text-xs sm:text-sm mt-2 ml-4 list-disc">
                      <li>You've lost your original seed phrase and can't restore it, OR</li>
                      <li>You want to start fresh with a new wallet, OR</li>
                      <li>You understand this creates a separate wallet (not linked to your old one)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {#if !confirmGenerateNew}
                <div class="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onclick={() => confirmGenerateNew = true}
                    disabled={generatingNewSeed}
                    class="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white;"
                  >
                    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                         style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);"></div>
                    <iconify-icon
                      noobserver
                      icon="ph:arrows-clockwise-bold"
                      width="20"
                      class="relative z-10 group-hover:rotate-180 transition-transform duration-500 flex-shrink-0"
                    ></iconify-icon>
                    <span class="relative z-10">Yes, Replace My Wallet</span>
                  </button>

                  <button
                    type="button"
                    onclick={() => showGenerateNew = false}
                    disabled={generatingNewSeed}
                    class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white;"
                  >
                    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                         style="background: linear-gradient(135deg, #4B5563 0%, #6B7280 100%);"></div>
                    <iconify-icon
                      noobserver
                      icon="ph:x-circle-bold"
                      width="24"
                      class="relative z-10 group-hover:rotate-90 transition-transform duration-300"
                    ></iconify-icon>
                    <span class="relative z-10">Cancel</span>
                  </button>
                </div>
              {:else}
                <!-- EXTRA CONFIRMATION with BIG LETTERS -->
                <div class="space-y-4 animate-scaleIn">
                  <div class="bg-red-500/20 border-2 border-red-500/50 rounded-xl p-3 sm:p-4">
                    <div class="flex items-start gap-2 sm:gap-3">
                      <iconify-icon
                        icon="ph:warning-bold"
                        class="text-red-400 mt-1 flex-shrink-0"
                        width="24"
                      ></iconify-icon>
                      <div class="min-w-0">
                        <p class="font-bold text-red-400 text-base sm:text-xl md:text-2xl uppercase tracking-wide mb-2 sm:mb-3 break-words">
                          ⚠️ FINAL CONFIRMATION REQUIRED
                        </p>
                        <p class="text-white/90 text-sm sm:text-base font-semibold">
                          This will generate a NEW wallet and REPLACE your current one!
                        </p>
                        <p class="text-white/80 text-xs sm:text-sm mt-2">
                          Make absolutely sure you have saved your current wallet's recovery phrase. You will need it to restore this wallet in the future.
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Lightning Address Warning -->
                  {#if user?.lightningAddress}
                  <div class="bg-amber-500/20 border-2 border-amber-500/50 rounded-xl p-3 sm:p-4">
                    <div class="flex items-start gap-2 sm:gap-3">
                      <iconify-icon
                        icon="ph:lightning-bold"
                        class="text-amber-400 mt-1 flex-shrink-0"
                        width="24"
                      ></iconify-icon>
                      <div class="min-w-0">
                        <p class="font-bold text-amber-400 text-sm sm:text-base uppercase tracking-wide mb-2 break-words">
                          ⚡ NEW SEED = NEW LIGHTNING ADDRESS
                        </p>
                        <p class="text-white/90 text-xs sm:text-sm font-semibold mb-2 break-all">
                          Current: <span class="font-mono">{user.lightningAddress}</span>
                        </p>
                        <p class="text-white/80 text-xs sm:text-sm">
                          Each seed has its own unique Lightning address. The new seed will get a different Lightning address. Your current address is tied to your current seed only.
                        </p>
                      </div>
                    </div>
                  </div>
                  {/if}

                  <div class="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onclick={() => generateNewSeed()}
                      disabled={generatingNewSeed}
                      class="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white;"
                    >
                      <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                           style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);"></div>
                      {#if generatingNewSeed}
                        <iconify-icon
                          icon="ph:spinner"
                          width="20"
                          class="animate-spin relative z-10 flex-shrink-0"
                        ></iconify-icon>
                        <span class="relative z-10">Generating...</span>
                      {:else}
                        <iconify-icon
                          noobserver
                          icon="ph:warning-circle-bold"
                          width="20"
                          class="relative z-10 flex-shrink-0"
                        ></iconify-icon>
                        <span class="relative z-10 uppercase text-xs sm:text-sm">YES, I'M ABSOLUTELY SURE</span>
                      {/if}
                    </button>

                    <button
                      type="button"
                      onclick={() => confirmGenerateNew = false}
                      disabled={generatingNewSeed}
                      class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white;"
                    >
                      <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                           style="background: linear-gradient(135deg, #4B5563 0%, #6B7280 100%);"></div>
                      <iconify-icon
                        noobserver
                        icon="ph:x-circle-bold"
                        width="24"
                        class="relative z-10"
                      ></iconify-icon>
                      <span class="relative z-10">Go Back</span>
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>

  <!-- Display Newly Generated Seed Phrase -->
  {#if showNewSeedPhrase && newGeneratedSeed}
    <div
      class="premium-card backdrop-blur-xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-red-500/20 border-2 border-purple-500/50 animate-scaleIn"
    >
      <div class="space-y-4">
        <!-- Warning -->
        <div class="bg-red-500/20 border-2 border-red-500/50 rounded-xl p-4">
          <div class="flex items-start gap-3">
            <iconify-icon
              noobserver
              icon="ph:warning-circle-bold"
              class="text-red-400 mt-1"
              width="28"
            ></iconify-icon>
            <div>
              <p class="text-red-400 font-bold text-lg mb-2">
                ⚠️ IMPORTANT - BACKUP YOUR NEW WALLET!
              </p>
              <p class="text-white text-sm">
                This is your NEW recovery phrase for this device/browser. Your old seed phrase still works for your previous wallet.
                Write these words down on paper and keep them safe. You can view them again later in the Recovery Phrase section above.
              </p>
            </div>
          </div>
        </div>
        
        <!-- New Seed Phrase Display -->
        <div class="bg-black/40 rounded-xl p-4 border-2 border-purple-500/30">
          <h4 class="text-white font-bold mb-3 text-center">Your New Recovery Phrase</h4>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
            {#each newGeneratedSeed.split(' ') as word, i}
              <div class="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-lg p-2 sm:p-3 border border-purple-500/30 min-w-0">
                <span class="text-purple-400 text-xs block">#{i + 1}</span>
                <div class="font-mono text-white text-sm sm:text-base mt-1 break-all font-bold">{word}</div>
              </div>
            {/each}
          </div>
          
          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onclick={copyNewSeedPhrase}
              class="flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
              style="background: linear-gradient(135deg, #A855F7 0%, #EC4899 100%); color: white;"
            >
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                   style="background: linear-gradient(135deg, #EC4899 0%, #A855F7 100%);"></div>
              <iconify-icon
                noobserver
                icon="ph:copy-bold"
                width="20"
                class="relative z-10"
              ></iconify-icon>
              <span class="relative z-10">Copy New Phrase</span>
            </button>
            
            <button
              type="button"
              onclick={hideNewSeedPhrase}
              class="flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
              style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white;"
            >
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                   style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);"></div>
              <iconify-icon
                noobserver
                icon="ph:check-circle-bold"
                width="20"
                class="relative z-10"
              ></iconify-icon>
              <span class="relative z-10">I've Written It Down</span>
            </button>
          </div>
        </div>
        
        <div class="text-center text-white/60 text-sm">
          After closing this, you can only view your seed phrase by clicking "Reveal Recovery Phrase" above.
        </div>
      </div>
    </div>
  {/if}

</div>

<!-- PIN Modals - rendered outside main container for proper z-index -->
{#if verifying}
  <Pin bind:value={verify} {cancel} notify={false} />
{:else if settingPin}
  <Pin
    bind:value={pin}
    title={$t("user.settings.setPIN")}
    {cancel}
    notify={false}
  />
{/if}

{#if confirming2fa || disabling2fa}
  <Pin
    bind:value={twoFaToken}
    title="Enter 2FA Code"
    {cancel}
    notify={false}
  />
{/if}
