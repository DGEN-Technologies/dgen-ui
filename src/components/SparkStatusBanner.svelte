<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getSparkNetworkStatus } from "$lib/rails";

  // null means "not checked yet", which is distinct from a check that came
  // back "unknown". Both are states we cannot vouch for, but only the second
  // is worth warning about: the first check has to await the wasm module, so
  // treating null as unknown put a scary banner on screen during every page
  // load and then removed it a moment later.
  let status = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let unknownStreak = 0;

  // An "unknown" is usually transient — wasm still loading, or a slow status
  // fetch — so retry soon rather than leaving the warning up for a full slow
  // interval. Give up on the fast cadence after a minute so a genuinely
  // unreachable service is not polled every 15s forever.
  const SLOW_MS = 5 * 60 * 1000;
  const FAST_MS = 15 * 1000;
  const FAST_ATTEMPTS = 4;

  // "unknown" is deliberately excluded from the loud banner but tracked
  // separately — it is a "we cannot tell" state, not a healthy one.
  const degraded = $derived(
    status === "degraded" || status === "partial" || status === "major",
  );
  const unknown = $derived(status === "unknown");

  const message = $derived(
    status === "major"
      ? "Bitcoin and Lightning payments are currently unavailable. Your money is safe."
      : "Bitcoin and Lightning payments may be slower than usual right now.",
  );

  // Self-scheduling rather than setInterval: the check awaits wasm init on
  // the first call, and overlapping runs would stack up behind it.
  async function check() {
    const next = await getSparkNetworkStatus();
    if (stopped) return;
    status = next;

    unknownStreak = next === "unknown" ? unknownStreak + 1 : 0;
    const delay =
      unknownStreak > 0 && unknownStreak <= FAST_ATTEMPTS ? FAST_MS : SLOW_MS;
    timer = setTimeout(check, delay);
  }

  onMount(() => {
    void check();
  });

  onDestroy(() => {
    stopped = true;
    if (timer) clearTimeout(timer);
  });
</script>

{#if degraded || unknown}
  <div
    class="bg-warning/20 border-b border-warning/40 px-4 py-2 text-sm text-center"
    role="status"
  >
    {unknown
      ? "Cannot reach the Bitcoin and Lightning network status service. Payments may or may not work right now."
      : message}
  </div>
{/if}
