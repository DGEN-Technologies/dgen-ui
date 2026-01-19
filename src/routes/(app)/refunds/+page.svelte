<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { format } from "date-fns";
  import { sat } from "$lib/utils";
  import { refundablesStore } from "$lib/stores/refundables";

  const MS_TIMESTAMP_THRESHOLD = 10000000000; // 10-digit seconds vs 13-digit milliseconds.

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "--";
    const date =
      timestamp > MS_TIMESTAMP_THRESHOLD
        ? new Date(timestamp)
        : new Date(timestamp * 1000);
    return format(date, "h:mmaaa MMM d, yyyy");
  };

  const refresh = async (options = {}) => {
    await refundablesStore.refresh(options);
  };

  onMount(() => {
    refresh();
  });
</script>

<div class="container mx-auto max-w-2xl px-4 space-y-6">
  <div
    class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
  >
    <div>
      <h1 class="text-3xl font-semibold">Refundable Deposits</h1>
      <p class="text-sm text-secondary">
        Refund on-chain deposits that fell below the network minimum.
      </p>
    </div>
    <button
      class="btn btn-primary btn-sm w-full sm:w-auto"
      onclick={() => refresh({ rescan: true })}
    >
      Rescan
    </button>
  </div>

  {#if $refundablesStore.loading}
    <div class="card bg-base-200">
      <div class="card-body">
        <div class="flex items-center gap-3">
          <span class="loading loading-spinner"></span>
          <span>Loading refundable swaps…</span>
        </div>
      </div>
    </div>
  {:else if $refundablesStore.error}
    <div class="card bg-base-200">
      <div class="card-body">
        <p class="text-error">{$refundablesStore.error}</p>
        <button class="btn btn-outline mt-4" onclick={() => refresh()}>
          Try Again
        </button>
      </div>
    </div>
  {:else if $refundablesStore.items.length === 0}
    <div class="card bg-base-200">
      <div class="card-body">
        <p>
          {"No Refundables Available"}
        </p>
      </div>
    </div>
  {:else}
    <div class="space-y-4">
      {#each $refundablesStore.items as swap}
        <div class="card bg-base-200">
          <div class="card-body space-y-3">
            <div class="flex items-center justify-between gap-4">
              <div class="text-xl font-semibold">
                {sat(swap.amountSat)} sats
              </div>
              <div class="text-xs text-secondary">
                {formatTimestamp(swap.timestamp)}
              </div>
            </div>
            <div class="text-xs text-secondary break-all">
              Swap address: {swap.swapAddress}
            </div>
            {#if swap.lastRefundTxId}
              <div class="text-xs text-secondary break-all">
                Last refund txid: {swap.lastRefundTxId}
              </div>
            {/if}
            <button
              class="btn btn-primary w-full"
              onclick={() =>
                goto(`/refunds/${encodeURIComponent(swap.swapAddress)}`)}
            >
              {swap.lastRefundTxId ? "Retry Refund" : "Refund"}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
