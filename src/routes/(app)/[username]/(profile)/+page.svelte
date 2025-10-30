<script>
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { scale } from "svelte/transition";
  import { btc, f, sat } from "$lib/utils";
  import Account from "$comp/Account.svelte";
  import Balance from "$comp/Balance.svelte";
  import BuyBitcoin from "$comp/BuyBitcoin.svelte";
  import { t } from "$lib/translations";
  import { installPrompt, password } from "$lib/store";
  import { afterNavigate, preloadData } from "$app/navigation";
  import { page } from "$app/stores";
  import { walletInfo, walletBalance, transactions } from "$lib/stores/wallet";

  let { data } = $props();

  // Buy Bitcoin modal state
  let showBuyBitcoin = $state(false);

  afterNavigate(() => {
    if (user) preloadData(`/${user.username}/receive`);
    preloadData("/send");
  });
  
  // Refresh wallet data on mount to ensure latest balance
  onMount(async () => {
    if (browser && user) {
      try {
        // Import wallet service to check connection
        const walletService = await import('$lib/walletService');
        
        // Only refresh if SDK is connected
        if (walletService.isConnected()) {
          const { walletStore, transactions: txStore } = await import('$lib/stores/wallet');
          
          // Refresh wallet data
          await walletStore.refresh();
          await txStore.refresh();
        } else {
          // The layout will initialize the wallet and trigger updates
        }
      } catch (e) {
        console.error('[Profile] Failed to refresh wallet data:', e);
      }
    }
  });

  let { subject, rate, user } = $derived(data);
  let { locked } = $derived(user);
  
  // Track if user has acknowledged backup warning
  let backupAcknowledged = $state(false);
  
  // Check localStorage for backup acknowledgment
  onMount(() => {
    if (browser && user) {
      const key = `backup-acknowledged-${user.id || user.username}`;
      backupAcknowledged = localStorage.getItem(key) === 'true';
    }
  });
  
  function acknowledgeBackup() {
    if (user) {
      const key = `backup-acknowledged-${user.id || user.username}`;
      localStorage.setItem(key, 'true');
      backupAcknowledged = true;
    }
  }
  
  // Get wallet data from browser SDK
  let browserWalletInfo = $derived($walletInfo);
  // Following misty-breez: balance comes directly from SDK, let Balance component handle loading state
  let balance = $derived($walletBalance);
  let walletTransactions = $derived($transactions);

  // Create accounts from browser SDK data
  let accounts = $derived([
    {
      id: `lightning-${user?.id || 'browser'}`,
      name: "Lightning Wallet",
      asset: "lightning",
      balance: balance, // Can be 0 during loading, Balance component checks walletInfo === null
      browserManaged: true
    }
  ]);
  
  // Wallet status flags - all removed, browser manages everything

  let install = async () => {
    if (!$installPrompt) return;
    await $installPrompt.prompt();
    $installPrompt = null;
  };

  // iOS and Android detection
  let isIOS = $state(false);
  let isAndroid = $state(false);
  let isStandalone = $state(false);
  let showIOSInstructions = $state(false);
  let showAndroidInstructions = $state(false);

  onMount(() => {
    if (browser) {
      // @ts-ignore - MSStream is IE-specific
      isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      isAndroid = /Android/.test(navigator.userAgent);
      // @ts-ignore - standalone is iOS-specific
      isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                     window.navigator.standalone === true;
    }
  });

  let showIOSInstallGuide = () => {
    showIOSInstructions = true;
  };

  let showAndroidInstallGuide = () => {
    showAndroidInstructions = true;
  };

  let pubkey = $state();
  $effect(() => {
    if (user) user.savings = 0;
  });
  let { host } = $derived($page.url);
</script>

<div class="relative min-h-screen">
  <!-- Content Container -->
  <div class="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-40 sm:pb-44 relative z-10">
    <div class="max-w-4xl mx-auto space-y-6">
      {#if user?.id && user.id === subject.id}
        <!-- Install App Button - Top Position (Android or iOS) -->
        {#if $installPrompt || (isIOS && !isStandalone) || (isAndroid && !isStandalone)}
          <button
            class="lg:hidden w-full px-6 py-3 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 animate-pulse-soft"
            style="background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%); color: white;"
            onclick={$installPrompt ? install : (isIOS ? showIOSInstallGuide : showAndroidInstallGuide)}
          >
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                 style="background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%);"></div>
            <iconify-icon
              noobserver
              icon="ph:floppy-disk-bold"
              width="28"
              class="relative z-10 group-hover:rotate-12 transition-transform duration-300"
            ></iconify-icon>
            <span class="relative z-10 font-bold">{$t("user.install")}</span>
          </button>
        {/if}

        <!-- Disclaimer -->
        <div class="mb-6 space-y-3">
          <div class="glass p-3 sm:p-4 rounded-2xl border-2 border-yellow-500/50 bg-yellow-500/10 max-w-2xl mx-auto">
            <div class="text-center">
              <p class="text-yellow-400 font-bold text-xs sm:text-sm">⚠️ This website/app is in Beta and not finalized. Use at your own risk.</p>
            </div>
          </div>
        </div>
      {/if}

      {#if user && subject?.username === user?.username && browserWalletInfo && !backupAcknowledged}
        <div
          class="glass p-3 sm:p-4 rounded-2xl border border-red-500/30 bg-red-500/5 animate-scaleIn"
        >
          <div class="flex items-start gap-3">
            <iconify-icon
              icon="ph:warning-bold"
              class="text-red-400 flex-shrink-0 mt-1"
              width="20"
            ></iconify-icon>
            <div class="flex-1">
              <div class="text-sm font-semibold text-red-400 mb-1">
                Important: Backup Your Recovery Phrase
              </div>
              <div class="text-xs text-white/60 mb-2 space-y-1">
                <p><span class="text-red-300 font-medium">Think of your recovery phrase as the password to your money.</span></p>
                <ul class="list-disc list-inside space-y-0.5 ml-2">
                  <li><span class="text-red-300 font-medium">Write it down</span> and keep it safe - if you lose it, your funds are gone forever</li>
                  <li><span class="text-green-300 font-medium">To use this same wallet on another device:</span>
                    <ul class="list-disc list-inside ml-4 mt-0.5">
                      <li>Go to Settings → Security → Import your recovery phrase</li>
                    </ul>
                  </li>
                  <li>Without importing, opening DGEN on a new device creates a completely separate wallet</li>
                  <li>We never store your recovery phrase - only you have it</li>
                </ul>
              </div>
              <div class="flex flex-wrap gap-2">
                <a href="/settings/security?autoReveal=true" class="inline-block">
                  <button
                    class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-all"
                  >
                    View Recovery Phrase
                  </button>
                </a>
                <button
                  onclick={acknowledgeBackup}
                  class="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white/60 transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Syncing Indicator -->
      <!-- TODO: Re-enable syncing indicator later -->
      <!-- {#if user && subject?.username === user?.username && isSyncing}
        <div
          class="glass p-3 sm:p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 animate-scaleIn"
        >
          <div class="flex items-start gap-3">
            <div class="loading loading-spinner loading-sm text-blue-400"></div>
            <div class="flex-1">
              <div class="text-sm font-semibold text-blue-400 mb-1">
                Syncing Wallet
              </div>
              <div class="text-xs text-white/60">
                Fetching your transaction history and updating balance...
              </div>
            </div>
          </div>
        </div>
      {/if} -->

      {#if user?.destination && !user?.autowithdraw}
        <div
          class="premium-card backdrop-blur-xl bg-yellow-500/10 border-2 border-yellow-500/50 hover:border-yellow-500 transition-all duration-500 animate-scaleIn hover:shadow-2xl hover:shadow-yellow-500/30"
        >
          <div class="flex items-start gap-4">
            <div class="p-3 rounded-2xl bg-yellow-500/20">
              <iconify-icon
                icon="ph:warning-circle"
                class="text-yellow-400"
                width="32"
              ></iconify-icon>
            </div>
            <div class="flex-1">
              <h1 class="text-xl sm:text-2xl font-bold text-yellow-400 mb-2">
                {$t("user.settings.confirmAutoWithdrawal")}
              </h1>
              <div class="text-sm sm:text-base text-white/70 mb-4">
                {$t("user.settings.confirmAutoWithdrawalDesc")}
              </div>
              <a href="/settings/account" class="inline-block">
                <button
                  class="px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center gap-2"
                  style="background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%); color: white;"
                >
                  <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                       style="background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%);"></div>
                  <iconify-icon
                    icon="ph:gear-bold"
                    width="24"
                    class="relative z-10 group-hover:rotate-90 transition-transform duration-300"
                  ></iconify-icon>
                  <span class="relative z-10 font-semibold">Configure Settings</span>
                </button>
              </a>
            </div>
          </div>
        </div>
      {/if}
      {#if user?.fresh}
        <div
          class="premium-card backdrop-blur-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/50 hover:border-green-500 transition-all duration-500 animate-scaleIn hover:shadow-2xl hover:shadow-green-500/30"
          style="animation-delay: 0.1s;"
        >
          <div class="flex items-start gap-4">
            <div
              class="p-3 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-500/30"
            >
              <iconify-icon icon="ph:sparkle" class="text-white" width="32"
              ></iconify-icon>
            </div>
            <div class="flex-1">
              <h2 class="text-xl sm:text-2xl font-bold gradient-text mb-3">
                Welcome to DGEN!
              </h2>
              <div class="space-y-2 mb-4">
                <div class="flex items-center gap-2">
                  <span class="text-white/60">Username:</span>
                  <span class="text-green-400 text-xl font-bold"
                    >{user?.username}</span
                  >
                </div>
                {#if $password}
                  <div class="flex items-center gap-2">
                    <span class="text-white/60">Password:</span>
                    <span
                      class="text-yellow-400 text-xl font-mono bg-black/30 px-3 py-1 rounded-lg"
                      >{$password}</span
                    >
                  </div>
                {/if}
              </div>
              <a href="/settings/profile" class="inline-block">
                <button
                  class="px-6 py-3 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center gap-2"
                  style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white;"
                >
                  <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                       style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);"></div>
                  <iconify-icon
                    icon="ph:rocket-launch"
                    width="24"
                    class="relative z-10 group-hover:rotate-12 transition-transform duration-300"
                  ></iconify-icon>
                  <span class="relative z-10 font-bold"
                    >{$t("user.settings.continueSettingUp")}</span
                  >
                </button>
              </a>
            </div>
          </div>
        </div>
      {/if}
      {#if user?.id && user.id === subject.id}
        <div class="space-y-6" data-sveltekit-preload-data="false">
          {#each accounts as account, i}
            <div
              class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-dgen-aqua/40 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-dgen-aqua/20 animate-scaleIn"
              style="animation-delay: {0.15 * i}s;"
            >
              <Account
                {user}
                {rate}
                {account}
                last={i === accounts.length - 1}
                bind:showBuyBitcoin
              />
            </div>
          {/each}
        </div>


        {#if locked}
          <div
            class="glass p-4 rounded-2xl border-2 border-red-500/50 bg-red-500/10 text-red-400 animate-pulse"
          >
            <iconify-icon
              icon="ph:warning-circle"
              width="24"
              class="inline mr-2"
            ></iconify-icon>
            {$t("incident")}
          </div>
        {/if}
      {/if}
    </div>
  </div>

  <!-- <a href="/funder" class="btn">Funder</a> -->

  <!-- Pay Button - Commented Out -->
  <!-- <div
    class="fixed inset-x-0 mx-auto flex px-3 sm:px-4 z-50"
    style="bottom: calc(var(--safe-area-inset-bottom) + 120px);"
  >
    {#if user?.username !== subject.username && (!subject.anon || subject.lud16)}
      <a
        href={subject.anon
          ? `/send/${encodeURIComponent(subject.lud16)}`
          : `/pay/${subject.username}`}
        class="contents"
      >
        <button
          class="w-full sm:max-w-[400px] mx-auto px-6 py-4 rounded-2xl text-xl sm:text-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-2xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-3"
          style="background: linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%); color: white; box-shadow: 0 10px 30px rgba(251, 191, 36, 0.3);"
        >
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
               style="background: linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%);"></div>
          <iconify-icon
            noobserver
            icon="ph:lightning-fill"
            class="relative z-10 text-yellow-100 animate-pulse"
            width="32"
          ></iconify-icon>
          <div class="relative z-10 font-bold">
            {$t("user.pay")}
            <span class="text-yellow-100">{subject.username}</span>
          </div>
        </button>
      </a>
    {/if}
  </div> -->
</div>

<!-- Buy Bitcoin Modal - Rendered at page level -->
<BuyBitcoin bind:show={showBuyBitcoin} />

<!-- iOS Install Instructions Modal -->
{#if showIOSInstructions}
  <div
    class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onclick={() => (showIOSInstructions = false)}
  >
    <div
      class="glass p-6 rounded-3xl border-2 border-blue-500/50 bg-gradient-to-br from-blue-500/20 to-purple-500/20 max-w-md w-full animate-scaleIn"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <iconify-icon icon="ph:info-bold" width="24" class="text-blue-400"></iconify-icon>
          Install App
        </h3>
        <button
          onclick={() => (showIOSInstructions = false)}
          class="p-2 hover:bg-white/10 rounded-lg transition-all"
        >
          <iconify-icon icon="ph:x-bold" width="24" class="text-white/60"></iconify-icon>
        </button>
      </div>

      <div class="space-y-4 text-white/80">
        <p class="text-sm">To install this app on your iPhone/iPad:</p>

        <ol class="space-y-3 text-sm">
          <li class="flex items-start gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <p class="font-medium text-white">Tap the Share button</p>
              <p class="text-xs text-white/60">Look for <iconify-icon icon="ph:share" class="inline" width="16"></iconify-icon> in Safari's toolbar (bottom of screen)</p>
            </div>
          </li>

          <li class="flex items-start gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <p class="font-medium text-white">Scroll and tap "Add to Home Screen"</p>
              <p class="text-xs text-white/60">Look for <iconify-icon icon="ph:plus-square" class="inline" width="16"></iconify-icon> Add to Home Screen</p>
            </div>
          </li>

          <li class="flex items-start gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <p class="font-medium text-white">Tap "Add"</p>
              <p class="text-xs text-white/60">The app will appear on your home screen</p>
            </div>
          </li>
        </ol>

        <button
          onclick={() => (showIOSInstructions = false)}
          class="w-full mt-4 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105"
          style="background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%); color: white;"
        >
          Got it!
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Android Install Instructions Modal -->
{#if showAndroidInstructions}
  <div
    class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onclick={() => (showAndroidInstructions = false)}
  >
    <div
      class="glass p-6 rounded-3xl border-2 border-blue-500/50 bg-gradient-to-br from-blue-500/20 to-purple-500/20 max-w-md w-full animate-scaleIn"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <iconify-icon icon="ph:info-bold" width="24" class="text-blue-400"></iconify-icon>
          Install App
        </h3>
        <button
          onclick={() => (showAndroidInstructions = false)}
          class="p-2 hover:bg-white/10 rounded-lg transition-all"
        >
          <iconify-icon icon="ph:x-bold" width="24" class="text-white/60"></iconify-icon>
        </button>
      </div>

      <div class="space-y-4 text-white/80">
        <p class="text-sm">To install this app on your Android device:</p>

        <ol class="space-y-3 text-sm">
          <li class="flex items-start gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <p class="font-medium text-white">Tap the Menu button</p>
              <p class="text-xs text-white/60">Look for <iconify-icon icon="ph:dots-three-vertical" class="inline" width="16"></iconify-icon> in Chrome's toolbar (top-right corner)</p>
            </div>
          </li>

          <li class="flex items-start gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <p class="font-medium text-white">Tap "Add to Home screen" or "Install app"</p>
              <p class="text-xs text-white/60">This option appears in the menu list</p>
            </div>
          </li>

          <li class="flex items-start gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <p class="font-medium text-white">Tap "Install" or "Add"</p>
              <p class="text-xs text-white/60">The app will appear on your home screen</p>
            </div>
          </li>
        </ol>

        <button
          onclick={() => (showAndroidInstructions = false)}
          class="w-full mt-4 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105"
          style="background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%); color: white;"
        >
          Got it!
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes pulse-soft {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.9;
      transform: scale(1.02);
    }
  }

  :global(.animate-pulse-soft) {
    animation: pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style>
