<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { t } from "$lib/translations";
  import { listRefundables, waitForSdk } from "$lib/walletService";
  import RefundForm from "$comp/RefundForm.svelte";

  const decodeSwapAddress = (value) => {
    if (!value) return { value: "", error: "" };
    try {
      return { value: decodeURIComponent(value), error: "" };
    } catch (err) {
      return { value: "", error: "Invalid swap address." };
    }
  };

  let decodedSwapAddress = $derived.by(() =>
    decodeSwapAddress($page.params.swapAddress || ""),
  );
  let swapAddress = $derived.by(() => decodedSwapAddress.value);
  let refundable = $state(null);
  let loading = $state(true);
  let error = $state(null);

  onMount(async () => {
    try {
      if (decodedSwapAddress.error) {
        error = decodedSwapAddress.error;
        return;
      }

      if (!swapAddress) {
        error = "Swap address not found.";
        return;
      }

      const ready = await waitForSdk();
      if (!ready) {
        error = "Wallet SDK not connected.";
        return;
      }

      const refundables = await listRefundables();
      refundable =
        refundables.find((item) => item.swapAddress === swapAddress) || null;

      if (!refundable) {
        error = "Refundable swap not found.";
      }
    } catch (err) {
      console.error("[Refunds] Failed to load refundable swap:", err);
      error = "Failed to load refundable swap.";
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
