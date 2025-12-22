<script lang="ts">
  import LandingHeader from "$comp/LandingHeader.svelte";
  import LandingHero from "$comp/LandingHero.svelte";
  import FeatureShowcase from "$comp/FeatureShowcase.svelte";
  import HowDgenWorks from "$comp/HowDgenWorks.svelte";
  import DegenTestimonials from "$comp/DegenTestimonials.svelte";
  import BitcoinEducation from "$comp/BitcoinEducation.svelte";
  import Partners from "$comp/Partners.svelte";
  // import BugBounty from "$comp/BugBounty.svelte";
  import Roadmap from "$comp/Roadmap.svelte";
  import FAQ from "$comp/FAQ.svelte";
  import Footer from "$comp/Footer.svelte";

  import { locale, t } from "$lib/translations";
  import { onDestroy, onMount, tick } from "svelte";
  import { proMode } from "$lib/store";

  let { data } = $props();
  let { faqs, locations, user } = $derived(data);

  let howItWorks = $state();
  let roadmap = $state();
  let partners = $state();
  let faq = $state();
  let about = $state();

  onMount(() => {
    // Bind section elements after components are mounted
    setTimeout(() => {
      howItWorks = document.getElementById("howItWorks");
      roadmap = document.getElementById("roadmap");
      partners = document.getElementById("partners");
      faq = document.getElementById("faq");
      about = document.getElementById("about");
    }, 100);
  });
</script>

<LandingHeader {howItWorks} {roadmap} {partners} {faq} {about} {user} />

<div class="relative landing-page-content">
  <!-- Lightning Bolts (Pro Mode Only) - Landing Page -->
  {#if $proMode}
    <div class="lightning-container-landing">
      {#each Array.from({ length: 6 }) as _, i}
        <div
          class="lightning-bolt"
          style="left: {10 + i * 15}%; animation-delay: {i * 3 +
            Math.random() * 2}s; animation-duration: {2 + Math.random()}s"
        >
          <iconify-icon
            icon="ph:lightning-fill"
            width="24"
            class="text-cyan-400"
          ></iconify-icon>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Hero Section with turquoise cloud background -->
  <div class="turquoise-cloud-section">
    <LandingHero />

    <!-- How DGEN Works -->
    <HowDgenWorks />

    <!-- Interactive Feature Showcase (Built Different) -->
    <FeatureShowcase />

    <!-- Degen Testimonials -->
    <DegenTestimonials />

    <!-- Bitcoin Education Section -->
    <BitcoinEducation />
  </div>

  <!-- Bug Bounty Program -->
  <!-- <BugBounty /> -->

  <!-- Partners -->
  <div class="purple-fade-section">
    <Partners />
  </div>

  <!-- Roadmap with gradient fade from turquoise to purple -->
  <div class="purple-fade-section">
    <Roadmap />
  </div>

  <!-- FAQ with smooth blend to solid black -->
  <div class="faq-dark-section">
    <FAQ />
    <Footer />
  </div>
</div>

<style>
  /* Ensure landing page sections flow properly in both modes */
  :global(main) {
    background: transparent !important;
  }

  /* Pro mode - eliminate visible gaps between sections */

  /* Remove margins from all child components */
  :global(.pro-mode) .turquoise-cloud-section > :global(*),
  :global(.pro-mode) .purple-fade-section > :global(*),
  :global(.pro-mode) .faq-dark-section > :global(*) {
    margin: 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  /* KEY FIX: Hide internal background elements that block parent gradients */
  :global(.pro-mode) .turquoise-cloud-section :global(.aurora-bg),
  :global(.pro-mode) .turquoise-cloud-section :global(.blob),
  :global(.pro-mode) .turquoise-cloud-section :global(.cyber-grid),
  :global(.pro-mode) .turquoise-cloud-section :global(.particles),
  :global(.pro-mode) .purple-fade-section :global(.aurora-bg),
  :global(.pro-mode) .purple-fade-section :global(.blob),
  :global(.pro-mode) .purple-fade-section :global(.cyber-grid),
  :global(.pro-mode) .faq-dark-section :global(.aurora-bg),
  :global(.pro-mode) .faq-dark-section :global(.blob),
  :global(.pro-mode) .faq-dark-section :global(.cyber-grid) {
    display: none !important;
  }

  /* Make all absolute positioned background divs transparent */
  :global(.pro-mode) .turquoise-cloud-section :global(.absolute),
  :global(.pro-mode) .purple-fade-section :global(.absolute),
  :global(.pro-mode) .faq-dark-section :global(.absolute) {
    background: transparent !important;
  }

  :global(.pro-mode) .turquoise-cloud-section :global(.absolute *),
  :global(.pro-mode) .purple-fade-section :global(.absolute *),
  :global(.pro-mode) .faq-dark-section :global(.absolute *) {
    background: transparent !important;
  }

  /* Remove padding from sections to eliminate gaps */
  :global(.pro-mode) .turquoise-cloud-section :global(section),
  :global(.pro-mode) .purple-fade-section :global(section),
  :global(.pro-mode) .faq-dark-section :global(section) {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    margin: 0 !important;
  }

  /* Add padding to section content divs for spacing */
  :global(.pro-mode) .turquoise-cloud-section :global(section > div),
  :global(.pro-mode) .purple-fade-section :global(section > div),
  :global(.pro-mode) .faq-dark-section :global(section > div) {
    padding-top: 2rem !important;
    padding-bottom: 2rem !important;
  }

  /* Container styling - no spacing between sections */
  .landing-page-content {
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .turquoise-cloud-section,
  .purple-fade-section,
  .faq-dark-section {
    border: 0 !important;
    box-shadow: none !important;
    outline: none !important;
  }

  /* Pro mode - additional overlap to eliminate sub-pixel gaps */
  :global(.pro-mode) .landing-page-content {
    display: flex !important;
    flex-direction: column !important;
    gap: 0 !important;
  }

  :global(.pro-mode) .turquoise-cloud-section,
  :global(.pro-mode) .purple-fade-section,
  :global(.pro-mode) .faq-dark-section {
    margin: 0 !important;
    padding: 0 !important;
    flex-shrink: 0 !important;
  }

  /* Extra negative margin on transitions for complete seamlessness */
  :global(.pro-mode) .purple-fade-section,
  :global(.pro-mode) .faq-dark-section {
    margin-top: -3px !important;
  }

  /* Lightning container for landing page */
  .lightning-container-landing {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
    z-index: 10;
  }

  /* Turquoise cloud background extending from hero to Bitcoin Education */
  .turquoise-cloud-section {
    background: linear-gradient(
      180deg,
      #0a0a0f 0%,
      #0d1520 10%,
      #0f1f2e 25%,
      #112a3c 40%,
      #0f1f2e 60%,
      #0d1520 80%,
      #0a0a0f 100%
    );
    position: relative;
  }

  .turquoise-cloud-section::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      radial-gradient(
        ellipse 80% 50% at 20% 20%,
        rgba(116, 235, 213, 0.15) 0%,
        transparent 50%
      ),
      radial-gradient(
        ellipse 60% 40% at 80% 40%,
        rgba(94, 238, 207, 0.12) 0%,
        transparent 50%
      ),
      radial-gradient(
        ellipse 70% 45% at 40% 60%,
        rgba(106, 238, 199, 0.1) 0%,
        transparent 50%
      ),
      radial-gradient(
        ellipse 65% 35% at 70% 80%,
        rgba(116, 235, 213, 0.08) 0%,
        transparent 50%
      );
    pointer-events: none;
    opacity: 1;
  }

  /* Purple fade section - smooth transition from turquoise to purple */
  .purple-fade-section {
    background: linear-gradient(
      180deg,
      #0a0a0f 0%,
      #12101f 20%,
      #1a1530 50%,
      #1e1838 80%,
      #0a0a0f 100%
    );
    position: relative;
    margin-top: -1px;
  }

  .purple-fade-section::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      radial-gradient(
        ellipse 70% 50% at 30% 10%,
        rgba(116, 235, 213, 0.08) 0%,
        transparent 40%
      ),
      radial-gradient(
        ellipse 80% 60% at 50% 50%,
        rgba(150, 136, 221, 0.15) 0%,
        transparent 60%
      ),
      radial-gradient(
        ellipse 65% 45% at 70% 80%,
        rgba(184, 169, 232, 0.12) 0%,
        transparent 50%
      );
    pointer-events: none;
  }

  /* FAQ dark section - smooth blend from purple to solid black */
  .faq-dark-section {
    background: linear-gradient(180deg, #0a0a0f 0%, #0a0a0f 100%);
    position: relative;
    margin-top: -1px;
  }

  .faq-dark-section::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: radial-gradient(
      ellipse 70% 60% at 50% 0%,
      rgba(150, 136, 221, 0.08) 0%,
      transparent 70%
    );
    pointer-events: none;
  }
</style>
