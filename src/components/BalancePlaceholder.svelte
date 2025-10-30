<script>
  import { onMount, onDestroy } from 'svelte';

  let { class: className = '' } = $props();

  // Animated loading dots
  let dotCount = $state(0);
  let interval;

  onMount(() => {
    interval = setInterval(() => {
      dotCount = (dotCount + 1) % 4;
    }, 400);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  const dots = $derived('.'.repeat(dotCount));
  const paddingDots = $derived('.'.repeat(3 - dotCount));
</script>

<!-- Shimmer placeholder similar to misty-breez PlaceholderBalanceText -->
<div class="flex flex-col items-center gap-2">
  <div class="text-white/50 text-lg font-bold">Loading</div>
  <div class="inline-flex items-baseline gap-2 {className}">
    <div class="relative overflow-hidden rounded-lg">
      <!-- Shimmer effect -->
      <div class="absolute inset-0 shimmer"></div>

      <!-- Placeholder balance -->
      <div class="relative text-4xl md:text-5xl font-bold text-white/40">
        0{dots}<span class="opacity-0">{paddingDots}</span>
      </div>
    </div>

    <span class="text-2xl md:text-3xl text-white/30 font-medium">sats</span>
  </div>
</div>

<style>
  .shimmer {
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.1) 50%,
      transparent 100%
    );
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
</style>
