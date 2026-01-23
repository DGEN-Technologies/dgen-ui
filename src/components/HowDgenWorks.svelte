<script>
  import { onMount } from "svelte";
  import { fly, fade, scale } from "svelte/transition";

  let mounted = $state(false);
  let activeStep = $state(0);
  let completedSteps = $state([]);
  let isPaused = $state(false);
  let animationInterval = null;
  let sectionElement = null;

  const steps = [
    {
      number: "01",
      title: "Create Your Account",
      time: "Can be done in less than 10 seconds",
      description:
        "Sign up with just a username (email is optional). Your account is ready instantly - no complicated setup required.",
      mobileDescription: "Sign up with a username. Ready instantly.",
      icon: "ph:rocket-launch-bold",
      action: "Click 'Create Account'",
      visual: "🚀",
    },
    {
      number: "02",
      title: "Receive Bitcoin or Tether",
      time: "",
      description:
        "Show QR code or wallet address/username to sender. Receive payments from anyone anywhere in the world.",
      mobileDescription:
        "Share QR code or address. Receive payments instantly.",
      icon: "ph:qr-code-bold",
      action: "Show QR code or wallet address/username to sender",
      visual: "💰",
    },
    {
      number: "03",
      title: "Send Crypto",
      time: "",
      description:
        "Scan QR codes or paste addresses. Send Crypto anywhere instantly.",
      mobileDescription: "Scan QR codes. Send Crypto instantly.",
      icon: "ph:paper-plane-tilt-bold",
      action: "Scan & send in seconds",
      visual: "⚡",
    },
    {
      number: "04",
      title: "Grow Your Crypto",
      time: "",
      description:
        "Buy Crypto, manage multiple wallets, and explore advanced features as you learn.",
      mobileDescription: "Buy Crypto and explore advanced features.",
      icon: "ph:trending-up-bold",
      action: "Explore advanced features",
      visual: "📈",
    },
  ];

  const startAnimation = () => {
    // Disabled auto-animation - users must click to navigate
    // if (animationInterval) clearInterval(animationInterval);
    //
    // animationInterval = setInterval(() => {
    //   if (!isPaused) {
    //     if (activeStep < steps.length - 1) {
    //       completedSteps = [...completedSteps, activeStep];
    //       activeStep++;
    //     } else {
    //       completedSteps = [];
    //       activeStep = 0;
    //     }
    //   }
    // }, 3000);
  };

  const handleStepClick = (stepIndex) => {
    // Mark previous steps as completed if clicking forward
    if (stepIndex > activeStep) {
      for (let i = activeStep; i < stepIndex; i++) {
        if (!completedSteps.includes(i)) {
          completedSteps = [...completedSteps, i];
        }
      }
    }
    activeStep = stepIndex;
    // No auto-resume - user controls navigation
  };

  onMount(() => {
    mounted = true;
    startAnimation();

    // Observer to restart animation when section is out of view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            isPaused = false;
            activeStep = 0;
            completedSteps = [];
          }
        });
      },
      { threshold: 0.1 },
    );

    if (sectionElement) {
      observer.observe(sectionElement);
    }

    return () => {
      if (animationInterval) clearInterval(animationInterval);
      if (sectionElement) observer.unobserve(sectionElement);
    };
  });
</script>

{#if mounted}
  <section
    id="howItWorks"
    class="relative py-4 sm:py-24"
    bind:this={sectionElement}
  >
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="text-center mb-6 sm:mb-10" in:fly={{ y: 30, duration: 800 }}>
        <h2
          class="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 heading-condensed"
        >
          <span class="holographic">HOW THIS WORKS</span>
        </h2>
        <p class="text-sm sm:text-base md:text-lg opacity-60 mt-2">
          (click on steps 1, 2, 3, or 4 to navigate)
        </p>
      </div>

      <div class="max-w-6xl mx-auto">
        <!-- Progress Timeline -->
        <div class="relative mb-8 mx-auto w-[60%] lg:w-[70%]">
          <div
            class="absolute left-0 right-0 top-1/2 h-1 bg-white/10 rounded-full"
          ></div>
          <div
            class="absolute left-0 top-1/2 h-1 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full transition-all duration-1000"
            style="width: {(activeStep / (steps.length - 1)) * 100}%"
          ></div>

          <div class="relative flex justify-between">
            {#each steps as step, i}
              <button class="relative group" onclick={() => handleStepClick(i)}>
                <div
                  class="w-4 h-4 rounded-full transition-all duration-500 {i ===
                  activeStep
                    ? 'bg-gradient-primary scale-150'
                    : completedSteps.includes(i)
                      ? 'bg-white/40'
                      : 'bg-white/20'}"
                >
                  {#if i === activeStep}
                    <div
                      class="absolute inset-0 bg-gradient-primary rounded-full animate-ping"
                    ></div>
                  {/if}
                </div>
                <span
                  class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs opacity-60 whitespace-nowrap"
                >
                  Step {step.number}
                </span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Active Step Display -->
        <div class="mt-8 sm:mt-16">
          {#each steps as step, i}
            {#if i === activeStep}
              <div
                class="grid lg:grid-cols-2 gap-4 sm:gap-8 lg:gap-12 items-start lg:items-center"
                in:fade={{ duration: 500 }}
              >
                <!-- Visual Side -->
                <div class="relative order-2 lg:order-1">
                  <div
                    class="premium-card border-2 border-purple-500/20 hover:border-purple-500/60 transition-all duration-500 min-h-[200px] sm:min-h-[240px] lg:min-h-[280px] flex flex-col justify-center"
                  >
                    <!-- Floating visual -->
                    <div
                      class="absolute top-8 right-8 text-4xl sm:text-6xl opacity-20 animate-float"
                    >
                      {step.visual}
                    </div>

                    <!-- Phone Mockup Display -->
                    <div
                      class="relative mx-auto w-full max-w-[230px] lg:max-w-[270px]"
                    >
                      <!-- Phone frame -->
                      <div
                        class="glass rounded-3xl p-2 border-2 border-white/20"
                      >
                        <div
                          class="bg-gradient-dark rounded-2xl p-2 sm:p-3 min-h-[140px] sm:min-h-[200px] flex flex-col justify-center"
                        >
                          <!-- Phone status bar -->
                          <div
                            class="flex justify-between items-center mb-2 text-[10px] opacity-60"
                          >
                            <span>9:41</span>
                            <div class="flex gap-1">
                              <div
                                class="w-3 h-1.5 bg-white/60 rounded-sm"
                              ></div>
                              <div
                                class="w-5 h-1.5 bg-green-400 rounded-sm"
                              ></div>
                            </div>
                          </div>

                          <!-- Step content -->
                          <div class="text-center space-y-1 sm:space-y-2">
                            <div class="text-2xl sm:text-3xl mb-1">
                              {step.visual}
                            </div>
                            <h4
                              class="text-base sm:text-lg font-bold text-white"
                            >
                              {step.title}
                            </h4>
                            <p class="text-xs sm:text-sm text-white/70">
                              {step.action}
                            </p>

                            <!-- Simple action visualization -->
                            {#if i === 0}
                              <div
                                class="glass rounded-lg p-1.5 sm:p-2 mt-2 sm:mt-3"
                              >
                                <div
                                  class="flex items-center justify-center gap-2"
                                >
                                  <iconify-icon
                                    icon="ph:user-bold"
                                    width="14"
                                    class="text-purple-400"
                                  ></iconify-icon>
                                  <span class="text-xs sm:text-sm"
                                    >Choose username</span
                                  >
                                </div>
                              </div>
                            {:else if i === 1}
                              <div
                                class="glass rounded-lg p-1.5 sm:p-2 mt-2 sm:mt-3"
                              >
                                <div
                                  class="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-white rounded-lg p-1.5 flex items-center justify-center"
                                >
                                  <div class="w-full h-full relative">
                                    <!-- QR code pattern -->
                                    <svg
                                      viewBox="0 0 21 21"
                                      class="w-full h-full"
                                    >
                                      <!-- Corner patterns -->
                                      <rect
                                        x="0"
                                        y="0"
                                        width="7"
                                        height="7"
                                        fill="black"
                                      />
                                      <rect
                                        x="1"
                                        y="1"
                                        width="5"
                                        height="5"
                                        fill="white"
                                      />
                                      <rect
                                        x="2"
                                        y="2"
                                        width="3"
                                        height="3"
                                        fill="black"
                                      />

                                      <rect
                                        x="14"
                                        y="0"
                                        width="7"
                                        height="7"
                                        fill="black"
                                      />
                                      <rect
                                        x="15"
                                        y="1"
                                        width="5"
                                        height="5"
                                        fill="white"
                                      />
                                      <rect
                                        x="16"
                                        y="2"
                                        width="3"
                                        height="3"
                                        fill="black"
                                      />

                                      <rect
                                        x="0"
                                        y="14"
                                        width="7"
                                        height="7"
                                        fill="black"
                                      />
                                      <rect
                                        x="1"
                                        y="15"
                                        width="5"
                                        height="5"
                                        fill="white"
                                      />
                                      <rect
                                        x="2"
                                        y="16"
                                        width="3"
                                        height="3"
                                        fill="black"
                                      />

                                      <!-- Random data pattern -->
                                      {#each Array(49) as _, k}
                                        {#if Math.random() > 0.4}
                                          <rect
                                            x={7 + (k % 7)}
                                            y={7 + Math.floor(k / 7)}
                                            width="1"
                                            height="1"
                                            fill="black"
                                          />
                                        {/if}
                                      {/each}
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            {:else if i === 2}
                              <div
                                class="glass rounded-lg p-1.5 sm:p-2 mt-2 sm:mt-3"
                              >
                                <div
                                  class="flex flex-col items-center justify-center gap-1"
                                >
                                  <div
                                    class="flex items-center justify-center gap-2"
                                  >
                                    <div class="flex flex-col items-center">
                                      <iconify-icon
                                        icon="ph:camera-bold"
                                        width="14"
                                        class="text-yellow-400"
                                      ></iconify-icon>
                                      <span class="text-[10px] opacity-60 mt-1"
                                        >(scan)</span
                                      >
                                    </div>
                                    <iconify-icon
                                      icon="ph:arrow-right-bold"
                                      width="10"
                                      class="text-white/60"
                                    ></iconify-icon>
                                    <iconify-icon
                                      icon="ph:paper-plane-bold"
                                      width="14"
                                      class="text-green-400"
                                    ></iconify-icon>
                                  </div>
                                </div>
                              </div>
                            {:else}
                              <div
                                class="glass rounded-lg p-1.5 sm:p-2 mt-2 sm:mt-3"
                              >
                                <div
                                  class="flex flex-col items-center justify-center"
                                >
                                  <!-- Coin stack image -->
                                  <img
                                    src="/images/bitcoin.png"
                                    alt="Bitcoin"
                                    class="w-12 h-12 object-contain"
                                  />
                                  <div
                                    class="flex items-center justify-center gap-2 mt-1"
                                  >
                                    <iconify-icon
                                      icon="ph:trend-up-bold"
                                      width="14"
                                      class="text-green-400"
                                    ></iconify-icon>
                                  </div>
                                </div>
                              </div>
                            {/if}
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Stats -->
                    {#if step.time}
                      <div class="mt-4 flex justify-center gap-6">
                        <div class="text-center px-4">
                          <p
                            class="text-base sm:text-lg lg:text-xl font-bold gradient-text leading-relaxed"
                          >
                            {step.time}
                          </p>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Info Side -->
                <div class="space-y-3 sm:space-y-6 order-1 lg:order-2">
                  <div class="flex items-center gap-3 sm:gap-4">
                    <div
                      class="text-3xl sm:text-5xl font-bold gradient-text opacity-50"
                    >
                      {step.number}
                    </div>
                    <div
                      class="w-10 h-10 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center"
                    >
                      <iconify-icon
                        icon={step.icon}
                        class="text-white text-xl sm:text-3xl"
                      ></iconify-icon>
                    </div>
                  </div>

                  <h3 class="text-lg sm:text-xl md:text-3xl font-bold">
                    {step.title}
                  </h3>
                  <p class="text-xs sm:text-base md:text-lg opacity-80">
                    <span class="sm:hidden">{step.mobileDescription}</span>
                    <span class="hidden sm:inline">{step.description}</span>
                  </p>

                  <!-- Progress indicators -->
                  <div class="flex gap-2">
                    {#each steps as _, j}
                      <div
                        class="h-1.5 sm:h-2 flex-1 rounded-full transition-all duration-500 {j <
                        i
                          ? 'bg-white/30'
                          : j === i
                            ? 'bg-gradient-primary'
                            : 'bg-white/10'}"
                      ></div>
                    {/each}
                  </div>

                  <!-- Action button -->
                  <button
                    class="btn btn-liquid text-white font-bold text-xs sm:text-sm py-2 sm:py-3"
                    onclick={() =>
                      (activeStep = (activeStep + 1) % steps.length)}
                  >
                    {i < steps.length - 1 ? "Next Step" : "Start Over"}
                    <iconify-icon
                      icon="ph:arrow-right-bold"
                      width="16"
                      class="ml-2"
                    ></iconify-icon>
                  </button>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    </div>
  </section>
{/if}
