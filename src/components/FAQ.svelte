<script>
  import { onMount } from "svelte";
  import { fly, fade, slide } from "svelte/transition";

  let mounted = $state(false);
  let activeQuestion = $state(null);
  let searchQuery = $state("");

  const faqs = [
    // Beginner-friendly questions first
    {
      id: "bitcoin-basics",
      category: "Education",
      question: "What is Bitcoin?",
      answer:
        "Bitcoin is decentralized digital money - no banks or governments control it. Created in 2009, it uses blockchain technology to enable peer-to-peer transactions. With a fixed supply of 21 million coins, it's designed to be scarce, secure, and accessible to everyone globally.",
      icon: "ph:bitcoin-bold",
      emoji: "₿",
    },
    {
      id: "lightning-basics",
      category: "Education",
      question: "What is the Lightning Network?",
      answer:
        "Lightning is Bitcoin's layer-2 scaling solution enabling instant, nearly-free micropayments. It creates payment channels between users, allowing thousands of transactions per second while maintaining Bitcoin's security. Perfect for everyday purchases and streaming payments.",
      icon: "ph:lightning-bolt",
      emoji: "⚡",
    },
    {
      id: "fees",
      category: "Money",
      question: "How much does DGEN cost?",
      answer:
        "DGEN is completely free to use. You only pay minimal Lightning Network fees (typically less than a penny per transaction). Our mission is to grow the Bitcoin ecosystem.",
      icon: "ph:currency-circle-dollar-bold",
      emoji: "💸",
    },
    {
      id: "self-custody",
      category: "Education",
      question: "What is self-custody?",
      answer:
        "Self-custody means YOU control your Bitcoin's private keys - not an exchange or bank. 'Not your keys, not your coins' is the golden rule. With DGEN, your seed phrase gives you complete ownership. No one else can access, freeze, or confiscate your funds.",
      icon: "ph:vault-bold",
      emoji: "🔐",
    },
    {
      id: "custody",
      category: "Security",
      question: "Who controls my Bitcoin?",
      answer:
        "You maintain complete control. With self-custody options, only you have access to your private keys. We cannot access your funds - that's the security of true ownership.",
      icon: "ph:key-bold",
      emoji: "🔑",
    },
    {
      id: "backup",
      category: "Security",
      question: "What if I lose my phone?",
      answer:
        "Your 12-word seed phrase allows complete wallet recovery. Store it securely offline - written down or engraved in steel. Never share it with anyone.",
      icon: "ph:cloud-arrow-up-bold",
      emoji: "☁️",
    },
    {
      id: "speed",
      category: "Tech",
      question: "How fast is Lightning really?",
      answer:
        "Lightning payments typically settle in under 300ms - that's 10x faster than traditional card networks. Experience the speed of modern payment technology.",
      icon: "ph:lightning-bold",
      emoji: "⚡",
    },
    {
      id: "comparison",
      category: "DGEN",
      question: "Why DGEN over other wallets?",
      answer:
        "Built by Bitcoin enthusiasts for the community. No data harvesting, no hidden fees, complete transparency. Features include atomic swaps, submarine swaps, and cutting-edge Lightning technology.",
      icon: "ph:rocket-bold",
      emoji: "🚀",
    },
    {
      id: "learn",
      category: "Education",
      question: "Where can I learn about Bitcoin?",
      answer:
        '<a href="https://bitcoin.org" target="_blank" class="text-dgen-aqua hover:underline">Bitcoin.org</a> for basics, Andreas Antonopoulos\' \'Mastering Bitcoin\' for technical depth, or <a href="https://bitcoinmagazine.com" target="_blank" class="text-dgen-aqua hover:underline">Bitcoin Magazine</a> for news. For Lightning, check out <a href="https://docs.lightning.engineering" target="_blank" class="text-dgen-aqua hover:underline">Lightning Labs docs</a> and <a href="https://breez.technology" target="_blank" class="text-dgen-aqua hover:underline">Breez\'s educational content</a>. Join communities on Bitcoin Twitter and <a href="https://reddit.com/r/Bitcoin" target="_blank" class="text-dgen-aqua hover:underline">Reddit r/Bitcoin</a>.',
      icon: "ph:book-open-bold",
      emoji: "📚",
    },
    {
      id: "resources",
      category: "Education",
      question: "Best Bitcoin learning resources?",
      answer:
        'Beginners: Start with <a href="https://bitcoin.org" target="_blank" class="text-dgen-aqua hover:underline">Bitcoin.org</a>, \'The Bitcoin Standard\' book, and <a href="https://bitcoinmagazine.com" target="_blank" class="text-dgen-aqua hover:underline">Bitcoin Magazine</a>. Technical: Andreas Antonopoulos videos, <a href="https://docs.lightning.engineering" target="_blank" class="text-dgen-aqua hover:underline">Lightning Labs docs</a>, <a href="https://sdk-doc-liquid.breez.technology" target="_blank" class="text-dgen-aqua hover:underline">Breez SDK documentation</a>. Communities: Bitcoin Twitter, <a href="https://reddit.com/r/Bitcoin" target="_blank" class="text-dgen-aqua hover:underline">r/Bitcoin</a>, Bitcoin Talk forums, and local Bitcoin meetups.',
      icon: "ph:graduation-cap-bold",
      emoji: "🎓",
    },
    // More technical questions at the bottom
    {
      id: "business",
      category: "Business",
      question: "Can businesses use DGEN?",
      answer:
        "Absolutely. Generate invoices, QR codes, and integrate with our API. Accept Bitcoin globally with zero chargeback risk and simplified accounting.",
      icon: "ph:storefront-bold",
      emoji: "🏪",
    },
    {
      id: "channels",
      category: "Tech",
      question: "Do I need to manage channels?",
      answer:
        'No! DGEN uses Breez SDK Liquid - a next-generation Lightning solution that eliminates channel management entirely. No channel opening, no rebalancing, no liquidity concerns. Just instant payments that work every time. Learn more at <a href="https://sdk-doc-liquid.breez.technology" target="_blank" class="text-dgen-aqua hover:underline">Breez SDK Liquid Documentation</a>',
      icon: "ph:cpu-bold",
      emoji: "🤖",
    },
    {
      id: "liquid",
      category: "Tech",
      question: "What is Liquid Network?",
      answer:
        "Liquid is Bitcoin's confidential sidechain. Faster 2-minute blocks, confidential transactions, perfect for trading and high-value transfers. Peg Bitcoin in/out seamlessly.",
      icon: "ph:drop-bold",
      emoji: "💧",
    },
  ];

  const categories = [...new Set(faqs.map((f) => f.category))].sort();
  let selectedCategory = $state("All");

  const filteredFaqs = $derived(() => {
    let filtered = faqs;

    if (selectedCategory !== "All") {
      filtered = filtered.filter((f) => f.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (f) =>
          f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.answer.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    return filtered;
  });

  onMount(() => {
    mounted = true;
  });
</script>

{#if mounted}
  <section id="faq" class="relative py-32">
    <div class="container mx-auto px-4 relative z-10">
      <div class="text-center mb-16" in:fly={{ y: 30, duration: 800 }}>
        <h2 class="text-5xl md:text-6xl font-bold mb-4">
          <span class="holographic">FAQ</span>
        </h2>
        <p class="text-2xl opacity-80 mb-8">
          Everything you need to know about DGEN, plus educational
          resources to learn about Crypto
        </p>

        <!-- Search Bar -->
        <div class="max-w-2xl mx-auto mb-8">
          <div class="relative group">
            <div
              class="absolute inset-0 bg-gradient-primary opacity-0 group-focus-within:opacity-20 rounded-2xl blur-xl transition-opacity duration-300"
            ></div>
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Search your question..."
              class="relative glass border-2 border-white/10 focus:border-dgen-aqua/50 transition-all duration-300 pr-12 pl-4"
            />
            <iconify-icon
              icon="ph:magnifying-glass-bold"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-white/60"
              width="20"
            ></iconify-icon>
          </div>
        </div>

        <!-- Category Filter -->
        <div class="flex flex-wrap justify-center gap-3">
          <button
            class="glass px-6 py-2 rounded-full border transition-all duration-300 {selectedCategory ===
            'All'
              ? 'border-dgen-aqua bg-dgen-aqua/20 text-dgen-aqua'
              : 'border-white/10 hover:border-white/30'}"
            onclick={() => (selectedCategory = "All")}
          >
            All
          </button>
          {#each categories as category}
            <button
              class="glass px-6 py-2 rounded-full border transition-all duration-300 {selectedCategory ===
              category
                ? 'border-dgen-aqua bg-dgen-aqua/20 text-dgen-aqua'
                : 'border-white/10 hover:border-white/30'}"
              onclick={() => (selectedCategory = category)}
            >
              {category}
            </button>
          {/each}
        </div>
      </div>

      <!-- FAQ Grid -->
      <div class="max-w-4xl mx-auto">
        {#if filteredFaqs().length === 0}
          <div class="text-center py-12 glass rounded-3xl">
            <p class="text-xl opacity-60">
              No questions found. Try a different search.
            </p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each filteredFaqs() as faq, i}
              <div
                class="premium-card border-2 transition-all duration-500 cursor-pointer {activeQuestion ===
                faq.id
                  ? 'border-dgen-aqua/60 scale-105'
                  : 'border-white/10 hover:border-white/30'}"
                onclick={(e) => {
                  // Prevent collapse when selecting text
                  if (window.getSelection().toString()) return;
                  activeQuestion = activeQuestion === faq.id ? null : faq.id;
                }}
                in:fly={{ y: 20, duration: 500, delay: 50 * i }}
              >
                <!-- Question Header -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-4 flex-1">
                    <!-- Icon -->
                    <div
                      class="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center {activeQuestion ===
                      faq.id
                        ? ''
                        : 'opacity-60'}"
                    >
                      <span class="text-2xl">{faq.emoji}</span>
                    </div>

                    <!-- Question -->
                    <div class="flex-1">
                      <p class="text-xs opacity-60 mb-1">{faq.category}</p>
                      <h3
                        class="text-lg font-bold {activeQuestion === faq.id
                          ? 'text-dgen-aqua'
                          : ''}"
                      >
                        {faq.question}
                      </h3>
                    </div>
                  </div>

                  <!-- Chevron -->
                  <div
                    class="ml-4 transition-transform duration-300 {activeQuestion ===
                    faq.id
                      ? 'rotate-180'
                      : ''}"
                  >
                    <iconify-icon
                      icon="ph:caret-down-bold"
                      width="24"
                      class="text-white/60"
                    ></iconify-icon>
                  </div>
                </div>

                <!-- Answer -->
                {#if activeQuestion === faq.id}
                  <div
                    class="mt-6 pt-6 border-t border-white/10"
                    in:slide={{ duration: 300 }}
                  >
                    <p class="text-lg opacity-80 leading-relaxed">
                      {@html faq.answer}
                    </p>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Still have questions? -->
      <!-- <div
        class="text-center mt-16"
        in:fly={{ y: 30, duration: 800, delay: 600 }}
      >
        <div class="glass inline-block p-8 rounded-3xl border border-white/10">
          <h3 class="text-2xl font-bold mb-4">Still have questions?</h3>
          <p class="opacity-80 mb-6">Our support team is available 24/7</p>
          <div class="flex justify-center">
            <a href="mailto:support@dgentech.io">
              <button
                class="btn glass px-6 py-3 md:px-8 md:py-4 font-bold hover:bg-white/10 text-base md:text-lg flex items-center gap-3"
              >
                <iconify-icon icon="ph:envelope-bold" width="20" class="md:w-6"></iconify-icon>
                <span>Email Support</span>
              </button>
            </a>
          </div>
        </div>
      </div> -->
    </div>
  </section>
{/if}
