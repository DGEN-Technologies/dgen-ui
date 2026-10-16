<script>
  import { back } from "$lib/utils";
  import { env } from "$env/dynamic/public";
  import { fade, scale } from "svelte/transition";

  let isLoading = $state(true);
  let hasError = $state(false);
  let showSwapInfo = $state(false);

  /**
   * The widget URL, normalised to the query form and themed.
   *
   * Two things make this less trivial than appending a parameter. The
   * configured value uses SwapSpace's /widget/<key> path form, which answers
   * 308 to /widget?key=<key> and DROPS the query string on the way — a theme
   * appended to the path form silently disappears. And without a theme the
   * widget's own <body> is #333, a light grey slab that sits badly on this
   * app's near-black background.
   *
   * Converting to the query form first keeps the parameter, and any theme
   * value clears that grey to #110B12. The iframe is cross-origin, so this is
   * the only lever we have over its background — CSS on our side cannot reach
   * inside it.
   */
  const widgetSrc = $derived.by(() => {
    const raw = env.PUBLIC_SWAPSPACE_WIDGET_URL;
    if (!raw) return "";
    try {
      const url = new URL(raw);
      const keyInPath = url.pathname.match(/^\/widget\/([^/]+)\/?$/);
      if (keyInPath) {
        url.pathname = "/widget";
        url.searchParams.set("key", keyInPath[1]);
      }
      if (!url.searchParams.has("theme")) {
        url.searchParams.set("theme", "dark");
      }
      return url.toString();
    } catch {
      // Malformed value: hand it back untouched. isValidUrl below still gates
      // whether it is rendered at all.
      return raw;
    }
  });
</script>

<div class="flex flex-col h-full w-full max-w-3xl mx-auto p-4">
  <!-- Header -->
  <div class="flex items-center mb-3">
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
    class="mx-auto mb-3 px-3 py-2 w-fit items-center rounded-md text-xs sm:text-sm font-bold text-center bg-gradient-to-r bg-yellow-400/70 border border-yellow-400/50 shadow-lg shadow-yellow-400/50"
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
          Read Before Using This Feature
        </h3>
        <div class="overflow-y-auto h-60 sm:h-96">
          <p class="mb-3">
            This is a crypto exchange aggregator allowing you to trade thousands
            of cryptocurrencies across hundreds of blockchains/networks.
          </p>

          <p class="mb-3 font-semibold">To swap:</p>
          <ul class="mb-3 list-disc list-inside space-y-1 opacity-90">
            <li>
              Choose the 2 cryptocurrencies you want to swap &amp; the amount.
            </li>
            <li>
              On the next screen, you enter your 'Receive address' (where your
              funds will arrive), and a 'Refund address' (in case of your swap
              failing) which is usually the same as your address you're sending
              from.
            </li>
          </ul>

          <div class="mb-3">
            <div class="font-semibold" style="font-size: 1.5em;">TIPS:</div>
            <p class="mt-1">
              Prepare in advance - Have your wallet addresses ready to
              copy/paste.
            </p>
          </div>

          <div class="mb-3">
            <div class="font-semibold" style="font-size: 1.5em;">EXAMPLE:</div>
            <p class="mt-1">To swap BTC for USDT (on the Ethereum Network):</p>
            <p class="mt-1">
              Get your BTC sending address and USDT (ERC-20) receiving address
              before starting.
            </p>
          </div>

          <p class="mb-3 text-yellow-400">
            SAVE YOUR EXCHANGE ID when it pops up, in the case of your swap
            failing.
          </p>
          <p class="mb-3 text-yellow-400">
            DO NOT USE MIXERS or COINJOINERS with any transaction that is
            involved with a transaction on this DGEN platform or DGEN's
            associated apps.
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
          src={widgetSrc}
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
