<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { t } from "$lib/translations";
  import { listRefundables } from "$lib/walletService";
  import RefundForm from "$comp/RefundForm.svelte";

  let swapAddress = $derived(
    decodeURIComponent($page.params.swapAddress || ""),
  );
  let refundable = $state(null);
  let loading = $state(true);
  let error = $state(null);

  onMount(async () => {
    try {
      const refundables = await listRefundables();
      refundable =
        refundables.find((item) => item.swapAddress === swapAddress) || null;

      if (!refundable) {
        error = "Refundable swap not found.";
      }
    } catch (err) {
      error = err?.message || "Failed to load refundable swap.";
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <div class="container mx-auto max-w-lg px-4">
    <div class="card bg-base-200">
      <div class="card-body">
        <div class="flex items-center gap-3">
          <span class="loading loading-spinner"></span>
          <span>Loading refundable swap…</span>
        </div>
      </div>
    </div>
  </div>
{:else if error}
  <div class="container mx-auto max-w-lg px-4">
    <div class="card bg-base-200">
      <div class="card-body">
        <p class="text-error">{error}</p>
        <button class="btn btn-ghost mt-4" onclick={() => goto("/refunds")}>
          {$t("common.back") || "Back"}
        </button>
      </div>
    </div>
  </div>
{:else}
  <RefundForm
    swapAddress={refundable.swapAddress}
    amountSat={refundable.amountSat}
    lastRefundTxId={refundable.lastRefundTxId || ""}
    onCancel={() => goto("/refunds")}
    onSuccess={() => setTimeout(() => goto("/refunds"), 2000)}
  />
{/if}
