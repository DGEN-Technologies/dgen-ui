<script lang="ts">
  import LandingHeader from "$comp/LandingHeader.svelte";
  import LandingHero from "$comp/LandingHero.svelte";
  import FeatureShowcase from "$comp/FeatureShowcase.svelte";
  import HowDgenWorks from "$comp/HowDgenWorks.svelte";
  import BitcoinEducation from "$comp/BitcoinEducation.svelte";
  import Partners from "$comp/Partners.svelte";
  // import BugBounty from "$comp/BugBounty.svelte";
  import Roadmap from "$comp/Roadmap.svelte";
  import Footer from "$comp/Footer.svelte";

  import { locale, t } from "$lib/translations";
  import { browser } from "$app/environment";
  import { onDestroy, onMount, tick } from "svelte";
  import { proMode } from "$lib/store";
  import "../landing-restyle.css";

  let { data } = $props();
  let { faqs, locations, user } = $derived(data);

  let howItWorks = $state();
  let roadmap = $state();
  let about = $state();
  let reduceFx = $state(false);

  onMount(() => {
    if (browser) {
      let storageReadOk = false;
      let userSetRaw: string | null = null;
      try {
        userSetRaw = localStorage.getItem("proModeUserSet");
        storageReadOk = true;
      } catch (err) {
        console.warn("[Landing] localStorage unavailable:", err);
      }
      if (storageReadOk && userSetRaw !== "true") {
        proMode.set(true);
      }

      let ua = "";
      let platform = "";
      try {
        ua = navigator.userAgent || "";
        platform = navigator.userAgentData?.platform || "";
      } catch (err) {
        console.warn("[Landing] navigator metadata unavailable:", err);
      }

      let prefersReduced = false;
      try {
        prefersReduced =
          window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ===
          true;
      } catch (err) {
        console.warn("[Landing] matchMedia unavailable:", err);
      }
      reduceFx = prefersReduced;
    }

    // Bind section elements after components are mounted
    setTimeout(() => {
      howItWorks = document.getElementById("howItWorks");
      roadmap = document.getElementById("roadmap");
      about = document.getElementById("about");
    }, 100);
  });
</script>

<div class="dg-landing">
  <LandingHeader {howItWorks} {roadmap} {about} {user} />

  <div class="relative landing-page-content">
    <!-- Hero Section with turquoise cloud background -->
    <div class="turquoise-cloud-section">
      <LandingHero />

      <!-- How DGEN Works -->
      <HowDgenWorks />

      <!-- Interactive Feature Showcase (Built Different) -->
      <FeatureShowcase />
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

    <div class="turquoise-cloud-section">
      <!-- Bitcoin Education Section -->
      <BitcoinEducation />
    </div>

    <!-- FAQ with smooth blend to solid black -->
    <div class="faq-dark-section">
      <Footer />
    </div>
  </div>
</div>

<style>
  /* Sections are transparent over the dark page; each gets one soft glow. */
  .landing-page-content {
    display: block;
    margin: 0;
    padding: 0;
  }

  .turquoise-cloud-section,
  .purple-fade-section,
  .faq-dark-section {
    position: relative;
    background: transparent;
    border: 0;
    box-shadow: none;
    outline: none;
  }

  .turquoise-cloud-section::before,
  .purple-fade-section::before {
    content: "";
    position: absolute;
    left: 50%;
    width: 1300px;
    max-width: 100%;
    height: 900px;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .turquoise-cloud-section::before {
    top: -200px;
    background: radial-gradient(
      closest-side,
      rgba(125, 227, 207, 0.1),
      rgba(125, 227, 207, 0)
    );
  }

  .purple-fade-section::before {
    top: 0;
    background: radial-gradient(
      closest-side,
      rgba(167, 156, 230, 0.09),
      rgba(167, 156, 230, 0)
    );
  }

  /* Keep page content above the decorative glows */
  .turquoise-cloud-section > :global(*),
  .purple-fade-section > :global(*),
  .faq-dark-section > :global(*) {
    position: relative;
  }
</style>
