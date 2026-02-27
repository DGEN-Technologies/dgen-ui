<script>
  import { page } from "$app/stores";
  import TermsContent from "$comp/TermsContent.svelte";

  const rawReturnTarget = $derived($page.url.searchParams.get("return") || "/");
  const returnTarget = $derived(
    rawReturnTarget &&
      rawReturnTarget.startsWith("/") &&
      !rawReturnTarget.startsWith("//")
      ? rawReturnTarget
      : "/",
  );
  const backLabel = $derived(
    returnTarget.startsWith("/settings") ? "Back to Settings" : "Back to Home",
  );
</script>

<svelte:head>
  <title>DGEN Wallet - Terms & Conditions</title>
  <meta
    name="description"
    content="Terms and Conditions for the DGEN web application."
  />
  <meta property="og:title" content="DGEN Wallet - Terms & Conditions" />
  <meta
    property="og:description"
    content="Terms and Conditions for the DGEN web application."
  />
  <meta property="og:type" content="website" />
</svelte:head>

<div class="min-h-screen bg-black/20">
  <div class="container mx-auto max-w-4xl px-4 py-12 md:py-20">
    <div
      class="premium-card backdrop-blur-xl bg-white/5 border border-white/10 md:border-2 p-6 md:p-10"
    >
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 text-center sm:text-left"
      >
        <div>
          <h1 class="text-3xl md:text-4xl font-bold text-white">
            Terms & Conditions
          </h1>
          <p class="text-white/60 text-sm md:text-base mt-2">
            Please review the terms governing access to the DGEN web
            application.
          </p>
        </div>
        <a
          href={returnTarget}
          data-sveltekit-reload
          class="px-4 py-2 rounded-xl border border-white/20 text-white/80 hover:text-white hover:border-white/50 transition-all text-center self-center sm:self-auto"
          role="button"
        >
          {backLabel}
        </a>
      </div>

      <div
        class="glass border border-white/10 rounded-2xl p-4 md:p-6 max-h-[70vh] overflow-y-auto"
      >
        <TermsContent />
      </div>
    </div>
  </div>
</div>
