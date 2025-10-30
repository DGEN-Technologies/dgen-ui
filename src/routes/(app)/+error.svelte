<script>
  import { back } from "$lib/utils";
  import Icon from "$comp/Icon.svelte";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import Spinner from "$comp/Spinner.svelte";

  let { data } = $props();
  let { user } = data;

  let link = user ? `/${user.username}` : "/";
  
  let isRetryable = $derived($page.error?.retryable || 
                            $page.error?.message?.includes("syncing") ||
                            $page.status === 503);
  
  let autoRetryCountdown = $state(5);
  let isRetrying = $state(false);
  
  onMount(() => {
    if (isRetryable) {
      const interval = setInterval(() => {
        autoRetryCountdown--;
        if (autoRetryCountdown <= 0) {
          clearInterval(interval);
          handleRetry();
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  });
  
  function handleRetry() {
    isRetrying = true;
    window.location.reload();
  }
</script>

<div class="container px-4 max-w-xl mx-auto mt-10 space-y-5">
  <div class="w-full flex">
    <a href="/" class="mx-auto">
      <Icon icon="logo" />
    </a>
  </div>

  <div class="flex justify-center items-center">
    <div class="shadow-xl rounded-3xl px-10 pt-5 pb-10 space-y-5 w-full mx-5">
      <div class="relative">
        <h1 class="text-2xl md:text-3xl font-semibold text-center">
          {isRetryable ? "Wallet Syncing" : "Error"}
        </h1>
      </div>
      
      {#if isRetryable}
        <div class="space-y-4">
          <p class="text-secondary text-center">
            {$page.error?.message || "Your wallet is still syncing. Please wait a moment."}
          </p>
          
          <div class="flex justify-center">
            <div class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 max-w-sm">
              <div class="flex items-center gap-3">
                <Spinner />
                <div class="text-blue-400">
                  <p class="text-sm">Auto-refreshing in {autoRetryCountdown} seconds...</p>
                  <p class="text-xs mt-1 opacity-70">Your wallet data is being synchronized</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="flex justify-center gap-4 pt-8">
            <button
              onclick={handleRetry}
              disabled={isRetrying}
              class="bg-gradient-to-r from-dgen-aqua to-dgen-cyan text-black px-6 py-3 rounded-full font-bold hover:shadow-lg hover:shadow-dgen-aqua/30 disabled:opacity-50 transition-all"
            >
              {#if isRetrying}
                <span class="inline-flex items-center gap-2">
                  <Spinner />
                  <span>Refreshing...</span>
                </span>
              {:else}
                Refresh Now
              {/if}
            </button>
            
            <a href={link}>
              <button class="bg-white/10 backdrop-blur text-white px-6 py-3 rounded-full font-bold hover:bg-white/20 transition-all">
                Go Back
              </button>
            </a>
          </div>
        </div>
      {:else}
        <p class="text-secondary text-center">Something went wrong</p>
        <p class="text-secondary text-center">{$page.error?.message || 'Unknown error occurred'}</p>

        <div class="flex justify-center py-24">
          <a href={link}>
            <button
              class="bg-black text-white border rounded-full px-8 py-4 font-bold hover:opacity-80 text-xl"
            >
              Back
            </button>
          </a>
        </div>
      {/if}
    </div>
  </div>
</div>
