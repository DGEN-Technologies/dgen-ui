<script>
  import Amount from "$comp/Amount.svelte";

  import { btc, copy, f, sat, s, sats, types } from "$lib/utils";
  import { unitPreference } from "$lib/store";
  let {
    showQr,
    link,
    txt,
    invoice,
    amount,
    amountFiat,
    currency,
    locale,
    tip,
    rate,
    t,
    updating = false,
    lastError = null,
    update = null,
    onchainLimits = null,
    lightningLimits = null,
  } = $props();

  let loaded = $state(false);
  let { memo } = $derived(invoice);
  let load = () => (loaded = true);

  // Truncate address for display (first 6...last 4 chars)
  function truncateAddress(address) {
    if (!address || address.length <= 12) return address;
    return `${address.substring(0, 6)}….${address.substring(address.length - 4)}`;
  }
</script>

<div
  class="max-w-[360px] mx-auto min-h-[360px] flex items-center justify-center"
>
  {#if lastError && !updating}
    <!-- Show error with retry button -->
    <div class="text-center space-y-4 p-4">
      <div class="glass p-4 rounded-2xl border-2 border-red-500/50 bg-red-500/10">
        <iconify-icon icon="ph:warning-circle" class="text-red-400 mb-2" width="48"></iconify-icon>
        <p class="text-red-400 font-semibold mb-2">Failed to Generate Address</p>
        <p class="text-white/70 text-sm">{lastError}</p>
      </div>
      {#if update}
        <button
          onclick={() => update()}
          class="px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center gap-2"
          style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white;"
        >
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
               style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);"></div>
          <iconify-icon icon="ph:arrow-clockwise-bold" width="20" class="relative z-10"></iconify-icon>
          <span class="relative z-10">Try Again</span>
        </button>
      {/if}
    </div>
  {:else if updating}
    <!-- Show spinner when updating -->
    <div class="text-center">
      <div
        class="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"
      ></div>
      <p class="text-white/70">
        Generating {invoice.type === "lightning"
          ? "Lightning invoice"
          : "address"}...
      </p>
    </div>
  {:else if showQr && (invoice.text || (invoice.type === "lnurl" && txt) || (invoice.type === "usdt" && txt))}
    <!-- Show QR Code -->
    <a href={link}>
      <img
        src={`/qr/${encodeURIComponent(invoice.type === "lnurl" ? `lightning:${txt}` : txt)}/raw`}
        class="z-10 border-4 border-white opacity-0 transition-opacity duration-300"
        class:opacity-100={loaded}
        onload={load}
        alt={txt}
      />
    </a>
  {:else if !showQr && txt && txt.length > 120}
    <!-- Show text for long invoices when toggled -->
    <div class="break-all text-center text-secondary text-xl">
      <p class="mb-4 max-h-96 overflow-y-auto">{txt}</p>
      <button onclick={() => copy(txt)} class="mx-auto block">
        <iconify-icon noobserver icon="ph:copy-bold" width="32"></iconify-icon>
      </button>
    </div>
  {:else if invoice.type === "lightning" && !invoice.text}
    <!-- Show message for Lightning, which requires amount -->
    <div class="text-center text-white/70">
      <p class="text-xl mb-2">⚡ Lightning Invoice</p>
      <p>Set an amount to generate invoice</p>
    </div>
  {:else if invoice.type === types.bitcoin && !invoice.text}
    <!-- Show message for Bitcoin on-chain -->
    <div class="text-center text-white/70">
      <div class="flex justify-center items-center gap-2 mb-2">
        <iconify-icon
          noobserver
          icon="cryptocurrency:btc"
          class="text-orange-400"
          width="32"
        ></iconify-icon>
        <p class="text-xl">Bitcoin On-Chain</p>
      </div>
      <p>Set an amount to generate address</p>
    </div>
  {:else if invoice.type === types.liquid && !invoice.text}
    <!-- Show message for Liquid, which requires amount and asset selection -->
    <div class="text-center text-white/70">
      <div class="flex justify-center items-center gap-2 mb-2">
        <iconify-icon
          noobserver
          icon="ph:drop-fill"
          class="text-blue-400"
          width="32"
        ></iconify-icon>
        <p class="text-xl">Liquid Network</p>
      </div>
      <p>Select an asset to continue</p>
    </div>
  {:else if invoice.type === "lnurl" && txt}
    <!-- Show Lightning Address -->
    <div class="text-center space-y-4">
      <p class="text-xl text-green-400 mb-2">@ Lightning Address</p>
      <p class="text-2xl text-white font-mono">{txt}</p>
      <button onclick={() => copy(txt)} class="mx-auto block">
        <iconify-icon noobserver icon="ph:copy-bold" width="32"></iconify-icon>
      </button>
      <p class="text-sm text-white/60">Reusable payment address</p>
    </div>
  {/if}
</div>

{#if invoice.type === types.bitcoin && txt && onchainLimits}
  <!-- Bitcoin On-Chain Limits Warning -->
  <div class="mx-auto max-w-md mt-4 mb-4">
    <div class="rounded-2xl p-4 bg-yellow-500/10 border-2 border-yellow-500/30">
      <div class="text-center">
        <iconify-icon
          noobserver
          icon="ph:warning-bold"
          width="24"
          class="text-yellow-400 mb-2"
        ></iconify-icon>
        <p class="text-yellow-200 font-semibold leading-relaxed">
          {#if onchainLimits.receive?.minSat && onchainLimits.receive?.maxSat}
            Amount must be between <span class="font-bold text-yellow-100">{btc(onchainLimits.receive.minSat)} BTC</span> and <span class="font-bold text-yellow-100">{btc(onchainLimits.receive.maxSat)} BTC</span>
          {:else if onchainLimits.receive?.minSat}
            Minimum amount: <span class="font-bold text-yellow-100">{btc(onchainLimits.receive.minSat)} BTC</span>
          {:else if onchainLimits.receive?.maxSat}
            Maximum amount: <span class="font-bold text-yellow-100">{btc(onchainLimits.receive.maxSat)} BTC</span>
          {:else}
            Bitcoin on-chain payments require network fees
          {/if}
        </p>
        <p class="text-yellow-300/70 text-sm mt-2">
          Amounts outside this range will not work
        </p>
      </div>
    </div>
  </div>
{/if}

{#if invoice.type === types.liquid}
  {#if invoice.selectedAsset === 'usdt'}
    <div class="p-4 shadow text-center">
      <iconify-icon
        noobserver
        icon="ph:warning-bold"
        width="48"
        class="text-warning mb-2"
      ></iconify-icon>
      <div class="text-xl text-secondary">
        Only send <span class="text-green-500 font-bold">Tether (USDT)</span> to this address
        <br />
        <span class="text-sm">If you want to send L-BTC to this wallet, select the Bitcoin option on the previous screen</span>
      </div>
    </div>
  {:else}
    <div class="p-4 shadow text-center">
      <iconify-icon
        noobserver
        icon="ph:warning-bold"
        width="48"
        class="text-warning mb-2"
      ></iconify-icon>
      <div class="text-xl text-secondary">
        Only send <span class="text-teal-500 font-bold">L-BTC</span>, NOT Tether (USDT) to this address
        <br />
        <span class="text-sm">If you want to send Tether (USDT) to this wallet, select the Tether option on the previous screen</span>
      </div>
    </div>
  {/if}
{/if}

{#if showQr && txt && txt.length <= 120 && !updating}
  <!-- For short text like Bitcoin addresses, always show text below QR -->
  <div
    class="break-all text-center text-secondary text-xl flex gap-1 items-center justify-center mt-4"
  >
    {truncateAddress(txt)}

    <button onclick={() => copy(txt)}>
      <iconify-icon noobserver icon="ph:copy-bold" width="32"></iconify-icon>
    </button>
  </div>
{/if}

{#each invoice.items as i}
  <div class="grid grid-cols-12 text-xl">
    <div class="col-span-1 my-auto">{i.quantity}</div>
    <div class="mr-auto grow col-span-7 my-auto">
      {i.name}
    </div>
    <div class="col-span-2 font-semibold text-right my-auto">
      {f(i.price * i.quantity, currency)}
    </div>
    <div class="col-span-2 text-secondary text-right text-lg my-auto">
      {#if $unitPreference === 'btc'}
        {btc(i.price * i.quantity)} BTC
      {:else}
        {sat(i.price * i.quantity)} sats
      {/if}
    </div>
  </div>
{/each}

{#if amount > 0}
  <Amount {amount} {currency} {rate} {locale} {tip} selectedAsset={invoice.selectedAsset} invoiceType={invoice.type} />
{/if}

{#if memo}
  <div class="text-xl text-center">{memo}</div>
{/if}
