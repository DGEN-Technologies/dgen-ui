<script>
  import SendLightning from "$comp/SendLightning.svelte";
  import { page } from "$app/stores";
  
  let payreq = $derived($page.params.payreq);
  let memo = $derived($page.params.memo);
</script>

<SendLightning {payreq} {memo} />