<script>
  let { image, style } = $props();

  function handleError(event) {
    // Hide image if it fails to load
    event.target.style.display = "none";
  }
</script>

<img
  src="/images/{image}.webp"
  alt={image}
  class={style}
  on:error={handleError}
/>
