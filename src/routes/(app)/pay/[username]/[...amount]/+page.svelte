<!-- Pay User Page - Disabled - Redirect to User Profile -->
<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { t } from "$lib/translations";
  import { copy, s } from "$lib/utils";
  import { walletBalance } from "$lib/stores/wallet";
  import Qr from "$comp/Qr.svelte";

  let { data, form } = $props();

  let { subject } = $state(data);

  // Use the actual Lightning Address from the user's profile
  let lightningAddress = $derived(subject?.lightningAddress);
  let hasLightningAddress = $derived(!!lightningAddress && lightningAddress.length > 0);

  // Redirect to user profile since /pay feature is disabled
  onMount(() => {
    if (subject?.username) {
      goto(`/${subject.username}`);
    }
  });
</script>

<div class="min-h-screen relative overflow-hidden bg-gradient-dark flex items-center justify-center">
  <!-- Animated background mesh with aurora effect -->
  <div class="absolute inset-0">
    <div class="absolute inset-0 aurora-bg opacity-5"></div>
    <div
      class="absolute top-0 -left-4 w-96 h-96 bg-yellow-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
    ></div>
    <div
      class="absolute top-0 -right-4 w-96 h-96 bg-dgen-cyan rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 2s;"
    ></div>
    <div
      class="absolute -bottom-8 left-20 w-96 h-96 bg-green-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 4s;"
    ></div>
  </div>

  <!-- Cyber Grid overlay -->
  <div class="absolute inset-0 cyber-grid opacity-20"></div>

  <!-- Content Container -->
  <div class="container px-4 py-20 max-w-xl mx-auto relative z-10">
    <!-- Feature Disabled Message -->
    <div
      class="premium-card backdrop-blur-xl bg-white/5 border-2 border-yellow-500/50 transition-all duration-500 space-y-5 animate-scaleIn"
    >
      <div class="text-center py-12 space-y-6">
        <div class="flex justify-center">
          <div class="w-20 h-20 rounded-full bg-yellow-400/10 border-2 border-yellow-400/30 flex items-center justify-center">
            <iconify-icon icon="ph:warning-bold" class="text-yellow-400" width="40"></iconify-icon>
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="text-2xl font-bold text-white">Feature Temporarily Disabled</h3>
          <p class="text-white/60 max-w-md mx-auto">
            Paying users directly via their profile page is currently disabled.
          </p>
        </div>

        <a href="/" class="inline-block">
          <button
            class="px-6 py-3 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center gap-2"
            style="background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%); color: white;"
          >
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                 style="background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%);"></div>
            <iconify-icon
              icon="ph:house-bold"
              width="24"
              class="relative z-10"
            ></iconify-icon>
            <span class="relative z-10 font-bold">Go Home</span>
          </button>
        </a>
      </div>
    </div>
  </div>
</div>

<!-- ORIGINAL CODE - COMMENTED OUT -->
<!--
<div class="min-h-screen relative overflow-hidden bg-gradient-dark">
  <div class="absolute inset-0">
    <div class="absolute inset-0 aurora-bg opacity-5"></div>
    <div
      class="absolute top-0 -left-4 w-96 h-96 bg-yellow-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
    ></div>
    <div
      class="absolute top-0 -right-4 w-96 h-96 bg-dgen-cyan rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 2s;"
    ></div>
    <div
      class="absolute -bottom-8 left-20 w-96 h-96 bg-green-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 4s;"
    ></div>
  </div>

  <div class="absolute inset-0 cyber-grid opacity-20"></div>

  <div class="container px-4 pt-20 pb-10 max-w-xl mx-auto relative z-10">
    {#if form?.message}
      <div
        class="glass p-4 rounded-2xl border-2 border-red-500/50 bg-red-500/10 text-red-400 mb-4 animate-pulse"
      >
        <iconify-icon icon="ph:warning-circle" width="24" class="inline mr-2"
        ></iconify-icon>
        {form.message}
      </div>
    {/if}

    <div class="text-center mb-6 animate-fadeInUp">
      <h1 class="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-2">
        <iconify-icon icon="ph:arrow-up-bold" class="text-dgen-cyan" width="28"></iconify-icon>
        <span class="gradient-text">Send Payment</span>
      </h1>

      <div class="glass rounded-2xl p-4 border border-white/10 bg-white/5 mb-4">
        <p class="text-xs text-white/50 mb-2">Sending to</p>
        <div class="flex items-center justify-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold">
            {subject?.username?.charAt(0).toUpperCase() || "U"}
          </div>
          <div class="text-left">
            <p class="text-xl font-bold text-white">@{subject?.username || "user"}</p>
            {#if $walletBalance > 0}
              <p class="text-xs text-white/60">Your balance: {s($walletBalance)}</p>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div
      class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-dgen-aqua/40 transition-all duration-500 space-y-5 animate-scaleIn"
    >
      {#if !hasLightningAddress}
        <div class="text-center py-12 space-y-6">
          <div class="flex justify-center">
            <div class="w-20 h-20 rounded-full bg-yellow-400/10 border-2 border-yellow-400/30 flex items-center justify-center">
              <iconify-icon icon="ph:warning-bold" class="text-yellow-400" width="40"></iconify-icon>
            </div>
          </div>

          <div class="space-y-2">
            <h3 class="text-xl font-bold text-white">Lightning Address Not Set Up</h3>
            <p class="text-white/60 max-w-md mx-auto">
              @{subject?.username || "user"} hasn't set up their Lightning Address yet.
            </p>
          </div>

          <div class="glass rounded-xl p-4 border border-blue-500/20 bg-blue-500/5 max-w-md mx-auto">
            <div class="flex gap-3 text-left">
              <iconify-icon icon="ph:info-bold" width="20" class="text-blue-400 mt-0.5 flex-shrink-0"></iconify-icon>
              <div class="text-sm text-white/70">
                <p class="mb-2">Lightning Addresses are automatically created when users access their wallet.</p>
                <p class="text-xs text-white/50">Ask them to visit their Receive page to activate it.</p>
              </div>
            </div>
          </div>
        </div>
      {:else}
        <div class="text-center space-y-2">
          <div class="flex items-center justify-center gap-2 text-yellow-400">
            <iconify-icon icon="ph:lightning-fill" width="24"></iconify-icon>
            <p class="text-sm font-semibold">Lightning Address</p>
          </div>
          <p class="text-xs text-white/50">Scan or copy to send payment</p>
        </div>

        <div class="flex justify-center p-6">
          <div class="bg-white rounded-2xl p-4 shadow-xl">
            <Qr text={lightningAddress} />
          </div>
        </div>

        <div class="space-y-3">
          <div class="glass rounded-2xl p-4 border border-white/20 bg-white/5">
            <p class="text-center font-mono text-lg break-all text-white/90">
              {lightningAddress}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <a href={`/send/${lightningAddress}`} class="contents">
              <button
                type="button"
                class="px-6 py-3 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
                style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white;"
              >
                <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                     style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);"></div>
                <iconify-icon
                  icon="ph:paper-plane-right-bold"
                  width="24"
                  class="relative z-10 group-hover:translate-x-1 transition-transform"
                ></iconify-icon>
                <span class="relative z-10 font-bold">Send Now</span>
              </button>
            </a>

            <button
              type="button"
              class="px-6 py-3 rounded-2xl font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
              style="background: linear-gradient(135deg, #74EBD5 0%, #9688DD 100%); color: white;"
              onclick={() => copy(lightningAddress)}
            >
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                   style="background: linear-gradient(135deg, #9688DD 0%, #74EBD5 100%);"></div>
              <iconify-icon
                icon="ph:copy-bold"
                width="24"
                class="relative z-10"
              ></iconify-icon>
              <span class="relative z-10 font-bold">Copy</span>
            </button>
          </div>
        </div>

        <div class="glass rounded-xl p-4 border border-blue-500/20 bg-blue-500/5">
          <div class="flex gap-3">
            <iconify-icon icon="ph:info-bold" width="20" class="text-blue-400 mt-0.5"></iconify-icon>
            <div class="text-sm text-white/70 space-y-1">
              <p>Use any Lightning wallet to send a payment to this address.</p>
              <p class="text-xs text-white/50">Compatible with all major Lightning wallets</p>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
-->
