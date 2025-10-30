<!-- SUPPORT PAGE DISABLED -->
<!-- <script>
  import { browser } from "$app/environment";
  import { onDestroy } from "svelte";
  import { fail, success, post } from "$lib/utils";
  import { scale } from "svelte/transition";
  import Icon from "$comp/Icon.svelte";
  import { t } from "$lib/translations";
  import { PUBLIC_RECAPTCHA_SITE_KEY } from "$env/static/public";

  let { data } = $props();
  let { user } = data;

  let username = $state(user?.username);
  let email = $state();
  let message = $state();
  let sent = $state();
  let recaptchaSiteKey = PUBLIC_RECAPTCHA_SITE_KEY || "";

  let submit = async (e) => {
    e.preventDefault();

    // Skip reCAPTCHA in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        await post("/email", {
          username: user?.username || `${username} (unverified)`,
          email,
          message,
          token: 'dev-token', // Dummy token for dev
        });
        sent = true;
      } catch {
        fail("Problem submitting");
      }
    } else {
      // Production with reCAPTCHA
      grecaptcha.ready(() => {
        grecaptcha.execute(recaptchaSiteKey, { action: "submit" }).then((token) =>
          post("/email", {
            username: user?.username || `${username} (unverified)`,
            email,
            message,
            token,
          })
            .then(() => (sent = true))
            .catch(() => fail("problem submitting")),
        );
      });
    }
  };

  onDestroy(() => {
    if (!browser) return;
    const nodeBadge = document.querySelector(".grecaptcha-badge");
    if (nodeBadge) {
      document.body.removeChild(nodeBadge.parentNode);
    }

    const scriptSelector =
      "script[src='https://www.google.com/recaptcha/api.js?render=" +
      recaptchaSiteKey +
      "']";
    const script = document.querySelector(scriptSelector);
    if (script) {
      script.remove();
    }
  });
</script>

<svelte:head>
  {#if browser && recaptchaSiteKey && !window.location.hostname.includes('localhost')}
    <script
      src="https://www.google.com/recaptcha/api.js?render=6LfCd8YkAAAAANmVJgzN3SQY3n3fv1RhiS5PgMYM"
    ></script>
  {/if}
</svelte:head> -->

<!-- SUPPORT PAGE DISABLED - Page content commented out -->

<!--
<div class="min-h-screen relative overflow-hidden bg-gradient-dark">
  Animated background and content removed...
</div>
-->
