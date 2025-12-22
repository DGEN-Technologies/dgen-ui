<script>
  import { onMount } from "svelte";
  import { fly, fade, scale } from "svelte/transition";

  let mounted = $state(false);
  let activeTestimonial = $state(0);
  let isPaused = $state(false);
  let autoplayInterval = null;

  const features = [
    {
      title: "Security",
      icon: "🔒",
      description:
        "Complete control over your assets. Advanced security with multi-signature support and hardware wallet integration.",
      highlight: "Your keys",
      category: "Security",
    },
    {
      title: "Liquid Network Support",
      icon: "💧",
      description:
        "Fast 2-minute block confirmations with confidential transactions. Good for institutional trading and high-value transfers.",
      highlight: "Auto-managed",
      category: "Network",
    },
    {
      title: "Universal Access",
      icon: "🌍",
      description:
        "Seamless experience across all platforms. Access your wallet from web, mobile, or desktop anywhere in the world (where bitcoin is legal).",
      highlight: "",
      category: "Access",
    },
  ];

  const techSpecs = [
    { label: "Payment Speed", value: "<1s", icon: "ph:lightning-bold" },
    { label: "Network Fees", value: "<$0.01", icon: "cryptocurrency:btc" },
    { label: "Uptime", value: "99.9%", icon: "ph:check-circle-bold" },
    { label: "Open Source", value: "100%", icon: "ph:code-bold" },
  ];

  const startAutoplay = () => {
    if (autoplayInterval) clearInterval(autoplayInterval);

    autoplayInterval = setInterval(() => {
      if (!isPaused) {
        activeTestimonial = (activeTestimonial + 1) % features.length;
      }
    }, 3000); // 3 seconds between slides
  };

  const togglePlayPause = () => {
    isPaused = !isPaused;
  };

  const goToSlide = (index) => {
    activeTestimonial = index;
    isPaused = true; // Pause when user manually selects a slide
  };

  onMount(() => {
    mounted = true;
    startAutoplay();

    return () => {
      if (autoplayInterval) clearInterval(autoplayInterval);
    };
  });
</script>

{#if mounted}
  <section class="relative pb-32 pt-0">
    <div class="container mx-auto px-4 relative z-10">
      <!-- Tech Specs -->
      <div
        class="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto mb-16"
      >
        {#each techSpecs as stat, i}
          <div
            class="glass text-center p-6 rounded-2xl border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-105"
            in:scale={{ duration: 500, delay: 100 * i }}
          >
            <iconify-icon icon={stat.icon} class="text-3xl text-purple-400 mb-2"
            ></iconify-icon>
            <p class="text-2xl font-bold gradient-text">{stat.value}</p>
            <p class="text-sm opacity-60">{stat.label}</p>
          </div>
        {/each}
      </div>

      <!-- Features Showcase -->
      <div class="max-w-4xl mx-auto relative">
        <div class="relative">
          {#each features as feature, i}
            {#if i === activeTestimonial}
              <div class="w-full" in:fade={{ duration: 500 }}>
                <div
                  class="premium-card border-2 border-purple-500/20 hover:border-purple-500/60 transition-all duration-500 min-h-[350px] sm:min-h-[400px]"
                >
                  <!-- Content -->
                  <div
                    class="relative z-10 flex flex-col justify-center min-h-full p-4"
                  >
                    <!-- Feature Icon and Title -->
                    <div class="text-center mb-6">
                      <div class="text-6xl mb-4">{feature.icon}</div>
                      <h3
                        class="text-xl sm:text-2xl lg:text-3xl font-bold gradient-text mb-2"
                      >
                        {feature.title}
                      </h3>
                      <div
                        class="inline-block px-4 py-2 bg-purple-500/10 rounded-full border border-purple-500/30"
                      >
                        <span class="text-sm opacity-80"
                          >{feature.category}</span
                        >
                      </div>
                    </div>

                    <!-- Description -->
                    <p
                      class="text-base sm:text-lg lg:text-xl leading-relaxed mb-6 text-center px-4"
                    >
                      {feature.description}
                    </p>

                    <!-- Highlight -->
                    {#if feature.highlight}
                      <div class="text-center">
                        <div
                          class="inline-block px-6 py-3 bg-gradient-primary rounded-full"
                        >
                          <p class="text-xl font-bold text-white">
                            {feature.highlight}
                          </p>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>

        <!-- Navigation controls -->
        <div class="flex flex-col items-center gap-4 mt-8">
          <!-- Play/Pause button -->
          <button
            class="glass px-6 py-3 rounded-full border-2 border-purple-500/30 hover:border-purple-500/60 transition-all duration-300 hover:scale-110 flex items-center gap-3"
            onclick={togglePlayPause}
          >
            {#if isPaused}
              <iconify-icon
                icon="ph:play-fill"
                width="24"
                class="text-purple-400"
              ></iconify-icon>
              <span class="text-sm font-bold">Resume Slideshow</span>
            {:else}
              <iconify-icon
                icon="ph:pause-fill"
                width="24"
                class="text-purple-400"
              ></iconify-icon>
              <span class="text-sm font-bold">Pause Slideshow</span>
            {/if}
          </button>

          <!-- Navigation dots - 2x bigger -->
          <div class="flex justify-center gap-3">
            {#each features as _, i}
              <button
                class="w-4 h-4 rounded-full transition-all duration-300 hover:scale-125 {i ===
                activeTestimonial
                  ? 'w-16 bg-gradient-primary'
                  : 'bg-white/20 hover:bg-white/40'}"
                onclick={() => goToSlide(i)}
              ></button>
            {/each}
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div
        class="text-center mt-16"
        in:fly={{ y: 30, duration: 800, delay: 600 }}
      >
        <p class="text-xl opacity-80 mb-6">
          Ready to experience the future of finance?
        </p>
        <a href="/register" class="inline-block">
          <button
            class="btn btn-liquid text-white font-bold text-xl px-12 py-4"
          >
            <iconify-icon
              icon="ph:lightning-bold"
              width="28"
              class="animate-pulse"
            ></iconify-icon>
            Get Started
            <iconify-icon icon="ph:arrow-right-bold" width="24"></iconify-icon>
          </button>
        </a>
      </div>
    </div>
  </section>
{/if}
