<script>
  import { onMount } from "svelte";
  import { fly, fade } from "svelte/transition";

  let mounted = $state(false);
  let activeTab = $state("beginner");

  const resources = {
    beginner: {
      title: "Start Your Bitcoin Journey",
      icon: "🚀",
      items: [
        {
          title: "Bitcoin.org",
          description: "Official Bitcoin website - start here for the basics",
          url: "https://bitcoin.org",
          icon: "cryptocurrency:btc",
        },
        {
          title: "The Bitcoin Standard",
          description: "Essential book by Saifedean Ammous on Bitcoin economics",
          url: "https://saifedean.com/thebitcoinstandard",
          icon: "ph:book-bold",
        },
        {
          title: "Bitcoin Magazine",
          description: "Latest news, analysis, and educational content",
          url: "https://bitcoinmagazine.com",
          icon: "ph:newspaper-bold",
        },
        {
          title: "What is Lightning?",
          description: "Learn about instant Bitcoin payments via Lightning",
          url: "https://lightning.network",
          icon: "ph:lightning-bold",
        },
      ],
    },
    intermediate: {
      title: "Deepen Your Knowledge",
      icon: "📚",
      items: [
        {
          title: "Andreas Antonopoulos",
          description: "Technical talks and 'Mastering Bitcoin' book series",
          url: "https://aantonop.com",
          icon: "ph:youtube-logo-bold",
        },
        {
          title: "Lightning Labs Documentation",
          description: "Deep dive into Lightning Network technology",
          url: "https://docs.lightning.engineering",
          icon: "ph:file-text-bold",
        },
        {
          title: "Lightning Dev Kit",
          description: "Build custom Lightning Network applications",
          url: "https://lightningdevkit.org",
          icon: "ph:code-bold",
        },
        {
          title: "Bitcoin Optech",
          description: "Technical Bitcoin newsletter and resources",
          url: "https://bitcoinops.org",
          icon: "ph:gear-bold",
        },
      ],
    },
    community: {
      title: "Join the Community",
      icon: "🌍",
      items: [
        {
          title: "r/Bitcoin Reddit",
          description: "Active community discussions and Q&A",
          url: "https://reddit.com/r/bitcoin",
          icon: "ph:reddit-logo-bold",
        },
        {
          title: "Bitcoin Talk Forum",
          description: "Original Bitcoin forum since 2009",
          url: "https://bitcointalk.org",
          icon: "ph:chat-circle-bold",
        },
        {
          title: "Local Bitcoin Meetups",
          description: "Find Bitcoin events and meetups near you",
          url: "https://www.meetup.com/topics/bitcoin",
          icon: "ph:users-bold",
        },
      ],
    },
  };

  const concepts = [
    {
      term: "Satoshi",
      definition: "The smallest unit of Bitcoin (0.00000001 BTC), named after Bitcoin's creator",
      emoji: "🪙",
    },
    {
      term: "Private Keys",
      definition: "Your secret password that controls your Bitcoin - never share it!",
      emoji: "🔑",
    },
    {
      term: "Seed Phrase",
      definition: "12-24 words that backup your wallet - write it down and keep it safe",
      emoji: "📝",
    },
    {
      term: "HODL",
      definition: "Hold On for Dear Life - the strategy of long-term Bitcoin saving",
      emoji: "💎",
    },
    {
      term: "Lightning Invoice",
      definition: "A payment request on Lightning Network for instant Bitcoin transfers",
      emoji: "⚡",
    },
    {
      term: "Self-Custody",
      definition: "You control your Bitcoin keys, not an exchange - true ownership",
      emoji: "🔐",
    },
  ];

  onMount(() => {
    mounted = true;
  });
</script>

{#if mounted}
  <section id="education" class="relative py-32">
    <div class="container mx-auto px-4 relative z-10">
      <!-- Header -->
      <div class="text-center mb-16" in:fly={{ y: 30, duration: 800 }}>
        <h2 class="text-5xl md:text-6xl font-bold mb-4">
          <span class="bg-gradient-to-r from-dgen-aqua to-dgen-cyan bg-clip-text text-transparent">
            LEARN ABOUT CRYPTO
          </span>
        </h2>
        <p class="text-2xl opacity-80 max-w-3xl mx-auto">
          Your journey into the future of money starts here. From basics to
          advanced concepts, we've curated some great resources.
        </p>
      </div>

      <!-- Resource Tabs -->
      <div class="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-12 px-4" in:fly={{ y: 20, duration: 600, delay: 200 }}>
        {#each Object.entries(resources) as [key, section]}
          <button
            class="glass px-4 sm:px-6 py-3 rounded-full border-2 transition-all duration-300 text-sm sm:text-base {activeTab === key
              ? 'border-dgen-aqua bg-dgen-aqua/20 text-dgen-aqua scale-105'
              : 'border-white/10 hover:border-dgen-cyan/30'}"
            onclick={() => (activeTab = key)}
          >
            <span class="mr-2">{section.icon}</span>
            <span class="whitespace-nowrap">{section.title}</span>
          </button>
        {/each}
      </div>

      <!-- Resource Grid -->
      <div class="max-w-6xl mx-auto mb-20">
        {#key activeTab}
          <div class="grid md:grid-cols-2 gap-6" in:fly={{ x: 0, y: 20, duration: 400 }}>
            {#each resources[activeTab].items as resource, i}
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                class="group"
              >
                <div
                  class="premium-card border-2 border-white/10 hover:border-dgen-aqua/50 transition-all duration-300 hover:scale-105 h-full"
                  in:fly={{ y: 20, duration: 400, delay: 100 * i }}
                >
                  <div class="flex items-start gap-4 h-full">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-dgen-aqua to-dgen-cyan flex items-center justify-center flex-shrink-0">
                      <iconify-icon
                        icon={resource.icon}
                        width="24"
                        class="text-black"
                      ></iconify-icon>
                    </div>
                    <div class="flex-1 flex flex-col">
                      <h3 class="text-xl font-bold mb-2 group-hover:text-dgen-aqua transition-colors">
                        {resource.title}
                        <iconify-icon
                          icon="ph:arrow-up-right-bold"
                          width="16"
                          class="inline ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        ></iconify-icon>
                      </h3>
                      <p class="opacity-70 text-sm leading-relaxed">{resource.description}</p>
                    </div>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        {/key}
      </div>

      <!-- Key Concepts -->
      <div class="max-w-6xl mx-auto" in:fly={{ y: 30, duration: 800, delay: 400 }}>
        <h3 class="text-3xl font-bold mb-8 text-center">
          <span class="bg-gradient-to-r from-dgen-cyan to-dgen-aqua bg-clip-text text-transparent">
            Essential Bitcoin Terms
          </span>
        </h3>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each concepts as concept, i}
            <div
              class="glass p-6 rounded-2xl border border-white/10 hover:border-dgen-cyan/30 transition-all duration-300"
              in:fly={{ y: 20, duration: 400, delay: 50 * i }}
            >
              <div class="flex items-start gap-3">
                <span class="text-2xl">{concept.emoji}</span>
                <div>
                  <h4 class="font-bold text-dgen-aqua mb-1">{concept.term}</h4>
                  <p class="text-sm opacity-70">{concept.definition}</p>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- CTA -->
      <div class="text-center mt-16" in:fly={{ y: 30, duration: 800, delay: 600 }}>
        <div class="glass inline-block p-8 rounded-3xl border border-dgen-aqua/20">
          <h3 class="text-2xl font-bold mb-4">Ready to start?</h3>
          <p class="opacity-80 mb-6">
            Join thousands using DGEN to experience the Lightning Network
          </p>
          <div class="flex flex-col gap-4 justify-center items-center px-4">
            <a href="/register" class="w-full sm:w-auto">
              <button class="btn bg-gradient-to-r from-dgen-aqua to-dgen-cyan text-black font-bold hover:scale-105 transition-transform w-full sm:w-auto">
                Create Account
              </button>
            </a>
            <a href="https://t.me/dgentech" target="_blank" rel="noopener noreferrer" class="w-full sm:w-auto">
              <button class="btn glass border-2 border-dgen-cyan/30 hover:border-dgen-cyan font-bold hover:scale-105 transition-transform w-full sm:w-auto">
                <iconify-icon icon="ph:telegram-logo-bold" width="20" class="mr-2"></iconify-icon>
                <span class="whitespace-nowrap">Join us on Telegram</span>
              </button>
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
{/if}

<style>
  .cyber-grid {
    background-image: linear-gradient(
        rgba(116, 235, 213, 0.1) 1px,
        transparent 1px
      ),
      linear-gradient(90deg, rgba(116, 235, 213, 0.1) 1px, transparent 1px);
    background-size: 50px 50px;
  }

  .premium-card {
    @apply p-6 rounded-2xl;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);
  }

  .glass {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
  }
</style>