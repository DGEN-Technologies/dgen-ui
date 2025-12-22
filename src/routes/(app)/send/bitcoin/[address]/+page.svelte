<script>
  import { tick } from "svelte";
  import { t } from "$lib/translations";
  import Icon from "$comp/Icon.svelte";
  import Numpad from "$comp/Numpad.svelte";
  import { page } from "$app/stores";
  import { rate } from "$lib/store";
  import { loc, fail, s, focus } from "$lib/utils";
  import { walletBalance } from "$lib/stores/wallet";

  let { data } = $props();

  let { user } = data;
  let { address } = $page.params;
  // Clean up the address - remove any trailing whitespace or newlines
  address = address.trim();
  let { currency, username } = user;
  let locale = loc(user);

  let amount = $state(0);
  let a = $state(0);
  let submit = $state(),
    fiat = $state();
  $effect(() => ($rate = data.rate));
  $effect(() => (amount = a));

  let setMax = async (e) => {
    e.preventDefault();
    fiat = false;
    amount = $walletBalance;
    await tick();
    submit.click();
  };
</script>

<div class="container px-4 max-w-xl mx-auto space-y-5 text-center">
  <!-- Back Button -->
  <div class="flex items-center justify-between mb-4">
    <button
      type="button"
      class="btn btn-ghost btn-sm gap-2"
      onclick={() => window.history.back()}
    >
      <iconify-icon icon="ph:arrow-left-bold" width="20"></iconify-icon>
      Back
    </button>
    <div class="flex-1"></div>
  </div>

  <h1 class="text-3xl md:text-4xl font-semibold mb-2">{$t("payments.send")}</h1>

  <div class="text-xl text-secondary break-all">{address}</div>

  <Numpad
    bind:amount={a}
    bind:fiat
    {currency}
    {submit}
    bind:rate={$rate}
    {locale}
    skipBalanceCheck={true}
  />

  <div class="flex justify-center gap-2">
    <button
      type="button"
      class="btn !w-auto grow"
      onclick={setMax}
      onkeydown={setMax}>Max ⚡️{s($walletBalance)}</button
    >

    <form action={`/send/bitcoin/${encodeURIComponent(address)}/${amount}/`} class="contents">
      <button
        use:focus
        bind:this={submit}
        type="submit"
        class="btn !w-auto grow btn-accent"
        disabled={!amount || amount <= 0}
      >
        {$t("payments.next")}
      </button>
    </form>
  </div>
</div>
