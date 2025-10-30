<script>
  import { proMode } from "$lib/store";
  import { fade } from "svelte/transition";
  
  let showTooltip = $state(false);
  let proModeValue = $state(false);
  
  // Subscribe to the store
  $effect(() => {
    const unsubscribe = proMode.subscribe(value => {
      proModeValue = value;
    });
    
    return unsubscribe;
  });
  
  const toggleProMode = () => {
    proMode.update(v => !v);
  };
</script>

<div class="relative flex items-center">
  <button
    class="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 {proModeValue 
      ? 'border-cyan-400 bg-cyan-400/10 shadow-lg shadow-cyan-400/30' 
      : 'border-white/20 bg-white/5 opacity-75 hover:opacity-100'} hover:scale-105"
    onclick={toggleProMode}
    onmouseenter={() => showTooltip = true}
    onmouseleave={() => showTooltip = false}
  >
    <span class="text-sm font-medium {proModeValue ? 'text-cyan-400 font-bold drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'text-white/80'}">
      PRO MODE
    </span>
    <div class="flex items-center justify-center w-5 h-5">
      {#if proModeValue}
        <iconify-icon icon="ph:lightning-fill" class="text-cyan-400 animate-pulse drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" width="20"></iconify-icon>
      {:else}
        <iconify-icon icon="ph:lightning" class="text-white/40" width="20"></iconify-icon>
      {/if}
    </div>
  </button>
  
  {#if showTooltip}
    <div 
      class="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-base-200 text-sm px-3 py-2 rounded-lg shadow-xl border border-white/10 whitespace-nowrap z-50"
      transition:fade={{ duration: 200 }}
    >
      <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-base-200 rotate-45 border-t border-l border-white/10"></div>
      Enables all visual effects which uses more processing power
    </div>
  {/if}
</div>