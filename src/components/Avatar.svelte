<script lang="ts">
  import { avatar, banner } from "$lib/store";
  import { punk, getImageUrl } from "$lib/utils";

  interface Props {
    user: any;
    size?: number;
    disabled?: boolean;
  }

  let { user, size = 32, disabled = false }: Props = $props();

  let s = $derived(size.toString());
  let link = $derived(user?.anon ? `/${user.pubkey}` : `/${user.username}`);

  let profile = $derived(
    user?.profile ? user.profile :
    user?.picture ? user.picture : null,
  );
  let tmp = $derived($avatar?.id && $avatar.id === user?.id && $avatar.src);
  // Convert relative URLs to full backend URLs for production compatibility
  let src = $derived(getImageUrl(tmp || profile));
  let hasError = $state(false);
</script>

{#snippet body()}
  <div
    class="w-{s} h-{s} rounded-full border-4 border-base-100 overflow-hidden bg-gradient-to-r from-primary to-gradient flex justify-center items-center"
  >
    {#if !src || hasError}
      <!-- Default avatar with DGEN logo -->
      <img
        src="/images/dgen-logo-white.svg"
        class="w-4/5 h-4/5 object-contain"
        alt="DGEN"
      />
    {:else}
      <img
        {src}
        class="w-full h-full object-cover object-center overflow-hidden"
        alt={user?.username}
        onerror={() => (hasError = true)}
      />
    {/if}
  </div>
{/snippet}

{#if disabled}
  {@render body()}
{:else}
  <a href={link} class:pointer-events-none={disabled}>
    {@render body()}
  </a>
{/if}
