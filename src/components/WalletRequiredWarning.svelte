<script>
  import { t } from "$lib/translations";
  import { goto } from "$app/navigation";
  
  let { show = false, message = null } = $props();
</script>

{#if show}
  <div class="alert alert-error shadow-lg mb-6">
    <iconify-icon icon="ph:warning-circle" width="24"></iconify-icon>
    <div>
      <h3 class="font-bold">{$t("wallet.setupRequired") || "Wallet Setup Required"}</h3>
      <div class="text-sm">
        {message || $t("wallet.cannotReceiveWithoutWallet") || "You cannot receive payments without initializing your wallet with a seed phrase. Your funds would be lost!"}
      </div>
    </div>
    <button 
      class="btn btn-sm btn-warning"
      onclick={() => goto("/wallet/setup")}
    >
      {$t("wallet.setupNow") || "Setup Wallet Now"}
    </button>
  </div>
{/if}

<style>
  .alert-error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 2px solid rgb(239, 68, 68);
  }
</style>