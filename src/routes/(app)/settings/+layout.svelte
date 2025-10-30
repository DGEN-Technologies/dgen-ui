<script>
  import { browser } from "$app/environment";
  import { PUBLIC_DGEN_URL } from "$env/static/public";
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
  // import { sign, send, getPrivateKey } from "$lib/nostr"; // NOSTR DISABLED
  import { invalidateAll } from "$app/navigation";
  // import { getPublicKey } from "nostr-tools"; // NOSTR DISABLED
  import { bytesToHex } from "@noble/hashes/utils";

  let { children, data, form } = $props();

  let formElement = $state();

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

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      submitting = true;
      let body = new FormData(formElement);
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
      } else {
        $signer = null;

        let event = {
          kind: 27235,
          created_at: Date.now(),
          content: "",
          tags: [
            ["u", `${PUBLIC_DGEN_URL}/api/nostrAuth`],
            ["method", "POST"],
            ["challenge", user.challenge],
          ],
        };

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
          let url = `${PUBLIC_DGEN_URL}/public/${hash}.${ext || "webp"}`;
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
          let url = `${PUBLIC_DGEN_URL}/public/${hash}.${ext || "webp"}`;
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
          fail(e.message);
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
      }

      applyAction(result);
    } catch (e) {
      console.log(e);
      fail("Something went wrong");
    }

    submitting = false;
  }
  $effect(() => form?.success && throttledSuccess());
  $effect(() => form?.message && fail(form.message));
  $effect(() => {
    if (form?.message?.startsWith("Pin")) {
      fail("Wrong pin, try again");
      $pin = "";
    }
  });
  $effect(() => {
    if (!$loading && $page.url.searchParams.get("verified"))
      success($t("user.settings.verified"));
  });
</script>

{#if user?.haspin && $pin?.length !== 6}
  <Pin />
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

    <div class="container mx-auto max-w-2xl px-4 py-20">
      <div class="header animate-fadeInUp">
        <!-- Title with epic glow effect -->
        <h1 class="text-center text-4xl md:text-5xl font-bold mb-2">
          <span class="bg-gradient-to-r from-dgen-aqua to-dgen-cyan bg-clip-text text-transparent">Settings</span>
          <span class="text-dgen-aqua mx-2">⚙️</span>
          <span class="bg-gradient-to-r from-dgen-cyan to-dgen-purple bg-clip-text text-transparent">Center</span>
        </h1>
        <p class="text-center text-xl text-white/60 mb-8">
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
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
               style="background: linear-gradient(135deg, #9688DD 0%, #74EBD5 100%);"></div>
          
          {#if submitting}
            <Spinner />
          {:else}
            <span class="relative z-10 flex items-center justify-center gap-3 text-white">
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
          <div class="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div class="absolute inset-0 scale-0 group-hover:scale-150 transition-transform duration-700 rounded-full bg-white/20"></div>
          </div>
        </button>
      </div>
    </div>
  </form>
</div>
