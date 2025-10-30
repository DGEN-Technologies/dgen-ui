<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { t } from "$lib/translations";
  import { get, post, fail, success } from "$lib/utils";
  
  let { data } = $props();
  let { user, payment } = $state(data);
  
  let loading = $state(false);
  let refundAddress = $state("");
  let feeRate = $state(1); // Default to 1 sat/vbyte (economy)
  let recommendedFees = $state(null);
  let showConfirm = $state(false);
  let preparedRefund = $state(null);
  
  onMount(async () => {
    // Get recommended fees
    try {
      const fees = await get("/wallet/refund-fees");
      recommendedFees = fees.fees;
      // Set default to the economy fee rate (lowest)
      if (recommendedFees?.economy) {
        feeRate = recommendedFees.economy;
      } else if (recommendedFees?.hour) {
        feeRate = recommendedFees.hour;
      }
    } catch (e) {
      console.error("Failed to get recommended fees:", e);
      // Fall back to reasonable defaults if fees API fails
      recommendedFees = {
        economy: 1,
        hour: 3,
        fastest: 5
      };
      feeRate = 1; // Default to economy (1 sat/vbyte)
    }
  });
  
  async function prepareRefund() {
    if (!refundAddress) {
      fail($t("payments.refundAddressRequired") || "Please enter a Bitcoin address");
      return;
    }
    
    loading = true;
    try {
      // For now, just show confirmation
      // In production, you'd call a prepare endpoint first
      preparedRefund = {
        swapAddress: payment.swapAddress || payment.swapId,
        refundAddress,
        feeRate,
        estimatedFee: Math.round(feeRate * 200) // Rough estimate
      };
      showConfirm = true;
    } catch (e) {
      fail(e.message || "Failed to prepare refund");
    } finally {
      loading = false;
    }
  }
  
  async function confirmRefund() {
    loading = true;
    console.log('Starting refund with:', {
      swapAddress: payment.swapAddress || payment.swapId,
      refundAddress,
      feeRateSatPerVbyte: feeRate
    });
    
    try {
      const result = await post("/wallet/refund", {
        swapAddress: payment.swapAddress || payment.swapId,
        refundAddress,
        feeRateSatPerVbyte: feeRate
      });
      
      console.log('Refund result:', result);
      success($t("payments.refundSuccess") || "Refund transaction broadcast successfully!");
      
      // Redirect back to payment details
      setTimeout(() => {
        goto(`/payment/${payment.id}`);
      }, 2000);
    } catch (e) {
      console.error('Refund error:', e);
      fail(e.message || "Failed to process refund");
    } finally {
      loading = false;
    }
  }
  
  function setFeeRate(rate) {
    feeRate = rate;
  }
</script>

<div class="container mx-auto max-w-lg px-4 space-y-6">
  <h1 class="text-3xl font-semibold text-center mb-8">
    {$t("payments.refund") || "Refund Payment"}
  </h1>
  
  {#if !showConfirm}
    <div class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title">{$t("payments.refundDetails") || "Refund Details"}</h2>
        
        <div class="space-y-4">
          <div>
            <label class="label">
              <span class="label-text">{$t("payments.amount") || "Amount"}</span>
            </label>
            <div class="text-2xl font-bold">
              {Math.abs(payment.amount).toLocaleString()} sats
            </div>
          </div>
          
          <div>
            <label class="label">
              <span class="label-text">{$t("payments.refundTo") || "Refund to Bitcoin address"}</span>
            </label>
            <input
              type="text"
              bind:value={refundAddress}
              placeholder="bc1q..."
              class="input input-bordered w-full"
              disabled={loading}
            />
          </div>
          
          <div>
            <label class="label">
              <span class="label-text">{$t("payments.feeRate") || "Network Fee Rate"} (sat/vbyte)</span>
            </label>
            
            {#if recommendedFees}
              <div class="grid grid-cols-3 gap-2 mb-2">
                <button 
                  class="btn btn-sm {feeRate === recommendedFees.economy ? 'btn-primary' : 'btn-outline'}"
                  onclick={() => setFeeRate(recommendedFees.economy)}
                >
                  {$t("payments.feeSlow") || "Slow"}<br/>
                  {recommendedFees.economy} sat/vb
                </button>
                <button 
                  class="btn btn-sm {feeRate === recommendedFees.hour ? 'btn-primary' : 'btn-outline'}"
                  onclick={() => setFeeRate(recommendedFees.hour)}
                >
                  {$t("payments.feeNormal") || "Normal"}<br/>
                  {recommendedFees.hour} sat/vb
                </button>
                <button 
                  class="btn btn-sm {feeRate === recommendedFees.fastest ? 'btn-primary' : 'btn-outline'}"
                  onclick={() => setFeeRate(recommendedFees.fastest)}
                >
                  {$t("payments.feeFast") || "Fast"}<br/>
                  {recommendedFees.fastest} sat/vb
                </button>
              </div>
            {/if}
            
            <input
              type="number"
              bind:value={feeRate}
              min="1"
              max="500"
              class="input input-bordered w-full"
              disabled={loading}
            />
            <div class="text-sm text-secondary mt-1">
              Estimated fee: ~{Math.round(feeRate * 200)} sats
            </div>
          </div>
        </div>
        
        <div class="card-actions justify-end mt-6">
          <button 
            class="btn btn-ghost"
            onclick={() => goto(`/payment/${payment.id}`)}
            disabled={loading}
          >
            {$t("common.cancel") || "Cancel"}
          </button>
          <button 
            class="btn btn-primary"
            onclick={prepareRefund}
            disabled={loading || !refundAddress}
          >
            {#if loading}
              <span class="loading loading-spinner"></span>
            {/if}
            {$t("common.continue") || "Continue"}
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title">{$t("payments.confirmRefund") || "Confirm Refund"}</h2>
        
        <div class="space-y-4">
          <div class="alert alert-info">
            <iconify-icon icon="ph:info" width="24"></iconify-icon>
            <span>
              {$t("payments.refundWarning") || "Please verify the refund address is correct. This transaction cannot be reversed."}
            </span>
          </div>
          
          <div>
            <div class="text-sm text-secondary">{$t("payments.refundTo") || "Refund to"}</div>
            <div class="font-mono text-sm break-all">{refundAddress}</div>
          </div>
          
          <div>
            <div class="text-sm text-secondary">{$t("payments.amount") || "Amount"}</div>
            <div class="text-xl font-bold">{Math.abs(payment.amount).toLocaleString()} sats</div>
          </div>
          
          <div>
            <div class="text-sm text-secondary">{$t("payments.networkFee") || "Network Fee"}</div>
            <div>~{preparedRefund.estimatedFee} sats ({feeRate} sat/vbyte)</div>
          </div>
          
          <div>
            <div class="text-sm text-secondary">{$t("payments.youWillReceive") || "You will receive"}</div>
            <div class="text-xl font-bold">
              ~{(Math.abs(payment.amount) - preparedRefund.estimatedFee).toLocaleString()} sats
            </div>
          </div>
        </div>
        
        <div class="card-actions justify-end mt-6">
          <button 
            class="btn btn-ghost"
            onclick={() => showConfirm = false}
            disabled={loading}
          >
            {$t("common.back") || "Back"}
          </button>
          <button 
            class="btn btn-primary"
            onclick={confirmRefund}
            disabled={loading}
          >
            {#if loading}
              <span class="loading loading-spinner"></span>
            {/if}
            {$t("payments.confirmRefund") || "Confirm Refund"}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>