<script>
  import { onMount } from "svelte";
  import { fly, fade } from "svelte/transition";

  let mounted = $state(false);
  let activeFeature = $state(0);

  const features = [
    {
      id: "lightning",
      title: "Swift Global Transfers",
      subtitle: "Efficient global transfers",
      description:
        "Send Bitcoin anywhere on Earth with efficient transaction times. Payment settlement typically occurs quickly.",
      icon: "tabler:bolt",
      color: "yellow",
      stats: ["300ms", "Global", "Minimal fees"],
      visual: "⚡",
    },
    {
      id: "security",
      title: "Enhanced Security",
      subtitle: "Your choice, your control",
      description:
        "Wallet Encryption. Non-custodial - You control your keys, so you don’t have to trust a 3rd party to hold your keys for you.",
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
      subtitle: "Fast Bitcoin Transactions onchain",
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

  // Muted accent palette. Keep exactly 5 space-separated tokens per entry:
  // [0] from, [1] to, [2] border, [3] hover border, [4] text.
  const getColorClasses = (color) => {
    const colors = {
      yellow:
        "from-[#E8B64A]/25 to-[#E8B64A]/10 border-[#E8B64A]/25 hover:border-[#E8B64A]/45 text-[#E8B64A]",
      green:
        "from-[#5FC48B]/25 to-[#5FC48B]/10 border-[#5FC48B]/25 hover:border-[#5FC48B]/45 text-[#5FC48B]",
      purple:
        "from-[#A98BE0]/25 to-[#A98BE0]/10 border-[#A98BE0]/25 hover:border-[#A98BE0]/45 text-[#A98BE0]",
      blue: "from-[#5BB8F0]/25 to-[#5BB8F0]/10 border-[#5BB8F0]/25 hover:border-[#5BB8F0]/45 text-[#5BB8F0]",
      cyan: "from-[#5FD0C8]/25 to-[#5FD0C8]/10 border-[#5FD0C8]/25 hover:border-[#5FD0C8]/45 text-[#5FD0C8]",
    };
    return colors[color];
  };

  // RGB triples for the active-row tint (see landing-restyle.css .dg-accent)
  const getAccent = (color) =>
    ({
      yellow: "232,182,74",
      green: "95,196,139",
      purple: "169,139,224",
      blue: "91,184,240",
      cyan: "95,208,200",
    })[color] ?? "125,227,207";
</script>

{#if mounted}
  <section class="relative py-20 sm:py-32">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="text-center mb-12 sm:mb-16" in:fly={{ y: 30, duration: 800 }}>
        <h2
          class="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 heading-condensed"
        >
          <span class="holographic">Built Different</span>
        </h2>
        <p class="text-lg sm:text-xl md:text-2xl opacity-80 px-2">
          Easy to use. Can create an account in seconds
        </p>
      </div>

      <!-- 3D Feature Cards Carousel -->
      <div class="relative max-w-5xl mx-auto">
        <!-- Desktop view: side-by-side layout -->
        <div class="hidden lg:grid lg:grid-cols-2 gap-4 lg:gap-12 items-center">
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
                      )
                        .split(' ')
                        .slice(2, 4)
                        .join(' ')} relative overflow-hidden"
                    >
                      <!-- Floating visual -->
                      <div
                        class="absolute top-8 right-8 text-6xl opacity-20 animate-float"
                      >
                        {feature.visual}
                      </div>

                      <!-- Content -->
                      <div class="relative z-10">
                        <div class="mb-8">
                          <div
                            class="w-16 h-16 rounded-3xl bg-gradient-to-br {getColorClasses(
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
                          class="text-2xl sm:text-2xl font-bold mb-1 text-white"
                        >
                          {feature.title}
                        </h3>
                        <p
                          class="text-lg sm:text-lg mb-2 {getColorClasses(
                            feature.color,
                          ).split(' ')[4]}"
                        >
                          {feature.subtitle}
                        </p>
                        <p
                          class="text-base sm:text-base opacity-70 mb-6 sm:mb-6"
                        >
                          {feature.description}
                        </p>

                        <!-- Stats -->
                        <div
                          class="flex flex-wrap gap-2 sm:gap-1 justify-center sm:justify-start"
                        >
                          {#each feature.stats as stat}
                            <div
                              class="glass px-3 sm:px-2 py-2 sm:py-1 rounded-xl border border-white/10 min-w-fit"
                            >
                              <span
                                class="font-bold text-sm sm:text-sm whitespace-nowrap {getColorClasses(
                                  feature.color,
                                ).split(' ')[4]}">{stat}</span
                              >
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            {/each}
          </div>

          <!-- Feature Selector -->
          <div class="space-y-2">
            {#each features as feature, i}
              <button
                class="w-full text-left premium-card border-2 transition-all duration-500 {i ===
                activeFeature
                  ? getColorClasses(feature.color) + ' dg-accent'
                  : 'border-white/10 hover:border-white/30'}"
                style="--accent: {getAccent(feature.color)}"
                onclick={() => (activeFeature = i)}
              >
                <div class="flex items-center gap-2">
                  <div
                    class="w-10 h-10 rounded-xl bg-gradient-to-br {getColorClasses(
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
                      class="font-bold text-base {i === activeFeature
                        ? getColorClasses(feature.color).split(' ')[4]
                        : 'text-white/80'}"
                    >
                      {feature.title}
                    </h4>
                    <p class="text-xs opacity-60">{feature.subtitle}</p>
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
                    class="mt-2 h-1 bg-black/30 rounded-full overflow-hidden"
                  >
                    <div
                      class="h-full bg-current {getColorClasses(
                        feature.color,
                      ).split(' ')[4]} rounded-full"
                      style="animation: progress 5s linear infinite;"
                    ></div>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Mobile view: dropdown accordion -->
        <div class="lg:hidden space-y-2">
          {#each features as feature, i}
            <button
              class="w-full text-left premium-card border-2 transition-all duration-500 {i ===
              activeFeature
                ? getColorClasses(feature.color) + ' dg-accent'
                : 'border-white/10 hover:border-white/30'}"
              style="--accent: {getAccent(feature.color)}"
              onclick={() => (activeFeature = activeFeature === i ? -1 : i)}
            >
              <div class="flex items-center gap-2">
                <div
                  class="w-8 h-8 rounded-xl bg-gradient-to-br {getColorClasses(
                    feature.color,
                  ).split(' ')[0]} {getColorClasses(feature.color).split(
                    ' ',
                  )[1]} flex items-center justify-center {i === activeFeature
                    ? ''
                    : 'opacity-50'}"
                >
                  <iconify-icon icon={feature.icon} class="text-white text-xl"
                  ></iconify-icon>
                </div>
                <div class="flex-1">
                  <h4
                    class="font-bold text-sm {i === activeFeature
                      ? getColorClasses(feature.color).split(' ')[4]
                      : 'text-white/80'}"
                  >
                    {feature.title}
                  </h4>
                  <p class="text-xs opacity-60">{feature.subtitle}</p>
                </div>
                <div
                  class="text-xl transition-transform duration-300 {i ===
                  activeFeature
                    ? 'rotate-180'
                    : ''}"
                >
                  <iconify-icon icon="ph:caret-down-bold" width="15"
                  ></iconify-icon>
                </div>
              </div>

              {#if i === activeFeature}
                <!-- Dropdown content -->
                <div
                  class="mt-2 pt-2 border-t border-white/10"
                  in:fade={{ duration: 300 }}
                >
                  <p class="text-sm opacity-70 mb-2">
                    {feature.description}
                  </p>

                  <!-- Stats -->
                  <div class="flex flex-wrap gap-1">
                    {#each feature.stats as stat}
                      <div
                        class="glass px-1 py-1 rounded-xl border border-white/20"
                      >
                        <span
                          class="font-bold text-xs whitespace-nowrap {getColorClasses(
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
