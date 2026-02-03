<script>
  import { fade, fly } from "svelte/transition";
</script>

<section id="partners" class="relative py-10">
  <div class="container mx-auto px-2 sm:px-4 lg:px-6 relative z-10">
    <div class="text-center mb-12" in:fly={{ y: 30, duration: 600 }}>
      <h2
        class="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 heading-condensed"
      >
        <span
          class="bg-gradient-to-r from-dgen-aqua to-dgen-cyan bg-clip-text text-transparent"
        >
          WHO WE WORK WITH
        </span>
      </h2>
    </div>

    <div
      class="max-w-4xl mx-auto flex flex-col gap-6 sm:gap-10 items-stretch"
      in:fade={{ duration: 500, delay: 150 }}
    >
      <div class="flex flex-col sm:flex-row gap-6 sm:gap-10 items-stretch">
        <!-- Breez -->
        <div
          class="sm:w-1/2 premium-card group flex items-start gap-2 sm:gap-4
         border-2 border-white/10 bg-white/5
         rounded-2xl p-3
         transition-all duration-300
         hover:border-dgen-cyan/50 hover:bg-white/10"
        >
          <!-- Logo -->
          <div
            class="w-10 h-10 sm:w-16 sm:h-16
           rounded-xl
           sm:rounded-2xl
           bg-black/30
           border border-white/20
           flex items-center justify-center"
          >
            <img
              src="/Breez_logo.jpeg"
              alt="Breez"
              class="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl"
            />
          </div>

          <!-- Content -->
          <div class="flex-1">
            <h3 class="text-base sm:text-xl font-bold text-white mb-1">
              Breez
            </h3>
            <p class="text-xs sm:text-sm text-white/70 leading-relaxed">
              Non-custodial infrastructure providers with a focus is on
              empowering developers to bring self-sovereign Bitcoin
              functionality to global users.
            </p>
          </div>
        </div>

        <!-- PrivKey -->
        <div
          class="sm:w-1/2 premium-card group flex items-start gap-2 sm:gap-4
         border-2 border-white/10 bg-white/5
         rounded-2xl p-3
         transition-all duration-300
         hover:border-dgen-aqua/60 hover:bg-white/10"
        >
          <!-- Logo -->
          <div
            class="w-10 h-10 sm:w-16 sm:h-16
           rounded-xl
           sm:rounded-2xl
           bg-black/30
           border border-white/20
           flex items-center justify-center"
          >
            <img
              src="/PrivKey_logo.png"
              alt="PrivKey"
              class="rounded-xl sm:rounded-2xl"
            />
          </div>

          <!-- Content -->
          <div class="flex-1">
            <h3
              class="text-base sm:text-xl font-bold text-white mb-1 heading-condensed"
            >
              PrivKey
            </h3>
            <p class="text-xs sm:text-sm text-white/80 leading-relaxed">
              Advanced Full-Stack Developers with over 35 years of experience.
            </p>
          </div>
        </div>
      </div>
      <!-- Swap Space -->
      <div class="flex flex-col sm:flex-row gap-6 sm:gap-10 items-stretch">
        <div
          class="sm:w-1/2 sm:mx-auto premium-card group flex items-start gap-2 sm:gap-4
         border-2 border-white/10 bg-white/5
         rounded-2xl p-3
         transition-all duration-300
         hover:border-dgen-cyan/50 hover:bg-white/10"
        >
          <!-- Logo -->
          <div
            class="w-10 h-10 sm:w-16 sm:h-16
           rounded-xl
           sm:rounded-2xl
           bg-black/30
           border border-white/20
           flex items-center justify-center"
          >
            <img
              src="/Swap_space_logo.png"
              alt="Swap Space"
              class="rounded-xl sm:rounded-2xl"
            />
          </div>

          <!-- Content -->
          <div class="flex-1">
            <h3 class="text-base sm:text-xl font-bold text-white mb-1">
              Swap Space
            </h3>
            <p class="text-xs sm:text-sm text-white/70 leading-relaxed">
              Liquidity/Exchange Aggregator.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
