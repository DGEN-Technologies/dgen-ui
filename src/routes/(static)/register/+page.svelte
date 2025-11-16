<script>
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { PUBLIC_DGEN_URL } from "$env/static/public";
  import { upload } from "$lib/upload";
  import { afterNavigate, invalidateAll } from "$app/navigation";
  import { applyAction, deserialize } from "$app/forms";
  import { tick } from "svelte";
  import { fly } from "svelte/transition";
  import { enhance } from "$app/forms";

  import Pin from "$comp/Pin.svelte";
  import Spinner from "$comp/Spinner.svelte";
  import PasswordInput from "$comp/PasswordInput.svelte";

  import { focus, fail } from "$lib/utils";
  import { avatar, signer, password, pin, loginRedirect } from "$lib/store";
  import { t } from "$lib/translations";
  import { page } from "$app/stores";
  import {
    NumberDictionary,
    uniqueNamesGenerator,
    colors,
    adjectives,
    animals,
  } from "unique-names-generator";
  // import { sign } from "$lib/nostr"; // NOSTR DISABLED

  let { form, data } = $props();
  let { challenge } = $derived(data);

  onMount(() => {
    if (browser) {
      // Initialize password to empty string if undefined
      if ($password === undefined) {
        password.set("");
      }
      setTimeout(() => {
        pin.set(undefined);
        signer.set(undefined);
        localStorage.clear();
        sessionStorage.clear();
      }, 50);
    }
  });

  let username = $state();
  let revealPassword = $state(false);
  let confirmPassword = $state("");
  let revealConfirmPassword = $state(false);
  
  // Simple avatar color system
  const avatarColors = [
    'from-dgen-aqua to-dgen-cyan',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-emerald-500',
    'from-yellow-500 to-orange-500',
    'from-dgen-cyan to-dgen-teal',
    'from-dgen-teal to-green-500',
    'from-teal-500 to-green-500',
    'from-orange-500 to-yellow-500'
  ];
  
  let colorIndex = $state(Math.floor(Math.random() * avatarColors.length));

  let cleared;
  let clear = () => {
    if (!cleared) {
      cleared = true;
      username = "";
      $password = "";
      confirmPassword = "";
      revealPassword = false;
      revealConfirmPassword = false;
    }
  };

  let refresh = async (e) => {
    e.preventDefault();
    cleared = false;

    username = uniqueNamesGenerator({
      dictionaries: [animals, NumberDictionary.generate({ min: 10, max: 99 })],
      length: 2,
      separator: "",
    });

    // Don't randomize password - user should choose their own
  };

  afterNavigate(async () => {
    try {
      await invalidateAll();
    } catch (e) {
      console.log(e);
    }
  });

  let token = $state();
  let code = [];
  let redirect;

  let cancel = () => (need2fa = false);

  let email,
    btn = $state();

  let loading = $state();

  let avatarInput = $state();
  let decr = () => (colorIndex = colorIndex <= 0 ? avatarColors.length - 1 : colorIndex - 1);
  let incr = () => (colorIndex = colorIndex >= avatarColors.length - 1 ? 0 : colorIndex + 1);
  let selectAvatar = () => avatarInput.click();

  let progress;
  let handleFile = async ({ target }) => {
    let type = "picture";
    let file = target.files[0];
    if (!file) return;

    if (file.size > 10000000) form.error = "File too large";
    $avatar = { file, type, progress };

    var reader = new FileReader();
    reader.onload = async (e) => {
      uploadedSrc = e.target.result;
    };

    reader.readAsDataURL(file);
  };

  let need2fa = $derived(form?.message === "2fa");
  let uploadedSrc = $state(null);

  $effect(() => {
    if (need2fa && form.token === token) token = "";
  });

  $effect(() => {
    token && token?.length === 6 && tick().then(() => btn.click());
  });

  let nostrLogin = async () => {
    let event = {
      kind: 27235,
      created_at: Date.now(),
      content: "",
      tags: [
        ["u", `${PUBLIC_DGEN_URL}/api/nostrAuth`][("method", "POST")],
        ["challenge", challenge],
      ],
    };

    let signedEvent = await sign(event);

    const formData = new FormData();

    try {
      formData.append("loginRedirect", redirect);
      formData.append("token", token);
      formData.append("event", JSON.stringify(signedEvent));
      formData.append("challenge", challenge);

      let response = await fetch("/login?/nostr", {
        method: "POST",
        body: formData,
      });

      const result = deserialize(await response.text());

      if (result.type === "success") {
        await invalidateAll();
      }

      applyAction(result);
    } catch (e) {
      fail(e.message);
    }
  };
</script>

{#if need2fa}
  <Pin bind:value={token} title="Enter 2FA Code" {cancel} notify={false} />
{/if}

<div
  class="mx-auto premium-card max-w-xl w-full md:w-[480px] mb-20 mt-32 relative overflow-visible animate-fadeInUp"
>
  <!-- Animated background orbs -->
  <div
    class="absolute -top-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl animate-float"
  ></div>
  <div
    class="absolute -bottom-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-float"
    style="animation-delay: 2s;"
  ></div>
    <h1 class="text-4xl font-bold text-center mb-2">
      <span class="holographic">Join DGEN</span>
      <span class="text-yellow-400 lightning mx-2">⚡</span>
    </h1>
    <p class="text-center opacity-60 mb-6">Create Your Lightning Wallet</p>
    <!-- Removed avatar selector for simplified registration -->

    {#if form?.error}
      <div
        class="glass p-4 rounded-2xl border-2 border-red-500/50 bg-red-500/10 text-red-400 text-center animate-pulse"
        in:fly
      >
        <iconify-icon icon="ph:warning-circle" width="24" class="inline mr-2"
        ></iconify-icon>
        {form.error}
      </div>
    {/if}

    <form
      class="space-y-5"
      method="POST"
      use:enhance={() => {
        // Validate password confirmation
        if ($password !== confirmPassword) {
          fail($t("accounts.passwordMismatch"));
          // Cancel form submission
          return () => {};
        }

        loading = true;

        return async ({ result, update }) => {
          loading = false;
          await update();
        };
      }}
    >
      <input
        type="hidden"
        name="loginRedirect"
        value={$loginRedirect || $page.url.searchParams.get("redirect")}
      />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="confirm" bind:value={confirmPassword} />

      <div class="relative group">
        <div
          class="absolute inset-0 bg-gradient-primary opacity-0 group-focus-within:opacity-20 rounded-2xl blur-xl transition-opacity duration-300"
        ></div>
        <div class="relative flex items-center">
          <input
            name="username"
            type="text"
            required
            bind:value={username}
            use:focus
            onfocus={clear}
            autocapitalize="none"
            placeholder={$t("login.username")}
            class="relative glass border-2 border-white/10 focus:border-purple-500/50 transition-all duration-300 pr-12"
          />
          <button
            type="button"
            tabindex="-1"
            onclick={refresh}
            aria-label="Randomize"
            class="absolute right-3 hover:scale-110 transition-transform text-purple-400 hover:text-purple-300"
          >
            <iconify-icon noobserver icon="ph:dice-three-bold" width="32"></iconify-icon>
          </button>
        </div>
      </div>

      <div class="relative group">
        <div
          class="absolute inset-0 bg-gradient-accent opacity-0 group-focus-within:opacity-20 rounded-2xl blur-xl transition-opacity duration-300"
        ></div>
        <div class="relative">
          <PasswordInput
            id="password"
            bind:value={$password}
            placeholder={$t("login.password")}
            required
          />
        </div>
      </div>

      <div class="relative group">
        <div
          class="absolute inset-0 bg-gradient-accent opacity-0 group-focus-within:opacity-20 rounded-2xl blur-xl transition-opacity duration-300"
        ></div>
        <div class="relative">
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            bind:value={confirmPassword}
            placeholder={$t("accounts.confirmPassword")}
            required
          />
        </div>
      </div>

      <button
        type="submit"
        class="w-full px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
        style="background: linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%); color: white; box-shadow: 0 10px 30px rgba(167, 139, 250, 0.3);"
        disabled={loading}
        bind:this={btn}
      >
        {#if loading}
          <Spinner />
        {:else}
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
               style="background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%);"></div>
          <iconify-icon icon="ph:user-circle-plus" width="24" class="relative z-10 group-hover:rotate-12 transition-transform duration-300"></iconify-icon>
          <span class="relative z-10">{$t("login.register")}</span>
          <iconify-icon
            icon="ph:arrow-right-bold"
            width="20"
            class="relative z-10 group-hover:translate-x-2 transition-transform duration-300"
          ></iconify-icon>
        {/if}
      </button>

      <!-- Nostr login disabled
      <button
        type="button"
        class="btn glass border-2 border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/10 transition-all duration-300 font-bold"
        onclick={nostrLogin}
      >
        {#if $signer?.ready}
          <div class="shrink">
            <Spinner />
          </div>
        {:else}
          <div class="relative">
            <div
              class="absolute inset-0 bg-purple-500 blur-xl opacity-30"
            ></div>
            <img src="/images/nostr.png" class="w-8 relative" />
          </div>
        {/if}
        <div class="my-auto flex items-center gap-2">
          {$t("login.nostr")}
          <span class="text-purple-400">⚡</span>
        </div>
      </button>
      -->

      <div class="text-center space-y-2">
        <p class="text-secondary font-medium">
          {$t("login.haveAccount")}
        </p>
        <a href={"/login" + $page.url.search} class="inline-block">
          <button
            type="button"
            class="px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center gap-2"
            style="background: linear-gradient(135deg, #74EBD5 0%, #9688DD 100%); color: white;"
          >
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                 style="background: linear-gradient(135deg, #9688DD 0%, #74EBD5 100%);"></div>
            <span class="relative z-10">{$t("login.signIn")}</span>
            <iconify-icon icon="ph:arrow-right-bold" width="20" class="relative z-10 group-hover:translate-x-2 transition-transform duration-300"></iconify-icon>
          </button>
        </a>
      </div>
    </form>
  </div>
