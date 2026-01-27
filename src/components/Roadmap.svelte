<script>
  import { onMount } from "svelte";
  import { fade, fly, scale } from "svelte/transition";

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });

  const roadmapItems = [
    {
      phase: "Phase 1",
      title: "Public Listing & Fiat POS System",
      icon: "ph:chart-line-up-bold",
      color: "from-green-400 to-emerald-400",
      items: [
        "Stock exchange listing (subject to approvals)",
        "Enhanced visibility & liquidity",
        "Launch of fiat Point-of-Sale system",
        "Seamless fiat transactions & merchant adoption",
      ],
      status: "upcoming",
    },
    {
      phase: "Phase 2",
      title: "Introduction of DGEN Crypto DGEN Card",
      icon: "ph:credit-card-bold",
      color: "from-cyan-400 to-blue-400",
      items: [
        "Branded Visa or MasterCard for crypto spending (off-ramp)",
        "Global merchant acceptance",
        "Low fees",
        "Bridging Crypto with Traditional Finance",
      ],
      status: "upcoming",
    },
    {
      phase: "Phase 3",
      title: "Mobile App and Rewards Program",
      icon: "ph:device-mobile-bold",
      color: "from-purple-400 to-pink-400",
      items: [
        "Mobile app on major app stores",
        "Global accessibility",
        "Tiered Reward and Referral System",
        "Integration with Crypto Wallet",
      ],
      status: "upcoming",
    },
    {
      phase: "Phase 4",
      title: "Launch of DGEN Crypto Wallet",
      icon: "ph:wallet-bold",
      color: "from-yellow-400 to-orange-400",
      items: [
        "Secure web-based cryptocurrency wallet",
        "Robust security infrastructure",
        "Supports Bitcoin, Lightning, Liquid & Tether",
        "Premium experience for retail & institutional clients",
      ],
      status: "in-progress",
    },
  ];
</script>

<section id="roadmap" class="relative py-20 sm:py-32">
  <div class="relative z-10 container mx-auto px-4">
    {#if mounted}
      <!-- Section Header -->
      <div class="text-center mb-16" in:fade={{ duration: 800, delay: 200 }}>
        <h2
          class="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 heading-condensed"
        >
          <span class="gradient-text">DGEN Strategic Roadmap</span>
        </h2>
        <p class="text-xl text-white/70 max-w-3xl mx-auto heading-condensed">
          Bridging Blockchain With Traditional Markets
        </p>
      </div>

      <!-- Timeline -->
      <div class="relative max-w-6xl mx-auto">
        <!-- Central timeline line -->
        <div
          class="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-dgen-cyan via-purple-500 to-yellow-400 opacity-30 hidden lg:block"
        ></div>

        <!-- Roadmap items -->
        <div class="space-y-12 lg:space-y-24">
          {#each roadmapItems as item, index}
            <div
              class="relative"
              in:fly={{
                x: index % 2 === 0 ? -50 : 50,
                duration: 800,
                delay: 400 + index * 100,
              }}
            >
              <div class="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
                <!-- Content -->
                <div
                  class={`${index % 2 === 0 ? "lg:text-right" : "lg:col-start-2"}`}
                >
                  <div
                    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-dgen-cyan/40 transition-all duration-500 hover:shadow-2xl hover:shadow-dgen-cyan/20 p-6 sm:p-8"
                  >
                    <!-- Phase badge -->
                    <div
                      class={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${item.color} text-black font-bold mb-4`}
                    >
                      <iconify-icon icon={item.icon} width="20"></iconify-icon>
                      <span>{item.phase}</span>
                      {#if item.status === "in-progress"}
                        <span class="animate-pulse">🔥</span>
                      {/if}
                    </div>

                    <!-- Title -->
                    <h3 class="text-2xl sm:text-3xl font-bold text-white mb-4">
                      {item.title}
                    </h3>

                    <!-- Items list -->
                    <ul class="space-y-3">
                      {#each item.items as listItem}
                        <li class="flex items-center gap-3 text-white/80">
                          <iconify-icon
                            icon={item.status === "in-progress"
                              ? "ph:check-circle-fill"
                              : "ph:circle-dashed"}
                            class={item.status === "in-progress"
                              ? "text-green-400"
                              : "text-white/40"}
                            width="20"
                          ></iconify-icon>
                          <span>{listItem}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                </div>

                <!-- Timeline node -->
                <div
                  class={`hidden lg:flex lg:justify-center lg:items-center ${index % 2 === 0 ? "lg:col-start-2" : ""} lg:absolute lg:left-1/2 lg:transform lg:-translate-x-1/2`}
                >
                  <div class="relative">
                    <div
                      class={`w-8 h-8 rounded-full bg-gradient-to-r ${item.color} shadow-lg shadow-current animate-pulse`}
                    ></div>
                    <div
                      class={`absolute inset-0 w-8 h-8 rounded-full bg-gradient-to-r ${item.color} blur-xl opacity-50`}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Disclaimer -->
      <div
        class="text-center mt-20 max-w-4xl mx-auto"
        in:fade={{ duration: 800, delay: 1000 }}
      >
        <div class="glass border border-white/10 rounded-lg p-6">
          <h4
            class="text-base sm:text-xl font-bold text-yellow-300/70 mb-3 uppercase tracking-wider"
          >
            Disclaimer
          </h4>
          <p class="text-xs sm:text-lg text-yellow-400/60 leading-relaxed">
            The roadmap presented herein reflects DGEN's current intentions and
            plans for the development and release of its products and services,
            as outlined in the specified phases. However, DGEN expressly
            reserves the right to modify, amend, or alter the sequence, timing,
            or content of these phases at its sole discretion. Such changes may
            result from unforeseen circumstances, including but not limited to
            acts of God, market conditions, operational challenges, or shifts in
            business strategy or corporate structure. DGEN makes no
            representations, warranties, or guarantees, whether express or
            implied, regarding the precise timing, order, or execution of any
            phase or event described in the roadmap. DGEN shall not be liable
            for any delays, modifications, or cancellations related to the
            roadmap or its implementation.
          </p>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  @keyframes blob {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    33% {
      transform: translate(30px, -50px) scale(1.1);
    }
    66% {
      transform: translate(-20px, 20px) scale(0.9);
    }
  }

  .blob {
    animation: blob 12s infinite;
  }
</style>
