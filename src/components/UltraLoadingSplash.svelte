<script>
  import { onMount } from "svelte";
  import { fade, scale } from "svelte/transition";

  let mounted = $state(false);
  let loadingProgress = $state(0);

  onMount(() => {
    mounted = true;
    // Simulate loading progress
    const interval = setInterval(() => {
      loadingProgress += Math.random() * 30;
      if (loadingProgress >= 100) {
        loadingProgress = 100;
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  });
</script>

{#if mounted}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-dark"
    in:fade={{ duration: 300 }}
  >
    <!-- Animated background -->
    <div class="absolute inset-0">
      <div class="absolute inset-0 aurora-bg opacity-5"></div>
      <div class="absolute inset-0 cyber-grid opacity-20"></div>

      <!-- Floating orbs -->
      <div
        class="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl blob"
      ></div>
      <div
        class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl blob"
        style="animation-delay: 2s;"
      ></div>
      <div
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 rounded-full blur-3xl animate-pulse"
      ></div>
    </div>

    <!-- Content -->
    <div
      class="relative z-10 text-center space-y-8"
      in:scale={{ duration: 500, delay: 100 }}
    >
      <!-- Logo with glow -->
      <div class="relative mx-auto w-32 h-32 mb-8">
        <div
          class="absolute inset-0 bg-gradient-primary blur-2xl opacity-50 animate-pulse"
        ></div>
        <img
          src="/images/dgen-logo-white.svg"
          alt="DGEN"
          class="relative w-full h-full floating"
        />
      </div>

      <!-- Title removed for mobile -->
      {#if false}
        <h1 class="text-5xl font-bold mb-4">
          <span class="holographic">DGEN</span>
        </h1>
      {/if}

      <!-- Loading bar -->
      <div class="w-64 mx-auto">
        <div class="mb-2 flex justify-between text-sm opacity-60">
          <span>Initializing...</span>
          <span class="font-bold text-purple-400"
            >{Math.floor(loadingProgress)}%</span
          >
        </div>
        <div class="w-full h-2 bg-black/30 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-purple-400 to-blue-400 rounded-full transition-all duration-300 shimmer"
            style="width: {loadingProgress}%"
          ></div>
        </div>
      </div>

      <!-- Loading messages -->
      <div class="text-sm opacity-60 h-6">
        {#if loadingProgress < 30}
          <span in:fade={{ duration: 200 }}
            >Connecting to Lightning Network...</span
          >
        {:else if loadingProgress < 60}
          <span in:fade={{ duration: 200 }}>Syncing wallet data...</span>
        {:else if loadingProgress < 90}
          <span in:fade={{ duration: 200 }}>Preparing your experience...</span>
        {:else}
          <span in:fade={{ duration: 200 }}>Almost ready...</span>
        {/if}
      </div>

      <!-- Animated dots -->
      <div class="flex justify-center gap-2">
        {#each Array(3) as _, i}
          <div
            class="w-2 h-2 bg-white rounded-full opacity-50 animate-bounce"
            style="animation-delay: {i * 0.2}s"
          ></div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes float {
    0%,
    100% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-20px) rotate(5deg);
    }
  }
</style>
