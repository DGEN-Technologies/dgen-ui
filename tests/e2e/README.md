# DGEN Wallet test robot

Clicks through every DGEN Wallet feature in a real browser, on GitHub's servers.

- **When:** every pull request, every Tuesday and Friday (10:17 Perth), or by hand
  (GitHub, Actions tab, "Wallet test robot", Run workflow).
- **Dev site, full test:** registers throwaway accounts, logs in and out, creates
  invoices and addresses, reads an invoice on the send screen (stops before paying),
  checks history, settings, 2FA, PIN, recovery phrase and wallet import.
- **Live site, read-only:** home, register and sign-in pages, links and security headers.
- **Tiny real payments:** two funded test wallets pay each other $0.01 and back on
  scheduled runs. Needs the `E2E_WALLET_*` secrets; skipped if they are missing.
- **When something breaks:** a GitHub issue is opened (or updated) and assigned to
  `dgentech`, which emails the account. The issue history is the robot's memory.
- **ORBIT_SENTRY (auto-fix):** if the `ORBIT_SENTRY_KEY` secret is set, ORBIT_SENTRY
  reads the issue, fixes the code and opens a pull request into `dev`. Nothing goes
  live without a merge.

Run locally: `cd tests/e2e && npm install && npx playwright install chromium && npx playwright test`
