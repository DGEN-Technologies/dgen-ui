<script>
  import { run } from "svelte/legacy";

  import { page } from "$app/stores";
  import { fly } from "svelte/transition";
  import { enhance } from "$app/forms";
  import { tick } from "svelte";
  import { browser } from "$app/environment";
  import { t } from "$lib/translations";
  import Avatar from "$comp/Avatar.svelte";
  import Spinner from "$comp/Spinner.svelte";
  import { back, fail, focus } from "$lib/utils";

  let { data = $bindable(), form } = $props();

  let { token } = data;
  data.subject = data.user;

  let el = $state(),
    text = $state(),
    pasted = $state(),
    w = $state();

  let keypress = (e) => e.key === "Enter" && (e.preventDefault() || el.click());

  let paste = async () => {
    text = await navigator.clipboard.readText();
  };

  run(() => {
    if (browser && pasted && text) el.click() && (pasted = false);
  });
</script>

<svelte:window bind:innerWidth={w} />

<div class="min-h-screen relative overflow-hidden bg-gradient-dark">
  <!-- Animated background mesh with aurora effect -->
  <div class="absolute inset-0">
    <div class="absolute inset-0 aurora-bg opacity-5"></div>
    <div
      class="absolute top-0 -left-4 w-96 h-96 bg-dgen-aqua rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
    ></div>
    <div
      class="absolute top-0 -right-4 w-96 h-96 bg-green-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 2s;"
    ></div>
    <div
      class="absolute -bottom-8 left-20 w-96 h-96 bg-dgen-aqua rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 4s;"
    ></div>
  </div>

  <!-- Cyber Grid overlay -->
  <div class="absolute inset-0 cyber-grid opacity-20"></div>

  <!-- Content Container -->
  <div
    class="container px-4 max-w-lg mx-auto space-y-5 pt-20 pb-10 relative z-10"
  >
    <!-- Title with epic glow effect -->
    <div class="text-center mb-8 animate-fadeInUp">
      <h1 class="text-4xl md:text-5xl font-bold mb-2">
        <span class="gradient-text">Receive</span>
        <span class="text-dgen-aqua lightning mx-2">⚡</span>
        <span class="gradient-text">Payment</span>
      </h1>
      <p class="text-xl text-white/70">Enter LNURL Withdraw Code</p>
    </div>

    <form
      method="POST"
      use:enhance
      class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-dgen-aqua/40 transition-all duration-500 space-y-4 animate-scaleIn"
    >
      {#if form?.error}
        <div class="mb-5">
          <div
            class="glass p-4 rounded-2xl border-2 border-red-500/50 bg-red-500/10 text-red-400"
          >
            {form.error === "default"
              ? $t("error.unrecognizedInput")
              : form.error}
          </div>
        </div>
      {/if}

      <div class="relative">
        <textarea
          use:focus
          name="text"
          placeholder="Enter LNURL withdraw code"
          onkeypress={keypress}
          class="w-full p-4 rounded-2xl h-32 text-xl glass border-2 border-white/20 focus:border-dgen-aqua/50 transition-all duration-300 placeholder-white/40"
          bind:value={text}
          onpaste={() => (pasted = true)}
          autocapitalize="none"
        ></textarea>
        <div class="absolute top-2 right-2">
          <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>

      <div class="flex gap-3">
        <a href="/scan" class="contents">
          <button
            type="button"
            class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
            style="background: linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%); color: white;"
          >
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                 style="background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%);"></div>
            <iconify-icon
              noobserver
              icon="ph:camera-bold"
              width="28"
              class="relative z-10 group-hover:rotate-12 transition-transform duration-300"
            ></iconify-icon>
            <span class="relative z-10">{$t("user.send.scan")}</span>
          </button>
        </a>

        <button
          type="button"
          class="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
          style="background: linear-gradient(135deg, #74EBD5 0%, #9688DD 100%); color: white;"
          onclick={paste}
        >
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
               style="background: linear-gradient(135deg, #9688DD 0%, #74EBD5 100%);"></div>
          <iconify-icon
            noobserver
            icon="ph:clipboard-text-bold"
            width="28"
            class="relative z-10 group-hover:rotate-12 transition-transform duration-300"
          ></iconify-icon>
          <span class="relative z-10">{$t("user.send.paste")}</span>
        </button>
      </div>

      <button
        bind:this={el}
        type="submit"
        class="w-full px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-3"
        style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);"
      >
        <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
             style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);"></div>
        <iconify-icon
          noobserver
          icon="ph:paper-plane-right-bold"
          width="32"
          class="relative z-10 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300"
        ></iconify-icon>
        <span class="relative z-10 font-bold">{$t("user.send.next")}</span>
      </button>
    </form>
  </div>
</div>
