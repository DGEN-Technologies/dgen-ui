<script>
  import { goto } from "$app/navigation";
  import { post, success, fail, info } from "$lib/utils";
  import { t } from "$lib/translations";
  import Spinner from "$comp/Spinner.svelte";

  let { data } = $props();
  let { user } = data;

  let mnemonicInput = $state("");
  let isRestoring = $state(false);
  let showMnemonic = $state(true);
  let isSyncing = $state(false);
  let syncMessage = $state("");
  let syncProgress = $state(0);

  async function restoreWallet() {
    const mnemonic = mnemonicInput.trim();
    const words = mnemonic.split(/\s+/);

    if (words.length !== 12 && words.length !== 24) {
      fail("Seed phrase must be 12 or 24 words");
      return;
    }

    isRestoring = true;
    try {
      // Import wallet service
      const walletService = await import('$lib/walletService');
      
      // Validate mnemonic
      if (!walletService.validateMnemonic(mnemonic)) {
        throw new Error("Invalid seed phrase. Please check your words.");
      }

      const userId = user.id || user.username;

      // Get password from session token
      const { getWalletPassword } = walletService;
      const userPassword = getWalletPassword(userId);

      if (!userPassword) {
        fail("Session expired. Please log in again.");
        return;
      }

      // Save the mnemonic to secure storage with password
      await walletService.saveMnemonic(mnemonic, userPassword, userId);
      
      // Check if wallet is already connected (from layout initialization)
      if (!walletService.isConnected()) {
        // Initialize wallet with the restored mnemonic
        success("Connecting to wallet...");
        await walletService.initWallet(mnemonic, userId);
      } else {
        success("Wallet already connected, refreshing...");
      }
      
      // Initialize wallet store
      const { walletStore, transactions } = await import('$lib/stores/wallet');
      await walletStore.init(userPassword, userId);
      
      // Show sync progress
      isSyncing = true;
      syncMessage = "Syncing with network...";
      syncProgress = 20;
      
      // Wait for SDK to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set up a one-time event listener for the synced event
      let syncedPromise = new Promise((resolve) => {
        const checkSync = async () => {
          // Set timeout as fallback in case sync event doesn't fire
          const timeout = setTimeout(() => {
            console.log("Sync timeout reached, proceeding anyway");
            resolve(true);
          }, 10000); // 10 second timeout
          
          // Add event listener for synced event
          const listenerId = await walletService.addEventListener((event) => {
            console.log("Restore page received event:", event);
            if (event.type === 'synced') {
              clearTimeout(timeout);
              walletService.removeEventListener(listenerId);
              resolve(true);
            }
          });
        };
        checkSync();
      });
      
      // Perform initial sync
      syncMessage = "Fetching wallet data...";
      syncProgress = 40;
      
      try {
        // Don't manually sync - let the SDK handle it automatically
        // This avoids rate limiting issues with the blockchain API
        syncProgress = 60;
        
        // Wait for synced event or timeout
        syncMessage = "Waiting for network sync...";
        await syncedPromise;
        
        syncProgress = 70;
        
        // After sync, refresh wallet info
        syncMessage = "Loading balance...";
        await walletStore.refresh();
        const info = await walletService.getWalletInfo();
        
        syncProgress = 80;
        
        // Load transactions
        syncMessage = "Loading transaction history...";
        await transactions.refresh();
        const txns = await walletService.getTransactions();
        
        syncProgress = 90;
        
        // Force one more refresh to ensure latest data
        await walletStore.refresh();
        
        syncProgress = 100;
        
        // Get final balance from store
        const finalInfo = await walletService.getWalletInfo();
        const balance = finalInfo?.walletInfo?.balanceSat || 0;
        
        // Display success with balance
        success(`Wallet restored! Balance: ${balance.toLocaleString()} sats`);
        
      } catch (syncError) {
        console.warn("Initial sync failed, wallet will sync in background:", syncError);
        // Even if sync fails, refresh the stores
        await walletStore.refresh();
        await transactions.refresh();
        success("Wallet restored! Syncing in background...");
      }
      
      isSyncing = false;
      isRestoring = false;
      
      // Force a final refresh before navigation
      await walletStore.refresh();
      
      // Small delay for UI update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Trigger a page reload to ensure the layout picks up the new wallet
      // This ensures the balance is properly displayed
      window.location.href = `/${user.username}`;
      
    } catch (e) {
      console.error("Restore error:", e);
      fail(e.message || "Failed to restore wallet. Please check your seed phrase.");
      isRestoring = false;
      isSyncing = false;
    }
  }
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
  <div class="space-y-8">
    <div class="text-center">
      <h1 class="text-4xl font-bold gradient-text mb-4">Restore Your Wallet</h1>
      <p class="text-lg text-white/70">
        Enter your 12 or 24 word seed phrase to restore your wallet
      </p>
    </div>

    <div
      class="premium-card backdrop-blur-xl bg-white/5 border-2 border-blue-500/40"
    >
      <div class="space-y-6">
        <div class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div class="flex items-start gap-3">
            <iconify-icon
              icon="ph:info-bold"
              class="text-blue-400 mt-1"
              width="24"
            ></iconify-icon>
            <div class="text-blue-400">
              <p>Enter your seed phrase exactly as it was given to you.</p>
              <p class="mt-2">Words should be separated by spaces.</p>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-white/80">Seed Phrase</label>
          <div class="relative">
            <textarea
              bind:value={mnemonicInput}
              placeholder="Enter your 12 or 24 word seed phrase..."
              class="w-full min-h-[120px] p-4 bg-black/30 border border-white/10 rounded-xl text-white placeholder-white/30 font-mono"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              disabled={isRestoring || isSyncing}
            ></textarea>
            <button
              class="absolute top-2 right-2 btn glass text-sm py-1 px-2"
              onclick={() => (showMnemonic = !showMnemonic)}
              disabled={isRestoring || isSyncing}
            >
              <iconify-icon
                icon={showMnemonic ? "ph:eye-slash-bold" : "ph:eye-bold"}
                width="20"
              ></iconify-icon>
            </button>
          </div>
          {#if !showMnemonic && mnemonicInput}
            <div
              class="absolute inset-0 bg-black/80 rounded-xl flex items-center justify-center"
            >
              <p class="text-white/60">Hidden for security</p>
            </div>
          {/if}
        </div>

        <div
          class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4"
        >
          <div class="flex items-start gap-3">
            <iconify-icon
              icon="ph:warning-bold"
              class="text-yellow-400 mt-1"
              width="24"
            ></iconify-icon>
            <div class="text-yellow-400">
              <p class="font-semibold">Security Warning</p>
              <p class="mt-1 text-sm">
                Make sure you're on the correct website and not a phishing site.
                Never enter your seed phrase on an untrusted device or website.
              </p>
            </div>
          </div>
        </div>

        <div class="flex gap-4">
          <a href="/" class="btn glass hover:bg-white/10 flex-1">
            <iconify-icon icon="ph:arrow-left-bold" width="24"></iconify-icon>
            <span class="ml-2">Cancel</span>
          </a>

          <button
            class="btn-gradient flex-1 hover:shadow-lg hover:shadow-blue-500/30"
            onclick={restoreWallet}
            disabled={!mnemonicInput.trim() || isRestoring || isSyncing}
          >
            {#if isRestoring || isSyncing}
              <Spinner />
              <span class="ml-2">
                {isSyncing ? "Syncing..." : "Restoring..."}
              </span>
            {:else}
              <iconify-icon icon="ph:arrow-clockwise-bold" width="24"
              ></iconify-icon>
              <span class="ml-2">Restore Wallet</span>
            {/if}
          </button>
        </div>
        
        {#if isSyncing}
          <div class="mt-6 space-y-3">
            <div class="text-center text-blue-400">
              <p class="text-sm font-medium">{syncMessage}</p>
            </div>
            <div class="w-full bg-black/30 rounded-full h-2 overflow-hidden">
              <div 
                class="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                style="width: {syncProgress}%"
              ></div>
            </div>
            <div class="text-center text-white/50 text-xs">
              This may take a few moments while we sync your wallet data...
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .gradient-text {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .btn-gradient {
    background: linear-gradient(135deg, #74EBD5, #9688DD);
    color: black;
    border: none;
    border-radius: 1rem;
    padding: 0.75rem 1.5rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
  }

  .btn-gradient:hover {
    transform: translateY(-2px);
  }

  .btn-gradient:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>