<script>
  import { goto } from "$app/navigation";
  import LocaleSelector from "$comp/LocaleSelector.svelte";
  import { t } from "$lib/translations";

  const followLinks = [
    // {
    //   url: "nostr:nprofile1qy28wue69uhnzv3h9cczuvpwxyargwpk8yhszxrhwvaz7tmhda6zucnjd9nksarzdak8gtnwv46z7qpqw27mc4aa6m0ufe3xs5z3m6qyr52gc0rglept7vqlwx4xeaf72tasv5xyqv",
    //   titleID: "nostr",
    // },
    // { url: "https://linktr.ee/dgentech.io", titleID: "linkhub" },
  ];

  const companyLinks = [
    // { url: "/support", titleID: "support" },
  ];
</script>

<footer
  id="about"
  class="border-t border-white/10 mt-20 pt-12 pb-8 px-6 bg-black/20 backdrop-blur-sm"
>
  <div
    class="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between gap-8"
  >
    <div class="gap-x-48 flex flex-col sm:flex-row">
      <div class="pt-2">
        <LocaleSelector />
      </div>
      <div class="pt-2">
        <button
          class="w-full border border-white/20 py-5 px-7 rounded-2xl"
          onclick={() => goto("/faq")}>FAQ</button
        >
      </div>
    </div>

    <!-- Follow Us section commented out
    <div>
      <h3 class="font-semibold text-white mb-4">{$t("footer.followUs")}</h3>
      <ul class="space-y-2">
        {#each followLinks as link}
          <li>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              class="text-gray-400 hover:text-purple-400 transition-colors text-sm"
            >
              {$t("footer." + link.titleID)}
            </a>
          </li>
        {/each}
      </ul>
    </div>
    -->

    <!-- Company section commented out
    <div>
      <h3 class="font-semibold text-white mb-4">{$t("footer.company")}</h3>
      <ul class="space-y-2">
        {#each companyLinks as link}
          <li>
            <a
              href={link.url}
              class="text-gray-400 hover:text-purple-400 transition-colors text-sm"
            >
              {$t("footer." + link.titleID)}
            </a>
          </li>
        {/each}
      </ul>
    </div>
    -->

    <div class="flex items-start justify-center md:justify-end">
      <div class="text-center space-y-2">
        <div>
          <div class="text-5xl mb-1">⚡</div>
          <p class="text-xs text-gray-400">Lightning Network</p>
        </div>
        <div>
          <div class="text-4xl mb-1">💧</div>
          <p class="text-xs text-gray-400">Liquid Network</p>
        </div>
        <div>
          <div class="text-4xl mb-1">₿</div>
          <p class="text-xs text-gray-400">Bitcoin Onchain</p>
        </div>
      </div>
    </div>
  </div>

  <div class="mt-12 pt-8 border-t border-white/5 text-center space-y-3">
    <button
      class="text-xs md:text-sm text-white/70 hover:text-white underline underline-offset-4 decoration-white/30 hover:decoration-white transition-colors"
      onclick={() => goto("/terms")}
    >
      Terms & Conditions
    </button>
    <p class="text-xs text-gray-500">
      © 2026 DGEN Technologies. All rights reserved.
    </p>
  </div>
</footer>
