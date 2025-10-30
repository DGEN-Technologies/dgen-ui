<script>
  import { onMount } from "svelte";
  import { fly, fade } from "svelte/transition";

  let mounted = $state(false);

  const bountyTiers = [
    {
      level: "Critical",
      reward: "$5,000 - $10,000",
      description: "Remote code execution, wallet fund theft, key extraction",
      color: "red",
      icon: "ph:warning-octagon-bold",
    },
    {
      level: "High",
      reward: "$1,000 - $5,000", 
      description: "Authentication bypass, data exposure, transaction manipulation",
      color: "orange",
      icon: "ph:shield-warning-bold",
    },
    {
      level: "Medium",
      reward: "$500 - $1,000",
      description: "Cross-site scripting, sensitive info disclosure, logic flaws",
      color: "yellow",
      icon: "ph:warning-bold",
    },
    {
      level: "Low",
      reward: "$100 - $500",
      description: "Minor bugs, UI issues, performance problems",
      color: "green",
      icon: "ph:info-bold",
    },
  ];

  onMount(() => {
    mounted = true;
  });
</script>

{#if mounted}
  <section class="relative py-32 overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0">
      <div class="absolute inset-0 bg-gradient-dark"></div>
      <div class="absolute inset-0 cyber-grid opacity-10"></div>
    </div>

    <div class="container mx-auto px-4 relative z-10">
      <!-- Header -->
      <div class="text-center mb-16" in:fly={{ y: 30, duration: 800 }}>
        <h2 class="text-5xl md:text-6xl font-bold mb-4">
          <span class="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            BUG BOUNTY PROGRAM
          </span>
        </h2>
        <p class="text-2xl opacity-80 mb-4">
          Help us build the most secure Lightning wallet
        </p>
        <p class="text-lg opacity-60 max-w-3xl mx-auto">
          We take security seriously. Find vulnerabilities, report them responsibly, 
          and earn rewards for helping keep DGEN safe for everyone.
        </p>
      </div>

      <!-- Bounty Tiers -->
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {#each bountyTiers as tier, i}
          <div
            class="premium-card border-2 transition-all duration-500 hover:scale-105"
            class:border-red-500={tier.color === "red"}
            class:border-orange-500={tier.color === "orange"}
            class:border-yellow-500={tier.color === "yellow"}
            class:border-green-500={tier.color === "green"}
            class:hover:border-red-600={tier.color === "red"}
            class:hover:border-orange-600={tier.color === "orange"}
            class:hover:border-yellow-600={tier.color === "yellow"}
            class:hover:border-green-600={tier.color === "green"}
            in:fly={{ y: 30, duration: 600, delay: i * 100 }}
          >
            <div class="text-center space-y-4">
              <div
                class="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
                class:bg-gradient-to-br={true}
                class:from-red-400={tier.color === "red"}
                class:to-red-600={tier.color === "red"}
                class:from-orange-400={tier.color === "orange"}
                class:to-orange-600={tier.color === "orange"}
                class:from-yellow-400={tier.color === "yellow"}
                class:to-yellow-600={tier.color === "yellow"}
                class:from-green-400={tier.color === "green"}
                class:to-green-600={tier.color === "green"}
              >
                <iconify-icon icon={tier.icon} width="32" class="text-white"></iconify-icon>
              </div>
              
              <h3 class="text-2xl font-bold"
                class:text-red-400={tier.color === "red"}
                class:text-orange-400={tier.color === "orange"}
                class:text-yellow-400={tier.color === "yellow"}
                class:text-green-400={tier.color === "green"}
              >
                {tier.level}
              </h3>
              
              <p class="text-3xl font-bold">{tier.reward}</p>
              <p class="text-sm opacity-70">{tier.description}</p>
            </div>
          </div>
        {/each}
      </div>

      <!-- How to Report -->
      <div class="max-w-4xl mx-auto">
        <div class="premium-card border-2 border-purple-500/30 hover:border-purple-500/60 transition-all">
          <h3 class="text-3xl font-bold mb-6 text-center text-purple-400">
            How to Report
          </h3>
          
          <div class="space-y-6">
            <div class="flex gap-4 items-start">
              <div class="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <span class="text-purple-400 font-bold">1</span>
              </div>
              <div>
                <h4 class="font-bold text-lg mb-2">Discover a vulnerability</h4>
                <p class="opacity-70">Test responsibly on testnet or your own account. Never test on other users' accounts.</p>
              </div>
            </div>

            <div class="flex gap-4 items-start">
              <div class="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <span class="text-purple-400 font-bold">2</span>
              </div>
              <div>
                <h4 class="font-bold text-lg mb-2">Document your findings</h4>
                <p class="opacity-70">Include steps to reproduce, impact assessment, and proof of concept if applicable.</p>
              </div>
            </div>

            <div class="flex gap-4 items-start">
              <div class="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <span class="text-purple-400 font-bold">3</span>
              </div>
              <div>
                <h4 class="font-bold text-lg mb-2">Submit your report</h4>
                <p class="opacity-70">
                  Email <a href="mailto:security@dgentech.io" class="text-purple-400 hover:text-purple-300 underline">security@dgentech.io</a> with encrypted details.
                  Use our PGP key for sensitive reports.
                </p>
              </div>
            </div>

            <div class="flex gap-4 items-start">
              <div class="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <span class="text-purple-400 font-bold">4</span>
              </div>
              <div>
                <h4 class="font-bold text-lg mb-2">Get rewarded</h4>
                <p class="opacity-70">We'll review and respond within 48 hours. Valid reports receive rewards via Lightning!</p>
              </div>
            </div>
          </div>

          <div class="mt-8 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
            <p class="text-center text-sm opacity-80">
              ⚡ All bounties are paid instantly via Lightning Network
            </p>
          </div>
        </div>
      </div>

      <!-- Rules -->
      <div class="mt-12 text-center">
        <p class="text-sm opacity-60 max-w-3xl mx-auto">
          By participating, you agree to responsible disclosure. Do not publicly disclose vulnerabilities 
          until we've had time to patch them. We commit to fixing critical issues within 30 days.
        </p>
      </div>
    </div>
  </section>
{/if}

<style>
  .premium-card {
    @apply p-6 rounded-2xl;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
  }

  .cyber-grid {
    background-image: linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
    background-size: 50px 50px;
  }
</style>