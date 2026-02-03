<script>
  import { back } from "$lib/utils";
  import { env } from "$env/dynamic/public";
  import { fade, scale } from "svelte/transition";

  let isLoading = $state(true);
  let hasError = $state(false);
  let showSwapInfo = $state(true);
</script>

<div class="flex flex-col h-full w-full max-w-3xl mx-auto p-4">
  <!-- Header -->
  <div class="flex items-center mb-6">
    <button
      class="btn btn-circle btn-ghost mr-2"
      onclick={back}
      aria-label="Go back"
    >
      <iconify-icon icon="ph:arrow-left-bold" width="24"></iconify-icon>
    </button>
    <h1 class="text-2xl font-bold">Swap Crypto</h1>
  </div>

  <button
    onclick={() => {
      showSwapInfo = true;
    }}
    class="mx-auto mb-4 px-3 py-2 w-fit items-center rounded-md text-xs sm:text-sm font-bold text-center text-black bg-gradient-to-r bg-yellow-400/70 border border-yellow-400/50 shadow-lg shadow-yellow-400/50"
  >
    READ THIS Before Using This Swap / Buy Feature
  </button>

  {#if showSwapInfo}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      transition:fade
    >
      <div
        class="max-w-md w-full mx-4 rounded-2xl bg-neutral-900
             border border-white/20 p-5 text-sm text-white"
        transition:scale
      >
        <h3 class="font-bold text-dgen-aqua mb-3">
          Read before using this feature
        </h3>
        <div class="overflow-y-auto h-60 sm:h-96">
          <p class="mb-3">
            This is a crypto exchange aggregator allowing you to trade over
            3,500 cryptocurrencies across 500+ networks.
          </p>

          <p class="mb-3 font-semibold">To swap:</p>
          <ul class="mb-3 list-disc list-inside space-y-1 opacity-90">
            <li>
              Choose the 2 cryptocurrencies you want to swap & the amounts.
            </li>
            <li>
              On the next screen, you will have to enter your sending address
              (where funds come from) and a refund address (in case of the swap
              failing).
            </li>
          </ul>

          <div class="mb-3">
            <div class="font-semibold" style="font-size: 1.5em;">Tip:</div>
            <p class="mt-1">
              Prepare in advance—select the assets you want to swap, then have
              your wallet addresses ready to copy/paste.
            </p>
          </div>
          <p class="mb-3">
            Example: If you want to swap BTC for USDT (on Ethereum):
          </p>
          <p class="mb-3">
            Get your BTC sending/refund addresses and USDT (ERC-20) receiving
            address before starting.
          </p>
          <p class="mb-3 text-yellow-400">
            SAVE YOUR EXCHANGE ID when it pops up, in the case of any issues
            happening with your swap.
          </p>
          <p class="mb-3 text-yellow-400">
            DO NOT USE MIXERS/COINJOINERS with anything
          </p>
          <p class="mb-3 text-yellow-400">
            Note: Off-Ramp feature is not available but it will be soon. The
            On-Ramp feature here is available.
          </p>
        </div>
        <button
          class="mt-4 w-full py-2 rounded-xl
               bg-dgen-aqua text-black font-bold"
          onclick={() => (showSwapInfo = false)}
        >
          I Understand
        </button>
      </div>
    </div>
  {/if}

  <!-- Widget Container -->
  {#if env.PUBLIC_SWAPSPACE_WIDGET_URL}
    {@const isValidUrl = env.PUBLIC_SWAPSPACE_WIDGET_URL.startsWith(
      "https://swapspace.co/",
    )}
    <div
      class="flex-1 bg-transparent rounded-3xl overflow-hidden relative min-h-[617px] min-[392px]:min-h-[536px] w-full max-w-[404px] mx-auto"
    >
      {#if !isValidUrl}
        <div
          class="flex flex-col items-center justify-center h-full text-center p-6 gap-4"
        >
          <iconify-icon
            icon="ph:warning-circle-bold"
            class="text-error"
            width="48"
          ></iconify-icon>
          <div class="flex flex-col gap-2">
            <p class="text-lg font-bold text-error">Security Warning</p>
            <p class="text-sm opacity-60">
              Invalid SwapSpace URL configuration. <br />URL must start with
              https://swapspace.co/
            </p>
          </div>
        </div>
      {:else if hasError}
        <div
          class="flex flex-col items-center justify-center h-full text-center p-6 gap-4"
        >
          <iconify-icon
            icon="ph:warning-circle-bold"
            class="text-error"
            width="48"
          ></iconify-icon>
          <div class="flex flex-col gap-2">
            <p class="text-lg font-bold text-error">
              Failed to load swap widget
            </p>
            <p class="text-sm opacity-60">
              Please check your connection or try again later.
            </p>
          </div>
          <button
            class="btn btn-primary btn-sm"
            onclick={() => {
              hasError = false;
              isLoading = true;
              location.reload();
            }}
          >
            Retry
          </button>
        </div>
      {:else}
        <!-- Loading State -->
        {#if isLoading}
          <div
            class="absolute inset-0 z-10 flex flex-col gap-4 items-center justify-center bg-base-100/50 backdrop-blur-sm transition-opacity duration-300"
          >
            <div
              class="animate-spin rounded-full h-12 w-12 border-4 border-dgen-aqua border-t-transparent"
            ></div>
            <p class="text-lg font-semibold animate-pulse text-dgen-aqua">
              Loading...
            </p>
          </div>
        {/if}

        <iframe
          src={env.PUBLIC_SWAPSPACE_WIDGET_URL}
          onload={() => (isLoading = false)}
          onerror={() => {
            isLoading = false;
            hasError = true;
          }}
          title="SwapSpace Widget"
          class="w-full h-full absolute inset-0 border-0 transition-opacity duration-500 {isLoading
            ? 'opacity-0'
            : 'opacity-100'}"
          allow="clipboard-read; clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      {/if}
    </div>
  {:else}
    <div class="flex items-center justify-center h-full text-error">
      Swap feature not configured
    </div>
  {/if}
</div>
