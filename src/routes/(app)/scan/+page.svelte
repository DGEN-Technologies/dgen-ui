<script>
  import { tick } from "svelte";
  import Icon from "$comp/Icon.svelte";
  import QrScanner from "qr-scanner";
  import { onMount, onDestroy } from "svelte";
  import { back } from "$lib/utils";
  import { goto } from "$app/navigation";
  import { BarcodeDetector } from "barcode-detector/ponyfill";

  let scanner,
    vid = $state(),
    resizing,
    loading = $state(true),
    error = $state("");

  let resize = () => {
    if (resizing) clearTimeout(resizing);
    resizing = setTimeout(initialize, 1000);
  };

  let initialize = async () => {
    if (scanner) {
      scanner.stop();
      await new Promise((r) => setTimeout(r, 1000));
    }

    loading = true;
    error = "";

    try {
      // Request camera permission explicitly for mobile
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
        },
      });

      // Stop the test stream
      stream.getTracks().forEach((track) => track.stop());

      let options = {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        qrEngine: BarcodeDetector,
        preferredCamera: "environment", // Back camera for mobile
      };
      let cb = ({ data }) =>
        scanner.stop() || goto(`/send/${encodeURIComponent(data)}`);
      scanner = new QrScanner(vid, cb, options);
      await tick();
      await scanner.start();
      loading = false;
    } catch (err) {
      console.error("Camera permission error:", err);
      loading = false;
      error =
        err.message ||
        "Camera permission denied. Please enable camera access in your browser settings.";
    }
  };

  onMount(initialize);
  onDestroy(() => scanner?.stop());
</script>

<svelte:window onresize={resize} />

<div class="flex w-full mb-4 p-4">
  <div class="mx-auto rounded-3xl relative">
    {#if loading}
      <div
        class="absolute inset-0 flex items-center justify-center bg-black/80 rounded-3xl z-10"
      >
        <div class="text-center text-white">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"
          ></div>
          <p>Requesting camera access...</p>
        </div>
      </div>
    {/if}
    {#if error}
      <div
        class="absolute inset-0 flex items-center justify-center bg-red-500/80 rounded-3xl z-10"
      >
        <div class="text-center text-white p-4">
          <p class="text-xl mb-2">Camera Error</p>
          <p class="text-sm">{error}</p>
          <button class="btn btn-sm mt-4" onclick={initialize}>Try Again</button
          >
        </div>
      </div>
    {/if}
    <video
      bind:this={vid}
      class="border-4 rounded-3xl border-black max-h-[calc(100vh*0.7)]"
      style="min-width: 300px; min-height: 300px;"
      muted
      playsinline
    ></video>
  </div>
</div>

<div class="flex justify-center">
  <button class="btn !w-auto" onclick={back}>Cancel</button>
</div>

<style>
  video {
    transition: transform 0.3s ease-out;
    transform: scale(1);
  }
</style>
