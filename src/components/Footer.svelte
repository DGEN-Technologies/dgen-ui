<script>
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
  <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
    <div class="space-y-4">
      <a href="/" aria-label="Home" class="block">
        <div class="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          DGEN Technologies
        </div>
      </a>
      <p class="text-sm text-gray-400 max-w-xs">
        Lightning-fast Bitcoin payments for everyone
      </p>
      <div class="pt-2">
        <LocaleSelector />
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

    <!-- Placeholder columns to push network section to the right -->
    <div></div>
    <div></div>

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
  
  <div class="mt-12 pt-8 border-t border-white/5 text-center">
    <p class="text-xs text-gray-500">
      © 2025 DGEN Technologies. All rights reserved.
    </p>
  </div>
</footer>
