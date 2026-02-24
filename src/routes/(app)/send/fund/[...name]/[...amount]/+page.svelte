<script>
  import { t } from "$lib/translations";
  import { enhance } from "$app/forms";
  import Numpad from "$comp/Numpad.svelte";
  import Spinner from "$comp/Spinner.svelte";
  import { pin } from "$lib/store";
  import handler from "$lib/handler";
  import { loc } from "$lib/utils";

  let { data, form } = $props();
  let { amount, user } = $state(data);
  let { currency } = $derived(user);
  let { name, rate } = $derived(data);
  let fiat = $state();
  let locale = loc(user);

  let submit = $state();
  let submitting = $state();
  let toggle = () => (submitting = !submitting);
  $effect(() => {
    if (form?.message?.includes("pin")) $pin = undefined;
  });
</script>

{#if form?.message}
  <div class="text-red-600 text-center">
    {form.message}
  </div>
{/if}

<div class="container px-4 mt-20 max-w-xl mx-auto">
  <Numpad bind:amount {currency} {rate} {fiat} {submit} {locale} compactClear />

  <form
    use:enhance={handler(toggle)}
    method="POST"
    class="space-y-5"
  >
    <input name="fund" value={name} type="hidden" />
    <input name="amount" value={amount} type="hidden" />
    <input name="pin" value={$pin} type="hidden" />

    <div class="flex gap-2">
      <button
        use:focus
        bind:this={submit}
        type="submit"
        class="btn btn-accent !w-auto grow"
      >
        {#if submitting}
          <Spinner />
        {:else}
          <div class="my-auto">{$t("payments.next")}</div>
        {/if}
      </button>
    </div>
  </form>
</div>
