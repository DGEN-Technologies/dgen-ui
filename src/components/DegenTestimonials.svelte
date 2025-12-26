<script>
  import { onMount } from "svelte";
  import { fly, scale } from "svelte/transition";

  let mounted = $state(false);
  // let activeTestimonial = $state(0);
  // let isPaused = $state(false);
  // let autoplayInterval = null;

  // const features = [
  //   {
  //     title: "Security",
  //     icon: "🔒",
  //     description:
  //       "Complete control over your assets. Advanced security with multi-signature support and hardware wallet integration.",
  //     highlight: "Your keys",
  //     category: "Security",
  //   },
  //   {
  //     title: "Liquid Network Support",
  //     icon: "💧",
  //     description:
  //       "Fast 2-minute block confirmations with confidential transactions. Good for institutional trading and high-value transfers.",
  //     highlight: "Auto-managed",
  //     category: "Network",
  //   },
  //   {
  //     title: "Universal Access",
  //     icon: "🌍",
  //     description:
  //       "Seamless experience across all platforms. Access your wallet from web, mobile, or desktop anywhere in the world (where bitcoin is legal).",
  //     highlight: "",
  //     category: "Access",
  //   },
  // ];

  const techSpecs = [
    { label: "Payment Speed", value: "<1s", icon: "ph:lightning-bold" },
    { label: "Network Fees", value: "<$0.01", icon: "cryptocurrency:btc" },
    { label: "Uptime", value: "99.9%", icon: "ph:check-circle-bold" },
    { label: "Open Source", value: "100%", icon: "ph:code-bold" },
  ];

  // const startAutoplay = () => {
  //   if (autoplayInterval) clearInterval(autoplayInterval);

  //   autoplayInterval = setInterval(() => {
  //     if (!isPaused) {
  //       activeTestimonial = (activeTestimonial + 1) % features.length;
  //     }
  //   }, 3000); // 3 seconds between slides
  // };

  // const togglePlayPause = () => {
  //   isPaused = !isPaused;
  // };

  // const goToSlide = (index) => {
  //   activeTestimonial = index;
  //   isPaused = true; // Pause when user manually selects a slide
  // };

  onMount(() => {
    mounted = true;
    // startAutoplay();

    // return () => {
    //   if (autoplayInterval) clearInterval(autoplayInterval);
    // };
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
