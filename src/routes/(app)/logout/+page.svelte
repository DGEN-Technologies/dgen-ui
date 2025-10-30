<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  onMount(async () => {
    if (browser) {
      // Clear in-memory stores (not the persisted wallet data)
      try {
        const { lnAddressStore } = await import('$lib/stores/lightningAddress');
        const { walletStore, transactions } = await import('$lib/stores/wallet');

        // Reset stores to initial state
        lnAddressStore.reset();
        walletStore.reset();
        transactions.reset();

        console.log('[Logout] Cleared in-memory stores');
      } catch (e) {
        console.error('[Logout] Failed to clear stores:', e);
      }

      // Force a full page reload to ensure clean state
      // This prevents old wallet data from showing when switching users
      window.location.replace('/login');
    }
  });
</script>
