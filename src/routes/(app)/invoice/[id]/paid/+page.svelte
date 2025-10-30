<script>
  import Amount from "$comp/Amount.svelte";
  import Success from "$comp/Success.svelte";
  import { t } from "$lib/translations";
  import { loc } from "$lib/utils";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  let { data } = $props();
  let { amount, currency, rate, tip, user, id } = $derived(data.invoice || {});
  let locale = $derived(loc(user));

  onMount(() => {
    const handleClick = () => {
      goto(`/${user?.username || ''}`);
    };

    const timer = setTimeout(() => {
      goto(`/${user?.username || ''}`);
    }, 5000);

    document.addEventListener('click', handleClick);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  });
</script>

<div class="container px-4 text-center mx-auto min-h-screen flex flex-col items-center justify-center">
  <Success
    amount={amount - (tip || 0)}
    {rate}
    tip={tip || 0}
    {currency}
    {locale}
    title={$t("invoice.paymentSuccessful") || "Payment Received!"}
  />

  <div class="flex justify-center mt-8 text-white/60">
    {$t("payments.tapAnywhere") || "Tap anywhere to continue"}
  </div>
</div>
