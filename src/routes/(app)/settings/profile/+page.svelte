<script>
  import { tick } from "svelte";
  import { avatar, banner as bannerStore, proMode } from "$lib/store";
  import { t } from "$lib/translations";
  import { page } from "$app/stores";
  import PasswordInput from "$comp/PasswordInput.svelte";
  import Qr from "$comp/Qr.svelte";
  import { PUBLIC_DGEN_URL } from "$env/static/public";

  let { data } = $props();
  let { user } = $derived(data);
  let { id } = user;
  let { about, banner, picture, display, username } = $state(user);

  let avatarFile,
    avatarInput = $state(),
    bannerFile,
    password = $state(),
    revealPassword = $state(),
    bannerInput = $state();

  let selectAvatar = () => avatarInput.click();
  let selectBanner = () => bannerInput.click();

  let copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  let percent;
  let progress = async (event) => {
    percent = Math.round((event.loaded / event.total) * 100);
  };

  let tooLarge = $state({});

  let handleFile = async ({ target }, type) => {
    tooLarge[type] = false;
    let file = target.files[0];
    if (!file) return;

    if (file.size > 10000000) return (tooLarge[type] = true);

    var reader = new FileReader();
    reader.onload = async (e) => {
      if (type === "picture") {
        $avatar = { id, file, type, progress, src: e.target.result };
      } else if (type === "banner") {
        $bannerStore = { id, file, type, progress, src: e.target.result };
      }
    };

    reader.readAsDataURL(file);
  };

  let url = $derived(`${$page.url.host}/${username}`);
  let full = $derived(`${$page.url.protocol}//${url}`);
  let addr = $derived(`${username}@${$page.url.host}`);
</script>

<div class="space-y-6">
  <!-- Username Field -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-purple-500/40 transition-all duration-500 animate-scaleIn"
  >
    <label for="username" class="font-bold mb-2 block text-lg gradient-text"
      >{$t("user.settings.username")}</label
    >
    <div class="flex">
      <input
        type="text"
        name="username"
        bind:value={username}
        class="glass rounded-2xl border-2 border-white/20 focus:border-purple-500/50 bg-white/5 w-full p-4 text-white placeholder-white/40"
      />
    </div>
  </div>

  <input type="hidden" name="confirm" bind:value={password} />

  <!-- Password Field -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-pink-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.1s;"
  >
    <label for="password" class="font-bold mb-2 block text-lg gradient-text"
      >{$t("user.settings.newPassword")}</label
    >

    <PasswordInput
      bind:value={password}
      placeholder="(Leave blank to keep unchanged)"
      class="glass rounded-2xl border-2 border-white/20 focus:border-pink-500/50 bg-white/5"
    />
  </div>

  <!-- Display Name Field -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-blue-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.2s;"
  >
    <label for="display" class="font-bold mb-2 block text-lg gradient-text"
      >{$t("user.settings.displayName")}</label
    >
    <input
      type="text"
      name="display"
      bind:value={display}
      class="glass rounded-2xl border-2 border-white/20 focus:border-blue-500/50 bg-white/5 w-full p-4 text-white placeholder-white/40"
    />
  </div>

  <!-- Profile Image Section -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-yellow-500/40 transition-all duration-500 space-y-3 animate-scaleIn"
    style="animation-delay: 0.3s;"
  >
    <span class="font-bold text-lg gradient-text"
      >{$t("user.settings.profileImage")}</span
    >

    <div class="flex items-center gap-4">
      {#if $avatar?.src || (picture && picture !== 'undefined' && picture !== undefined)}
        {@const avatarSrc = $avatar?.src || picture}
        <div
          class="relative rounded-full overflow-hidden text-center w-24 h-24 hover:scale-110 transition-transform cursor-pointer group border-2 border-purple-500/50 hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-500/50"
          onclick={selectAvatar}
          onkeydown={selectAvatar}
        >
          {#if avatarSrc}
            <img
              src={avatarSrc}
              class="absolute w-full h-full object-cover object-center visible overflow-hidden"
              alt={username}
            />
          {/if}
          <div
            class="absolute inset-0 bg-gradient-to-t from-purple-900/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <iconify-icon icon="ph:camera" class="text-white" width="32"
            ></iconify-icon>
          </div>
        </div>
      {:else}
        <div
          class="rounded-full p-4 glass w-24 h-24 hover:scale-110 transition-all cursor-pointer border-2 border-white/20 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/50 flex items-center justify-center group"
          onclick={selectAvatar}
          onkeydown={selectAvatar}
        >
          <iconify-icon
            icon="ph:user-circle-plus"
            class="text-white/50 group-hover:text-purple-400"
            width="48"
          ></iconify-icon>
        </div>
      {/if}
      <div>
        <button
          type="button"
          class="px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group flex items-center gap-2"
          style="background: linear-gradient(135deg, #B794F4 0%, #9F7AEA 100%); color: white;"
          onclick={selectAvatar}
          onkeydown={selectAvatar}
        >
          <!-- Shimmer effect -->
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
               style="background: linear-gradient(135deg, #9F7AEA 0%, #B794F4 100%);"></div>
          <iconify-icon icon="ph:camera-bold" width="24" class="relative z-10 group-hover:rotate-12 transition-transform duration-300"
          ></iconify-icon>
          <span class="relative z-10">{$t("user.settings.select")} Photo</span>
        </button>
        <input
          type="file"
          class="hidden"
          bind:this={avatarInput}
          onchange={(e) => handleFile(e, "picture")}
        />
      </div>
    </div>

    {#if tooLarge["avatar"]}
      <div class="text-red-400 glass p-3 rounded-xl border border-red-500/50">
        <iconify-icon icon="ph:warning-circle" class="inline mr-1"
        ></iconify-icon>
        Max file size 10MB
      </div>
    {/if}
  </div>

  <!-- Banner Image Section (Optional) -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 dark:bg-black/30 border-2 border-white/10 hover:border-green-500/40 transition-all duration-500 space-y-3 animate-scaleIn"
    style="animation-delay: 0.4s;"
  >
    <div class="flex justify-between items-center">
      <span class="font-bold text-lg gradient-text"
        >{$t("user.settings.bannerImage")}
        <span class="text-sm text-white/50">(Optional)</span></span
      >
    </div>

    {#if $bannerStore?.src || (banner && banner !== 'undefined' && banner !== undefined)}
      {@const bannerSrc = $bannerStore?.src || banner}
      <div
        class="relative group cursor-pointer rounded-2xl overflow-hidden"
        onclick={selectBanner}
        onkeydown={selectBanner}
      >
        {#if bannerSrc}
          <img
            src={bannerSrc}
            class="w-full object-cover object-center visible overflow-hidden h-48 group-hover:scale-105 transition-transform"
            alt="Banner"
          />
        {:else}
          <div class="w-full h-48 bg-gray-800"></div>
        {/if}
        <div
          class="absolute inset-0 bg-gradient-to-t from-purple-900/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        >
          <iconify-icon icon="ph:camera" class="text-white" width="48"
          ></iconify-icon>
        </div>
      </div>
    {:else}
      <div
        class="glass w-full h-48 cursor-pointer hover:border-green-500/50 transition-all rounded-2xl border-2 border-white/20 flex items-center justify-center group hover:shadow-lg hover:shadow-green-500/20"
        onclick={selectBanner}
        onkeydown={selectBanner}
      >
        <iconify-icon
          icon="ph:image-square"
          class="text-white/50 group-hover:text-green-400"
          width="64"
        ></iconify-icon>
      </div>
    {/if}

    <button
      type="button"
      class="px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center gap-2"
      style="background: linear-gradient(135deg, #68D391 0%, #48BB78 100%); color: white;"
      onclick={selectBanner}
      onkeydown={selectBanner}
    >
      <!-- Shimmer effect -->
      <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
           style="background: linear-gradient(135deg, #48BB78 0%, #68D391 100%);"></div>
      <iconify-icon icon="ph:image-bold" width="24" class="relative z-10 group-hover:rotate-12 transition-transform duration-300"
      ></iconify-icon>
      <span class="relative z-10">{$t("user.settings.select")} Banner</span>
    </button>
    <input
      type="file"
      class="hidden"
      bind:this={bannerInput}
      onchange={(e) => handleFile(e, "banner")}
    />

    {#if tooLarge["banner"]}
      <div class="text-red-400 glass p-3 rounded-xl border border-red-500/50">
        <iconify-icon icon="ph:warning-circle" class="inline mr-1"
        ></iconify-icon>
        Max file size 10MB
      </div>
    {/if}
  </div>

  <!-- About Section -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-purple-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.5s;"
  >
    <label for="about" class="font-bold mb-2 block text-lg gradient-text"
      >{$t("user.settings.about")}</label
    >
    <textarea
      type="text"
      name="about"
      bind:value={about}
      placeholder={$t("user.settings.aboutPlaceholder")}
      class="glass rounded-2xl border-2 border-white/20 focus:border-purple-500/50 bg-white/5 w-full p-4 h-32 text-white placeholder-white/40"
    ></textarea>
  </div>

  <!-- PRO Mode Toggle -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-cyan-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.6s;"
  >
    <div class="flex items-center justify-between">
      <div>
        <label for="proMode" class="font-bold mb-1 block text-lg gradient-text">
          PRO Mode
        </label>
        <p class="text-sm text-white/60">
          Enable all animations and visual effects (uses more processing power)
        </p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          bind:checked={$proMode}
          class="sr-only peer"
        />
        <div class="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-cyan-500 peer-checked:to-teal-500"></div>
      </label>
    </div>
  </div>

  <!-- Profile QR Code Section -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-indigo-500/40 transition-all duration-500 animate-scaleIn space-y-4"
    style="animation-delay: 0.7s;"
  >
    <label class="font-bold text-lg gradient-text block">
      {$t("user.url") || "Profile URL"}
    </label>

    <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div class="flex-1 break-all">
        <p class="text-sm text-white/60 mb-2">Share this link with others so they can find and pay you:</p>
        <p class="text-lg text-white font-mono bg-white/5 p-3 rounded-lg border border-white/10">
          {full}
        </p>
      </div>

      <div class="flex gap-2 flex-shrink-0">
        <button
          type="button"
          class="p-3 rounded-xl glass border border-white/20 hover:border-white/40 transition-all hover:bg-white/10 flex items-center justify-center group"
          onclick={() => copy(full)}
          title="Copy profile link"
          aria-label="Copy profile link"
        >
          <iconify-icon icon="ph:copy-bold" class="text-white group-hover:text-cyan-400 transition-colors" width="24"></iconify-icon>
        </button>
        <a
          href={`/qr/${encodeURIComponent(full)}`}
          class="p-3 rounded-xl glass border border-white/20 hover:border-white/40 transition-all hover:bg-white/10 flex items-center justify-center group"
          title="View QR code"
          aria-label="View QR code"
        >
          <iconify-icon icon="ph:qr-code-bold" class="text-white group-hover:text-indigo-400 transition-colors" width="24"></iconify-icon>
        </a>
      </div>
    </div>

    <div class="mt-4 pt-4 border-t border-white/10">
      <p class="text-sm text-white/60 mb-3">Or scan this QR code:</p>
      <Qr text={full} />
    </div>
  </div>
</div>
