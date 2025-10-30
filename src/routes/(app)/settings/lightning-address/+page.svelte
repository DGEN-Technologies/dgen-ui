<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import {
    setupLightningAddress,
    unregisterLightningAddress,
    getWalletInfo,
    UsernameConflictError
  } from '$lib/walletService';
  import { lnAddressStore, hasValidAddress, isLoading } from '$lib/stores/lightningAddress';
  import UpdateUsernameModal from '$lib/../components/UpdateUsernameModal.svelte';
  import { post, fail, success } from '$lib/utils';
  import { browser } from '$app/environment';
  import { PUBLIC_DGEN_URL } from '$env/static/public';

  let { data } = $props();
  let { user } = $derived(data || {});

  let username = $state('');
  let registering = $state(false);
  let checking = $state(false);
  let available = $state(null);
  let error = $state('');
  let showUpdateModal = $state(false);
  let recovering = $state(false);
  let copied = $state(false);
  let walletPubkey = $state(null);
  let fetchingWalletInfo = $state(false);
  let showRemove = $state(false);
  let confirmRemove = $state(false);
  let removing = $state(false);

  // Initialize store - don't show DB address until we verify it works for this seed
  $effect(() => {
    // Always start with reset - we'll verify via recovery
    lnAddressStore.reset();
  });

  // Try recovery on mount to verify if DB address is active for THIS seed
  onMount(async () => {
    // Always try recovery if user has an address in DB
    // This verifies if the address works with THIS seed
    if (user?.lightningAddress) {
      await tryRecover();
    }

    // Fetch wallet pubkey for display
    await fetchWalletPubkey();
  });

  // Fetch wallet pubkey
  const fetchWalletPubkey = async () => {
    if (fetchingWalletInfo) return;

    fetchingWalletInfo = true;
    try {
      const { isConnected } = await import('$lib/walletService');
      if (!isConnected()) {
        console.log('[Wallet Info] SDK not connected yet');
        fetchingWalletInfo = false;
        return;
      }

      const info = await getWalletInfo();
      if (info?.walletInfo?.pubkey) {
        walletPubkey = info.walletInfo.pubkey;
      }
    } catch (e) {
      console.error('[Wallet Info] Failed to fetch:', e);
    } finally {
      fetchingWalletInfo = false;
    }
  };

  // Truncate pubkey for display (show first 8 and last 8 characters)
  const truncatePubkey = (pubkey) => {
    if (!pubkey || pubkey.length < 16) return pubkey;
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
  };

  // Derive current lightning address from store
  const lightningAddress = $derived($lnAddressStore.lnAddress);
  const currentUsername = $derived(lightningAddress ? lightningAddress.split('@')[0] : '');

  // Validation
  const validateUsername = (value) => {
    if (!value) return 'Username is required';
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 20) return 'Username must be less than 20 characters';
    if (!/^[a-z0-9_-]+$/.test(value)) return 'Username can only contain lowercase letters, numbers, hyphens, and underscores';
    return null;
  };

  // Auto-sanitize username input
  const sanitizeUsername = (value) => {
    return value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  };

  const handleUsernameInput = (e) => {
    username = sanitizeUsername(e.target.value);
  };

  $effect(() => {
    if (username) {
      const validationError = validateUsername(username);
      if (!validationError) {
        available = true;
        checking = false;
      } else {
        available = null;
        checking = false;
      }
    } else {
      available = null;
      checking = false;
    }
  });

  const tryRecover = async () => {
    if (recovering) return;

    recovering = true;
    lnAddressStore.setLoading();

    try {
      const { isConnected, recoverLightningAddress } = await import('$lib/walletService');
      if (!isConnected()) {
        console.log('[Lightning Address] SDK not connected yet, skipping recovery');
        lnAddressStore.reset();
        recovering = false;
        return;
      }

      const serverOrigin = PUBLIC_DGEN_URL;
      const webhookUrl = new URL('/api/v1/notify', serverOrigin);
      webhookUrl.searchParams.set('user', user.id);

      console.log('[Lightning Address] Checking if address is active for this seed...');

      // Try recovery - only succeeds if THIS seed already has a registration
      const recovered = await recoverLightningAddress(webhookUrl.toString());

      if (recovered && recovered.lightningAddress) {
        console.log('[Lightning Address] Address is active for this seed:', recovered.lightningAddress);

        lnAddressStore.setSuccess(
          recovered.lnurl,
          recovered.lightningAddress,
          recovered.bip353Address
        );

        // Update DB if address changed
        if (user.lightningAddress !== recovered.lightningAddress) {
          await post('/user', {
            lightningAddress: recovered.lightningAddress,
            lnurl: recovered.lnurl,
            bip353Address: recovered.bip353Address
          });

          user.lightningAddress = recovered.lightningAddress;
          user.lnurl = recovered.lnurl;
          user.bip353Address = recovered.bip353Address;
        }
      } else {
        // No registration for this seed - clear stale DB address
        console.log('[Lightning Address] No active address for this seed, clearing stale data');

        if (user.lightningAddress) {
          await post('/user', {
            lightningAddress: null,
            lnurl: null,
            bip353Address: null
          });

          user.lightningAddress = null;
          user.lnurl = null;
          user.bip353Address = null;
        }

        lnAddressStore.reset();
      }

    } catch (e) {
      console.error('[Lightning Address] Recovery check failed:', e);
      lnAddressStore.reset();
    } finally {
      recovering = false;
    }
  };

  const handleRegister = async () => {
    const validationError = validateUsername(username);
    if (validationError) {
      error = validationError;
      fail(validationError);
      return;
    }

    const { isConnected, registerLightningAddress, formatUsername } = await import('$lib/walletService');
    if (!isConnected()) {
      error = 'Wallet SDK is still initializing. Please wait a moment and try again.';
      fail(error);
      return;
    }

    registering = true;
    error = '';
    lnAddressStore.setLoading();

    try {
      const serverOrigin = PUBLIC_DGEN_URL;
      const webhookUrl = new URL('/api/v1/notify', serverOrigin);
      webhookUrl.searchParams.set('user', user.id);

      // Format username before registration
      const formattedUsername = formatUsername(username);
      console.log('[Lightning Address] Registering with formatted username:', formattedUsername);

      // Use direct registration with automatic retry
      // This will automatically try with discriminators if username is taken
      const result = await registerLightningAddress(
        formattedUsername,
        webhookUrl.toString()
      );

      console.log('[Lightning Address] Registration successful:', result.lightningAddress);

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

      // Show the final registered address (might have discriminator)
      const finalUsername = result.lightningAddress?.split('@')[0];
      if (finalUsername && finalUsername !== formattedUsername) {
        success(`Lightning address registered: ${result.lightningAddress} (username was adjusted to ensure uniqueness)`);
      } else {
        success(`Lightning address registered: ${result.lightningAddress}`);
      }

    } catch (e) {
      console.error('[Lightning Address] Registration error:', e);

      let errorMessage = 'Registration failed';

      // The retry logic handles UsernameConflictError internally now
      // If we get here with that error, it means all retries failed
      if (e instanceof Error && e.name === 'UsernameConflictError') {
        errorMessage = 'All username variations are taken. Please try a different username.';
        error = errorMessage;
      } else if (e instanceof Error) {
        errorMessage = e.message;
        error = errorMessage;
      }

      lnAddressStore.setError(e instanceof Error ? e : new Error(errorMessage));
      fail(errorMessage);

    } finally {
      registering = false;
    }
  };

  const handleUpdateSuccess = async (result) => {
    // Update user profile
    await post('/user', {
      lightningAddress: result.lightningAddress,
      lnurl: result.lnurl,
      bip353Address: result.bip353Address
    });

    user.lightningAddress = result.lightningAddress;
    user.lnurl = result.lnurl;
    user.bip353Address = result.bip353Address;
  };

  const handleUnregister = async () => {
    if (removing) return;

    try {
      removing = true;
      const serverOrigin = PUBLIC_DGEN_URL;
      const webhookUrl = new URL('/api/v1/notify', serverOrigin);
      webhookUrl.searchParams.set('user', user.id);

      await unregisterLightningAddress(webhookUrl.toString());

      // Clear from user profile
      await post('/user', {
        lightningAddress: null,
        lnurl: null,
        bip353Address: null
      });

      user.lightningAddress = null;
      user.lnurl = null;
      user.bip353Address = null;

      lnAddressStore.reset();
      success('Lightning address removed');

      // Reset state
      showRemove = false;
      confirmRemove = false;

    } catch (e) {
      console.error('[Lightning Address] Unregister error:', e);
      fail('Failed to remove Lightning address');
    } finally {
      removing = false;
    }
  };

  const handleCopy = async () => {
    if (!lightningAddress) return;

    try {
      await navigator.clipboard.writeText(lightningAddress);
      copied = true;
      success('Copied to clipboard!');

      // Reset copied state after 2 seconds
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (e) {
      console.error('[Copy] Failed:', e);
      fail('Failed to copy to clipboard');
    }
  };
</script>

<div class="container mx-auto max-w-2xl px-4 py-8">
  <div class="mb-6">
    <h1 class="text-3xl font-bold mb-2">Lightning Address</h1>
    <p class="text-white/60">
      Here you can modify your optional username "username@breez.fun". Users can send you lightning with just your username (easier than giving someone a long string of letters/numbers)
    </p>
  </div>

  {#if lightningAddress}
    <div class="lightning-card">
      <div class="card-header">
        <div class="lightning-icon">
          <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
          </svg>
        </div>
        <div>
          <div class="card-title">Your Lightning Address</div>
          <div class="card-status">Active & Ready</div>
        </div>
      </div>

      <button
        type="button"
        onclick={handleCopy}
        class="address-container group cursor-pointer w-full"
        title="Click to copy"
      >
        <div class="address-display">
          <div class="address-icon">@</div>
          <div class="address-text">{lightningAddress}</div>
        </div>
        <div class="copy-indicator">
          {#if copied}
            <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {:else}
            <svg class="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          {/if}
        </div>
      </button>

      <div class="info-box">
        <svg class="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="info-text">
          <p class="font-medium">Ready to receive payments!</p>
          <p class="text-sm text-white/60 mt-1">Anyone can send you sats using this Lightning address from any wallet.</p>
        </div>
      </div>

      <!-- Wallet Identity Info -->
      {#if walletPubkey}
        <div class="wallet-info-box">
          <div class="flex items-start gap-2 sm:gap-3">
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-blue-400 mb-1 text-sm sm:text-base">Wallet Identity</p>
              <p class="text-xs sm:text-sm text-white/60 mb-2">This Lightning address is tied to your wallet seed</p>
              <div class="wallet-pubkey-display">
                <span class="text-xs text-white/40 font-mono">Pubkey:</span>
                <span class="text-xs text-white/80 font-mono ml-2 break-all">{truncatePubkey(walletPubkey)}</span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Seed = Address Warning -->
      <div class="warning-box">
        <div class="flex items-start gap-2 sm:gap-3">
          <svg class="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-amber-400 mb-2 text-sm sm:text-base">Your Seed = Your Lightning Address</p>
            <ul class="text-xs sm:text-sm text-white/70 space-y-2">
              <li><strong>• This Lightning address is tied to THIS seed phrase only</strong></li>
              <li>• New device = new seed = new Lightning address (e.g., user → user1234)</li>
              <li>• To use this same address on another device, you must <strong>restore this seed phrase</strong></li>
              <li>• If you import a different seed, you'll get a different Lightning address</li>
            </ul>
            <a href="/settings/security" class="inline-flex items-center gap-1 text-xs sm:text-sm text-blue-400 hover:text-blue-300 mt-3 transition-colors font-medium">
              <svg class="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Backup Seed Phrase Now
            </a>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="action-buttons">
        <button
          type="button"
          onclick={() => showUpdateModal = true}
          class="btn btn-secondary"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Update Username
        </button>
        <button
          type="button"
          onclick={() => showRemove = true}
          class="btn btn-danger"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Remove
        </button>
      </div>
    </div>

    <!-- Remove Lightning Address Confirmation Section -->
    {#if showRemove}
      <div class="glass rounded-xl p-6 border-2 border-red-500/50 bg-red-500/10 mt-4 animate-scaleIn">
        <div class="space-y-4">
          <div class="bg-red-500/20 border-2 border-red-500/50 rounded-xl p-4">
            <div class="flex items-start gap-3">
              <svg class="w-6 h-6 text-red-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p class="font-bold text-red-400 text-lg">Warning - This Will Remove Your Lightning Address!</p>
                <p class="text-white/90 text-sm mt-2">
                  Removing your Lightning address (<strong>{lightningAddress}</strong>) will:
                </p>
                <ul class="text-white/80 text-sm mt-2 ml-4 list-disc space-y-1">
                  <li>Unregister your Lightning address from the Breez service</li>
                  <li>Stop you from receiving payments at this address</li>
                  <li>Free up the address for others to potentially use</li>
                </ul>
                <p class="text-white/90 text-sm mt-3 font-semibold">
                  You can register a new Lightning address later, but you may not get the same one back.
                </p>
              </div>
            </div>
          </div>

          {#if !confirmRemove}
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onclick={() => confirmRemove = true}
                disabled={removing}
                class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white;"
              >
                <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                     style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);"></div>
                <svg class="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span class="relative z-10">Yes, Remove My Lightning Address</span>
              </button>

              <button
                type="button"
                onclick={() => { showRemove = false; confirmRemove = false; }}
                disabled={removing}
                class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white;"
              >
                <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                     style="background: linear-gradient(135deg, #4B5563 0%, #6B7280 100%);"></div>
                <svg class="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span class="relative z-10">Cancel</span>
              </button>
            </div>
          {:else}
            <!-- EXTRA CONFIRMATION with BIG LETTERS -->
            <div class="space-y-4 animate-scaleIn">
              <div class="bg-red-500/30 border-2 border-red-500/70 rounded-xl p-4">
                <div class="flex items-start gap-3">
                  <svg class="w-8 h-8 text-red-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p class="font-bold text-red-400 text-2xl uppercase tracking-wide mb-3">
                      Are You Absolutely Sure?
                    </p>
                    <p class="text-white/90 text-base font-semibold mb-2">
                      This will permanently remove: <span class="font-mono">{lightningAddress}</span>
                    </p>
                    <p class="text-white/80 text-sm">
                      This action cannot be undone. You will not be able to receive payments at this address anymore, and someone else may claim it.
                    </p>
                  </div>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onclick={handleUnregister}
                  disabled={removing}
                  class="flex-1 px-6 py-3 rounded-2xl font-bold text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white;"
                >
                  <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                       style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);"></div>
                  {#if removing}
                    <span class="loading loading-spinner loading-sm relative z-10"></span>
                    <span class="relative z-10">Removing...</span>
                  {:else}
                    <svg class="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span class="relative z-10 uppercase">Yes, I'm Absolutely Sure</span>
                  {/if}
                </button>

                <button
                  type="button"
                  onclick={() => confirmRemove = false}
                  disabled={removing}
                  class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white;"
                >
                  <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                       style="background: linear-gradient(135deg, #4B5563 0%, #6B7280 100%);"></div>
                  <svg class="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span class="relative z-10">Go Back</span>
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {:else}
    <div class="glass rounded-xl p-6 border-2 border-white/10">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">
            Choose your username
          </label>

          <div class="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-center">
            <input
              type="text"
              bind:value={username}
              oninput={handleUsernameInput}
              placeholder="username"
              class="input flex-1 sm:rounded-r-none"
              disabled={registering}
              maxlength="20"
              autocomplete="off"
              onkeydown={(e) => e.key === 'Enter' && e.preventDefault()}
            />
            <div class="bg-black/30 border border-white/20 rounded-lg sm:rounded-l-none px-4 py-3 text-white/60 text-center sm:text-left text-sm sm:text-base">
              @breez.fun
            </div>
          </div>

          {#if username}
            <div class="mt-2 text-sm">
              {#if validateUsername(username)}
                <span class="text-red-400">{validateUsername(username)}</span>
              {:else}
                <span class="text-green-400">✓ Valid format</span>
              {/if}
            </div>
          {/if}
        </div>

        {#if error}
          <div class="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        {/if}

        <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm">
          <div class="font-semibold mb-2">How it works:</div>
          <ul class="space-y-1 text-white/80">
            <li>• Your browser generates a reusable BOLT12 offer</li>
            <li>• Anyone can pay you via username@breez.fun</li>
            <li>• Works with any Lightning wallet</li>
            <li>• Payments come directly to your DGEN wallet</li>
          </ul>
        </div>

        <div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm">
          <div class="font-semibold mb-2 text-amber-400">Important:</div>
          <ul class="space-y-1 text-white/70">
            <li>• If your username is taken, we'll automatically add a 4-digit code (e.g., cole → cole1234)</li>
            <li>• This address is permanently tied to <strong>this seed phrase</strong></li>
            <li>• Backup your seed phrase to keep access to this Lightning address</li>
          </ul>
        </div>

        <button
          type="button"
          onclick={handleRegister}
          disabled={registering || !username || checking || validateUsername(username) || available !== true}
          class="btn btn-primary w-full text-sm sm:text-base"
          class:opacity-50={registering || !username || checking || validateUsername(username) || available !== true}
        >
          {#if registering}
            <span class="loading loading-spinner loading-sm"></span>
            <span class="hidden sm:inline">Registering...</span>
            <span class="sm:hidden">Registering</span>
          {:else}
            <span class="hidden sm:inline">Register Lightning Address</span>
            <span class="sm:hidden">Register ⚡ Address</span>
          {/if}
        </button>
      </div>
    </div>

    <div class="mt-6 text-sm text-white/60">
      <p class="mb-2"><strong>Note:</strong> Your Lightning address will be hosted on breez.fun (Breez's free service).</p>
      <p>To receive payments, you need to be online or have been online within the last 30 seconds.</p>
    </div>
  {/if}

  {#if recovering}
    <div class="glass rounded-xl p-6 border-2 border-blue-500/30 bg-blue-500/10 mt-4">
      <div class="flex items-center gap-3">
        <span class="loading loading-spinner loading-md text-blue-400"></span>
        <div>
          <div class="font-semibold text-blue-400">Recovering Lightning Address...</div>
          <div class="text-sm text-white/60">Checking for existing registration</div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Update Username Modal -->
{#if showUpdateModal && currentUsername}
  <UpdateUsernameModal
    currentUsername={currentUsername}
    userId={user.id}
    onClose={() => showUpdateModal = false}
    onSuccess={handleUpdateSuccess}
  />
{/if}

<style>
  .lightning-card {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1));
    backdrop-filter: blur(16px);
    border: 2px solid rgba(59, 130, 246, 0.3);
    border-radius: 1.5rem;
    padding: 2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
  }

  .lightning-card:hover {
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 12px 48px rgba(59, 130, 246, 0.2);
  }

  /* Card Header */
  .card-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .lightning-icon {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    border-radius: 1rem;
    padding: 0.75rem;
    color: white;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 0 30px rgba(251, 191, 36, 0.5);
    }
  }

  .card-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: white;
  }

  .card-status {
    font-size: 0.875rem;
    color: #4ade80;
    display: none; /* Hide "Active & Ready" status */
    align-items: center;
    gap: 0.5rem;
  }

  .card-status::before {
    content: '';
    display: none; /* Hide status indicator */
    width: 8px;
    height: 8px;
    background: #4ade80;
    border-radius: 50%;
    animation: blink 2s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Address Container */
  .address-container {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    transition: all 0.2s;
    text-align: left;
  }

  .address-container:hover {
    background: rgba(0, 0, 0, 0.5);
    border-color: rgba(59, 130, 246, 0.5);
  }

  @media (max-width: 640px) {
    .address-container {
      padding: 0.75rem;
      gap: 0.5rem;
    }
  }

  .address-display {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    overflow: hidden;
  }

  .address-icon {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .address-text {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    font-family: 'Monaco', 'Courier New', monospace;
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
    line-height: 1.4;
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .address-text {
      font-size: 0.8rem;
    }
  }

  /* Copy Indicator */
  .copy-indicator {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
  }

  /* Info Box */
  .info-box {
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.3);
    border-radius: 0.75rem;
    padding: 1rem;
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  /* Wallet Info Box */
  .wallet-info-box {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 1.5rem;
  }

  @media (min-width: 640px) {
    .wallet-info-box {
      padding: 1rem;
    }
  }

  .wallet-pubkey-display {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    margin-top: 0.5rem;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  /* Warning Box */
  .warning-box {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 1.5rem;
  }

  @media (min-width: 640px) {
    .warning-box {
      padding: 1rem;
    }
  }

  .warning-box strong {
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
  }

  .info-text {
    flex: 1;
  }

  /* Divider */
  .divider {
    height: 1px;
    background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent);
    margin: 1.5rem 0;
  }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .action-buttons .btn {
    flex: 1;
    min-width: 140px;
  }

  @media (max-width: 640px) {
    .action-buttons {
      flex-direction: column;
    }
    .action-buttons .btn {
      width: 100%;
    }
  }

  /* Form Inputs */
  .input {
    @apply bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white;
    @apply focus:border-blue-400 focus:outline-none;
  }

  /* Buttons */
  .btn {
    @apply px-6 py-3 rounded-lg font-semibold transition-all;
    @apply flex items-center gap-2 justify-center;
  }

  .btn:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .btn-primary {
    @apply bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600;
  }

  .btn-secondary {
    @apply bg-white/10 hover:bg-white/20 border border-white/20 text-white;
  }

  .btn-danger {
    @apply bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400;
  }

  .glass {
    backdrop-filter: blur(12px);
  }
</style>
