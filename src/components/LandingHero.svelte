<script>
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";

  let mounted = $state(false);
  let reduceFx = $state(false);

  onMount(() => {
    mounted = true;
    if (browser) {
      const ua = navigator.userAgent || "";
      const platform = navigator.userAgentData?.platform || "";
      const isAndroid = /Android/i.test(ua) || /Android/i.test(platform);
      const prefersReduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      )?.matches;
      if (isAndroid || prefersReduced) {
        reduceFx = true;
      }
    }
  });
</script>

<div class="relative sm:min-h-screen" class:reduceFx>
  <!-- Liquid light network background (pure SVG + CSS, no JS, decorative only) -->
  <div class="dg-hero-bg" aria-hidden="true">
    <div class="dg-hero-mask">
      <div class="dg-fl dg-hero-float">
        <svg
          viewBox="0 0 1440 1000"
          preserveAspectRatio="xMidYMid slice"
          width="100%"
          height="100%"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient
              id="dgLine"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="1440"
              y2="0"
              ><stop offset="0" stop-color="#7DE3CF" /><stop
                offset=".5"
                stop-color="#A79CE6"
              /><stop offset="1" stop-color="#7DE3CF" /></linearGradient
            >
            <radialGradient id="dgGlow"
              ><stop offset="0" stop-color="#7DE3CF" stop-opacity=".45" /><stop
                offset="1"
                stop-color="#7DE3CF"
                stop-opacity="0"
              /></radialGradient
            >
          </defs>
          <g
            fill="#FFFFFF"
            fill-opacity=".05"
            font-family="Inter,sans-serif"
            font-weight="600"
            font-size="190"
            ><text x="40" y="790">₿</text><text x="1180" y="810">₮</text></g
          >
          <g
            stroke="url(#dgLine)"
            stroke-width="1"
            stroke-opacity=".34"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M90 180L210 120L330 230L290 400L380 560L220 540L70 470L150 330L90 180M150 330L330 230M150 330L290 400M290 400L220 540"
            />
            <path
              d="M1360 160L1230 110L1110 250L1140 420L1070 580L1230 560L1380 480L1290 330L1360 160M1290 330L1110 250M1290 330L1140 420M1140 420L1230 560"
            />
            <path
              stroke-opacity=".16"
              d="M210 120L560 70L720 40L880 80L1230 110"
            />
          </g>
          <g fill="url(#dgGlow)"
            ><circle cx="210" cy="120" r="16" /><circle
              cx="290"
              cy="400"
              r="16"
            /><circle cx="70" cy="470" r="16" /><circle
              cx="1230"
              cy="110"
              r="16"
            /><circle cx="1140" cy="420" r="16" /><circle
              cx="1380"
              cy="480"
              r="16"
            /><circle cx="720" cy="40" r="16" /></g
          >
          <g fill="#7DE3CF" fill-opacity=".85"
            ><circle cx="90" cy="180" r="2.6" /><circle
              cx="330"
              cy="230"
              r="2.6"
            /><circle cx="290" cy="400" r="2.6" /><circle
              cx="220"
              cy="540"
              r="2.6"
            /><circle cx="1360" cy="160" r="2.6" /><circle
              cx="1110"
              cy="250"
              r="2.6"
            /><circle cx="1230" cy="560" r="2.6" /><circle
              cx="1290"
              cy="330"
              r="2.6"
            /><circle cx="720" cy="40" r="2.6" /></g
          >
          <g fill="#A79CE6" fill-opacity=".85"
            ><circle cx="210" cy="120" r="2.6" /><circle
              cx="150"
              cy="330"
              r="2.6"
            /><circle cx="70" cy="470" r="2.6" /><circle
              cx="380"
              cy="560"
              r="2.6"
            /><circle cx="1230" cy="110" r="2.6" /><circle
              cx="1140"
              cy="420"
              r="2.6"
            /><circle cx="1380" cy="480" r="2.6" /><circle
              cx="1070"
              cy="580"
              r="2.6"
            /><circle cx="560" cy="70" r="2.6" /><circle
              cx="880"
              cy="80"
              r="2.6"
            /></g
          >
          <g stroke-width="1.2" stroke-linejoin="round">
            <polygon
              points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
              transform="translate(1190 640) scale(11)"
              vector-effect="non-scaling-stroke"
              stroke="#7DE3CF"
              stroke-opacity=".26"
            />
            <polygon
              points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
              transform="translate(70 600) scale(7)"
              vector-effect="non-scaling-stroke"
              stroke="#A79CE6"
              stroke-opacity=".26"
            />
          </g>
        </svg>
      </div>
    </div>
    <div class="dg-w1 dg-wave">
      <svg
        viewBox="0 0 2880 260"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs
          ><linearGradient id="dgW1" x1="0" y1="0" x2="0" y2="1"
            ><stop offset="0" stop-color="#7DE3CF" stop-opacity=".16" /><stop
              offset="1"
              stop-color="#7DE3CF"
              stop-opacity="0"
            /></linearGradient
          ></defs
        >
        <path
          d="M0 70C180 10 540 130 720 70C900 10 1260 130 1440 70C1620 10 1980 130 2160 70C2340 10 2700 130 2880 70V260H0Z"
          fill="url(#dgW1)"
        />
        <path
          d="M0 70C180 10 540 130 720 70C900 10 1260 130 1440 70C1620 10 1980 130 2160 70C2340 10 2700 130 2880 70"
          stroke="#7DE3CF"
          stroke-opacity=".3"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>
    <div class="dg-w2 dg-wave dg-wave-2">
      <svg
        viewBox="0 0 2880 260"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs
          ><linearGradient id="dgW2" x1="0" y1="0" x2="0" y2="1"
            ><stop offset="0" stop-color="#A79CE6" stop-opacity=".14" /><stop
              offset="1"
              stop-color="#A79CE6"
              stop-opacity="0"
            /></linearGradient
          ></defs
        >
        <path
          d="M0 110C240 50 480 170 720 110C960 50 1200 170 1440 110C1680 50 1920 170 2160 110C2400 50 2640 170 2880 110V260H0Z"
          fill="url(#dgW2)"
        />
        <path
          d="M0 110C240 50 480 170 720 110C960 50 1200 170 1440 110C1680 50 1920 170 2160 110C2400 50 2640 170 2880 110"
          stroke="#A79CE6"
          stroke-opacity=".26"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>
  </div>

  <!-- Content -->
  <div class="relative z-10 flex flex-col items-center justify-start px-4">
    <!-- Disclaimer -->
    <div
      class="text-center px-4 mt-24 sm:mt-28"
      in:fly={{ y: 20, duration: 800, delay: 900 }}
    >
      <div class="dg-chip inline-block">
        <p class="font-medium text-sm sm:text-base">
          ⚠️ This website/app is in Beta and not finalized. Use at your own
          risk.
        </p>
      </div>
    </div>
    {#if mounted}
      <!-- Logo with epic glow effect -->
      <div class="relative" in:fade={{ duration: 800, delay: 200 }}>
        <div class="relative pointer-events-none">
          <div
            class="absolute inset-0 bg-gradient-to-r from-dgen-aqua/30 to-dgen-cyan/30 blur-3xl opacity-40"
          ></div>
          <div
            class="absolute inset-0 bg-gradient-to-r from-dgen-cyan/20 to-dgen-purple/20 blur-2xl opacity-20 scale-110 animate-pulse"
          ></div>
          <img
            src="/images/dgen-logo-white.svg"
            alt="DGEN Logo"
            class="relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 floating pointer-events-auto"
          />
        </div>
        <!-- Lightning bolt positioned close under logo -->
        <div
          class="absolute left-1/2 transform -translate-x-1/2 pointer-events-none"
          style="bottom: 1rem;"
        >
          <div class="relative inline-block sm:bottom-4">
            <div
              class="absolute inset-0 bg-yellow-400/30 blur-xl opacity-40 animate-pulse"
            ></div>
            <span
              class="relative animate-pulse text-3xl sm:text-4xl md:text-5xl drop-shadow-2xl"
              style="color: #ffd700; filter: drop-shadow(0 0 20px #ffd700);"
              >⚡</span
            >
          </div>
        </div>
      </div>

      <!-- Headline -->
      <h1
        class="dg-hero-title mb-8 px-2 w-full text-center"
        in:fly={{ y: 30, duration: 800, delay: 400 }}
      >
        Fintech For A New Generation
      </h1>

      <!-- Epic CTA Buttons -->
      <div
        class="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-8 items-center justify-center w-full px-4 sm:px-0"
        in:fly={{ y: 20, duration: 800, delay: 700 }}
      >
        <a href="/register" class="group">
          <button
            class="dg-cta-primary px-2 py-1 sm:px-8 sm:py-3 text-xs sm:text-lg font-bold relative overflow-hidden transition-all duration-300 w-full sm:w-auto"
          >
            <span class="relative z-10 flex items-center gap-1 sm:gap-3">
              <iconify-icon
                icon="ph:lightning-bold"
                width="12"
                class="animate-pulse sm:w-7"
              ></iconify-icon>
              Create Account
              <iconify-icon
                icon="ph:arrow-right-bold"
                width="10"
                class="group-hover:translate-x-1 sm:group-hover:translate-x-2 transition-transform sm:w-6"
              ></iconify-icon>
            </span>
          </button>
        </a>
        <a href="/login" class="group">
          <button
            class="dg-cta-ghost px-2 py-1 sm:px-8 sm:py-3 text-xs sm:text-lg font-bold transition-all duration-300 w-full sm:w-auto"
          >
            <span class="flex items-center gap-1 sm:gap-3 whitespace-nowrap">
              <iconify-icon
                icon="ph:sign-in-bold"
                width="12"
                class="flex-shrink-0 sm:w-6"
              ></iconify-icon>
              Sign In
              <iconify-icon
                icon="ph:arrow-right-bold"
                width="10"
                class="group-hover:translate-x-1 sm:group-hover:translate-x-2 transition-transform flex-shrink-0 sm:w-5"
              ></iconify-icon>
            </span>
          </button>
        </a>
      </div>

      <!-- Feature badges moved below buttons -->
      <div
        class="flex flex-wrap justify-center items-center gap-4 mb-8 sm:mb-12 max-w-4xl px-2"
        in:fly={{ y: 20, duration: 800, delay: 800 }}
      >
        <div
          class="px-5 sm:px-7 py-4 sm:py-5 flex items-center min-h-[3.5rem] flex flex-col"
        >
          <span
            class="dg-tagline font-medium text-base sm:text-xl whitespace-nowrap"
            >💎 Create Account In Seconds</span
          >
          <span class="dg-tagline font-medium text-base sm:text-xl"
            >(Literally)</span
          >
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes float {
    0%,
    100% {
      transform: translateY(0) rotate(0deg);
    }
    33% {
      transform: translateY(-20px) rotate(1deg);
    }
    66% {
      transform: translateY(10px) rotate(-1deg);
    }
  }

  :global(.reduceFx .aurora-bg),
  :global(.reduceFx .blob),
  :global(.reduceFx .cyber-grid),
  :global(.reduceFx .particles),
  :global(.reduceFx .floating),
  :global(.reduceFx .animate-pulse) {
    animation: none !important;
    filter: none !important;
    mix-blend-mode: normal !important;
  }

  :global(.reduceFx .blob),
  :global(.reduceFx .aurora-bg) {
    opacity: 0.1 !important;
  }
</style>
