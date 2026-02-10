<script>
  import { onMount } from "svelte";
  import { renderSafeMarkdown } from "$lib/safeMarkdown";
  import termsMarkdown from "$lib/terms.md?raw";

  let html = $state("");
  const plainText = termsMarkdown.trim();

  onMount(async () => {
    try {
      html = await renderSafeMarkdown(termsMarkdown);
    } catch (error) {
      console.error("Failed to render terms markdown:", error);
    }
  });
</script>

<div class="terms-content text-white/90 text-xs sm:text-sm leading-relaxed">
  {#if html}
    <div class="terms-markdown space-y-4">
      {@html html}
    </div>
  {:else}
    <pre class="whitespace-pre-wrap font-sans">{plainText}</pre>
  {/if}
</div>

<style>
  .terms-markdown :global(p) {
    margin: 0 0 0.75rem 0;
  }

  .terms-markdown :global(ul),
  .terms-markdown :global(ol) {
    padding-left: 1.25rem;
    margin: 0 0 0.75rem 0;
  }

  .terms-markdown :global(li) {
    margin: 0.25rem 0;
  }

  .terms-markdown :global(strong) {
    color: rgba(255, 255, 255, 0.95);
    font-weight: 700;
  }

  .terms-markdown :global(p > strong:only-child) {
    display: inline-block;
    font-size: 0.95rem;
    letter-spacing: 0.01em;
  }

  .terms-markdown :global(code),
  .terms-markdown :global(pre) {
    background: rgba(255, 255, 255, 0.08);
    padding: 0.1rem 0.25rem;
    border-radius: 0.25rem;
  }
</style>
