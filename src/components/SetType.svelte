<script>
  import InvoiceTypes from "$comp/InvoiceTypes.svelte";
  import { focus } from "$lib/utils";

  let {
    newAmount = $bindable(),
    invoice,
    user,
    submit = $bindable(),
    settingType,
    setAmount,
    setType,
    toggleType,
    t,
  } = $props();

  let { aid, type } = $derived(invoice);
</script>

{#if settingType}
  <div
    class="fixed inset-0 bg-black/80 backdrop-blur-md overflow-y-auto h-full w-full z-50 animate-fadeIn"
  >
    <div class="relative mx-auto p-4 max-w-xl mt-20 animate-scaleIn">
      <div
        class="premium-card backdrop-blur-xl bg-gradient-to-br from-purple-900/20 via-black/40 to-blue-900/20 border-2 border-purple-500/30 hover:border-purple-500/50 transition-all duration-500 space-y-4"
      >
        <div class="text-center mb-6">
          <h2 class="text-3xl font-bold">
            <span class="gradient-text">Payment Options</span>
          </h2>
        </div>

        <InvoiceTypes
          bind:newAmount
          {setAmount}
          {invoice}
          {user}
          {setType}
          {toggleType}
          {t}
        />
      </div>
    </div>
  </div>
{/if}
