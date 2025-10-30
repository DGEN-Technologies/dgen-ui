<script>
  import { onMount } from "svelte";
  import { fly, fade, scale } from "svelte/transition";

  let mounted = $state(false);
  let stats = $state([
    {
      label: "Active Nodes",
      value: "15,234",
      change: "+12%",
      icon: "ph:broadcast-bold",
    },
    {
      label: "Open Channels",
      value: "82,451",
      change: "+8%",
      icon: "ph:link-bold",
    },
    {
      label: "Network Capacity",
      value: "5,421 BTC",
      change: "+15%",
      icon: "ph:vault-bold",
    },
    {
      label: "Daily Transactions",
      value: "1.2M",
      change: "+24%",
      icon: "ph:lightning-bold",
    },
  ]);

  // Simulate live updates
  onMount(() => {
    mounted = true;
    const interval = setInterval(() => {
      stats = stats.map((stat) => ({
        ...stat,
        value:
          stat.label === "Daily Transactions"
            ? `${(1.2 + Math.random() * 0.1).toFixed(1)}M`
            : stat.value,
      }));
    }, 3000);

    return () => clearInterval(interval);
  });
</script>

{#if mounted}
  <section class="relative py-32 overflow-hidden">
    <!-- Animated background -->
    <div class="absolute inset-0">
      <div class="absolute inset-0 bg-gradient-dark opacity-50"></div>
      <div class="absolute inset-0 cyber-grid opacity-20"></div>

      <!-- Lightning bolts animation -->
      <div class="absolute top-20 left-10 text-yellow-400/20 animate-pulse">
        <iconify-icon icon="tabler:bolt" width="100"></iconify-icon>
      </div>
      <div
        class="absolute bottom-20 right-10 text-yellow-400/20 animate-pulse"
        style="animation-delay: 1s;"
      >
        <iconify-icon icon="tabler:bolt" width="100"></iconify-icon>
      </div>
    </div>

    <div class="container mx-auto px-4 relative z-10">
      <div class="text-center mb-16" in:fly={{ y: 30, duration: 800 }}>
        <h2 class="text-5xl md:text-6xl font-bold mb-4">
          <span class="holographic">Lightning Network</span>
        </h2>
        <p class="text-2xl opacity-80">
          Real-time metrics from the future of payments
        </p>
      </div>

      <div
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
      >
        {#each stats as stat, i}
          <div
            class="premium-card group relative overflow-hidden border-2 border-yellow-500/20 hover:border-yellow-500/60 transition-all duration-500"
            in:scale={{ duration: 500, delay: 100 * i }}
          >
            <!-- Animated gradient background -->
            <div
              class="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            ></div>

            <!-- Icon -->
            <div class="mb-4">
              <div
                class="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500"
              >
                <iconify-icon icon={stat.icon} class="text-white text-3xl"
                ></iconify-icon>
              </div>
            </div>

            <!-- Stats -->
            <div class="text-center">
              <p class="text-sm opacity-60 mb-2">{stat.label}</p>
              <p class="text-3xl font-bold gradient-text mb-2">{stat.value}</p>
              <p class="text-sm text-green-400 font-bold">
                <iconify-icon icon="ph:trend-up-bold" width="16" class="inline"
                ></iconify-icon>
                {stat.change}
              </p>
            </div>

            <!-- Pulse effect -->
            <div
              class="absolute -bottom-2 -right-2 w-20 h-20 bg-yellow-500/20 rounded-full blur-2xl animate-pulse"
            ></div>
          </div>
        {/each}
      </div>

      <!-- Live indicator -->
      <div
        class="flex justify-center mt-8"
        in:fade={{ duration: 800, delay: 400 }}
      >
        <div
          class="glass px-6 py-3 rounded-full border border-green-400/30 flex items-center gap-2"
        >
          <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span class="text-green-400 font-bold">LIVE</span>
          <span class="opacity-60">Network Status: Operational</span>
        </div>
      </div>
    </div>
  </section>
{/if}
