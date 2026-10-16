<script lang="ts">
  import { onMount } from "svelte";
  import {
    listUnclaimedDeposits,
    claimDeposit,
    type UnclaimedDeposit,
  } from "$lib/rails/spark";
  import { unclaimedDepositCount } from "$lib/stores/rails";
  import { mapTxError } from "$lib/txErrors";

  let deposits = $state<UnclaimedDeposit[]>([]);
  let claiming = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function load() {
    try {
      deposits = await listUnclaimedDeposits();
    } catch (e) {
      error = mapTxError(
        e instanceof Error ? e.message : undefined,
        "Could not load deposits",
      );
    }
  }

  async function claim(deposit: UnclaimedDeposit) {
    const key = `${deposit.txid}:${deposit.vout}`;
    claiming = key;
    error = null;
    try {
      // Exactly the fee the SDK asked for. Never the deposit amount.
      await claimDeposit(
        deposit.txid,
        deposit.vout,
        deposit.requiredFeeSats ?? 0,
      );
      await load();
    } catch (e) {
      // Routed through mapTxError so a fee-too-high failure reads as plain
      // language instead of raw SDK text — this is the component that
      // actually produces those errors.
      error = mapTxError(
        e instanceof Error ? e.message : undefined,
        "Claim failed",
      );
    } finally {
      claiming = null;
    }
  }

  onMount(load);
  $effect(() => {
    if ($unclaimedDepositCount > 0) void load();
  });
</script>

{#if deposits.length > 0}
  <div class="rounded-2xl border border-warning/40 bg-warning/10 p-4">
    <h3 class="font-bold mb-2">Bitcoin waiting to be added</h3>
    <p class="text-sm opacity-70 mb-3">
      Network fees are higher than the automatic limit, so these need your
      approval before the money lands in your balance.
    </p>

    {#if error}
      <p class="text-sm text-error mb-2">{error}</p>
    {/if}

    <ul class="flex flex-col gap-2">
      {#each deposits as deposit (deposit.txid + deposit.vout)}
        {@const feeKnown = typeof deposit.requiredFeeSats === "number"}
        {@const fee = deposit.requiredFeeSats ?? 0}
        {@const net = deposit.amountSats - fee}
        {@const uneconomic = feeKnown && net <= 0}
        {@const costly =
          feeKnown && !uneconomic && fee > deposit.amountSats / 2}
        <li class="flex items-center justify-between gap-3">
          <span class="flex flex-col">
            <span class="font-mono text-sm">{deposit.amountSats} sats</span>
            {#if feeKnown}
              <!-- The net is the number that matters. Showing amount and fee
                   as two separate figures lets someone approve a fee that
                   swallows most of the deposit without ever comparing them. -->
              <span class="text-xs opacity-60">
                Fee {fee} sats &rarr; you receive {net > 0 ? net : 0} sats
              </span>
              {#if uneconomic}
                <span class="text-xs text-error"
                  >Costs more than it is worth right now. Waiting for lower fees
                  keeps it claimable.</span
                >
              {:else if costly}
                <span class="text-xs text-warning"
                  >The fee takes more than half of this deposit.</span
                >
              {/if}
            {/if}
          </span>
          <button
            class="btn btn-sm {costly ? 'btn-warning' : 'btn-primary'}"
            disabled={claiming === `${deposit.txid}:${deposit.vout}` ||
              !deposit.isMature ||
              !feeKnown ||
              uneconomic}
            onclick={() => claim(deposit)}
          >
            {#if claiming === `${deposit.txid}:${deposit.vout}`}
              Adding&hellip;
            {:else if !deposit.isMature}
              Confirming
            {:else if !feeKnown}
              Waiting
            {:else if uneconomic}
              Fee too high
            {:else}
              Add {net} sats
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}
