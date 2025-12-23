<svelte:head>
  <title>DGEN A.I. Chatbot Disclaimer</title>
</svelte:head>

<section class="disclaimer">
  <div class="container">
    <p class="eyebrow">DGEN A.I. Chatbot Disclaimer</p>
    <h1>Read Before You Use The DGEN Chatbot</h1>
    <div class="card">
      <p class="important">
        <strong>IMPORTANT DISCLAIMER:</strong> This is not financial, investment,
        or legal advice.
      </p>
      <p>
        You are interacting with an artificial intelligence (the "Chatbot"). The
        Chatbot is currently in BETA stage and may generate inaccurate,
        incomplete, outdated, or fabricated information (hallucinations). You
        must independently verify and fact-check every statement, figure, or
        claim made by the Chatbot before relying on it. DGEN cannot and does not
        take responsibility for any misinformation, errors, or omissions
        produced by the A.I.
      </p>
      <p>
        The information provided is for informational and entertainment purposes
        only. DGEN, its affiliates, officers, directors, employees, agents, and
        representatives make no representations or warranties regarding
        accuracy, completeness, or reliability.
      </p>
      <p>
        <strong>No Financial Advice:</strong> Nothing here constitutes financial,
        investment, tax, accounting, legal, or professional advice. Do not use the
        Chatbot for financial decisions.
      </p>
      <p>
        <strong>No Liability:</strong> DGEN shall not be liable for any losses or
        damages arising from your use of or reliance on the Chatbot, including misinformation.
      </p>
      <p>
        <strong>Consult Professionals:</strong> Always consult qualified, licensed
        advisors in your jurisdiction for important matters.
      </p>
      <p class="acknowledge">
        By continuing, you acknowledge and agree to this disclaimer. If you do
        not agree, stop using the Chatbot immediately.
      </p>
    </div>
  </div>
</section>

<style>
  /* Scope background to this page to avoid bleed on SPA navigation */
  .disclaimer {
    background: #0b0c11;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 64px 16px;
    color: #f9fafb;
  }

  .container {
    width: 100%;
    max-width: 900px;
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 12px;
    color: #8ca9ff;
    margin-bottom: 8px;
  }

  h1 {
    font-size: clamp(26px, 3vw, 32px);
    margin: 0 0 20px;
    color: #e5e7eb;
    line-height: 1.2;
  }

  .card {
    background: linear-gradient(
      145deg,
      rgba(32, 37, 54, 0.9),
      rgba(18, 22, 33, 0.9)
    );
    border: 1px solid rgba(140, 169, 255, 0.25);
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  }

  p {
    margin: 12px 0;
    line-height: 1.55;
    color: #d1d5db;
  }

  .important {
    color: #fef3c7;
    background: rgba(255, 255, 255, 0.04);
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .acknowledge {
    margin-top: 16px;
    font-weight: 600;
    color: #f9fafb;
  }

  strong {
    color: #fef08a;
  }

</style>
