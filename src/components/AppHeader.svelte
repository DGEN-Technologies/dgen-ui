<script>
  import { PUBLIC_DGEN_URL } from "$env/static/public";
  import { banner, theme, newPayment } from "$lib/store";
  import { goto } from "$app/navigation";
  import { getImageUrl } from "$lib/utils";
  import Avatar from "$comp/Avatar.svelte";
  import Menu from "$comp/Menu.svelte";
  import { loading, t } from "$lib/translations";
  import { page } from "$app/stores";

  let { user, subject = $bindable() } = $props();

  let w = $state();
  $effect(() => (subject = subject || user));

  let bannerUrl = $derived(
    $banner?.id && $banner.id === subject?.id && $banner.src
      ? $banner.src
      : subject?.banner && subject.banner !== 'undefined' && subject.banner !== undefined
        ? subject.banner
        : null
  );

  // Convert relative URLs to full backend URLs for production compatibility
  let bg = $derived(bannerUrl ? `url(${getImageUrl(bannerUrl)})` : null);

  const links = $derived([
    {
      href: `/${user?.username}`,
      icon: "ph:house-bold",
      label: "HOME",
    },
    {
      href: `/${user?.username}/receive`,
      icon: "ph:hand-coins-bold",
      flip: "horizontal",
      label: "RECEIVE",
    },
    {
      href: `/payments`,
      icon: "ph:clock-bold",
      label: "TX HISTORY",
    },
    {
      href: `/send`,
      icon: "ph:paper-plane-right-bold",
      label: "SEND",
    },
    // {
    //   href: `/logout`,
    //   icon: "ph:sign-out-bold",
    //   label: "Logout",
    // },
  ]);

  let opacity = $derived((href) =>
    $page.url.pathname === href
      ? "opacity-100"
      : "opacity-90 hover:opacity-none",
  );
</script>

<svelte:window bind:innerWidth={w} />

{#if !$loading}
  <header
    class="glass backdrop-blur-xl h-[175px] w-full relative mb-16 !z-30 border-b dark:border-white/10 border-gray-300/50 {bg ? 'dark:bg-black/40 bg-white/40' : ''}"
    style:background-image={bg}
  >
    <nav class="flex justify-end items-center space-x-2 sm:space-x-4 p-3 sm:p-5 pr-2 sm:pr-5">
      {#if user}
        {#each links as { href, icon, flip, label }}
          <a {href} data-sveltekit-preload-data="off">
            <button class="btn-menu {opacity(href)} flex-col gap-1" aria-label={label}>
              <iconify-icon noobserver {icon} width={w > 640 ? 32 : 24} {flip}
              ></iconify-icon>
              <span class="hidden md:block text-xs font-semibold whitespace-nowrap">{label}</span>
            </button>
          </a>
        {/each}
        <Menu {opacity} {user} t={$t} {w} />
      {:else}
        <a href={`/login?redirect=${$page.url.pathname}`}>
          <button
            class="glass backdrop-blur-xl bg-white/10 border border-white/20 px-6 py-3 !rounded-full text-white font-semibold hover:bg-white/20 transition-all duration-300"
            >{$t("nav.signIn")}</button
          >
        </a>
      {/if}
    </nav>
    {#if subject}
      <div
        class="absolute md:w-[64px] md:mx-auto lg:left-[154px] xl:left-[194px] left-[calc(50vw-64px)] -bottom-[64px] z-30"
      >
        <Avatar user={subject} />
      </div>
    {/if}
  </header>
{/if}

<style>
  .btn-menu {
    @apply flex justify-center items-center glass backdrop-blur-xl dark:bg-black/50 bg-white/80 dark:border-dgen-aqua/20 border-dgen-cyan/30 border dark:text-dgen-aqua text-gray-800 p-2 rounded-full w-12 h-12 sm:w-16 sm:h-16 md:w-auto md:h-auto md:rounded-2xl md:px-3 md:py-2 drop-shadow-xl hover:border-dgen-aqua/50 hover:bg-dgen-aqua/10 transition-all duration-300;
  }

  header {
    z-index: 50;
    view-transition-name: header;
  }
</style>
