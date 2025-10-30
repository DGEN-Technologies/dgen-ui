<script lang="ts">
  import { proMode } from "$lib/store";
  
  interface Props {
    children?: import("svelte").Snippet;
  }

  let { children }: Props = $props();
</script>

<main class="min-h-dvh" class:pro-mode={$proMode}>
  {@render children?.()}
</main>
