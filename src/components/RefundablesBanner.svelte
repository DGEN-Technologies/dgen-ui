<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { t } from "$lib/translations";
  import { refundablesStore } from "$lib/stores/refundables";

  onMount(() => {
    refundablesStore.refresh();
  });

  let count = $derived($refundablesStore.items.length);
</script>

{#if count > 0}
  <div
    class="premium-card backdrop-blur-xl bg-orange-500/10 border-2 border-orange-500/40 hover:border-orange-500 transition-all duration-500 animate-scaleIn hover:shadow-2xl hover:shadow-orange-500/30"
  >
    <div class="flex items-start gap-4">
      <div class="p-3 rounded-2xl bg-orange-500/20">
        <iconify-icon icon="ph:warning-bold" class="text-orange-400" width="28"
        ></iconify-icon>
      </div>
      <div class="flex-1">
        <div class="text-sm font-semibold text-orange-300 mb-1">
          {$t("payments.refundAvailable") || "Refundable Deposit Detected"}
        </div>
        <div class="text-xs text-white/70 mb-3">
          {count} on-chain deposit{count === 1 ? "" : "s"} need a refund. You can
          send them back to a Bitcoin address.
        </div>
        <button
          class="btn btn-sm btn-outline border-orange-400 text-orange-300 hover:bg-orange-400/20"
          onclick={() => goto("/refunds")}
        >
          {$t("payments.refund") || "Refund Now"}
        </button>
      </div>
    </div>
  </div>
{/if}
