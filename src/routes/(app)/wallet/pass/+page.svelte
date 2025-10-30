<!--
  PASSWORD ENCRYPTION PAGE - CURRENTLY NOT IN USE
  
  This page was originally designed to encrypt the wallet seed with a user-provided password
  before storing it. However, since we're now:
  1. Not storing anything on the server (everything is client-side)
  2. Using a fixed storage key based on user ID for local encryption
  
  This step has been bypassed in the registration flow.
  The flow now goes: seed → verify → profile (skipping this password step)
  
  Keeping this file for potential future use if we want to:
  - Add user-controlled password encryption
  - Implement server-side encrypted backup
  - Add an optional security layer
-->

<script lang="ts">
  import { preventDefault } from "svelte/legacy";
  import { tick, onMount } from "svelte";
  import { t } from "$lib/translations";
  import Spinner from "$comp/Spinner.svelte";
  import { focus, fail, success, post } from "$lib/utils";
  import { goto } from "$app/navigation";
  import { saveMnemonic, initWallet } from "$lib/walletService";
  import { mnemonic as mnemonicStore } from "$lib/store";
  
  let { data } = $props();
  let { user } = data;
  
  let submitting = $state(false);
  let mnemonic = $state("");
  
  let confirm = $state("");
  let password = $state("");
  let revealPassword = $state(false);
  let revealConfirm = $state(false);
  
  onMount(() => {
    // Get mnemonic from store or URL params
    if ($mnemonicStore) {
      mnemonic = $mnemonicStore;
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const seedParam = urlParams.get('seed');
      
      if (seedParam) {
        mnemonic = atob(seedParam);
      } else {
        // No seed, redirect to settings
        goto('/settings/security');
      }
    }
  });

  let submit = async () => {
    submitting = true;
    await tick();
    
    if (!password || password !== confirm) {
      fail($t("accounts.passwordMismatch"));
      submitting = false;
      return;
    }

    try {
      const userId = user.id || user.username;

      // Save mnemonic to secure storage with password encryption
      await saveMnemonic(mnemonic, password, userId);
      
      // Initialize wallet with mnemonic
      await initWallet(mnemonic, userId);
      
      // Initialize wallet store
      const { walletStore } = await import('$lib/stores/wallet');
      await walletStore.init(password, userId);
      
      // Send to server to create watch-only wallet (NO seed storage)
      // We only send public key info, not the seed
      const walletInfo = await import('$lib/walletService').then(m => m.getWalletInfo());
      
      if (walletInfo) {
        console.log('[Wallet Creation] WalletInfo:', walletInfo);
        
        // Create watch-only account on server
        // Breez SDK Liquid uses different fields
        // Using the backend proxy path
        const pubkey = walletInfo.pubkey || walletInfo.nodeState?.id || "breez_liquid_pubkey";
        const fingerprint = walletInfo.fingerprint || walletInfo.nodeState?.id || "breez_liquid_id";
        
        try {
          // The post() function already adds /api/backend prefix
          await post("/wallet/create", {
            pubkey,
            fingerprint,
            type: "liquid"
          });
          console.log('[Wallet Creation] Watch-only wallet created on server');
        } catch (serverError) {
          // Server wallet creation failed, but local wallet is set up
          console.warn('[Wallet Creation] Server wallet creation failed:', serverError);
          // Continue anyway - wallet works locally
        }
      }
      
      // No need to mark on server - everything is client-side
      // The wallet creation timestamp is already saved in localStorage
      
      success("Wallet created successfully!");
      
      // Clear mnemonic from memory
      mnemonic = "";
      
      // Navigate to user profile
      goto(`/${user.username}`);
    } catch (e) {
      console.error(e);
      fail(e.message);
    }

    submitting = false;
  };
</script>

<div class="space-y-5">
  <div>
    <h1 class="text-center text-3xl font-semibold">
      Secure Your Wallet
    </h1>
  </div>

  <form
    onsubmit={preventDefault(submit)}
    class="container w-full mx-auto text-lg px-4 max-w-xl space-y-5"
  >
    <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
      <div class="flex items-start gap-3">
        <iconify-icon
          icon="ph:warning-bold"
          class="text-yellow-400 mt-1"
          width="24"
        ></iconify-icon>
        <div class="text-yellow-400">
          <p class="font-semibold">Important!</p>
          <p class="mt-1 text-sm">
            This password encrypts your wallet locally. If you forget it, you'll need your seed phrase to recover your wallet.
          </p>
        </div>
      </div>
    </div>

    <label
      for="password"
      class="input flex items-center justify-center gap-2 w-full"
    >
      {#if revealPassword}
        <input
          name="password"
          type="text"
          required
          bind:value={password}
          autocapitalize="none"
          class="clean"
          placeholder="Enter password"
        />
      {:else}
        <input
          use:focus
          name="password"
          type="password"
          placeholder={$t("accounts.password")}
          required
          bind:value={password}
          autocapitalize="none"
          class="clean"
        />
      {/if}

      <iconify-icon noobserver
        class="cursor-pointer ml-auto"
        onclick={() => (revealPassword = !revealPassword)}
        icon={revealPassword ? "ph:eye-bold" : "ph:eye-slash-bold"}
        width="32"
      ></iconify-icon>
    </label>

    <label
      for="confirm"
      class="input flex items-center justify-center gap-2 w-full"
    >
      {#if revealConfirm}
        <input
          name="confirm"
          type="text"
          placeholder="Confirm password"
          required
          bind:value={confirm}
          autocapitalize="none"
          class="clean"
        />
      {:else}
        <input
          type="password"
          placeholder={$t("accounts.confirmPassword")}
          required
          bind:value={confirm}
          autocapitalize="none"
          class="clean"
        />
      {/if}
      <iconify-icon noobserver
        class="cursor-pointer ml-auto"
        onclick={() => (revealConfirm = !revealConfirm)}
        icon={revealConfirm ? "ph:eye-bold" : "ph:eye-slash-bold"}
        width="32"
      ></iconify-icon>
    </label>

    <div class="flex gap-2">
      <a href="/settings/security" class="contents">
        <button type="button" class="btn !w-auto grow">
          {$t("accounts.back")}
        </button>
      </a>
      <button
        disabled={submitting}
        type="submit"
        class="btn btn-accent !w-auto grow"
      >
        {#if submitting}
          <Spinner />
        {:else}
          Create Wallet
        {/if}
      </button>
    </div>
  </form>
</div>