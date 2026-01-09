<script>
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });
</script>

{#if mounted}
  <section class="relative pb-20 sm:pb-32 pt-0">
    <div class="container mx-auto px-4 relative z-10">
      <!-- Features Showcase -->

      <!-- CTA -->
      <div
        class="text-center mt-16"
        in:fly={{ y: 30, duration: 800, delay: 600 }}
      >
        <p class="text-xl opacity-80 mb-6">Ready to experience DGEN app?</p>
        <a href="/register" class="inline-block">
          <button
            class="btn btn-liquid text-white font-bold text-xl px-12 py-4"
          >
            <iconify-icon
              icon="ph:lightning-bold"
              width="28"
              class="animate-pulse"
            ></iconify-icon>
            Get Started
            <iconify-icon icon="ph:arrow-right-bold" width="24"></iconify-icon>
          </button>
        </a>
      </div>
    </div>
  </section>
{/if}
