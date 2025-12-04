<script>
  import { run } from "svelte/legacy";
  import { browser } from "$app/environment";
  import { PUBLIC_DOMAIN, PUBLIC_WIDGET_API_BASE, PUBLIC_ORG_ID} from "$env/static/public";
  import "../app-modern.css";
  import { loading, t } from "$lib/translations";
  import { onMount } from "svelte";
  import { installPrompt, theme as themeStore, proMode } from "$lib/store";
  import { domSecurityMonitor } from "$lib/security/domMonitor";
  import ChatWidget from "$comp/ChatWidget.svelte";

  let { data, children } = $props();
  let { pathname, theme } = $state(data);
  $effect(() => ($themeStore = data.theme));
  $effect(() => (theme = $themeStore));

  // Fallback to ensure app renders even if translations are slow/stuck
  let forceRender = $state(false);

  // Chat widget state
  let showChatWidget = $state(false);
  let userId = $state("anonymous");

  let host = PUBLIC_DOMAIN.includes("localhost")
    ? `http://${PUBLIC_DOMAIN}`
    : `https://${PUBLIC_DOMAIN}`;

  function clearBadge() {
    if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }

  onMount(() => {
    if (!browser) return;

    // Force render after 2 seconds to prevent white screen issues
    setTimeout(() => {
      forceRender = true;
    }, 2000);

    // Enable chat widget after initial load
    setTimeout(() => {
      showChatWidget = true;
    }, 1000);

    // Start security monitoring for suspicious DOM access
    domSecurityMonitor.startMonitoring();

    // Handle install prompt
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      $installPrompt = event;
    });

    clearBadge(); // first load
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") clearBadge();
    });

    let hasNotch = typeof window.AndroidNotch !== "undefined";
    if (hasNotch) {
      window.AndroidNotch.getInsetTop(
        (px) => {
          document.documentElement.style.setProperty(
            "--safe-area-inset-top",
            Math.round(px) + "px",
          );
        },
        (err) => {
          console.error("Failed to get notch inset:", err);
        },
      );

      window.AndroidNotch.getInsetBottom(
        (px) => {
          document.documentElement.style.setProperty(
            "--safe-area-inset-bottom",
            24 + "px",
          );
        },
        (err) => {
          console.error("Failed to get bottom inset:", err);
        },
      );
    }
  });

  // Update userId when user data changes
  $effect(() => {
    if (data.user) {
      userId = data.user.id || data.user.username || "anonymous";
    }
  });
</script>

<svelte:head>
  <title>DGEN Wallet</title>
  <meta property="og:title" content="DGEN Wallet" />
  <meta name="twitter:title" content="DGEN Wallet" />

  <meta property="og:image" content={`${host}/images/logo.webp`} />
  <meta property="og:type" content="website" />
  <meta property="og:description" content="An easy to use bitcoin web wallet" />
  <meta name="description" content="An easy to use bitcoin web wallet" />

  <meta name="keywords" content="DGEN Wallet easy bitcoin web wallet" />
  <meta name="twitter:image" content={`${host}/images/logo.webp`} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta property="og:url" content={host + pathname} />
  <meta name="twitter:site" content="@dgenwalletapp" />
  <meta name="twitter:creator" content="@dgenwalletapp" />
</svelte:head>

{#if !$loading || forceRender}
  <main data-theme={theme} class:pro-mode={$proMode}>
    {@render children?.()}
  </main>
{/if}

<!-- Chat Widget - loads after initial render -->
{#if showChatWidget}
  <ChatWidget 
    apiBase={PUBLIC_WIDGET_API_BASE}
    orgId={PUBLIC_ORG_ID}
    userId={userId}
  />
{/if}

<style global>
  :root {
    --toastContainerTop: auto;
    --toastContainerRight: auto;
    --toastContainerBottom: 8rem;
    --toastContainerLeft: calc(50vw - 8rem);
    --toastBackground: #292929;

    --safe-area-inset-top: 0px;
    --safe-area-inset-bottom: 0px;
  }

  main {
    padding-top: var(--safe-area-inset-top);
    padding-bottom: var(--safe-area-inset-bottom);
  }
</style>
