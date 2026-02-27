<script>
  import { browser } from "$app/environment";
  import { env } from "$env/dynamic/public";
  import { onMount, tick } from "svelte";
  import { fly } from "svelte/transition";
  import { applyAction, deserialize } from "$app/forms";

  import Icon from "$comp/Icon.svelte";
  import Spinner from "$comp/Spinner.svelte";
  import Pin from "$comp/Pin.svelte";
  import { loading, t } from "$lib/translations";
  import { fd, fail, auth, post, sleep, warning, success } from "$lib/utils";
  import { avatar, banner, signer, password, pin, save } from "$lib/store";
  import { upload } from "$lib/upload";
  import { page } from "$app/stores";
  const NOSTR_SIGNING_ENABLED = false;
  // import { sign, send, getPrivateKey } from "$lib/nostr"; // NOSTR DISABLED
  import { beforeNavigate, invalidateAll, goto } from "$app/navigation";
  // import { getPublicKey } from "nostr-tools"; // NOSTR DISABLED
  import { bytesToHex } from "@noble/hashes/utils";

  let { children, data, form } = $props();

  let formElement = $state();

  let newPassword = $state("");
  let confirmPassword = $state("");
  let showConfirmPassword = $state(false);
  let showFinalConfirm = $state(false);
  let pendingBody = $state(null);
  let showPassword = $state(false);

  const publicDgenUrl = env.PUBLIC_DGEN_URL || "";
  let { token, cookies, subscriptions } = $derived(data);
  let { tab } = $derived(data);
  let user = $derived({ ...data?.user, ...form?.user });
  let prev = $derived({ ...data.user });

  let justUpdated;
  let throttledSuccess = () => {
    if (!justUpdated) {
      justUpdated = true;
      success($t("user.settings.saved"), false);
      setTimeout(() => (justUpdated = false), 5000);
    }
  };

  let tabs = [
    { name: "profile", key: "ACCOUNT" },
    { name: "account", key: "POINT_OF_SALE" },
    { name: "lightning-address", key: "LIGHTNING_ADDRESS" },
    // { name: "nostr", key: "NOSTR" }, // Nostr disabled
    { name: "security", key: "SECURITY" },
  ];

  let { about, id, username } = $derived(user);
  let submitting = $state();
  let cancel = () => goto(`/${username}`);

  const safeT = (key, fallback) => {
    const value = $t(key);
    return value && value !== key ? value : fallback;
  };

  const clearPasswordState = () => {
    newPassword = "";
    confirmPassword = "";
    showConfirmPassword = false;
    showFinalConfirm = false;
    pendingBody = null;
    showPassword = false;
  };

  onMount(() => {
    beforeNavigate(() => {
      clearPasswordState();
    });
    const handleVisibility = () => {
      if (document.hidden) clearPasswordState();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  });

  async function submitBody(body) {
    form = {
      user: await fd({
        formData() {
          return body;
        },
      }),
    };

    await tick();

    if (!user.pubkey || user.pubkey === prev.pubkey) {
      body.delete("pubkey");
    } else if (!NOSTR_SIGNING_ENABLED) {
      body.delete("pubkey");
      warning("Nostr signing is disabled; pubkey update skipped.");
    } else {
      $signer = null;

      let event = {
        kind: 27235,
        created_at: Date.now(),
        content: "",
        tags: [
          ["u", `${publicDgenUrl}/api/nostrAuth`],
          ["method", "POST"],
          ["challenge", user.challenge],
        ],
      };

      const { sign } = await import("$lib/nostr");
      let signedEvent = await sign(event);
      body.set("event", JSON.stringify(signedEvent));
    }

    if ($avatar) {
      try {
        let uploadResult = await upload(
          $avatar.file,
          $avatar.type,
          $avatar.progress,
          token,
        );
        let { hash, ext } = JSON.parse(uploadResult);

        // Use full backend URL for production compatibility
        let url = publicDgenUrl
          ? `${publicDgenUrl}/public/${hash}.${ext || "webp"}`
          : `/public/${hash}.${ext || "webp"}`;
        body.set("picture", url);

        await fetch(url, { cache: "reload", mode: "no-cors" });

        // Update avatar store with new URL for immediate display
        $avatar = { ...$avatar, src: url };
      } catch (e) {
        console.log("problem uploading avatar", e);
      }
    }

    if ($banner) {
      try {
        let { hash, ext } = JSON.parse(
          await upload($banner.file, $banner.type, $banner.progress, token),
        );

        // Use full backend URL for production compatibility
        let url = publicDgenUrl
          ? `${publicDgenUrl}/public/${hash}.${ext || "webp"}`
          : `/public/${hash}.${ext || "webp"}`;
        body.set("banner", url);
        await fetch(url, { cache: "reload", mode: "no-cors" });

        // Update banner store with new URL for immediate display
        $banner = { ...$banner, src: url };
      } catch (e) {
        console.log("problem uploading banner", e);
      }
    }

    // Nostr profile update disabled for MVP - the backend will handle all profile data
    // if (
    //   ["username", "about", "picture", "display", "banner"].some(
    //     (a) => user[a] && user[a] !== prev[a],
    //   )
    // ) {
    //   let event = {
    //     pubkey: user.pubkey,
    //     created_at: Math.floor(Date.now() / 1000),
    //     kind: 0,
    //     content: JSON.stringify({
    //       name: user.username,
    //       about: user.about,
    //       picture: user.picture,
    //       banner: user.banner,
    //       displayName: user.display,
    //       lud16: `${user.username}@${$page.url.hostname}`,
    //     }),
    //     tags: [],
    //   };

    //   try {
    //     event = await sign(event, user);
    //     send(event);
    //   } catch (e) {
    //     console.log(e);
    //     warning("Nostr profile could not be updated");
    //   }
    // }

    let email = body.get("email");
    if (email && email !== prev.email) {
      try {
        cookies.get = function (n) {
          return this.find((c) => c.name === n).value;
        };

        user.verified = false;

        await post("/email", { email });

        warning($t("user.settings.verifying"), false);
      } catch (e) {
        fail(safeT("error.message", "Please try again or contact support."));
        console.log(e);
      }
    }

    const response = await fetch(formElement.action, {
      method: "POST",
      body,
    });

    const result = deserialize(await response.text());

    if (result.type === "success") {
      await invalidateAll();
      if (body.get("password")) $password = body.get("password");
      newPassword = "";
      confirmPassword = "";
      showConfirmPassword = false;
      showFinalConfirm = false;
    }

    applyAction(result);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      submitting = true;
      let body = new FormData(formElement);

      newPassword = body.get("password") || "";

      /* STEP 1: user entered password → stop submit */
      if (newPassword && !showConfirmPassword && !showFinalConfirm) {
        pendingBody = body;
        showConfirmPassword = true;
        submitting = false;
        return;
      }

      await submitBody(body);
    } catch (e) {
      console.log(e);
      fail("Something went wrong");
    }

    submitting = false;
  }
  $effect(() => form?.success && throttledSuccess());
  $effect(() => {
    const message = form?.message;
    if (!message) return;
    if (typeof message !== "string") {
      console.warn("[Settings] Unhandled form message:", message);
      fail(safeT("error.message", "Something went wrong"));
      return;
    }
    if (message.startsWith("Pin")) return;
    console.warn("[Settings] Unhandled form message:", message);
    fail(safeT("error.message", "Something went wrong"));
  });
  $effect(() => {
    const message = form?.message;
    if (typeof message === "string" && message.startsWith("Pin")) {
      fail("Wrong pin, try again");
      $pin = "";
    }
  });
  $effect(() => {
    if (!$loading && $page.url.searchParams.get("verified"))
      success($t("user.settings.verified"));
  });

  let toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    showPassword = !showPassword;
  };
</script>

{#if user?.haspin && $pin?.length !== 6}
  <Pin bind:value={$pin} {cancel} />
{/if}

{#if showConfirmPassword}
  <div
    class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 sm:p-0"
  >
    <div class="glass w-full max-w-sm rounded-2xl p-4 sm:p-6">
      <h2 class="text-lg sm:text-xl font-bold mb-4">Confirm Password</h2>

      <input
        type="password"
        class="input w-full mb-4"
        placeholder="Confirm password"
        bind:value={confirmPassword}
      />
      <div class="flex gap-3 sm:gap-4">
        <button
          class="text-white border border-white/10 rounded-xl w-full py-2"
          onclick={() => {
            showConfirmPassword = false;
            showFinalConfirm = false;
            confirmPassword = "";
            newPassword = "";
            pendingBody = null;
          }}
        >
          Cancel
        </button>

        <button
          class="text-white border border-white/10 rounded-xl w-full py-2"
          onclick={() => {
            if (confirmPassword !== newPassword) {
              fail("Passwords do not match");
              return;
            }
            showConfirmPassword = false;
            showFinalConfirm = true;
            confirmPassword = "";
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
{/if}
{#if showFinalConfirm}
  <div class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
    <div class="glass w-full max-w-sm rounded-2xl p-4 sm:p-6">
      <h2 class="text-lg sm:text-xl font-bold mb-4">Are you sure?</h2>

      <div class="text-white/70 mb-4">
        You are changing your password to:
        <br />

        <!-- <button
          class="mt-2 text-xs text-dgen-aqua hover:underline"
          onclick={() => (showPassword = !showPassword)}
        >
          {showPassword ? "Hide password" : "Show password"}
        </button> -->
        <div class="flex flex-row justify-between">
          <span class="text-white text-lg sm:text-xl break-all">
            {showPassword ? newPassword : "•".repeat(newPassword.length)}
          </span>

          <button
            type="button"
            class="contents flex-shrink-0 items-end"
            onclick={toggle}
          >
            <iconify-icon
              noobserver
              icon={showPassword ? "ph:eye-slash-bold" : "ph:eye-bold"}
              width="28"
              class="sm:w-8"
            ></iconify-icon></button
          >
        </div>
      </div>

      <div class="flex gap-3 sm:gap-4">
        <button
          class="text-white border border-white/40 rounded-lg w-full"
          onclick={() => {
            showFinalConfirm = false;
            pendingBody = null;
            showPassword = false;
            newPassword = "";
          }}
        >
          No
        </button>

        <button
          class="text-red-400 border border-red-200/40 rounded-lg w-full"
          onclick={async () => {
            showFinalConfirm = false;
            if (!pendingBody) return;
            submitting = true;
            try {
              await submitBody(pendingBody);
            } catch (e) {
              console.log(e);
              fail("Something went wrong");
            }
            pendingBody = null;
            showPassword = false;
            newPassword = "";
            submitting = false;
          }}
        >
          Yes, Change Password
        </button>
      </div>
    </div>
  </div>
{/if}
<div class="min-h-screen relative">
  <form
    method="POST"
    class="relative z-10 pb-32"
    onsubmit={handleSubmit}
    bind:this={formElement}
  >
    <input type="hidden" name="pin" value={$pin} />
    <input type="hidden" name="tab" value={tab} />

    <div class="container mx-auto max-w-2xl px-4 py-2 sm:py-20">
      <div class="header animate-fadeInUp">
        <!-- Title with epic glow effect -->
        <h1 class="text-center text-4xl md:text-5xl font-bold mb-2">
          <span
            class="bg-gradient-to-r from-dgen-aqua to-dgen-cyan bg-clip-text text-transparent"
            >Settings
          </span>
          <span
            class="bg-gradient-to-r from-dgen-cyan to-dgen-purple bg-clip-text text-transparent"
            >Center</span
          >
        </h1>
        <p class="text-center text-lg sm:text-xl text-white/60 mb-8">
          Manage Your Preferences
        </p>

        <!-- Enhanced tab navigation -->
        <div class="glass rounded-3xl p-2 mb-8">
          <div class="flex flex-wrap justify-around items-center">
            {#each tabs as { name, key }}
              <a
                href={`/settings/${name}`}
                class="px-4 py-3 w-1/2 sm:w-1/4 flex-shrink-0 text-center rounded-2xl transition-all duration-300 {name ===
                tab
                  ? 'bg-gradient-to-r from-dgen-aqua/30 to-dgen-cyan/30 border border-dgen-aqua/50 shadow-lg shadow-dgen-aqua/20'
                  : 'hover:bg-white/10'}"
              >
                <span
                  class={name === tab
                    ? "text-dgen-aqua font-bold"
                    : "text-white/80 hover:text-white"}
                >
                  {$t(`user.settings.${key}`)}
                </span>
              </a>
            {/each}
          </div>
        </div>
      </div>

      <div class="space-y-6 animate-fadeInUp" style="animation-delay: 0.2s;">
        {@render children?.()}
      </div>
    </div>

    <!-- Enhanced floating save button with modern design -->
    <div
      class="fixed bottom-0 left-0 right-0 z-50 p-4"
      style="background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);"
    >
      <div class="container mx-auto max-w-2xl">
        <button
          bind:this={$save}
          type="submit"
          class="w-full sm:w-auto sm:mx-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl active:scale-95 relative overflow-hidden group"
          style="background: linear-gradient(135deg, #74EBD5 0%, #9688DD 100%); box-shadow: 0 10px 30px rgba(116, 235, 213, 0.3);"
          class:opacity-50={submitting}
          disabled={submitting}
        >
          <!-- Animated gradient overlay -->
          <div
            class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style="background: linear-gradient(135deg, #9688DD 0%, #74EBD5 100%);"
          ></div>

          {#if submitting}
            <Spinner />
          {:else}
            <span
              class="relative z-10 flex items-center justify-center gap-3 text-white"
            >
              <iconify-icon
                icon="ph:floppy-disk-bold"
                width={28}
                class="group-hover:rotate-12 transition-all duration-300"
              ></iconify-icon>
              <span>{$t("user.settings.saveSettings")}</span>
              <iconify-icon
                icon="ph:sparkle"
                width={20}
                class="group-hover:rotate-180 transition-all duration-500"
              ></iconify-icon>
            </span>
          {/if}

          <!-- Ripple effect on hover -->
          <div
            class="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
          >
            <div
              class="absolute inset-0 scale-0 group-hover:scale-150 transition-transform duration-700 rounded-full bg-white/20"
            ></div>
          </div>
        </button>
      </div>
    </div>
  </form>
</div>
