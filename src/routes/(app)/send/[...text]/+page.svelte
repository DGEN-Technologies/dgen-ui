<script>
  import { invalidate } from "$app/navigation";
  import { page } from "$app/stores";
  import { fly } from "svelte/transition";
  import { enhance } from "$app/forms";
  import { tick } from "svelte";
  import { browser } from "$app/environment";
  import { t } from "$lib/translations";
  import Avatar from "$comp/Avatar.svelte";
  import Icon from "$comp/Icon.svelte";
  import Spinner from "$comp/Spinner.svelte";
  import { back, get, post, fail, focus } from "$lib/utils";

  let { data = $bindable(), form } = $props();

  let { contacts = [] } = $derived(data);

  let all = $state();
  let loaded = $state();
  let loadMore = async () => {
    loaded = true;
    all = await get("/contacts");
  };

  let el = $state(),
    text = $state(data.text || ""),
    pasted = $state(),
    w = $state(),
    detectedType = $state(null),
    selectedAsset = $state("lbtc"); // Default to L-BTC for Liquid addresses

  let keypress = (e) =>
    e.key === "Enter" ? e.preventDefault() || el.click() : (pasted = false);

  let paste = async () => {
    text = (await navigator.clipboard.readText()).trim();
    await tick();
    pasted = true;
    detectPaymentType();
  };

  let detectPaymentType = () => {
    if (!text) {
      detectedType = null;
      return;
    }
    
    const lower = text.toLowerCase().trim();
    
    // Lightning invoice
    if (lower.startsWith("lnbc") || lower.startsWith("lntb") || lower.startsWith("lightning:")) {
      detectedType = "lightning";
    }
    // Bitcoin address
    else if (lower.startsWith("bitcoin:") || lower.startsWith("bc1") || lower.startsWith("tb1") || lower.startsWith("bcrt1")) {
      detectedType = "bitcoin";
    }
    // Liquid address (Bech32: lq1, ex1, ert1 OR Base58 confidential: V, CT, etc.)
    else if (lower.startsWith("liquidnetwork:") || lower.startsWith("lq1") || lower.startsWith("ex1") || lower.startsWith("ert1") ||
             /^[VCT][A-Za-z0-9]{50,}$/.test(text.trim()) || /^[2][A-Za-z0-9]{33,}$/.test(text.trim())) {
      detectedType = "liquid";
    }
    // Lightning address (email format)
    else if (lower.includes("@") && !lower.includes(" ")) {
      detectedType = "lnurl";
    }
    else {
      detectedType = null;
    }
  };

  let pin = async (e, { id, pinned }) => {
    e.preventDefault();
    e.stopPropagation();

    if (pinned) {
      await post("/pins/delete", { id });
    } else {
      await post("/pins", { id });
    }

    if (all) all = await get("/contacts");
    invalidate("app:contacts");
  };

  let trust = async (e, { id, trusted }) => {
    e.preventDefault();
    e.stopPropagation();

    if (trusted) {
      await post("/trust/delete", { id });
    } else {
      await post("/trust", { id });
    }

    if (all) all = await get("/contacts");
    invalidate("app:contacts");
  };

  $effect(() => {
    if (browser && pasted && text) el.click() && (pasted = false);
  });

  // Detect payment type on mount if text is pre-populated
  $effect(() => {
    if (browser && text) detectPaymentType();
  });
</script>

<svelte:window bind:innerWidth={w} />

<div class="min-h-screen relative">
  <!-- Content Container -->
  <div
    class="container px-4 max-w-lg mx-auto space-y-5 pt-4 sm:pt-6 pb-10 relative z-10"
  >
    <!-- Title with epic glow effect -->
    <div class="text-center mb-4 sm:mb-6 animate-fadeInUp">
      <div class="relative inline-block">
        <h1 class="text-4xl md:text-5xl font-bold mb-2">
          <span class="gradient-text">Send</span>
        </h1>
      </div>
      <p class="text-2xl text-white/70 mx-auto leading-relaxed px-2">
        Enter a Bitcoin, Lightning, or Liquid address (L-BTC, L-USDT)
      </p>
    </div>

    <!-- Main form card with glassmorphism -->
    <form
      method="POST"
      use:enhance
      class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-dgen-aqua/40 transition-all duration-500 space-y-4 text-xl animate-scaleIn"
    >
      {#if form?.error}
        <div class="mb-5">
          <div
            class="glass p-4 rounded-2xl border-2 border-red-500/50 bg-red-500/10 text-red-400"
          >
            <iconify-icon
              icon="ph:warning-circle"
              width="24"
              class="inline mr-2"
            ></iconify-icon>
            {form.error === "default"
              ? $t("error.unrecognizedInput")
              : form.error}
          </div>
        </div>
      {/if}

      <!-- Scan/Paste action buttons - More prominent -->
      <div class="grid grid-cols-2 gap-3 mb-4">
        <a href="/scan" class="contents">
          <button
            type="button"
            class="px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group flex flex-col items-center justify-center gap-2"
            style="background: linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%); color: white; min-height: 100px;"
          >
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                 style="background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%);"></div>
            <iconify-icon
              noobserver
              icon="ph:camera-bold"
              width="40"
              class="relative z-10 group-hover:scale-110 transition-transform duration-300"
            ></iconify-icon>
            <span class="relative z-10">{$t("user.send.scan")}</span>
          </button>
        </a>

        <button
          type="button"
          class="px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group flex flex-col items-center justify-center gap-2"
          style="background: linear-gradient(135deg, #74EBD5 0%, #9688DD 100%); color: white; min-height: 100px;"
          onclick={paste}
        >
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
               style="background: linear-gradient(135deg, #9688DD 0%, #74EBD5 100%);"></div>
          <iconify-icon
            noobserver
            icon="ph:clipboard-text-bold"
            width="40"
            class="relative z-10 group-hover:scale-110 transition-transform duration-300"
          ></iconify-icon>
          <span class="relative z-10">{$t("user.send.paste")}</span>
        </button>
      </div>

      <div class="text-center mb-2">
        <p class="text-xs text-white/50">or enter manually below</p>
      </div>

      <div class="space-y-2">
        <textarea
          use:focus
          name="text"
          placeholder={$t("user.send.placeholder")}
          onkeypress={keypress}
          oninput={detectPaymentType}
          class="w-full p-4 rounded-2xl h-24 text-base glass border-2 border-white/20 focus:border-dgen-cyan/50 focus:ring-2 focus:ring-dgen-cyan/20 transition-all duration-300 placeholder-white/40 resize-none"
          bind:value={text}
          onpaste={() => (pasted = true)}
          autocapitalize="none"
        ></textarea>

        <!-- Payment type indicator - positioned below textarea -->
        {#if detectedType}
          <div class="flex justify-center">
            <div class="glass px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-xl">
              {#if detectedType === "lightning"}
                <span class="flex items-center gap-1.5 text-yellow-400 text-sm font-semibold">
                  <iconify-icon icon="ph:lightning-fill" width="18"></iconify-icon>
                  <span>Lightning</span>
                </span>
              {:else if detectedType === "bitcoin"}
                <span class="flex items-center gap-1.5 text-orange-400 text-sm font-semibold">
                  <iconify-icon icon="cryptocurrency:btc" width="18"></iconify-icon>
                  <span>Bitcoin</span>
                </span>
              {:else if detectedType === "liquid"}
                <span class="flex items-center gap-1.5 text-blue-400 text-sm font-semibold">
                  <iconify-icon icon="ph:drop-fill" width="18"></iconify-icon>
                  <span>Liquid</span>
                </span>
              {:else if detectedType === "lnurl"}
                <span class="flex items-center gap-1.5 text-green-400 text-sm font-semibold">
                  <iconify-icon icon="ph:at-bold" width="18"></iconify-icon>
                  <span>LN Address</span>
                </span>
              {/if}
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Asset selector for Liquid addresses -->
      {#if detectedType === "liquid"}
        <div class="flex gap-2 justify-center">
          <button
            type="button"
            onclick={() => selectedAsset = "lbtc"}
            class="glass rounded-lg py-2 px-4 font-semibold transition-all duration-300 border-2 {selectedAsset === 'lbtc' ? 'border-orange-500/60 bg-orange-500/20 text-orange-400' : 'border-white/20 hover:border-white/40'}"
          >
            <span class="flex items-center gap-2">
              <iconify-icon icon="cryptocurrency:btc" width="20" class={selectedAsset === 'lbtc' ? 'text-orange-400' : ''}></iconify-icon>
              Bitcoin
            </span>
          </button>
          <button
            type="button"
            onclick={() => selectedAsset = "usdt"}
            class="glass rounded-lg py-2 px-4 font-semibold transition-all duration-300 border-2 {selectedAsset === 'usdt' ? 'border-green-500/60 bg-green-500/20 text-green-400' : 'border-white/20 hover:border-white/40'}"
          >
            <span class="flex items-center gap-2">
              <iconify-icon icon="cryptocurrency:usdt" width="20" class={selectedAsset === 'usdt' ? 'text-green-400' : ''}></iconify-icon>
              USDT
            </span>
          </button>
        </div>
        <input type="hidden" name="asset" value={selectedAsset} />
      {/if}

      {#if form?.error}
        <div class="glass bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p class="text-red-400">
            {#if form.error === "Unsupported payment type"}
              <span class="font-semibold">Unable to detect payment type</span>
              <div class="mt-2 text-sm text-white/70">
                Please check your address format:
                <ul class="mt-2 text-left list-disc list-inside space-y-1">
                  <li><span class="text-yellow-400">Lightning:</span> Starts with "lnbc" or "lntb"</li>
                  <li><span class="text-orange-400">Bitcoin:</span> Starts with "bc1" or "bitcoin:"</li>
                  <li><span class="text-blue-400">Liquid:</span> Starts with "lq1", "V", "CT", or "liquidnetwork:"</li>
                </ul>
              </div>
            {:else}
              {form.error}
            {/if}
          </p>
        </div>
      {/if}

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

      <!-- Create a fund button - moved to settings for advanced users -->
      <!-- <a href="/send/fund" class="block">
        <button
          type="button"
          class="btn glass border-2 border-yellow-400/30 hover:border-yellow-400/60 hover:shadow-lg hover:shadow-yellow-400/20 transition-all group"
        >
          <iconify-icon
            noobserver
            icon="ph:lightning-fill"
            class="text-yellow-300 text-2xl lightning"
          ></iconify-icon>
          <div class="my-auto font-semibold">{$t("payments.createFund")}</div>
        </button>
      </a> -->
    </form>

    {#if contacts.length}
      <div class="space-y-5 animate-fadeInUp" style="animation-delay: 0.3s;">
        <h1 class="px-3 md:px-0 text-2xl font-bold text-center">
          <span class="gradient-text">Quick Send</span>
        </h1>
        <div
          class="glass-card backdrop-blur-xl bg-white/5 border border-white/10"
        >
          {#each all || contacts as c, i}
            <a href={`/pay/${c.username}`} class="contents">
              <div
                class="flex hover:bg-white/10 p-3 rounded-2xl transition-all duration-200 group"
              >
                <Avatar user={c} size={20} disabled={true} />
                <div class="my-auto text-left">
                  <p
                    class="ml-2 text-lg break-words font-semibold group-hover:text-purple-400 transition-colors"
                  >
                    {c.username}
                  </p>
                </div>
                <div class="flex ml-auto gap-2">
                  <button
                    onclick={(e) => pin(e, c)}
                    class="hover:scale-110 transition-transform"
                  >
                    <iconify-icon
                      icon={c.pinned ? "ph:push-pin-fill" : "ph:push-pin-bold"}
                      width={28}
                      class={c.pinned
                        ? "text-yellow-400"
                        : "text-white/60 hover:text-yellow-400"}
                    ></iconify-icon>
                  </button>
                  <button
                    class="ml-auto hover:scale-110 transition-transform"
                    onclick={(e) => trust(e, c)}
                  >
                    <iconify-icon
                      icon={c.trusted ? "ph:star-fill" : "ph:star-bold"}
                      width={28}
                      class={c.trusted
                        ? "text-purple-400"
                        : "text-white/60 hover:text-purple-400"}
                    ></iconify-icon>
                  </button>
                </div>
              </div>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    {#if !loaded && contacts.length > 0}
      <button
        onclick={loadMore}
        type="button"
        class="w-full px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center justify-center gap-2"
        style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white;"
      >
        <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
             style="background: linear-gradient(135deg, #4B5563 0%, #6B7280 100%);"></div>
        <iconify-icon icon="ph:arrow-down-bold" width="20" class="relative z-10 group-hover:translate-y-1 transition-transform duration-300"></iconify-icon>
        <span class="relative z-10">{$t("user.loadMore")}</span>
      </button>
    {/if}
  </div>
</div>
