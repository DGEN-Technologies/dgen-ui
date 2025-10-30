<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { getSavedMnemonic, getWalletPassword } from "$lib/walletService";

  let { data } = $props();
  let { user } = $derived(data || {});

  onMount(async () => {
    // Wallets auto-generate now, just redirect to profile
    goto(`/${user.username}`);
  });
</script>

<div class="container px-4 max-w-xl mx-auto text-center space-y-4">
  <p class="text-white/60">Checking wallet status...</p>
</div>