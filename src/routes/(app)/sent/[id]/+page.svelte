<script>
  import { focus } from "$lib/utils";
  import { t } from "$lib/translations";
  import Success from "$comp/Success.svelte";

  let { data } = $props();
  let { user } = $state(data);
  let { username } = $derived(user);
</script>

<Success title={`${$t("payments.sent")}!`} minimal />

<a href={`/${username}`} use:focus aria-label="Continue">
  <div class="opacity-0 w-screen h-screen fixed top-0 left-0 z-50"></div>
</a>

<div class="flex justify-center mt-4">
  {$t("payments.tapAnywhere")}
</div>
