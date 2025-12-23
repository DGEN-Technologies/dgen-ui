<script>
  import { back } from "$lib/utils";
  import { env } from "$env/dynamic/public";

  let isLoading = $state(true);
  let hasError = $state(false);
</script>

<div class="flex flex-col h-full w-full max-w-3xl mx-auto p-4">
  <!-- Header -->
  <div class="flex items-center mb-6">
    <button class="btn btn-circle btn-ghost mr-2" onclick={back} aria-label="Go back">
      <iconify-icon icon="ph:arrow-left-bold" width="24"></iconify-icon>
    </button>
    <h1 class="text-2xl font-bold">Swap Crypto</h1>
  </div>

  <!-- Widget Container -->
  <div class="flex-1 bg-transparent rounded-3xl overflow-hidden relative min-h-[617px] min-[392px]:min-h-[536px] w-full max-w-[404px] mx-auto">
    {#if env.PUBLIC_SWAPSPACE_WIDGET_URL}
      {#if hasError}
        <div class="flex flex-col items-center justify-center h-full text-center p-6 gap-4">
          <iconify-icon icon="ph:warning-circle-bold" class="text-error" width="48"></iconify-icon>
          <div class="flex flex-col gap-2">
            <p class="text-lg font-bold text-error">Failed to load swap widget</p>
            <p class="text-sm opacity-60">Please check your connection or try again later.</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick={() => { hasError = false; isLoading = true; location.reload(); }}>
            Retry
          </button>
        </div>
      {:else}
        <!-- Loading State -->
        {#if isLoading}
          <div class="absolute inset-0 z-10 flex flex-col gap-4 items-center justify-center bg-base-100/50 backdrop-blur-sm transition-opacity duration-300">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-dgen-aqua border-t-transparent"></div>
            <p class="text-lg font-semibold animate-pulse text-dgen-aqua">Loading SwapSpace...</p>
          </div>
        {/if}

        <iframe 
          src={env.PUBLIC_SWAPSPACE_WIDGET_URL} 
          onload={() => isLoading = false}
          onerror={() => { isLoading = false; hasError = true; }}
          title="SwapSpace Widget"
          class="w-full h-full absolute inset-0 border-0 transition-opacity duration-500 {isLoading ? 'opacity-0' : 'opacity-100'}"
          allow="clipboard-read; clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      {/if}
    {:else}
      <div class="flex items-center justify-center h-full text-error">Swap feature not configured</div>
    {/if}
  </div>
</div>
