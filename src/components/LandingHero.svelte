<script>
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });
</script>

<div class="relative -mt-20 min-h-screen">
  <!-- Animated background mesh with aurora effect -->
  <div class="absolute inset-0">
    <div class="absolute inset-0 aurora-bg opacity-5"></div>
    <div
      class="absolute top-0 -left-4 w-96 h-96 bg-dgen-aqua rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
    ></div>
    <div
      class="absolute top-0 -right-4 w-96 h-96 bg-dgen-cyan rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 2s;"
    ></div>
    <div
      class="absolute -bottom-8 left-20 w-96 h-96 bg-dgen-teal rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 4s;"
    ></div>
    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-dgen-aqua/10 via-dgen-cyan/10 to-dgen-purple/10 rounded-full filter blur-3xl animate-pulse"
    ></div>
  </div>

  <!-- Cyber Grid overlay -->
  <div class="absolute inset-0 cyber-grid opacity-30"></div>

  <!-- Particle System -->
  <div class="particles">
    {#each Array(20) as _, i}
      <div
        class="particle"
        style="left: {Math.random() * 100}%; animation-delay: {Math.random() *
          20}s; animation-duration: {15 + Math.random() * 10}s"
      ></div>
    {/each}
  </div>

  <!-- Content -->
  <div
    class="relative z-10 flex flex-col items-center justify-start px-4 pt-28 sm:pt-36 md:pt-40 pb-16"
  >
    {#if mounted}
      <!-- Logo with epic glow effect -->
      <div
        class="mb-4 sm:mb-6 relative"
        in:fade={{ duration: 800, delay: 200 }}
      >
        <div class="relative pointer-events-none">
          <div
            class="absolute inset-0 bg-gradient-to-r from-dgen-aqua/30 to-dgen-cyan/30 blur-3xl opacity-40"
          ></div>
          <div
            class="absolute inset-0 bg-gradient-to-r from-dgen-cyan/20 to-dgen-purple/20 blur-2xl opacity-20 scale-110 animate-pulse"
          ></div>
          <img
            src="/images/dgen-logo-white.svg"
            alt="DGEN Logo"
            class="relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 floating pointer-events-auto"
          />
        </div>
        <!-- Lightning bolt positioned close under logo -->
        <div
          class="absolute left-1/2 transform -translate-x-1/2 pointer-events-none"
          style="bottom: 1rem;"
        >
          <div class="relative inline-block sm:bottom-4">
            <div
              class="absolute inset-0 bg-yellow-400/30 blur-xl opacity-40 animate-pulse"
            ></div>
            <span
              class="relative animate-pulse text-3xl sm:text-4xl md:text-5xl drop-shadow-2xl"
              style="color: #ffd700; filter: drop-shadow(0 0 20px #ffd700);"
              >⚡</span
            >
          </div>
        </div>
      </div>

      <!-- Bitcoin Lightning Wallet text below logo -->
      <div
        class="text-3xl sm:text-4xl md:text-6xl font-bold mb-8 px-2 w-full heading-condensed"
        in:fly={{ y: 30, duration: 800, delay: 400 }}
      >
        <div class="text-center">
          <span class="gradient-text font-roboto-condensed">
            THE FUTURE OF MONEY
          </span>
          <p class="text-lg sm:text-xl md:text-2xl opacity-80 px-2">
            How This Works, Built Different, Learn About Crypto.
          </p>
        </div>
      </div>

      <!-- Epic CTA Buttons -->
      <div
        class="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-8 items-center justify-center w-full px-4 sm:px-0"
        in:fly={{ y: 20, duration: 800, delay: 700 }}
      >
        <a href="/register" class="group">
          <button
            class="btn-liquid text-white border-0 px-2 py-1 sm:px-8 sm:py-3 text-xs sm:text-lg font-semibold sm:font-bold relative overflow-hidden transform hover:scale-105 sm:hover:scale-110 transition-all duration-300 hover:shadow-lg sm:hover:shadow-2xl hover:shadow-purple-500/50 rounded-xl sm:rounded-3xl w-full sm:w-auto"
          >
            <span class="relative z-10 flex items-center gap-1 sm:gap-3">
              <iconify-icon
                icon="ph:lightning-bold"
                width="12"
                class="animate-pulse sm:w-7"
              ></iconify-icon>
              Create Account
              <iconify-icon
                icon="ph:arrow-right-bold"
                width="10"
                class="group-hover:translate-x-1 sm:group-hover:translate-x-2 transition-transform sm:w-6"
              ></iconify-icon>
            </span>
          </button>
        </a>
        <a href="/login" class="group">
          <button
            class="glass border-2 border-white/30 px-2 py-1 sm:px-8 sm:py-3 text-xs sm:text-lg font-semibold sm:font-bold hover:border-white/60 transition-all duration-300 rounded-xl sm:rounded-3xl hover:scale-105 sm:hover:scale-110 hover:shadow-lg sm:hover:shadow-2xl w-full sm:w-auto"
          >
            <span class="flex items-center gap-1 sm:gap-3 whitespace-nowrap">
              <iconify-icon
                icon="ph:sign-in-bold"
                width="12"
                class="flex-shrink-0 sm:w-6"
              ></iconify-icon>
              Sign In
              <iconify-icon
                icon="ph:arrow-right-bold"
                width="10"
                class="group-hover:translate-x-1 sm:group-hover:translate-x-2 transition-transform flex-shrink-0 sm:w-5"
              ></iconify-icon>
            </span>
          </button>
        </a>
      </div>

      <!-- Feature badges moved below buttons -->
      <div
        class="flex flex-wrap justify-center items-center gap-4 mb-8 sm:mb-12 max-w-4xl px-2"
        in:fly={{ y: 20, duration: 800, delay: 800 }}
      >
        <div class="px-5 sm:px-7 py-4 sm:py-5 flex items-center min-h-[3.5rem]">
          <span class="text-dgen-aqua font-bold text-base sm:text-xl"
            >⚡ Instant Transactions</span
          >
        </div>
        <div class="px-5 sm:px-7 py-4 sm:py-5 flex items-center min-h-[3.5rem]">
          <span class="text-dgen-cyan font-bold text-base sm:text-xl"
            >💎 Create Account In Seconds (Literally)</span
          >
        </div>
        <div
          class="px-5 sm:px-7 py-4 sm:py-5 text-center min-h-[3.5rem] flex items-center"
        >
          <div class="text-dgen-aqua font-bold text-base sm:text-xl">
            🔒 Non-Custodial
          </div>
        </div>
      </div>

      <!-- Disclaimer -->
      <div
        class="text-center px-4 mb-16 sm:mb-20"
        in:fly={{ y: 20, duration: 800, delay: 900 }}
      >
        <div
          class="glass px-4 py-3 sm:px-6 rounded-full border border-white/60 bg-white/10 inline-block"
        >
          <p class="font-semibold text-sm sm:text-base text-white/90">
            ⚠️ This website/app is in Beta and not finalized. Use at your own
            risk.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes float {
    0%,
    100% {
      transform: translateY(0) rotate(0deg);
    }
    33% {
      transform: translateY(-20px) rotate(1deg);
    }
    66% {
      transform: translateY(10px) rotate(-1deg);
    }
  }
</style>
