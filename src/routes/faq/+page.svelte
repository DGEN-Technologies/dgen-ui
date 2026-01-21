<script>
  import { goto } from "$app/navigation";
  import FAQ from "$comp/FAQ.svelte";
</script>

<svelte:head>
  <title>DGEN Wallet - FAQ</title>

  <meta
    name="description"
    content="Frequently asked questions about the DGEN wallet, Bitcoin, Lightning Network, swaps, fees, security, and self-custody."
  />

  <!-- Open Graph -->
  <meta property="og:title" content="DGEN Wallet - FAQ" />
  <meta
    property="og:description"
    content="Answers to common questions about DGEN wallet, Bitcoin, Lightning, swaps, security, and self-custody."
  />
  <meta property="og:type" content="website" />
</svelte:head>

<FAQ />
<div
  class="fixed bottom-6 left-0 right-0 z-10 flex justify-center pointer-events-none px-4"
>
  <button
    class="glass border-2 border-white/60 hover:border-white/90 hover:bg-white/30 shadow-2xl hover:shadow-white/20 rounded-full px-8 py-3 font-bold text-lg transition-all pointer-events-auto flex items-center gap-3"
    style="box-shadow: 0 0 30px rgba(255, 255, 255, 0.2);"
    onclick={() => goto("/")}
  >
    <iconify-icon icon="ph:arrow-left-bold" width="24"></iconify-icon>
    <span>Back</span>
  </button>
</div>
