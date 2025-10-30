<script>
  import { types } from "$lib/utils";
  import { page } from "$app/stores";
  let {
    newAmount = $bindable(),
    invoice,
    user,
    t,
    toggleType,
    setAmount,
    setType,
    activeOnly,
  } = $props();

  let { aid, address_type, type } = $derived(invoice);
</script>

<div class="text-2xl font-bold mb-3">
  <span class="text-orange-400">🪙</span>
  <span class="gradient-text ml-2">Bitcoin</span>
</div>
<div class="flex flex-wrap gap-3 mb-6">
  <button
    class="glass px-6 py-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 flex items-center gap-3 grow"
    class:border-orange-400={type === types.bitcoin}
    class:bg-orange-500={type === types.bitcoin}
    class:bg-opacity-20={type === types.bitcoin}
    class:shadow-lg={type === types.bitcoin}
    class:shadow-orange-500={type === types.bitcoin}
    class:border-white={type !== types.bitcoin}
    class:border-opacity-20={type !== types.bitcoin}
    class:hover:border-orange-400={type !== types.bitcoin}
    class:hover:border-opacity-60={type !== types.bitcoin}
    class:hover:shadow-orange-400={type !== types.bitcoin}
    class:hidden={activeOnly && type !== types.bitcoin}
    onclick={() => (activeOnly ? toggleType() : setType(types.bitcoin))}
  >
    <img src="/images/bitcoin.svg" class="w-10 h-10" alt="Bitcoin" />
    <div class="text-lg font-semibold text-white">
      <span>Bitcoin</span>
      <span class="text-xs block text-orange-300">onchain • Taproot</span>
    </div>
  </button>

  <button
    class="glass px-6 py-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 flex items-center gap-3 grow"
    class:border-blue-400={type === types.liquid}
    class:bg-blue-500={type === types.liquid}
    class:bg-opacity-20={type === types.liquid}
    class:shadow-lg={type === types.liquid}
    class:shadow-blue-500={type === types.liquid}
    class:border-white={type !== types.liquid}
    class:border-opacity-20={type !== types.liquid}
    class:hover:border-blue-400={type !== types.liquid}
    class:hover:border-opacity-60={type !== types.liquid}
    class:hover:shadow-blue-400={type !== types.liquid}
    class:hidden={activeOnly && type !== types.liquid}
    onclick={() => (activeOnly ? toggleType() : setType(types.liquid))}
  >
    <div
      class="bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full w-10 h-10 items-center justify-center flex shadow-lg shadow-blue-500 shadow-opacity-30"
    >
      <div class="m-auto">
        <iconify-icon
          noobserver
          icon="cryptocurrency:lbtc"
          class="text-white text-2xl"
        ></iconify-icon>
      </div>
    </div>
    <div class="text-lg font-semibold text-white">
      <span>Liquid</span>
      <span class="text-xs block text-blue-300">L-BTC</span>
    </div>
  </button>

  <button
    class="glass px-6 py-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 flex items-center gap-3 grow"
    class:border-green-400={type === types.usdt}
    class:bg-green-500={type === types.usdt}
    class:bg-opacity-20={type === types.usdt}
    class:shadow-lg={type === types.usdt}
    class:shadow-green-500={type === types.usdt}
    class:border-white={type !== types.usdt}
    class:border-opacity-20={type !== types.usdt}
    class:hover:border-green-400={type !== types.usdt}
    class:hover:border-opacity-60={type !== types.usdt}
    class:hover:shadow-green-400={type !== types.usdt}
    class:hidden={activeOnly && type !== types.usdt}
    onclick={() => (activeOnly ? toggleType() : setType(types.usdt))}
  >
    <div
      class="bg-gradient-to-br from-green-400 to-emerald-500 rounded-full w-10 h-10 items-center justify-center flex shadow-lg shadow-green-500 shadow-opacity-30"
    >
      <div class="m-auto">
        <iconify-icon
          noobserver
          icon="cryptocurrency:usdt"
          class="text-white text-2xl"
        ></iconify-icon>
      </div>
    </div>
    <div class="text-lg font-semibold text-white">
      <span>Tether USD</span>
      <span class="text-xs block text-green-300">USDT • Stablecoin</span>
    </div>
  </button>
</div>

{#if invoice.uid === aid}
  <div class="text-2xl font-bold mb-3">
    <span class="text-yellow-400 lightning">⚡</span>
    <span class="gradient-text ml-2">Lightning</span>
  </div>
  <div class="flex flex-wrap gap-3 mb-6">
    <button
      class="glass px-6 py-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 flex items-center gap-3 grow"
      class:border-yellow-400={type === types.lightning}
      class:bg-yellow-500={type === types.lightning}
      class:bg-opacity-20={type === types.lightning}
      class:shadow-lg={type === types.lightning}
      class:shadow-yellow-500={type === types.lightning}
      class:border-white={type !== types.lightning}
      class:border-opacity-20={type !== types.lightning}
      class:hover:border-yellow-400={type !== types.lightning}
      class:hover:border-opacity-60={type !== types.lightning}
      class:hover:shadow-yellow-400={type !== types.lightning}
      class:hidden={activeOnly && type !== types.lightning}
      onclick={() => {
        if (activeOnly) {
          toggleType();
        } else {
          // For Lightning, always prompt for amount if not set
          if (!invoice.amount || invoice.amount === 0) {
            // Close modal and show amount prompt
            toggleType();
            setTimeout(() => {
              const event = new CustomEvent("needAmount");
              window.dispatchEvent(event);
            }, 100);
          } else {
            // We have an amount, create Lightning invoice
            setType(types.lightning);
          }
        }
      }}
    >
      <div
        class="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full w-10 h-10 items-center justify-center flex shadow-lg shadow-yellow-500 shadow-opacity-30"
      >
        <div class="m-auto">
          <iconify-icon
            noobserver
            icon="ph:lightning-fill"
            class="text-white text-2xl"
          ></iconify-icon>
        </div>
      </div>
      <div class="text-lg font-semibold text-white">Lightning Invoice</div>
    </button>

    <button
      class="glass px-6 py-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 flex items-center gap-3 grow"
      class:border-purple-400={type === types.bolt12}
      class:bg-purple-500={type === types.bolt12}
      class:bg-opacity-20={type === types.bolt12}
      class:shadow-lg={type === types.bolt12}
      class:shadow-purple-500={type === types.bolt12}
      class:border-white={type !== types.bolt12}
      class:border-opacity-20={type !== types.bolt12}
      class:hover:border-purple-400={type !== types.bolt12}
      class:hover:border-opacity-60={type !== types.bolt12}
      class:hover:shadow-purple-400={type !== types.bolt12}
      class:hidden={activeOnly && type !== types.bolt12}
      onclick={() => {
        if (activeOnly) {
          toggleType();
        } else {
          // BOLT12 doesn't require amount upfront for receiving
          setType(types.bolt12);
        }
      }}
    >
      <div
        class="bg-gradient-to-br from-purple-400 to-pink-500 rounded-full w-10 h-10 items-center justify-center flex shadow-lg shadow-purple-500 shadow-opacity-30"
      >
        <div class="m-auto">
          <iconify-icon
            noobserver
            icon="ph:lightning-fill"
            class="text-white text-2xl"
          ></iconify-icon>
        </div>
      </div>
      <div class="text-lg font-semibold text-white">
        <span>BOLT12 Offer</span>
        <span class="text-xs block text-purple-300">Reusable</span>
      </div>
    </button>

    <!-- Lightning Address / LNURL - Coming Soon -->
    <!-- <button
      class="glass px-6 py-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 flex items-center gap-3 grow"
      class:border-green-400={type === "lnurl"}
      class:bg-green-500={type === "lnurl"}
      class:bg-opacity-20={type === "lnurl"}
      class:shadow-lg={type === "lnurl"}
      class:shadow-green-500={type === "lnurl"}
      class:border-white={type !== "lnurl"}
      class:border-opacity-20={type !== "lnurl"}
      class:hover:border-green-400={type !== "lnurl"}
      class:hover:border-opacity-60={type !== "lnurl"}
      class:hover:shadow-green-400={type !== "lnurl"}
      class:hidden={activeOnly && type !== "lnurl"}
      onclick={() => {
        if (activeOnly) {
          toggleType();
        } else {
          // LNURL/Lightning Address is static, no invoice needed
          setType("lnurl");
        }
      }}
    >
      <div
        class="bg-gradient-to-br from-green-400 to-teal-500 rounded-full w-10 h-10 items-center justify-center flex shadow-lg shadow-green-500 shadow-opacity-30"
      >
        <div class="m-auto">
          <iconify-icon noobserver icon="ph:at" class="text-white text-2xl"
          ></iconify-icon>
        </div>
      </div>
      <div class="text-lg font-semibold text-white">
        <span>Lightning Address</span>
        <span class="text-xs block text-green-300">LNURL</span>
      </div>
    </button> -->
  </div>

  <div class="pt-4 border-t border-white border-opacity-10"></div>
  <button
    type="button"
    class="btn-liquid text-white border-0 hover:shadow-xl hover:shadow-red-500 hover:shadow-opacity-40 group w-full"
    onclick={toggleType}
  >
    <span class="relative z-10 flex items-center justify-center gap-2">
      <iconify-icon
        noobserver
        icon="ph:x-bold"
        width="24"
        class="group-hover:rotate-90 transition-transform"
      ></iconify-icon>
      <span class="font-semibold">
        {t("payments.cancel")}
      </span>
    </span>
  </button>
{/if}
