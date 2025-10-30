<script>
  import { goto } from "$app/navigation";
  import { fail, info } from "$lib/utils";
  import { t } from "$lib/translations";
  import Spinner from "$comp/Spinner.svelte";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { mnemonic as mnemonicStore } from "$lib/store";

  let { data } = $props();
  let { user } = data;

  let mnemonic = $state("");
  let verificationWords = $state([]);
  let userInputs = $state({});
  let isVerifying = $state(false);
  let showError = $state(false);
  let showPasswordPrompt = $state(false);

  onMount(() => {
    // Get mnemonic from store or URL params
    if ($mnemonicStore) {
      mnemonic = $mnemonicStore;
      setupVerification();
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const seedParam = urlParams.get('seed');
      
      if (seedParam) {
        mnemonic = atob(seedParam);
        setupVerification();
      } else {
        // If no seed, redirect to settings
        goto('/settings/security');
      }
    }
  });

  function setupVerification() {
    if (!mnemonic) return;
    
    const words = mnemonic.split(' ');
    // Pick 3-6 random words to verify
    const numWords = Math.min(6, Math.max(3, Math.floor(words.length / 4)));
    const indices = [];
    
    while (indices.length < numWords) {
      const idx = Math.floor(Math.random() * words.length);
      if (!indices.includes(idx)) {
        indices.push(idx);
      }
    }
    
    // Sort indices for better UX
    indices.sort((a, b) => a - b);
    
    verificationWords = indices.map(idx => ({
      index: idx,
      word: words[idx],
      position: idx + 1
    }));
    
    // Initialize user inputs
    verificationWords.forEach(w => {
      userInputs[w.index] = '';
    });
  }

  async function verifyAndContinue() {
    isVerifying = true;
    showError = false;
    
    // Check if all words match
    let allCorrect = true;
    let incorrectCount = 0;
    for (const wordData of verificationWords) {
      const userWord = userInputs[wordData.index]?.trim().toLowerCase();
      if (userWord !== wordData.word.toLowerCase()) {
        allCorrect = false;
        incorrectCount++;
      }
    }
    
    if (!allCorrect) {
      showError = true;
      if (incorrectCount === verificationWords.length) {
        fail("None of the words match. Please check your seed phrase carefully.");
      } else if (incorrectCount > 1) {
        fail(`${incorrectCount} words don't match. Please check and try again.`);
      } else {
        fail("One word doesn't match. Please check and try again.");
      }
      isVerifying = false;
      return;
    }
    
    // Verification successful - complete wallet setup (no password prompt needed)
    await completeWalletSetup();
  }

  async function completeWalletSetup() {
    isVerifying = true;
    showPasswordPrompt = false;

    try {
      const { success } = await import('$lib/utils');
      const walletService = await import('$lib/walletService');

      const userId = user.id || user.username;

      // Get password from session token (no user input needed)
      const walletPassword = walletService.getWalletPassword(userId);

      if (!walletPassword) {
        const { fail } = await import('$lib/utils');
        fail("Session expired. Please log in again.");
        isVerifying = false;
        return;
      }

      // Initialize wallet with mnemonic FIRST (wasm-example pattern)
      await walletService.initWallet(mnemonic, userId);

      // Save mnemonic to secure storage with password encryption
      await walletService.saveMnemonic(mnemonic, walletPassword, userId);

      // Initialize wallet store with password
      const { walletStore } = await import('$lib/stores/wallet');
      await walletStore.init(walletPassword, userId);
      
      // Get wallet info for server registration (optional)
      const walletInfo = await walletService.getWalletInfo();
      
      if (walletInfo) {
        // Try to create watch-only account on server (optional)
        try {
          const { post } = await import('$lib/utils');
          const pubkey = walletInfo.pubkey || walletInfo.nodeState?.id || "breez_liquid_pubkey";
          const fingerprint = walletInfo.fingerprint || walletInfo.nodeState?.id || "breez_liquid_id";
          
          await post("/wallet/create", {
            pubkey,
            fingerprint,
            type: "liquid"
          });
        } catch (serverError) {
          // Server wallet creation failed, but local wallet is set up
          console.warn('[Wallet Creation] Server wallet creation failed:', serverError);
        }
      }
      
      success("Wallet created successfully!");

      // Clear mnemonic from memory
      mnemonic = "";
      $mnemonicStore = "";
      
      // Trigger wallet store refresh to update balance immediately
      const { transactions } = await import('$lib/stores/wallet');
      await walletStore.refresh();
      await transactions.refresh();
      
      // Use a full page navigation to ensure layout re-initializes properly
      // This ensures the wallet SDK is properly connected on the new page
      setTimeout(() => {
        window.location.href = `/${user.username}`;
      }, 500);
      
    } catch (e) {
      console.error(e);
      // Clear any saved mnemonic on failure (wasm-example pattern)
      try {
        const walletService = await import('$lib/walletService');
        const userId = user?.id || user?.username;
        const password = walletService.getWalletPassword(userId);
        if (password) {
          await walletService.clearMnemonic(password, userId);
        }
      } catch (clearError) {
        console.error("Failed to clear mnemonic:", clearError);
      }
      fail(e.message || "Failed to create wallet. Please try again.");
      isVerifying = false;
    }
  }
  
  function isWordCorrect(index) {
    if (!showError) return true;
    const userWord = userInputs[index]?.trim().toLowerCase();
    const correctWord = verificationWords.find(w => w.index === index)?.word.toLowerCase();
    return userWord === correctWord;
  }
</script>

<div class="space-y-5">
  <h1 class="text-center text-3xl font-semibold">
    Verify Your Seed Phrase
  </h1>

  <div class="container w-full mx-auto text-lg px-4 max-w-xl space-y-4">
    <div class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
      <div class="flex items-start gap-3">
        <iconify-icon
          icon="ph:shield-check-bold"
          class="text-blue-400 mt-1"
          width="24"
        ></iconify-icon>
        <div class="text-blue-400">
          <p>To ensure you've written down your seed phrase correctly, please enter the following words:</p>
        </div>
      </div>
    </div>

    <div class="space-y-3">
      {#each verificationWords as wordData}
        <div class="flex items-center gap-3">
          <span class="text-neutral min-w-[40px]">#{wordData.position}:</span>
          <input
            type="text"
            bind:value={userInputs[wordData.index]}
            placeholder={`Enter word #${wordData.position}`}
            class="input flex-1 lowercase {showError && !isWordCorrect(wordData.index) ? 'border-red-500' : ''}"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            disabled={isVerifying}
          />
          {#if showError}
            {#if isWordCorrect(wordData.index)}
              <iconify-icon 
                icon="ph:check-circle-fill" 
                class="text-green-500"
                width="24"
              ></iconify-icon>
            {:else}
              <iconify-icon 
                icon="ph:x-circle-fill" 
                class="text-red-500"
                width="24"
              ></iconify-icon>
            {/if}
          {/if}
        </div>
      {/each}
    </div>

    {#if showError}
      <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <div class="flex items-start gap-3">
          <iconify-icon
            icon="ph:warning-bold"
            class="text-red-400 mt-1"
            width="24"
          ></iconify-icon>
          <div class="text-red-400">
            <p>Some words don't match. Please check your seed phrase and try again.</p>
          </div>
        </div>
      </div>
    {/if}

    <div class="flex gap-2">
      <a href="/settings/security" class="contents">
        <button type="button" class="btn !w-auto grow">
          {$t("accounts.back")}
        </button>
      </a>
      <button
        type="button"
        class="btn btn-accent !w-auto grow"
        onclick={verifyAndContinue}
        disabled={isVerifying || Object.values(userInputs).some(v => !v?.trim())}
      >
        {#if isVerifying}
          <Spinner />
        {:else}
          Verify & Continue
        {/if}
      </button>
    </div>
  </div>
</div>

<!-- Password prompt removed - using token-derived password for seamless UX -->