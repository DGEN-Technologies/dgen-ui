<script>
  import { goto } from "$app/navigation";
  import Avatar from "$comp/Avatar.svelte";
  import { get, f, s, si, sat, loc, sats, types } from "$lib/utils";
  import { format } from "date-fns";
  import { t } from "$lib/translations";
  import locales from "$lib/locales";
  const { fund, locale, user, payments } = $props();
  const language = $derived(user?.language || "en");
</script>

<div class="text-base">
  {#each payments as p, i}
    {@const amount = fund ? -p.amount : p.amount}
    {@const dest = p.details?.destination || ''}
    {@const desc = p.details?.description?.toLowerCase() || ''}
    <div
      class="grid grid-cols-12 border-b border-base-200 hover:bg-base-200 px-1 py-2 lg:p-4 cursor-pointer gap-2 sm:gap-1"
      class:border-b-0={i === payments.length - 1}
      class:text-error={amount < 0}
      onclick={() => goto(`/payment/${p.txId || p.id || p.paymentHash}`)}
      onkeydown={(e) => e.key === "Enter" && goto(`/payment/${p.txId || p.id || p.paymentHash}`)}
      role="button"
      tabindex="0"
      aria-label={`Payment ${Math.abs(amount)} sats`}
    >
      <div class="whitespace-nowrap my-auto col-span-3">
        <div class="font-bold flex items-center text-sm sm:text-base">
          <div class="flex items-center">
            <!-- 
              Since Breez Liquid SDK routes all payments through Liquid,
              we use a simple heuristic based on amount:
              - Over 25,000 sats: Bitcoin on-chain icon
              - Under 25,000 sats: Lightning icon
              This matches typical usage patterns.
            -->
            {#if Math.abs(amount) > 25000}
              <!-- Bitcoin on-chain (large amount) -->
              <img src="/images/bitcoin.svg" class="w-5 h-5 sm:w-6 sm:h-6 mr-1 sm:mr-2" alt="Bitcoin" />
            {:else}
              <!-- Lightning payment (smaller amount) -->
              <iconify-icon
                noobserver
                icon="ph:lightning-fill"
                width="20"
                class="text-yellow-300 mr-1 sm:mr-2"
              ></iconify-icon>
            {/if}
            <div>{s(Math.abs(amount), locale)}</div>
          </div>
        </div>

        <div class="text-secondary flex items-center text-xs sm:text-base">
          {f(Math.abs(amount) * (p.rate / sats), p.currency, locale)}

          {#if p.tip}
            <span class="text-sm text-secondary">
              &nbsp;+{Math.round((p.tip / Math.abs(amount)) * 100)}%
            </span>
          {/if}
        </div>
      </div>

      <div
        class="flex my-auto col-span-5 sm:col-span-6 pl-4 sm:pl-0 sm:justify-start"
      >
        {#if p.type === types.fund}
          {#if fund}
            <div class="flex">
              <div class="my-auto">
                <Avatar user={p.user} size={12} disabled={true} />
              </div>
              <div class="my-auto ml-1 text-secondary text-xs sm:text-base">
                {p.user.username}
              </div>
            </div>
          {:else}
            <a href={`/fund/${p.memo}`}>
              <div class="text-secondary flex">
                <iconify-icon
                  noobserver
                  icon="ph:lightning-fill"
                  class="text-yellow-300 text-3xl"
                ></iconify-icon>

                <div class="my-auto">{$t("payments.fund")}</div>
              </div>
            </a>
          {/if}
        {:else if p.with}
          <div class="flex">
            <div class="my-auto">
              <Avatar user={p.with} size={12} disabled={true} />
            </div>
            <div class="my-auto ml-1 text-secondary text-xs sm:text-base">
              {p.with.username}
            </div>
          </div>
        {:else}
          <div class="text-secondary flex items-center gap-0.5 text-xs sm:text-base">
            <!-- Direction icon based on amount -->
            {#if amount > 0}
              <iconify-icon
                noobserver
                icon="ph:arrow-down-bold"
                class="text-green-500 text-xl sm:text-2xl flex-shrink-0"
              ></iconify-icon>
            {:else}
              <iconify-icon
                noobserver
                icon="ph:arrow-up-bold"
                class="text-red-500 text-xl sm:text-2xl flex-shrink-0"
              ></iconify-icon>
            {/if}

            <div class="my-auto">
              {#if p.type === types.ecash}
                {amount > 0 ? $t("payments.redeemed") : $t("payments.minted")}
              {:else if p.status === "failed" || p.status === "timedOut"}
                {$t("payments.failed") || "Failed"}
              {:else if p.status === "pending" || p.status === "created"}
                {$t("payments.pending") || "Pending"}
              {:else if p.status === "complete" || p.status === "success"}
                {amount > 0 ? $t("payments.received") : $t("payments.sent")}
              {:else}
                <!-- Default based on amount direction -->
                {amount > 0 ? $t("payments.received") : $t("payments.sent")}
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <div class="text-secondary text-right text-xs sm:text-sm my-auto col-span-4 sm:col-span-3 min-w-0 pl-1">
        {#if p.timestamp && p.timestamp > 0}
          {@const date = new Date(p.timestamp * 1000)}
          <div class="whitespace-nowrap overflow-hidden text-ellipsis">
            {format(date, "h:mm a", {
              locale: locales[language],
            })}
          </div>
          <div class="whitespace-nowrap overflow-hidden text-ellipsis">
            {format(date, "MMM d", {
              locale: locales[language],
            })}
            <span class="hidden sm:inline">, {format(date, "yy")}</span>
          </div>
        {:else if p.paymentTime && p.paymentTime > 0}
          {@const date = new Date(p.paymentTime * 1000)}
          <div class="whitespace-nowrap overflow-hidden text-ellipsis">
            {format(date, "h:mm a", {
              locale: locales[language],
            })}
          </div>
          <div class="whitespace-nowrap overflow-hidden text-ellipsis">
            {format(date, "MMM d", {
              locale: locales[language],
            })}
            <span class="hidden sm:inline">, {format(date, "yy")}</span>
          </div>
        {:else}
          <div class="text-white/40">--</div>
        {/if}
      </div>
    </div>
  {:else}
    <p class="text-secondary text-lg text-center">{$t("payments.empty")}</p>
  {/each}
</div>
