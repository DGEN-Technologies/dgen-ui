<script>
  import { theme } from "$lib/store";
  import DarkToggle from "$comp/DarkToggle.svelte";
  import ProModeToggle from "$comp/ProModeToggle.svelte";
  import { OutClick } from "svelte-outclick";
  let { t, user, w, opacity } = $props();

  let dark = () => ($theme = $theme === "dark" ? "light" : "dark");
  let showMenu = $state(false);

  let menuButtons = [
    { key: "nav.settings", icon: "ph:gear-bold", href: `/settings` },
    // { key: "nav.support", icon: "ph:lifebuoy-bold", href: `/support` },
    {
      key: "nav.merch",
      icon: "ph:storefront-bold",
      href: `#`,
      comingSoon: true
    },
    // Dark mode toggle disabled for now - light mode needs more work
    // { key: "nav.dark", icon: "ph:moon-stars-bold", href: `/dark` },
    { key: "nav.signOut", icon: "ph:sign-out-bold", href: `/logout` },
  ];

  let hideMenu = () => (showMenu = false);
  let toggleMenu = () => (showMenu = !showMenu);
</script>

<div>
  <OutClick onOutClick={hideMenu}>
    <button
      class="btn-menu {opacity('/support')} flex-col gap-1"
      onclick={toggleMenu}
      aria-label="Open menu"
      ><iconify-icon noobserver icon="ph:list-bold" width={w > 640 ? 32 : 24}
      ></iconify-icon>
      <span class="hidden md:block text-xs font-semibold whitespace-nowrap">SETTINGS</span>
    </button>

    <div
      class="absolute top-14 right-0 backdrop-blur-xl dark:bg-black/90 bg-white/90 dark:border-white/20 border-gray-300/50 border rounded-3xl p-8 shadow-xl z-50"
      class:hidden={!showMenu}
      class:block={showMenu}
    >
      <ul class="space-y-5 w-48">
        {#each menuButtons as { href, icon, key, comingSoon }}
          <li>
            {#if key.includes("dark")}
              <DarkToggle />
            {:else}
              <a
                {href}
                data-sveltekit-preload-code="eager"
                data-sveltekit-preload-data="false"
                data-sveltekit-reload={key === "nav.signOut" ? true : undefined}
                onclick={comingSoon ? (e) => e.preventDefault() : hideMenu}
                class:opacity-60={comingSoon}
                class:cursor-not-allowed={comingSoon}
              >
                <button
                  class="flex flex-col justify-center items-center font-semibold hover:opacity-80 gap-1 dark:text-white text-gray-800"
                  disabled={comingSoon}
                >
                  <div class="flex items-center gap-2">
                    <iconify-icon noobserver {icon} width="32"></iconify-icon>
                    {t(key)}
                  </div>
                  {#if comingSoon}
                    <span class="text-xs text-white/50">(coming soon)</span>
                  {/if}
                </button>
              </a>
            {/if}
          </li>
        {/each}
      </ul>
      <hr class="my-4 dark:border-white/20 border-gray-300" />
      <!-- PRO MODE toggle for all users -->
      <div class="mb-4">
        <ProModeToggle />
      </div>
      <a href="/?stay=true" class="hover:opacity-80 transition-opacity"><div class="text-xl font-bold dark:text-white text-gray-800">Website Home Page</div></a>
    </div>
  </OutClick>
</div>

<style>
  .btn-menu {
    @apply flex justify-center items-center glass backdrop-blur-xl dark:bg-black/50 bg-white/80 dark:border-white/20 border-gray-300/50 border dark:text-white text-gray-800 p-2 rounded-full w-12 h-12 sm:w-16 sm:h-16 md:w-auto md:h-auto md:rounded-2xl md:px-3 md:py-2 drop-shadow-xl;
  }
</style>
