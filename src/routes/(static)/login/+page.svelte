<script>
  import { browser } from "$app/environment";
  import handler from "$lib/handler";
  import { applyAction, deserialize } from "$app/forms";
  import { onMount, tick } from "svelte";
  import { fly } from "svelte/transition";
  import { enhance } from "$app/forms";
  import Pinpad from "$comp/Pinpad.svelte";
  import PasswordInput from "$comp/PasswordInput.svelte";
  import Spinner from "$comp/Spinner.svelte";
  import { focus, fail } from "$lib/utils";
  import { password, signer, pin, loginRedirect } from "$lib/store";
  import { t } from "$lib/translations";
  import { page } from "$app/stores";
  // import { sign } from "$lib/nostr"; // NOSTR DISABLED
  import { invalidateAll } from "$app/navigation";
  import { sha256 } from "@noble/hashes/sha256";
  import { bytesToHex } from "@noble/hashes/utils";

  let { data, form } = $props();

  onMount(() => {
    if (browser) {
      setTimeout(() => {
        password.set(undefined);
        pin?.set(undefined);
        signer.set(undefined);
        localStorage.clear();
        sessionStorage.clear();
      }, 50);
    }
  });

  onMount(() => {
    let lang = $page.url.searchParams.get("lang");
    if (lang) document.cookie = `lang=${lang} ;`;
  });

  let { challenge } = $derived(data);
  let token = $state("");

  let cancel = () => (need2fa = false);

  let username = $state(),
    email,
    btn = $state();

  $effect(() => form && ({ username, password: $password } = form));
  let need2fa = $derived(form?.message === "2fa");
  $effect(() => {
    if (need2fa && form.token === token) token = "";
  });

  let revealPassword = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    let data = new FormData(this);
    let user = Object.fromEntries(data);

    for (let k in user) {
      data.set(k, user[k]);
    }

    const response = await fetch("?/login", {
      method: "POST",
      body: data,
    });

    const result = deserialize(await response.text());

    if (result.type === "success") {
      // No need to store password - wallet encryption uses token-derived password
      await invalidateAll();
    }

    applyAction(result);
  }

  $effect(() => {
    token?.length === 6 &&
      tick().then(() => {
        btn.click();
      });
  });

  let redirect = $derived(
    $loginRedirect || $page.url.searchParams.get("redirect"),
  );

  // NOSTR LOGIN DISABLED
  // let nostrLogin = async () => {
  //   let event = {
  //     kind: 27235,
  //     created_at: Date.now(),
  //     content: "",
  //     tags: [
  //       ["u", `${$page.url.origin}/api/nostrAuth`],
  //       ["method", "POST"],
  //       ["challenge", challenge],
  //     ],
  //   };

  //   let signedEvent = await sign(event);

  //   const formData = new FormData();

  //   try {
  //     formData.append("loginRedirect", redirect);
  //     formData.append("token", token);
  //     formData.append("event", JSON.stringify(signedEvent));
  //     formData.append("challenge", challenge);

  //     let response = await fetch("/login?/nostr", {
  //       method: "POST",
  //       body: formData,
  //     });

  //     const result = deserialize(await response.text());

  //     applyAction(result);
  //   } catch (e) {
  //     fail(e.message);
  //   }
  // };
</script>

<div
  class="mx-auto premium-card max-w-xl w-full md:w-[480px] mb-20 mt-32 relative overflow-visible animate-fadeInUp"
>
  <!-- Animated background orbs -->
  <div
    class="absolute -top-20 -left-20 w-40 h-40 bg-dgen-aqua/20 rounded-full blur-3xl animate-float"
  ></div>
  <div
    class="absolute -bottom-20 -right-20 w-40 h-40 bg-dgen-cyan/20 rounded-full blur-3xl animate-float"
    style="animation-delay: 2s;"
  ></div>

  <h1 class="text-4xl font-bold text-center mb-2">
    <span class="holographic">Welcome Back</span>
  </h1>
  <p class="text-center opacity-60 mb-6">Sign in to access your wallet</p>
  {#if form?.error && !form?.message.includes("2fa")}
    <div class="text-red-600 text-center" in:fly>
      {form.error}
    </div>
  {/if}

  <form
    use:enhance
    class="space-y-5"
    onsubmit={handleSubmit}
    method="POST"
    action="?/login"
  >
    <input type="hidden" name="loginRedirect" value={redirect} />
    <input type="hidden" name="token" value={token} />

    <div class="relative group">
      <div
        class="absolute inset-0 bg-gradient-primary opacity-0 group-focus-within:opacity-20 rounded-2xl blur-xl transition-opacity duration-300"
      ></div>
      <input
        name="username"
        type="text"
        required
        bind:value={username}
        use:focus
        autocapitalize="none"
        placeholder={$t("login.username")}
        class="relative glass border-2 border-white/10 focus:border-purple-500/50 transition-all duration-300"
      />
    </div>

    <div class="relative group">
      <div
        class="absolute inset-0 bg-gradient-accent opacity-0 group-focus-within:opacity-20 rounded-2xl blur-xl transition-opacity duration-300"
      ></div>
      <div class="relative">
        <PasswordInput
          bind:value={$password}
          placeholder={$t("login.password")}
        />
      </div>
    </div>

    <!-- <div class="flex justify-end items-center">
      <a href="/forgot" class="underline underline-offset-4 text-secondary"
        >{$t("login.forgotUserOrPassword")}</a
      >
    </div> -->

    <button
      type="submit"
      class="w-full px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
      style="background: linear-gradient(135deg, #74EBD5 0%, #9688DD 100%); color: white; box-shadow: 0 10px 30px rgba(116, 235, 213, 0.3);"
      bind:this={btn}
    >
      <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
           style="background: linear-gradient(135deg, #9688DD 0%, #74EBD5 100%);"></div>
      <iconify-icon icon="ph:sign-in-bold" width="24" class="relative z-10 group-hover:rotate-12 transition-transform duration-300"></iconify-icon>
      <span class="relative z-10">{$t("login.signIn")}</span>
      <iconify-icon
        icon="ph:arrow-right-bold"
        width="20"
        class="relative z-10 group-hover:translate-x-2 transition-transform duration-300"
      ></iconify-icon>
    </button>

    <!-- <button
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
          <div class="absolute inset-0 bg-purple-500 blur-xl opacity-30"></div>
          <img src="/images/nostr.png" class="w-8 relative" />
        </div>
      {/if}
      <div class="my-auto flex items-center gap-2">
        {$t("login.nostr")}
        <span class="text-purple-400">⚡</span>
      </div>
    </button> -->

    <div class="text-center space-y-2">
      <p class="text-secondary font-medium">
        {$t("login.noAccount")}
      </p>
      <a href={"/register" + $page.url.search} class="inline-block">
        <button
          class="px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center gap-2"
          style="background: linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%); color: white;"
        >
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
               style="background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%);"></div>
          <span class="relative z-10">{$t("login.register")}</span>
          <iconify-icon icon="ph:user-plus-bold" width="20" class="relative z-10 group-hover:rotate-12 transition-transform duration-300"
          ></iconify-icon>
        </button>
      </a>
    </div>
  </form>
</div>

{#if need2fa && token.length < 6}
  <div
    class="fixed bg-base-100 bg-opacity-90 inset-0 h-full w-full z-50 cursor-default"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-labelledby="title"
  >
    <div
      class="mx-auto p-5 border shadow-lg rounded-md bg-base-100 space-y-5 max-w-lg"
    >
      <h1 id="title" class="text-center text-2xl font-semibold">2FA</h1>
      <Pinpad bind:v={token} {cancel} />

      <div class="w-full flex">
        <button class="btn" onclick={cancel}>
          <div class="my-auto">Cancel</div>
        </button>
      </div>
    </div>
  </div>
{/if}
