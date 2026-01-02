<script>
  import SendLightning from "$comp/SendLightning.svelte";

  let { data } = $props();
  let { payreq, memo, rate, currency } = $derived(data);
</script>

<SendLightning {payreq} {memo} {rate} {currency} />
