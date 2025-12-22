<script>
  import { invalidate } from "$app/navigation";
  import { browser } from "$app/environment";
  import { hexToUint8Array } from "uint8array-extras";
  import {
    copy,
    f,
    loc,
    get,
    post,
    s,
    sats,
    success,
    fail,
    si,
  } from "$lib/utils";
  import { t } from "$lib/translations";
  // import { sign, send } from "$lib/nostr"; // NOSTR DISABLED
  import { bech32 } from "@scure/base";
  import { page } from "$app/stores";
  import { PUBLIC_DOMAIN } from "$env/static/public";
  import {
    lnAddressStore,
    isLoading as lnAddressLoading,
  } from "$lib/stores/lightningAddress";

  let { data, children } = $props();

  let { encode, toWords } = bech32;

  let {
    events,
    rate,
    user,
    subject,
    src,
    text,
    follows,
    followers,
    followList,
  } = $derived(data);

  let { currency, npub, username: n, display } = $derived(subject);
  let locale = $derived(loc(user));

  let list = $state([]);
  let follow = async () => {
    list = [...list, subject.pubkey];
    let pubkeys = await get(
      `/api/${user.pubkey}/follows?pubkeysOnly=true&nocache=true`,
    );
    pubkeys.push(subject.pubkey);
    await update(pubkeys);
  };

  let unfollow = async () => {
    list.splice(
      list.findIndex((t) => t[1] === subject.pubkey),
      1,
    );
    list = list;
    let pubkeys = await get(
      `/api/${user.pubkey}/follows?pubkeysOnly=true&nocache=true`,
    );
    pubkeys.splice(pubkeys.indexOf(subject.pubkey), 1);
    await update(pubkeys);
  };

  let update = async (pubkeys) => {
    if (!browser) return;

    let event = {
      pubkey: user.pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: 3,
      content: "",
      tags: pubkeys.map((p) => ["p", p]),
    };

    try {
      let signed = await sign(event);
      send(signed);
      invalidate("app:user");
    } catch (e) {
      console.log(e);
    }
  };

  let showBio = $state();
  let toggleBio = () => (showBio = !showBio);

  let showDetails = $state();
  let toggleDetails = () => (showDetails = !showDetails);

  let password = $state();

  let reset = async (e) => {
    e.preventDefault();
    try {
      await post(`/reset`, { username: n, password });
      success("Password reset");
    } catch (e) {
      fail(e.message);
    }
  };

  let stripped = $derived(n.replace(/\s/g, ""));
  let username = $derived(n.length > 60 ? n.substr(0, 6) : display || stripped);
  let lnaddr = $derived(
    subject?.anon
      ? subject.lud16 || undefined
      : `${stripped}@${$page.url.host}`,
  );
  let profile = $derived(`${$page.url.host}/${subject.anon ? npub : stripped}`);
  let lnurl = $derived(
    encode(
      "lnurl",
      toWords(
        new TextEncoder().encode(
          `https://${PUBLIC_DOMAIN}/p/${subject.anon ? npub : stripped}`,
        ),
      ),
      20000,
    ),
  );
  $effect(() => followList.then((l) => (list = l)));
  let following = $derived(list.some((t) => t.includes(subject.pubkey)));

  // Get lightning address from store (source of truth) or fall back to database value
  let displayLightningAddress = $derived(
    $lnAddressStore.lnAddress || subject?.lightningAddress,
  );
</script>

<div class="container mx-auto w-full px-4 flex flex-wrap lg:flex-nowrap">
  <div
    class="w-full lg:w-[280px] xl:w-[360px] lg:absolute space-y-2 lg:left-20 mx-auto pb-8 lg:pb-0"
  >
    <div class="space-y-1">
      <div
        class="flex text-3xl font-bold text-center mx-auto justify-center gap-1 items-center"
      >
        <button class="flex gap-1 items-center" onclick={toggleDetails}>
          <div class="break-words">{display || username}</div>
          <iconify-icon noobserver icon="ph:list-bold" width="32"
          ></iconify-icon>
        </button>
        <!-- <a href={`/${subject.pubkey}/notes`}> -->
        <!--   <iconify-icon noobserver icon="ph:note-bold" width="32"></iconify-icon> -->
        <!-- </a> -->
      </div>
      {#if subject.id === user?.id}
        <div class="flex justify-center">
          {#if displayLightningAddress}
            <button
              class="text-xs text-white/90 hover:text-white hover:underline cursor-pointer transition-all"
              onclick={toggleDetails}
            >
              (click here to show your Lightning Address)
            </button>
          {:else if $lnAddressLoading}
            <div class="text-xs text-white/60 flex items-center gap-1">
              <iconify-icon
                noobserver
                icon="ph:spinner"
                width="14"
                class="animate-spin"
              ></iconify-icon>
              <span>Setting up your Lightning Address...</span>
            </div>
          {/if}
        </div>

        <!-- Visa Card Coming Soon -->
        <div class="mt-3 flex justify-center">
          <div
            class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-2 border-blue-500/30"
          >
            <iconify-icon
              icon="ph:credit-card-bold"
              class="text-blue-400"
              width="20"
            ></iconify-icon>
            <span class="text-sm font-semibold text-blue-300">Visa Card</span>
            <span
              class="text-xs text-white/60 bg-white/10 px-2 py-0.5 rounded-full"
              >Coming Soon</span
            >
          </div>
        </div>
      {/if}
    </div>

    {#if subject.about}
      <div
        class="text-secondary mx-auto text-center lg:mx-0 break-words space-y-1"
        class:line-clamp-2={!showBio}
        onclick={toggleBio}
        onkeydown={toggleBio}
      >
        <div>
          {subject.about}
        </div>

        {#if subject.website}
          <div>
            <a href={subject.website} class="underline">{subject.website}</a>
          </div>
        {/if}
      </div>
    {/if}

    <!-- <div> -->
    <!--   <div class="flex justify-center gap-2"> -->
    <!--     <a -->
    <!--       href={`/${subject.pubkey}/follows`} -->
    <!--       data-sveltekit-preload-data="tap" -->
    <!--       rel="nofollow" -->
    <!--       ><b>{si(follows, 0, 0)}</b> -->
    <!--       <span class="text-secondary">{$t("user.following")}</span></a -->
    <!--     > -->
    <!--     <a -->
    <!--       href={`/${subject.pubkey}/followers`} -->
    <!--       data-sveltekit-preload-data="tap" -->
    <!--       rel="nofollow" -->
    <!--       ><b>{si(followers, 0, 0)}</b> -->
    <!--       <span class="text-secondary">{$t("user.followers")}</span></a -->
    <!--     > -->
    <!--   </div> -->
    <!-- </div> -->

    {#if showDetails}
      <div class="space-y-5">
        <!-- Lightning Address - Coming Soon -->
        <!-- {#if lnaddr}
          <div>
            <div class="text-secondary">{$t("user.lightningAddress")}</div>
            <div class="flex gap-4">
              <div class="break-all grow text-xl">
                {lnaddr}
              </div>
              <div class="flex mb-auto gap-1">
                <button class="my-auto" onclick={() => copy(lnaddr)}
                  ><iconify-icon noobserver icon="ph:copy-bold" width="32"
                  ></iconify-icon></button
                >
                <a href={`/qr/${encodeURIComponent(lnaddr)}`} class="my-auto">
                  <iconify-icon noobserver icon="ph:qr-code-bold" width="32"
                  ></iconify-icon>
                </a>
              </div>
            </div>
          </div>
        {/if} -->

        <!-- Public URL - Commented out per request -->
        <!-- <div class="flex flex-col items-center lg:items-start">
          <div class="text-secondary">{$t("user.url")}</div>
          <div class="flex gap-4">
            <div class="break-all grow text-xl">
              {profile}
            </div>
            <div class="flex mb-auto gap-1">
              <button class="my-auto" onclick={() => copy(profile)} aria-label="Copy profile link"
                ><iconify-icon noobserver icon="ph:copy-bold" width="32"
                ></iconify-icon></button
              >
              <a
                href={`/qr/${encodeURIComponent(
                  `${$page.url.protocol}//${profile}`,
                )}`}
                aria-label="View QR code"
                class="my-auto"
              >
                <iconify-icon noobserver icon="ph:qr-code-bold" width="32"
                ></iconify-icon>
              </a>
            </div>
          </div>
        </div> -->

        {#if displayLightningAddress && subject.id === user?.id}
          <div class="flex flex-col items-center lg:items-start">
            <div class="text-secondary">
              {$t("user.settings.LIGHTNING_ADDRESS")}
            </div>
            <div class="flex gap-4">
              <div class="break-all grow text-xl">
                {displayLightningAddress}
              </div>
              <div class="flex mb-auto gap-1">
                <button
                  class="my-auto"
                  onclick={() => copy(displayLightningAddress)}
                  aria-label="Copy Lightning address"
                  ><iconify-icon noobserver icon="ph:copy-bold" width="32"
                  ></iconify-icon></button
                >
                <a
                  href={`/${subject.username}/receive?show=lightning-address`}
                  aria-label="View QR code"
                  class="my-auto"
                >
                  <iconify-icon noobserver icon="ph:qr-code-bold" width="32"
                  ></iconify-icon>
                </a>
              </div>
            </div>
          </div>
        {/if}

        <!-- Payment Code (LNURL) - Coming Soon -->
        <!-- <div>
          <div class="text-secondary">{$t("user.lnurl")}</div>
          <div class="flex gap-4">
            <div class="break-all grow text-xl">
              {lnurl}
            </div>
            <div class="flex mb-auto gap-1">
              <button class="my-auto" onclick={() => copy(`lightning:${lnurl}`)}
                ><iconify-icon noobserver icon="ph:copy-bold" width="32"
                ></iconify-icon></button
              >
              <a
                href={`/${n}/accepted/${encodeURIComponent(`lightning:${lnurl}`)}`}
                class="my-auto"
              >
                <iconify-icon noobserver icon="ph:qr-code-bold" width="32"
                ></iconify-icon>
              </a>
            </div>
          </div>
        </div> -->
        <!-- <div> -->
        <!--   <div class="text-secondary">{$t("user.nostrPubkey")}</div> -->
        <!--   <div class="flex gap-4"> -->
        <!--     <div class="break-all grow text-xl"> -->
        <!--       {npub} -->
        <!--     </div> -->
        <!--     <div class="flex my-auto gap-1"> -->
        <!--       <button class="my-auto" onclick={() => copy(npub)} -->
        <!--         ><iconify-icon noobserver icon="ph:copy-bold" width="32" -->
        <!--         ></iconify-icon></button -->
        <!--       > -->
        <!--       <a href={`/qr/${encodeURIComponent(npub)}`} class="my-auto"> -->
        <!--         <iconify-icon noobserver icon="ph:qr-code-bold" width="32" -->
        <!--         ></iconify-icon> -->
        <!--       </a> -->
        <!--     </div> -->
        <!--   </div> -->
        <!-- </div> -->
      </div>
    {/if}

    <div class="flex flex-wrap gap-2 w-full text-lg">
      <!-- {#if user &#38;&#38; user.username !== subject.username &#38;&#38; subject.pubkey} -->
      <!--   {#if following} -->
      <!--     <button class="btn" onclick={unfollow}> -->
      <!--       <iconify-icon noobserver icon="ph:user-bold" width="32" -->
      <!--       ></iconify-icon> -->
      <!--       <div class="my-auto">{$t("user.unfollow")}</div> -->
      <!--     </button> -->
      <!--   {:else} -->
      <!--     <button class="btn" onclick={follow}> -->
      <!--       <iconify-icon noobserver icon="ph:user-bold" width="32" -->
      <!--       ></iconify-icon> -->
      <!--       <div class="my-auto">{$t("user.follow")}</div> -->
      <!--     </button> -->
      <!--   {/if} -->
      <!-- {/if} -->

      <!-- {#if user &#38;&#38; user.username !== subject.username &#38;&#38; subject.pubkey} -->
      <!--   <a href={`/messages/${subject.username}`} class="contents"> -->
      <!--     <button -->
      <!--       class="rounded-2xl border py-5 px-6 font-bold hover:opacity-80 flex w-60 grow" -->
      <!--     > -->
      <!--       <div class="mx-auto flex"> -->
      <!--         <Icon icon="message" style="w-8 mr-2 my-auto" /> -->
      <!--         <div class="mt-1 my-auto">{$t("user.message")}</div> -->
      <!--       </div> -->
      <!--     </button> -->
      <!--   </a> -->
      <!-- {/if} -->

      {#if user?.admin && user.username !== subject.username}
        <form class="w-full flex" onsubmit={reset}>
          <input placeholder="Password reset" bind:value={password} />
          <button
            type="submit"
            class="rounded-2xl border py-5 px-6 font-bold hover:opacity-80 flex w-60"
          >
            <div class="mx-auto flex">
              <iconify-icon noobserver icon="ph:clock" width="32"
              ></iconify-icon>
            </div>
          </button>
        </form>
      {/if}
    </div>
  </div>

  <div class="w-full">
    <div
      class="mx-auto space-y-5 lg:max-w-xl xl:max-w-2xl mt-5 lg:mt-0 lg:ml-80 xl:ml-96"
    >
      {@render children?.()}
    </div>
  </div>
</div>

{#if currency}
  <div
    class="fixed bottom-0 inset-x-0 z-40 glass backdrop-blur-xl bg-black/60 border-t border-white/10"
    style="padding-bottom: calc(var(--safe-area-inset-bottom) + 8px);"
  >
    <div class="flex justify-between items-center px-4 py-3 max-w-7xl mx-auto">
      <div class="flex items-center gap-3 text-sm">
        <div class="flex items-center gap-1 font-mono">
          <span class="text-gray-400">1</span>
          <img src="/images/bitcoin.svg" class="w-5 h-5" alt="Bitcoin" />
          <span class="text-gray-400">=</span>
          <span class="text-orange-400 font-semibold"
            >{f(rate, currency, locale, 0, 0)}</span
          >
        </div>
      </div>
      <div class="flex items-center gap-1 text-sm font-mono">
        <iconify-icon
          noobserver
          icon="ph:lightning-fill"
          class="text-yellow-400"
          width="20"
        ></iconify-icon>
        <span class="text-gray-400">{s((1 * sats) / rate)}</span>
        <span class="text-gray-400">=</span>
        <span class="text-yellow-400 font-semibold"
          >{f(1, currency, locale, 0, 0)}</span
        >
      </div>
    </div>
  </div>
{/if}
