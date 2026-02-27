<script>
  export let open = false;
  export let title = "Add Shortcut to Homescreen";
  export let onClose = () => {};

  const titleId = `install-instructions-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
</script>

{#if open}
  <div
    class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onclick={onClose}
  >
    <div
      class="glass p-6 rounded-3xl border-2 border-blue-500/50 bg-gradient-to-br from-blue-500/20 to-purple-500/20 max-w-md w-full animate-scaleIn"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div class="flex items-center justify-between mb-4">
        <h3
          id={titleId}
          class="text-xl font-bold text-white flex items-center gap-2"
        >
          <iconify-icon icon="ph:info-bold" width="24" class="text-blue-400"
          ></iconify-icon>
          {title}
        </h3>
        <button
          onclick={onClose}
          class="p-2 hover:bg-white/10 rounded-lg transition-all"
          aria-label="Close instructions"
        >
          <iconify-icon icon="ph:x-bold" width="24" class="text-white/60"
          ></iconify-icon>
        </button>
      </div>

      <div class="space-y-4 text-white/80">
        <slot />

        <button
          onclick={onClose}
          class="w-full mt-4 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105"
          style="background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%); color: white;"
        >
          Got it!
        </button>
      </div>
    </div>
  </div>
{/if}
