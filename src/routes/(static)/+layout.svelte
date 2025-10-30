<script>
  import { run } from "svelte/legacy";

  // import Nostr from "$comp/Nostr.svelte"; // NOSTR DISABLED
  import { SvelteToast } from "@zerodevx/svelte-toast";
  import Footer from "$comp/Footer.svelte";
  import LandingHeader from "$comp/LandingHeader.svelte";
  import { theme as themeStore, proMode } from "$lib/store";

  let { data, children } = $props();
  let { theme } = $state(data);
  let { user } = $derived(data);
  run(() => {
    theme = $themeStore;
  });
</script>

<SvelteToast options={{ reversed: true, intro: { y: 192 } }} />
<LandingHeader {user} />
<!-- <Nostr /> --> <!-- NOSTR DISABLED -->
<main
  class="container flex px-4 md:px-40 mx-auto min-h-[600px] pt-20"
  data-theme={theme}
  class:pro-mode={$proMode}
>
  {@render children?.()}
</main>
<Footer />
