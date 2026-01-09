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
          WHO WE WORK WITH
        </span>
      </h2>      
    </div>

    <div
      class="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10 items-stretch"
      in:fade={{ duration: 500, delay: 150 }}
    >
      <!-- Breez -->
      <div
        class="premium-card group flex items-center gap-5 sm:gap-6
         border-2 border-white/10 bg-white/5
         rounded-2xl p-6
         transition-all duration-300
         hover:border-dgen-cyan/50 hover:bg-white/10"
      >
        <!-- Logo -->
        <div
          class="w-16 h-16 sm:w-20 sm:h-20
           rounded-2xl
           bg-black/30
           border border-white/20
           flex items-center justify-center"
        >
          <img
            src="/Breez_logo.jpeg"
            alt="Breez"
            class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl"
          />
        </div>

        <!-- Content -->
        <div class="flex-1">
          <h3 class="text-xl sm:text-2xl font-bold text-white mb-1">Breez</h3>
          <p class="text-sm sm:text-base text-white/70 leading-relaxed">
            Non-custodial Lightning infrastructure powering instant crypto
            payments.
          </p>
        </div>
      </div>

      <!-- PrivKey -->
      <div
        class="premium-card group flex items-center gap-5 sm:gap-6
         border-2 border-white/10 bg-white/5
         rounded-2xl p-6
         transition-all duration-300
         hover:border-dgen-aqua/60 hover:bg-white/10"
      >
        <!-- Logo -->
        <div
          class="w-16 h-16 sm:w-20 sm:h-20
           rounded-2xl
           bg-black/30
           border border-white/20
           flex items-center justify-center"
        >
          <img
            src="/PrivKey_logo.png"
            alt="PrivKey"
            class="max-w-[70%] max-h-[70%] object-contain"
          />
        </div>

        <!-- Content -->
        <div class="flex-1">
          <h3
            class="text-xl sm:text-2xl font-bold text-white mb-1 heading-condensed"
          >
            PrivKey
          </h3>
          <p class="text-sm sm:text-base text-white/80 leading-relaxed">
            Expert Full-Stack Developers
          </p>
        </div>
      </div>
    </div>
  </div>
</section>
