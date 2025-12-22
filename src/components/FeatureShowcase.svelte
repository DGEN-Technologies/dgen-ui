<script>
  import { onMount } from "svelte";
  import { fly, fade } from "svelte/transition";

  let mounted = $state(false);
  let activeFeature = $state(0);

  const features = [
    {
      id: "lightning",
      title: "Lightning Fast",
      subtitle: "Instant global transfers",
      description:
        "Send Bitcoin anywhere on Earth instantly. Faster and more cost-effective than any traditional bank transfer. Instant payment settlement - Visa/MC take 1-2 business days to settle.",
      icon: "tabler:bolt",
      color: "yellow",
      stats: ["300ms", "Global", "Minimal fees"],
      visual: "⚡",
    },
    {
      id: "security",
      title: "High-Grade Security",
      subtitle: "Your choice, your control",
      description:
        "High-grade encryption, hardware wallet support, multi-signature vaults. Fully non-custodial - you control your keys.",
      icon: "ph:shield-check-bold",
      color: "green",
      stats: ["256-bit", "Multi-sig", "Biometric"],
      visual: "🔒",
    },
    {
      id: "defi",
      title: "Atomic Swaps & Submarine Swaps",
      subtitle: "Trustless layer swapping",
      description:
        "Seamlessly swap between layers with trustless protocols. Access decentralized finance directly from your wallet.",
      icon: "ph:swap-bold",
      color: "purple",
      stats: ["Atomic", "Trustless", "Instant"],
      visual: "🔄",
    },
    {
      id: "liquid",
      title: "The Liquid Network",
      subtitle: "Confidential & fast sidechains",
      description:
        "Transact with bitcoin using confidential transactions with speeds averaging 1 minute (compared to Bitcoin's typical 10min-2 hour transactions). All transactions here settle on the Liquid Network on the back end.",
      icon: "ph:drop-bold",
      color: "cyan",
      stats: ["Confidential", "2-min blocks", "Peg-in/out"],
      visual: "💧",
    },
  ];

  onMount(() => {
    mounted = true;
    // Disabled auto-rotation - users must click to navigate
    // const interval = setInterval(() => {
    //   activeFeature = (activeFeature + 1) % features.length;
    // }, 5000);

    // return () => clearInterval(interval);
  });

  const getColorClasses = (color) => {
    const colors = {
      yellow:
        "from-yellow-400 to-orange-500 border-yellow-500/20 hover:border-yellow-500/60 text-yellow-400",
      green:
        "from-green-400 to-emerald-500 border-green-500/20 hover:border-green-500/60 text-green-400",
      purple:
        "from-purple-400 to-pink-500 border-purple-500/20 hover:border-purple-500/60 text-purple-400",
      blue: "from-blue-400 to-cyan-500 border-blue-500/20 hover:border-blue-500/60 text-blue-400",
      cyan: "from-cyan-400 to-teal-500 border-cyan-500/20 hover:border-cyan-500/60 text-cyan-400",
    };
    return colors[color];
  };
</script>

{#if mounted}
  <section class="relative py-32">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="text-center mb-12 sm:mb-16" in:fly={{ y: 30, duration: 800 }}>
        <h2 class="text-3xl sm:text-4xl md:text-6xl font-bold mb-4">
          <span class="holographic">Built Different</span>
        </h2>
        <p class="text-lg sm:text-xl md:text-2xl opacity-80 px-2">
          Easy to use. Can create an account in seconds
        </p>
      </div>

      <!-- 3D Feature Cards Carousel -->
      <div class="relative max-w-6xl mx-auto">
        <!-- Desktop view: side-by-side layout -->
        <div class="hidden lg:grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <!-- Feature Display -->
          <div class="relative">
            {#each features as feature, i}
              {#if i === activeFeature}
                <div class="w-full" in:fade={{ duration: 500 }}>
                  <!-- 3D Card -->
                  <div class="card-3d">
                    <div
                      class="premium-card min-h-[400px] border-2 {getColorClasses(
                        feature.color,
                      )} relative overflow-hidden"
                    >
                      <!-- Floating visual -->
                      <div
                        class="absolute top-8 right-8 text-8xl opacity-20 animate-float"
                      >
                        {feature.visual}
                      </div>

                      <!-- Content -->
                      <div class="relative z-10">
                        <div class="mb-8">
                          <div
                            class="w-20 h-20 rounded-3xl bg-gradient-to-br {getColorClasses(
                              feature.color,
                            ).split(' ')[0]} {getColorClasses(
                              feature.color,
                            ).split(
                              ' ',
                            )[1]} flex items-center justify-center mb-6"
                          >
                            <iconify-icon
                              icon={feature.icon}
                              class="text-white text-4xl"
                            ></iconify-icon>
                          </div>
                        </div>

                        <h3
                          class="text-2xl sm:text-3xl font-bold mb-2 {getColorClasses(
                            feature.color,
                          ).split(' ')[4]}"
                        >
                          {feature.title}
                        </h3>
                        <p class="text-lg sm:text-xl opacity-80 mb-4">
                          {feature.subtitle}
                        </p>
                        <p class="text-base sm:text-lg opacity-70 mb-6 sm:mb-8">
                          {feature.description}
                        </p>

                        <!-- Stats -->
                        <div class="flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-start">
                          {#each feature.stats as stat}
                            <div
                              class="glass px-3 sm:px-4 py-2 sm:py-3 rounded-xl border border-white/20 min-w-fit"
                            >
                              <span
                                class="font-bold text-sm sm:text-base whitespace-nowrap {getColorClasses(
                                  feature.color,
                                ).split(' ')[4]}">{stat}</span
                              >
                            </div>
                          {/each}
                        </div>
                      </div>

                      <!-- Animated particles -->
                      <div class="absolute inset-0 pointer-events-none">
                        {#each Array(5) as _, j}
                          <div
                            class="absolute w-1 h-1 bg-white rounded-full opacity-30 animate-float"
                            style="left: {20 + j * 15}%; top: {Math.random() *
                              100}%; animation-delay: {j *
                              0.5}s; animation-duration: {3 +
                              Math.random() * 2}s"
                          ></div>
                        {/each}
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            {/each}
          </div>

          <!-- Feature Selector -->
          <div class="space-y-4">
            {#each features as feature, i}
              <button
                class="w-full text-left premium-card border-2 transition-all duration-500 {i ===
                activeFeature
                  ? getColorClasses(feature.color) + ' scale-105'
                  : 'border-white/10 hover:border-white/30'}"
                onclick={() => (activeFeature = i)}
              >
                <div class="flex items-center gap-4">
                  <div
                    class="w-12 h-12 rounded-xl bg-gradient-to-br {getColorClasses(
                      feature.color,
                    ).split(' ')[0]} {getColorClasses(feature.color).split(
                      ' ',
                    )[1]} flex items-center justify-center {i === activeFeature
                      ? ''
                      : 'opacity-50'}"
                  >
                    <iconify-icon
                      icon={feature.icon}
                      class="text-white text-2xl"
                    ></iconify-icon>
                  </div>
                  <div class="flex-1">
                    <h4
                      class="font-bold text-lg {i === activeFeature
                        ? getColorClasses(feature.color).split(' ')[4]
                        : 'text-white/80'}"
                    >
                      {feature.title}
                    </h4>
                    <p class="text-sm opacity-60">{feature.subtitle}</p>
                  </div>
                  {#if i === activeFeature}
                    <div class="text-2xl animate-pulse">
                      {feature.visual}
                    </div>
                  {/if}
                </div>

                {#if i === activeFeature}
                  <!-- Progress bar -->
                  <div
                    class="mt-4 h-1 bg-black/30 rounded-full overflow-hidden"
                  >
                    <div
                      class="h-full bg-gradient-to-r {getColorClasses(
                        feature.color,
                      ).split(' ')[0]} {getColorClasses(feature.color).split(
                        ' ',
                      )[1]} rounded-full"
                      style="animation: progress 5s linear infinite;"
                    ></div>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Mobile view: dropdown accordion -->
        <div class="lg:hidden space-y-4">
          {#each features as feature, i}
            <button
              class="w-full text-left premium-card border-2 transition-all duration-500 {i ===
              activeFeature
                ? getColorClasses(feature.color)
                : 'border-white/10 hover:border-white/30'}"
              onclick={() => (activeFeature = activeFeature === i ? -1 : i)}
            >
              <div class="flex items-center gap-4">
                <div
                  class="w-12 h-12 rounded-xl bg-gradient-to-br {getColorClasses(
                    feature.color,
                  ).split(' ')[0]} {getColorClasses(feature.color).split(
                    ' ',
                  )[1]} flex items-center justify-center {i === activeFeature
                    ? ''
                    : 'opacity-50'}"
                >
                  <iconify-icon
                    icon={feature.icon}
                    class="text-white text-2xl"
                  ></iconify-icon>
                </div>
                <div class="flex-1">
                  <h4
                    class="font-bold text-lg {i === activeFeature
                      ? getColorClasses(feature.color).split(' ')[4]
                      : 'text-white/80'}"
                  >
                    {feature.title}
                  </h4>
                  <p class="text-sm opacity-60">{feature.subtitle}</p>
                </div>
                <div class="text-2xl transition-transform duration-300 {i === activeFeature ? 'rotate-180' : ''}">
                  <iconify-icon icon="ph:caret-down-bold" width="24"></iconify-icon>
                </div>
              </div>

              {#if i === activeFeature}
                <!-- Dropdown content -->
                <div class="mt-4 pt-4 border-t border-white/10" in:fade={{ duration: 300 }}>
                  <p class="text-base opacity-70 mb-4">
                    {feature.description}
                  </p>

                  <!-- Stats -->
                  <div class="flex flex-wrap gap-2">
                    {#each feature.stats as stat}
                      <div
                        class="glass px-3 py-2 rounded-xl border border-white/20"
                      >
                        <span
                          class="font-bold text-sm whitespace-nowrap {getColorClasses(
                            feature.color,
                          ).split(' ')[4]}">{stat}</span
                        >
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </section>
{/if}

<style>
  @keyframes progress {
    from {
      width: 0%;
    }
    to {
      width: 100%;
    }
  }
</style>
