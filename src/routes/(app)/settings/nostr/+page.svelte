<!-- NOSTR SETTINGS PAGE COMMENTED OUT - NOT USED IN THIS APP -->

<!-- <script>
  import { untrack } from "svelte";
  import { browser } from "$app/environment";
  import { getNsec } from "$lib/nostr";
  import { page } from "$app/stores";
  import { tick } from "svelte";
  import { t } from "$lib/translations";
  import { s, copy, fail } from "$lib/utils";
  import {
    PUBLIC_DGEN_PUBKEY as pk,
    PUBLIC_DGEN_RELAY as relay,
  } from "$env/static/public";
  import { signer, save } from "$lib/store";

  let { data } = $props();
  let { apps, challenge, user } = $derived(data);
  let npub = $state(untrack(() => user.npub));
  let extensionAvailable = $derived(browser && window.nostr);
  let { locale } = $derived(user);

  let newNsec = $state(),
    nsec = $state(),
    pin = $state(""),
    revealNsec = $state(),
    revealNwc = $state();

  let toggleNsec = async () => {
    try {
      nsec = await getNsec(user);
      revealNsec = !revealNsec;
    } catch (e) {
      fail("Failed to decrypt nsec");
    }
  };

  let extension = $state();
  let getPubkey = async () => {
    $signer = { method: "extension", ready: true };
    extension = true;
    npub = await window.nostr.getPublicKey();
    await tick();
    $save.click();
  };
</script>

<input type="hidden" name="challenge" value={challenge} />
<input type="hidden" name="extension" value={extension} />

<div class="space-y-6">
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-purple-500/40 transition-all duration-500 animate-scaleIn"
  >
    <div class="flex items-start gap-4 mb-6">
      <div
        class="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/30"
      >
        <iconify-icon icon="ph:wallet-bold" class="text-white" width="32"
        ></iconify-icon>
      </div>
      <div class="flex-1">
        <h2 class="text-2xl font-bold gradient-text mb-2">
          {$t("user.settings.nwc")}
        </h2>
        <p class="text-white/60">
          {$t("user.settings.nwcDescription")}
        </p>
      </div>
    </div>

    <div class="space-y-3">
      {#each apps as app, i}
        {@const last = i === apps.length - 1}
        <div
          class="glass rounded-2xl p-4 border border-white/10 hover:border-purple-500/30 transition-all"
        >
          <div class="flex justify-center gap-2">
            <div class="grow text-xl break-words min-w-0">
              <div class="font-bold text-white">{app.name}</div>
              {#if app.max_amount > 0}
                <div class="flex gap-1 text-base mt-2">
                  <div class="flex items-center gap-1">
                    <iconify-icon
                      noobserver
                      icon="ph:lightning-fill"
                      class="text-yellow-300 lightning"
                    ></iconify-icon>
                    <span class="text-yellow-400">{s(app.spent, locale)}</span>
                    <span class="text-white/60">/</span>
                    <span class="text-green-400"
                      >{s(app.max_amount, locale)}</span
                    >
                  </div>

                  {#if app.budget_renewal !== "never"}
                    <div class="text-white/60">
                      {app.budget_renewal}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            <div class="flex gap-2">
              <a
                href={`/apps/${app.pubkey}`}
                aria-label={$t("accounts.edit")}
                title={$t("accounts.edit")}
                class="glass p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <iconify-icon
                  icon="ph:gear-bold"
                  width="24"
                  class="text-white/80 hover:text-white"
                ></iconify-icon>
              </a>

              <a
                href={`/apps/${app.pubkey}/payments`}
                aria-label={$t("accounts.payments")}
                class="glass p-2 rounded-lg transition-all {!app.secret
                  ? 'opacity-50 pointer-events-none'
                  : 'hover:bg-white/10'}"
                title={$t("accounts.payments")}
              >
                <iconify-icon
                  icon="ph:clock-bold"
                  width="24"
                  class="text-white/80 hover:text-white"
                ></iconify-icon>
              </a>

              <a
                aria-label="QR"
                href={`/qr/${encodeURIComponent(app.nwc)}`}
                class="glass p-2 rounded-lg transition-all {!app.secret
                  ? 'opacity-50 pointer-events-none'
                  : 'hover:bg-white/10'}"
                title={$t("user.receive.showQR")}
                disabled={!app.secret}
              >
                <iconify-icon
                  icon="ph:qr-code-bold"
                  width="24"
                  class="text-white/80 hover:text-white"
                ></iconify-icon>
              </a>
            </div>
          </div>

          <div class="flex flex-wrap justify-center gap-2 mt-4">
            <button
              aria-label="Copy"
              type="button"
              onclick={() => copy(app.nwc)}
              class="btn glass hover:bg-white/10 !w-auto grow {!app.secret
                ? 'opacity-50 pointer-events-none'
                : ''}"
              title={$t("accounts.copy")}
            >
              <iconify-icon icon="ph:copy-bold" width="20"></iconify-icon>
              <span class="ml-2">{$t("accounts.copyNwc")}</span>
            </button>
            <a
              href={app.nwc}
              class="btn-gradient !w-auto grow whitespace-nowrap {!app.secret
                ? 'opacity-50 pointer-events-none'
                : 'hover:shadow-lg hover:shadow-purple-500/30'}"
              aria-label="Open nostr"
            >
              <iconify-icon icon="ph:arrow-square-out-bold" width="20"
              ></iconify-icon>
              <span class="ml-2">{$t("accounts.connect")}</span>
            </a>
          </div>
        </div>
      {/each}

      <a href="/apps/new" class="block">
        <button
          class="btn-liquid text-white border-0 hover:shadow-2xl hover:shadow-purple-500/50 w-full group"
        >
          <span class="relative z-10 flex items-center justify-center gap-2">
            <iconify-icon
              icon="ph:plus-bold"
              width="24"
              class="group-hover:rotate-90 transition-transform"
            ></iconify-icon>
            <span class="font-bold">{$t("accounts.newConection")}</span>
          </span>
        </button>
      </a>
    </div>
  </div>

  {#if revealNwc}
    <div
      class="premium-card backdrop-blur-xl bg-white/5 border-2 border-purple-500/30 animate-fadeInUp"
    >
      <div class="break-all grow font-mono text-sm text-purple-300 mb-4">
        {nwc}
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          onclick={() => copy(nwc)}
          type="button"
          class="btn glass hover:bg-white/10 grow"
        >
          <iconify-icon noobserver icon="ph:copy-bold" width="24"
          ></iconify-icon>
          <span class="ml-2">{$t("accounts.copy")}</span>
        </button>
        <a
          href={`/qr/${encodeURIComponent(nwc)}`}
          class="btn glass hover:bg-white/10 grow"
        >
          <iconify-icon noobserver icon="ph:qr-code-bold" width="24"
          ></iconify-icon>
          <span class="ml-2">{$t("user.receive.showQR")}</span>
        </a>
      </div>
    </div>
  {/if}

  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-pink-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.1s;"
  >
    <div class="flex items-start gap-4 mb-4">
      <div
        class="p-3 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/30"
      >
        <iconify-icon icon="ph:key" class="text-white" width="32"
        ></iconify-icon>
      </div>
      <div class="flex-1">
        <h3 class="text-xl font-bold gradient-text mb-2">
          {$t("user.nostrPubkey")}
        </h3>
        <p class="text-white/60">Your public Nostr identity</p>
      </div>
    </div>
    <div class="flex gap-4">
      <textarea
        name="pubkey"
        bind:value={npub}
        rows={3}
        class="glass rounded-xl border-2 border-white/20 focus:border-pink-500/50 bg-white/5 w-full p-3 text-white placeholder-white/40 font-mono text-sm"
      ></textarea>
      <div class="flex my-auto gap-2">
        <button
          type="button"
          class="glass p-3 rounded-xl hover:bg-white/10 transition-all"
          onclick={() => copy(npub)}
          aria-label="Copy"
        >
          <iconify-icon
            noobserver
            icon="ph:copy-bold"
            width="24"
            class="text-white/80 hover:text-white"
          ></iconify-icon>
        </button>
        <a
          href={`/qr/${encodeURIComponent(npub)}`}
          class="glass p-3 rounded-xl hover:bg-white/10 transition-all"
          aria-label="QR"
        >
          <iconify-icon
            noobserver
            icon="ph:qr-code-bold"
            width="24"
            class="text-white/80 hover:text-white"
          ></iconify-icon>
        </a>
      </div>
    </div>

    {#if extensionAvailable}
      <button
        class="btn-gradient hover:shadow-lg hover:shadow-purple-500/30 mt-4 group"
        type="button"
        onclick={getPubkey}
      >
        <img
          src="/images/alby.svg"
          width="24"
          class="group-hover:scale-110 transition-transform"
        />
        <span class="ml-2 font-semibold"
          >{$t("user.settings.syncWithExtension")}</span
        >
      </button>
    {/if}
  </div>

  {#if user.nsec}
    <div
      class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-red-500/40 transition-all duration-500 animate-scaleIn"
      style="animation-delay: 0.2s;"
    >
      <div class="flex items-start gap-4 mb-4">
        <div
          class="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 shadow-lg shadow-red-500/30"
        >
          <iconify-icon icon="ph:warning-circle" class="text-white" width="32"
          ></iconify-icon>
        </div>
        <div class="flex-1">
          <h3 class="text-xl font-bold gradient-text mb-2">
            {$t("user.settings.nostrKeys")}
          </h3>
          <p class="text-white/60">
            {$t("user.settings.nostrDescription")}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap sm:flex-nowrap gap-2">
        <button
          type="button"
          class="btn glass border-2 border-red-500/30 hover:border-red-500/60 hover:bg-red-500/10 !w-auto flex-grow group"
          onclick={toggleNsec}
        >
          {#if revealNsec}
            <iconify-icon
              noobserver
              icon="ph:eye-slash-bold"
              width="24"
              class="text-red-400 group-hover:scale-110 transition-transform"
            ></iconify-icon>
            <span class="ml-2 font-semibold"
              >{$t("user.settings.hideNsec")}</span
            >
          {:else}
            <iconify-icon
              noobserver
              icon="ph:warning-bold"
              width="24"
              class="text-red-400 group-hover:scale-110 transition-transform"
            ></iconify-icon>
            <span class="ml-2 font-semibold"
              >{$t("user.settings.revealNsec")}</span
            >
          {/if}
        </button>
      </div>

      {#if revealNsec}
        <button
          type="button"
          class="glass rounded-xl p-4 break-all !h-auto font-mono text-sm leading-normal flex items-center justify-between w-full mt-4 border-2 border-red-500/30 hover:bg-red-500/10 transition-all"
          onclick={() => copy(nsec)}
        >
          <div class="text-red-400">{nsec}</div>
          <iconify-icon
            noobserver
            icon="ph:copy-bold"
            width="24"
            class="text-red-400 ml-4 flex-shrink-0"
          ></iconify-icon>
        </button>
      {/if}
    </div>
  {/if}
</div> -->

<div class="p-6 text-center text-white/60">
  <p>Nostr functionality has been disabled in this application.</p>
</div>
