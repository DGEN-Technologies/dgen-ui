<script>
  import { back } from "$lib/utils";
  import { PUBLIC_SWAPSPACE_WIDGET_URL } from "$env/static/public";
</script>

<div class="flex flex-col h-full w-full max-w-3xl mx-auto p-4">
  <!-- Header -->
  <div class="flex items-center mb-6">
    <button class="btn btn-circle btn-ghost mr-2" onclick={back}>
      <iconify-icon icon="ph:arrow-left-bold" width="24"></iconify-icon>
    </button>
    <h1 class="text-2xl font-bold">Swap Crypto</h1>
  </div>

  <!-- Widget Container -->
  <div class="flex-1 bg-white/5 rounded-3xl overflow-hidden relative min-h-[536px] w-[404px]">
    <iframe 
      src={PUBLIC_SWAPSPACE_WIDGET_URL} 
      title="SwapSpace Widget"
      class="w-full h-full absolute inset-0 border-0"
      allow="clipboard-read; clipboard-write"
    ></iframe>
    
    <!-- Loading/Placeholder State (optional, if you want to show something while iframe loads) -->
    <div class="absolute inset-0 -z-10 flex items-center justify-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white opacity-20"></div>
    </div>
  </div>
</div>
