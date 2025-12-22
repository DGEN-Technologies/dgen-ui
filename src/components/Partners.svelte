<script>
  import { fade, fly } from "svelte/transition";
</script>

<section id="partners" class="relative py-24">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
    <div class="text-center mb-12" in:fly={{ y: 30, duration: 600 }}>
      <h2
        class="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 heading-condensed"
      >
        <span
          class="bg-gradient-to-r from-dgen-aqua to-dgen-cyan bg-clip-text text-transparent"
        >
          Partners
        </span>
      </h2>
      <p class="text-lg sm:text-xl md:text-2xl opacity-80 max-w-2xl mx-auto">
        Building DGEN together with leading infrastructure and security
        partners.
      </p>
    </div>

    <div
      class="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10 items-stretch"
      in:fade={{ duration: 500, delay: 150 }}
    >
      <!-- Breez -->
      <div
        class="premium-card border-2 border-white/10 hover:border-dgen-cyan/50 transition-all duration-300 flex items-center gap-4 sm:gap-6"
      >
        <div
          class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center"
        >
          <!-- Breez logo is loaded from their site; replace with local asset if provided -->
          <img
            src="/Breez_logo.jpg"
            alt="Breez"
            class="max-w-[70%] max-h-[70%] object-contain"
          />
        </div>
        <div class="flex-1">
          <div
            class="text-sm uppercase tracking-[0.2em] text-white/60 mb-1 heading-condensed"
          >
            Partner
          </div>
          <h3 class="text-2xl font-bold text-white mb-1">Breez</h3>
          <p class="text-sm text-white/70">
            Non-custodial Lightning infrastructure powering instant crypto
            payments.
          </p>
        </div>
      </div>

      <!-- PrivKey -->
      <div
        class="premium-card border-2 border-white/10 hover:border-dgen-aqua/60 transition-all duration-300 flex items-center gap-4 sm:gap-6 bg-white/5"
      >
        <div
          class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-white/40 flex items-center justify-center"
        >
          <div
            class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center"
          >
            <img
              src="/PrivKey_logo.png"
              alt="PrivKey_logo.png"
              class="max-w-[70%] max-h-[70%] object-contain"
            />
          </div>
        </div>
        <div class="flex-1">
          <div
            class="text-sm uppercase tracking-[0.2em] text-white/70 mb-1 heading-condensed"
          >
            Security Partner
          </div>
          <h3 class="text-2xl font-bold text-white mb-1 heading-condensed">
            PrivKey
          </h3>
          <p class="text-sm text-white/80">
            White-label key security & recovery partner. Font and logo rendered
            fully in white as requested.
          </p>
        </div>
      </div>
    </div>
  </div>
</section>
