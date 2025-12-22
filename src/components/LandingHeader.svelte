<script>
  import { goto } from "$app/navigation";
  import { scroll } from "$lib/utils";
  import { t } from "$lib/translations";
  import { page } from "$app/stores";

  import DarkToggle from "$comp/DarkToggle.svelte";
  import LocaleSelector from "$comp/LocaleSelector.svelte";
  import ProModeToggle from "$comp/ProModeToggle.svelte";

  let { howItWorks, roadmap, faq, about, user } = $props();

  let showMobileMenu = $state(false);
  let header = $state();
  const mobileMenuButtonClick = (section) => {
    showMobileMenu = false;
    scroll(section);
  };
</script>

<header
  class="w-full px-6 py-4 fixed z-50 top-0 lg:bg-base-100/80 lg:backdrop-blur-xl lg:border-b lg:border-white/10"
  bind:this={header}
>
  <nav class="flex justify-between items-center max-w-7xl mx-auto">
    <div class="flex justify-start items-center">
      <!-- Logo removed from nav bar -->
    </div>

    <!-- desktop nav -->
    <div
      class="hidden space-x-6 lg:flex justify-center items-center font-semibold"
    >
      {#if $page.url.pathname === "/"}
        <button
          class="hover:text-primary transition-colors duration-200"
          onclick={() => scroll(howItWorks)}>{$t("howItWorks.header")}</button
        >
        <button
          class="hover:text-primary transition-colors duration-200"
          onclick={() => scroll(roadmap)}>Roadmap</button
        >
        <button
          class="hover:text-primary transition-colors duration-200"
          onclick={() => scroll(faq)}>{$t("faq.header")}</button
        >
        <button
          class="hover:text-primary transition-colors duration-200"
          >Merch <span class="text-xs text-gray-500 dark:text-gray-400">(coming soon)</span></button
        >
        <ProModeToggle />
      {/if}
      {#if user}
        <button
          class="btn !w-auto !rounded-full"
          onclick={() => goto(`/${user.username}`)}
          >{$t("nav.home")}
        </button>
        <button
          class="btn !w-auto !rounded-full"
          onclick={() => goto("/logout")}
        >
          {$t("nav.signOut")}
        </button>
      {:else}
        <button
          class="btn bg-gradient-primary text-white border-0 !w-auto !rounded-full px-6 hover:shadow-lg hover:scale-105 transition-all"
          onclick={() => goto("/register")}
          >{$t("nav.register")}
        </button>
        <button
          class="btn btn-ghost !w-auto !rounded-full px-6 border border-white/20 hover:bg-white/10 transition-all"
          onclick={() => goto("/login")}
        >
          {$t("nav.signIn")}
        </button>
      {/if}
    </div>

    <!-- Mobile menu button -->
    <button
      aria-label="Menu"
      class="block lg:hidden z flex items-center justify-center p-2"
      onclick={() => (showMobileMenu = !showMobileMenu)}
    >
      <iconify-icon
        noobserver
        icon={!showMobileMenu ? "ph:list-bold" : "ph:x-bold"}
        width="32"
      ></iconify-icon>
    </button>

    <div
      class="container w-full p-6 lg:hidden absolute top-0 {showMobileMenu
        ? 'right-0'
        : 'right-[-100%]'} transition-all ease-in-out duration-300 h-[100vh] w-full bg-base-100"
    >
      <div class="space-y-4 mt-16 font-bold text-xl">
        <LocaleSelector />
        <!-- <DarkToggle /> -->
        <button onclick={() => mobileMenuButtonClick(howItWorks)} class="block"
          >{$t("howItWorks.header")}</button
        >
        <button onclick={() => mobileMenuButtonClick(roadmap)} class="block"
          >Roadmap</button
        >
        <button onclick={() => mobileMenuButtonClick(faq)} class="block"
          >{$t("faq.header")}</button
        >
        <button class="block"
          >Merch <span class="text-sm text-gray-500 dark:text-gray-400">(coming soon)</span></button
        >
        <ProModeToggle />
        {#if !user}
          <button class="btn btn-accent" onclick={() => goto("/register")}
            >{$t("nav.register")}
          </button>
          <button class="btn" onclick={() => goto("/login")}>
            {$t("nav.signIn")}
          </button>
        {:else}
          <button
            class="border rounded-full px-6 py-2 font-bold block"
            onclick={() => goto(`/${user.username}`)}
            >{$t("nav.account")}
          </button>
          <button
            class="bg-primary text-white border rounded-full px-6 py-2 font-bold block"
            onclick={() => goto("/logout")}
          >
            {$t("nav.signOut")}
          </button>
        {/if}
      </div>
    </div>
  </nav>
</header>

<style>
  .z {
    z-index: 100;
  }
</style>
