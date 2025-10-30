<script>
  import { browser } from "$app/environment";
  import { scale, fade } from "svelte/transition";
  import Amount from "$comp/Amount.svelte";
  import { Confetti } from "svelte-confetti";
  const { amount, tip, rate, currency, locale, title } = $props();

  let loaded = $state(false);
  $effect(() => {
    if (browser)
      window.requestAnimationFrame((p) => {
        loaded = true;
      });
  });
</script>

<style>
  .success-circle {
    animation: pulse-scale 0.6s ease-out;
  }

  @keyframes pulse-scale {
    0% {
      transform: scale(0.3);
      opacity: 0;
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .checkmark-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
</style>

<div class="text-center mt-20 md:mt-0">
  {#if loaded}
    <div class="relative flex justify-center">
      <div class="absolute top-64 pointer-events-none">
        <Confetti
          amount="20"
          size="40"
          duration="1600"
          delay={[0, 500]}
          fallDistance="50px"
          colorArray={["url(/images/bolt.svg)"]}
        />
        <Confetti
          amount="40"
          delay={[0, 500]}
          size="15"
          fallDistance="50px"
          duration="1600"
          colorArray={[
            "#FFD700", // Gold
            "#FF6F61", // Coral
            "#6BCB77", // Mint green
            "#4D96FF", // Light blue
            "#FF9CEE", // Light pink
            "#FFD580", // Soft orange
            "#87CEEB", // Sky blue
            "#FFB6C1", // Light coral pink
            "#C1C7FF", // Lavender
          ]}
        />
      </div>
    </div>

    <div class="checkmark-wrapper mb-4">
      <div
        class="success-circle absolute w-32 h-32 bg-green-400/20 rounded-full"
        in:fade={{ duration: 300 }}
      ></div>
      <iconify-icon
        noobserver
        icon="ph:check-fat-fill"
        class="text-green-400 relative z-10"
        width="160"
        in:scale={{ start: 0.2, duration: 500, delay: 100 }}
      ></iconify-icon>
    </div>
  {/if}
  <h1 class="text-3xl md:text-4xl font-bold mb-6">{title}</h1>
  <Amount {amount} {tip} {rate} {currency} {locale} showAllUnits={true} />
</div>
