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
        "Lightning is Bitcoin's layer-2 scaling solution enabling instant, nearly-free micropayments. It creates payment channels between users, allowing thousands of transactions per second while maintaining Bitcoin's security. Good for everyday purchases and streaming payments.",
      icon: "ph:lightning-bolt",
      emoji: "⚡",
    },
    {
      id: "fees",
      category: "Money",
      question: "How much does DGEN cost?",
      answer:
        "<p>DGEN is free to create an account. When you transact, you will sometimes pay a minimal Lightning Network routing fee (typically ranging between a penny to 50 cents per transaction, depending on market conditions), and you also will pay a 0.6% fee when transacting in and out of the wallet using the Lightning network & onchain Bitcoin network. This fee is variable depending on market conditions such as the onchain Bitcoin network fees and the Lightning Network routing fees.</p> <p>In most cases, you will not experience fees when transacting only on the Liquid network. For ex, depositing L-BTC to your DGEN wallet, and then withdrawing that same L-BTC to a different place outside of your DGEN wallet.</p> <p>For buying/selling crypto via the fiat on-ramp/off-ramp, you will incur a fee that the 3rd party fiat on-ramp/off-ramp decides which is out of DGEN’s control.</p> <p>For swapping your crypto using the swap service, you will incur a fee that the 3rd party swap service decides which is out of DGEN’s control, and DGEN will add a small 0.2% fee on top of that.</p> <p>One of the main reasons why these fees exist is to cover DGEN’s cost of operations such as running our app’s, its features & websites.</p>",
      icon: "ph:currency-circle-dollar-bold",
      emoji: "💸",
    },
    {
      id: "self-custody",
      category: "Education",
      question: "What is self-custody?",
      answer:
        "<p>DGEN Technologies Corp never custodies your crypto or fiat/dollars.</p> <p>Self-custody (non-custodial) means YOU control your Bitcoin's private keys (via your seed phrase) - not an exchange or bank.</p> <p>With this DGEN web-app, your seed phrase (key) gives you complete ownership. No one else can access, freeze, or confiscate your funds if you do not give out your seed phrase to anyone. It’s your responsibility to take care of your seed phrase and store it properly somewhere that you think is very safe and it won’t get stolen & compromised etc.</p> <p>If you prefer to not want the hassle of managing your own seed phrase “keys’ and prefer a custodial solution (like an exchange for example) you can use our DGEN CARD app which is custodial - <a href='https://card.dgentech.io' target='_blank' rel='noopener noreferrer' class='text-dgen-aqua hover:underline'>card.dgentech.io</a></p> <p>For examples and extra information of what custodial and non-custodial means, we highly recommend you doing your own research to understand these things, before using DGEN’s apps & products.</p>",
      icon: "ph:vault-bold",
      emoji: "🔐",
    },
    {
      id: "custody",
      category: "Security",
      question: "Who controls my Bitcoin?",
      answer:
        "<p>With self-custody options, only you have access to your private keys (seed phrase). This DGEN wallet web-app cannot access your funds - that's the security of true ownership.</p><p> The DGEN CARD app is different, you can view the details on that website if you want.</p>",
      icon: "ph:key-bold",
      emoji: "🔑",
    },
    {
      id: "backup",
      category: "Security",
      question: "What if I lose access to my phone or computer?",
      answer:
        "Your 12-word seed phrase allows complete wallet recovery of all your funds in your DGEN wallet. Store it securely offline - written down or engraved in steel. Never share it with anyone. If you lose access to your phone or computer that had your DGEN wallet web-app on it, then you can recover all your funds on any other device, (new or used) by importing your seed phrase. Never share your seed phrase with anyone and make sure you take good care of it.",
      icon: "ph:cloud-arrow-up-bold",
      emoji: "☁️",
    },
    {
      id: "swap",
      category: "Swapping",
      question: "How does the swap feature work?",
      answer:
        "<p>The swap feature allows you to exchange one cryptocurrency for another directly within the wallet (even if they are completely different networks).</p> <ol class='pl-5'> <li>1. Select the crypto to send and the one to receive.</li> <li>2. Enter the amount – you'll see competitive rates aggregated from exchanges. You can potentially be getting the best swapping/exchange price/rate that is available on the whole market with using this feature.</li> <li>3. Provide your receiving wallet address (also the swap refund wallet address in the case of the swap failing, which can happen outside of DGEN’s control).</li> <li>4. Send the funds to the provided deposit address.</li> <li>5. SAVE YOUR EXCHANGE ID. This Exchange ID would be used in the case of your swap failing and you didn’t provide your refund address. Or, if your swap is taking more than 24 hours, then you can send a message to our live chat and request support. Without you having your Exchange ID, DGEN can not guarantee that you will recover your funds.</li> <li class='flex flex-col'><span>Example of Point 5 :-</span><img src='/images/FAQ-swap.png' alt='Swap Exchange ID example' class='rounded-lg' loading='lazy' /></li> </ol> <p>The exchange/swap feature is done by a 3rd party and DGEN is not the custodian of any of your cryptocurrency that you wish to swap.</p> <p>Swap/Exchange Processing typically completes in minutes to an hour (or more), depending on network conditions & market congestion, which DGEN has zero control over.</p>",
      icon: "uiw:swap",
      emoji: "🔁",
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
        "<p>Built by Bitcoin enthusiasts. Features accessible on the DGEN web-app include atomic swaps, submarine swaps, cross-chain swaps with 3,500 coins across almost all the main blockchains, cutting-edge Lightning & Liquid technology, Non-custodial, and the DGEN CARD app which is a crypto card that can be used internationally (more info on the DGEN CARD app at <a href='https://card.dgentech.io' target='_blank' rel='noopener noreferrer' class='text-dgen-aqua hover:underline'>card.dgentech.io</a>).</p> <p>There are not many crypto wallets/apps on the market that have all these value points together.</p>",
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
        "<p>Yes, businesses may accept cryptocurrency payments wherever such transactions are legally permitted and the business complies fully with applicable regulations and laws.</p><p>Features include:</p> <ul class='pl-5'> <li>• Full access to DGEN web app functionality: depositing, withdrawing, cross-chain swapping, and more.</li> <li>• Generating invoices and QR codes for payments for goods & services.</li> <li>• API integration for seamless processing.</li> <li>• Zero chargeback risk and simplified accounting with Bitcoin and supported cryptocurrencies.</li> <li>• This app would then potentially become another asset owned by your company potentially generating more revenue, especially with offering more options for your customers to pay you.</li></ul> <p>Additionally, businesses (or individuals) can white-label a customized version of the DGEN CARD app.</p> <p>DGEN does not provide business advice, tax advice, financial advice in any way. Consult a licenced professional that you trust if you want advice on anything being said here.</p>",
      icon: "ph:storefront-bold",
      emoji: "🏪",
    },
    {
      id: "channels",
      category: "Tech",
      question: "Do I need to manage channels?",
      answer:
        "<p>No 😊. DGEN uses Breez SDK - which eliminates channel management entirely. No channel opening, no rebalancing, and no liquidity balancing needed to be done when you are using the DGEN apps.</p> <p>For technical users, you can learn more at <a href='https://sdk-doc-liquid.breez.technology/' target='_blank' rel='noopener noreferrer' class='text-dgen-aqua hover:underline'>Breez SDK Liquid Documentation</a></p>",
      icon: "ph:cpu-bold",
      emoji: "🤖",
    },
    {
      id: "liquid",
      category: "Tech",
      question: "What is Liquid Network?",
      answer:
        "Liquid is a Bitcoin sidechain. Fast 2-minute blocks/transactions, and can peg Bitcoin in/out between networks.",
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
          Everything you need to know about DGEN, plus educational resources to
          learn about Crypto
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
