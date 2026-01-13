<script>
  import { goto } from "$app/navigation";
  import { t } from "$lib/translations";
  import RefundForm from "$comp/RefundForm.svelte";

  let { data } = $props();
  let { payment } = $state(data);

  let swapAddress = $derived(
    payment?.details?.bitcoinAddress ||
      payment?.swapAddress ||
      payment?.swapId ||
      payment?.details?.swapId ||
      "",
  );
  let amountSat = $derived(payment?.amountSat ?? Math.abs(payment?.amount ?? 0));
</script>

{#if !payment}
  <div class="container mx-auto max-w-lg px-4">
    <div class="card bg-base-200">
      <div class="card-body">
        <p>{$t("payments.notFound") || "Payment not found."}</p>
      </div>
    </div>
  </div>
{:else if !swapAddress}
  <div class="container mx-auto max-w-lg px-4">
    <div class="card bg-base-200">
      <div class="card-body">
        <p>
          {$t("payments.refundUnavailable") ||
            "Refund details not available for this payment."}
        </p>
        <button class="btn btn-ghost mt-4" onclick={() => goto(`/payment/${payment.id}`)}>
          {$t("common.back") || "Back"}
        </button>
      </div>
    </div>
  </div>
{:else}
  <RefundForm
    {swapAddress}
    {amountSat}
    lastRefundTxId={payment?.details?.refundTxId || ""}
    onCancel={() => goto(`/payment/${payment.id}`)}
    onSuccess={() => setTimeout(() => goto(`/payment/${payment.id}`), 2000)}
  />
{/if}
