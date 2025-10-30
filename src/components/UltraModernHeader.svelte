<script>
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { fly, fade } from "svelte/transition";

  let { user } = $props();

  let scrolled = $state(false);
  let mobileMenuOpen = $state(false);
  let mounted = $state(false);

  onMount(() => {
    mounted = true;

    const handleScroll = () => {
      scrolled = window.scrollY > 20;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  });

  let navItems = [
    {
      icon: "ph:wallet-bold",
      label: "Wallet",
      href: `/${user?.username || ""}`,
    },
    { icon: "ph:paper-plane-bold", label: "Send", href: "/send" },
    {
      icon: "ph:qr-code-bold",
      label: "Receive",
      href: `/${user?.username || ""}/receive`,
    },
    {
      icon: "ph:clock-counter-clockwise-bold",
      label: "History",
      href: "/payments",
    },
  ];
</script>

{#if mounted}
  <header
    class="fixed top-0 left-0 right-0 z-40 transition-all duration-500 {scrolled
      ? 'py-2'
      : 'py-4'}"
    in:fly={{ y: -20, duration: 500 }}
  >
    <div class="container mx-auto px-4">
      <nav
        class="premium-card border-2 border-white/10 {scrolled
          ? 'backdrop-blur-xl bg-black/80'
          : 'backdrop-blur-md bg-white/5'} transition-all duration-500"
      >
        <div class="flex items-center justify-between">
          <!-- Logo -->
          <button
            onclick={() => goto("/")}
            class="flex items-center gap-3 group"
          >
            <div class="relative">
              <div
                class="absolute inset-0 bg-gradient-primary blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300"
              ></div>
              <img
                src="/images/dgen-logo-white.svg"
                alt="DGEN"
                class="w-10 h-10 relative group-hover:scale-110 transition-transform duration-300"
              />
            </div>
            <span class="text-2xl font-bold hidden sm:block">
              <span class="gradient-text">DGEN</span>
            </span>
          </button>

          <!-- Desktop Navigation -->
          <div class="hidden lg:flex items-center gap-2">
            {#each navItems as item}
              <a
                href={item.href}
                class="group relative px-4 py-2 rounded-xl transition-all duration-300 hover:bg-white/10"
                class:active={$page.url.pathname === item.href}
              >
                {#if $page.url.pathname === item.href}
                  <div
                    class="absolute inset-0 bg-gradient-primary opacity-20 rounded-xl blur-xl"
                  ></div>
                {/if}
                <div class="relative flex items-center gap-2">
                  <iconify-icon
                    icon={item.icon}
                    width="20"
                    class="{$page.url.pathname === item.href
                      ? 'text-purple-400'
                      : 'text-white/60 group-hover:text-white'} transition-colors"
                  ></iconify-icon>
                  <span
                    class="{$page.url.pathname === item.href
                      ? 'text-purple-400 font-bold'
                      : 'text-white/80 group-hover:text-white'} transition-colors"
                  >
                    {item.label}
                  </span>
                </div>
                {#if $page.url.pathname === item.href}
                  <div
                    class="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-primary rounded-full"
                  ></div>
                {/if}
              </a>
            {/each}
          </div>

          <!-- User Section -->
          <div class="flex items-center gap-4">
            {#if user}
              <!-- Notifications -->
              <button
                class="relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300 group"
              >
                <iconify-icon
                  icon="ph:bell-bold"
                  width="24"
                  class="text-white/60 group-hover:text-white transition-colors"
                ></iconify-icon>
                <div
                  class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"
                ></div>
              </button>

              <!-- User Avatar -->
              <button
                onclick={() => goto("/settings")}
                class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-all duration-300 group"
              >
                <div class="relative">
                  <div
                    class="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center"
                  >
                    <span class="text-white font-bold text-sm">
                      {user.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div
                    class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-black"
                  ></div>
                </div>
                <span
                  class="text-white/80 group-hover:text-white transition-colors hidden sm:block"
                >
                  {user.username}
                </span>
                <iconify-icon
                  icon="ph:caret-down-bold"
                  width="16"
                  class="text-white/60 group-hover:text-white transition-colors"
                ></iconify-icon>
              </button>
            {:else}
              <!-- Login/Register -->
              <a href="/login">
                <button
                  class="btn btn-sm glass px-4 py-2 font-bold hover:bg-white/10 transition-all duration-300"
                >
                  Sign In
                </button>
              </a>
              <a href="/register">
                <button
                  class="btn btn-sm btn-liquid px-4 py-2 font-bold text-white"
                >
                  Get Started
                </button>
              </a>
            {/if}

            <!-- Mobile Menu Toggle -->
            <button
              onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
              class="lg:hidden p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
            >
              <iconify-icon
                icon={mobileMenuOpen ? "ph:x-bold" : "ph:list-bold"}
                width="24"
                class="text-white"
              ></iconify-icon>
            </button>
          </div>
        </div>

        <!-- Mobile Navigation -->
        {#if mobileMenuOpen}
          <div
            class="lg:hidden mt-4 pt-4 border-t border-white/10"
            in:fly={{ y: -10, duration: 300 }}
          >
            <div class="grid grid-cols-2 gap-2">
              {#each navItems as item}
                <a
                  href={item.href}
                  onclick={() => (mobileMenuOpen = false)}
                  class="flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300"
                  class:bg-gradient-primary={$page.url.pathname === item.href}
                  class:bg-opacity-20={$page.url.pathname === item.href}
                >
                  <iconify-icon
                    icon={item.icon}
                    width="20"
                    class={$page.url.pathname === item.href
                      ? "text-purple-400"
                      : "text-white/60"}
                  ></iconify-icon>
                  <span
                    class={$page.url.pathname === item.href
                      ? "text-purple-400 font-bold"
                      : "text-white/80"}
                  >
                    {item.label}
                  </span>
                </a>
              {/each}
            </div>
          </div>
        {/if}
      </nav>
    </div>

    <!-- Progress indicator -->
    <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20">
      <div class="h-full bg-gradient-primary shimmer" style="width: 0%"></div>
    </div>
  </header>

  <!-- Spacer -->
  <div class="h-20"></div>
{/if}

<style>
  .active {
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.1),
      rgba(118, 75, 162, 0.1)
    );
  }
</style>
