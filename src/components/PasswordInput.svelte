<script>
  let {
    name = $bindable("password"),
    show = $bindable(),
    value = $bindable(),
    placeholder = undefined,
  } = $props();

  let toggle = (e) => {
    e?.preventDefault();
    show = !show;
  };

  let icon = $derived(show ? "ph:eye-bold" : "ph:eye-slash-bold");
</script>

<label
  for="password"
  class="input flex items-center justify-center gap-2 w-full"
>
  {#if show}
    <input
      id="password"
      {name}
      type="text"
      bind:value
      class="clean"
      {placeholder}
    />
  {:else}
    <input
      id="password"
      {name}
      type="password"
      bind:value
      class="clean"
      {placeholder}
    />
  {/if}
  <button type="button" aria-label="Toggle" onclick={toggle} class="contents">
    <iconify-icon noobserver {icon} width="32"></iconify-icon>
  </button>
</label>
