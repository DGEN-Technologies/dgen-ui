<script>
  import screenfull from "screenfull";
  let { icon, text } = $props();
  let qr = $state();

  let src = `/qr/${encodeURIComponent(text)}`;
  if (icon) src += `/${icon}`;
  else src += "/raw";
</script>

<div
  class="w-full max-w-[240px] sm:max-w-[280px] md:max-w-[320px] mx-auto cursor-pointer"
  bind:this={qr}
  onclick={() => screenfull.toggle(qr)}
  onkeydown={() => screenfull.toggle(qr)}
>
  <img {src} class="w-full h-auto mx-auto" alt="QR Code" />
</div>
