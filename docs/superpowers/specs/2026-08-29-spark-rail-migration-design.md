# Spark Rail Migration — Design

**Date:** 2026-08-29
**Status:** Approved for planning
**Repo:** dgen-ui

## 1. Problem

Lightning and on-chain Bitcoin payments are down.

The wallet runs on Breez SDK — Nodeless (Liquid), which implements both by swapping
against Boltz under the hood. Boltz suspended its swap service indefinitely on
3 August 2026 after automated attacks outpaced its team's ability to patch. Several
other wallets (ZEUS, Aqua, Bull Bitcoin) went down the same day for the same reason.

What still works is everything that never touched Boltz: Liquid-native holding and
transfer of L-BTC and L-USDT. Only the swap layer broke.

### Alternatives rejected

| Option                                        | Why not                                                                                                                                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wait for Boltz                                | No ETA; suspension described as indefinite.                                                                                                                                                                                               |
| Point the Liquid SDK at another swap provider | The swapper is compiled into the Rust SDK, not configurable.                                                                                                                                                                              |
| Self-host Boltz                               | Breez opened a PR to route mainnet swaps to a self-hosted instance (breez-sdk-liquid#1105, 12 Aug 2026) and closed it without merging. Would also mean operating financial infrastructure and inheriting the exposure that stopped Boltz. |
| Cashu (`ecash.disabled/` in-tree)             | Mints are custodial. Fails the non-custodial requirement.                                                                                                                                                                                 |
| Migrate fully to Spark, drop Liquid           | Rejected by the client: L-BTC and L-USDT send/receive must be retained. Spark has no Liquid support.                                                                                                                                      |

### Decision

Add Breez SDK — Spark alongside the existing Liquid SDK.

- **Spark** handles Lightning and on-chain Bitcoin.
- **Liquid** handles L-BTC and L-USDT, unchanged.
- No bridge between them. Users do not move funds between rails.

## 2. Constraints

1. **Non-custodial.** Keys stay in the browser. The server never holds or moves user
   funds. This is enforced in code on the server side and must not regress.
2. **One seed.** Both SDKs derive from the same 12-word mnemonic. Spark accepts
   `Seed = { type: "mnemonic" }`; Liquid takes the mnemonic directly. Key custody,
   the encryption chain, and recovery are unchanged.
3. **Liquid is retained.** Client requirement, confirmed 2026-08-29.
4. **Lightning must interoperate** with Wallet of Satoshi, Breez, Muun, Bull Bitcoin,
   and Phoenix — send and receive, both directions.

### Confirmed with Breez

- Existing API key works for Spark; no new credential needed.
- A custom LNURL domain is required (`breez.fun` is not available on Spark). Breez
  will allowlist a domain on request; CNAME target is `breez.tips`. Subdomain is fine.
- A custom Bitcoin chain service may be supplied.
- 0-conf deposit crediting is not yet available.
- `glow-web` is the intended browser reference implementation.

## 3. Architecture

### 3.1 Boundary

`walletService.ts` currently mixes two unrelated concerns: seed/identity management
and payments. Only the second is rail-specific. The split follows that line.

```
src/lib/rails/
  types.ts     normalized Payment, Balance, RailEvent, Rail
  router.ts    parse -> rail decision; send/receive dispatch
  spark.ts     Spark adapter
  liquid.ts    Liquid adapter (wraps existing walletService internals)
  index.ts     the only payment API the UI imports
```

`walletService.ts` is retained and keeps: mnemonic generation and validation,
password derivation, encrypted storage, lock state, and session timers. Roughly half
of its ~30 importers use it only for these and require no change.

The Lightning address moves to the Spark rail, because Lightning is Spark. This
replaces ~400 lines of hand-rolled `breez.fun` HTTP — message signing, the 20-attempt
collision loop, the random-suffix fallback — with Spark's native
`registerLightningAddress` / `checkLightningAddressAvailable` / `getLightningAddress`.
Net reduction in code.

### 3.2 Normalized model

Only what the UI consumes is normalized. The SDK surface is not abstracted.

```ts
type Rail = "spark" | "liquid";

interface RailPayment {
  id: string;
  rail: Rail;
  direction: "send" | "receive";
  status: "pending" | "complete" | "failed";
  amountSat: number;
  feeSat: number;
  timestamp: number; // unix seconds
  method: "lightning" | "onchain" | "spark" | "liquid" | "usdt";
  assetId?: string; // Liquid only
  raw: unknown; // escape hatch to the source payment
}
```

**`bigint` converts to `number` at the adapter boundary.** Spark returns `bigint`;
Liquid returns `number`. The maximum possible sat value (~2.1e15) is below
`Number.MAX_SAFE_INTEGER` (~9.0e15), so the conversion is lossless for any real
balance. Converting once in the adapter prevents `bigint` leaking into every
component and template.

**`raw` is deliberate.** Payment detail screens need rail-specific fields. The shared
list uses the common shape; detail screens narrow on `rail` and read `raw`.

**Three statuses, not six.** The current `paymentEvents.ts` includes `fee_acceptance`,
which has no Spark equivalent. It remains a Liquid-only concern handled inside the
Liquid adapter and does not enter the shared vocabulary.

### 3.3 Routing

`router.ts` owns every rail decision. Two entry points.

**Send** — the destination is parsed and routed:

| Input                                                                 | Rail                    |
| --------------------------------------------------------------------- | ----------------------- |
| `bolt11Invoice`, `lightningAddress`, `lnurlPay`, `bip21` w/ lightning | Spark                   |
| `bitcoinAddress`, `bitcoin:` URI                                      | Spark                   |
| Liquid address, `liquidnetwork:` URI                                  | Liquid                  |
| Asset send (L-USDT)                                                   | Liquid                  |
| Ambiguous                                                             | Spark (the common path) |

**Receive** — the selected method determines the rail, mapping onto the existing
`types` in `utils.ts`:

| Method      | Rail              |
| ----------- | ----------------- |
| `lightning` | Spark             |
| `bitcoin`   | Spark             |
| `liquid`    | Liquid            |
| `usdt`      | Liquid            |
| `bolt12`    | Removed (see 6.2) |

Every rail selection is logged with its reason. When a payment goes somewhere
unexpected, that must be diagnosable without reproducing it.

## 4. Lifecycle

**Both SDKs connect in parallel and degrade independently.** The current layout
blocks on a single SDK connecting; blocking on two would roughly double the startup
failure rate. Each rail connects on its own and the wallet operates with whatever is
available. Spark up with Liquid down means Lightning and Bitcoin work while the
Liquid section reports unavailable, and the reverse. The wallet is never dead because
the less-used rail failed.

**One tab lock, unchanged.** The lock protects the seed and the session, not a
particular SDK. Both rails run under the existing lock and suspend/resume together on
the current policy (suspend 30s after the tab hides, 30s resume cooldown).

**Bitcoin watching moves into Spark.** `PollManager` currently polls Esplora for
Bitcoin confirmations. Spark performs its own deposit detection and emits
`newDeposits` / `claimedDeposits` / `unclaimedDeposits`. Since a custom chain service
may be supplied, Spark is given the existing Esplora proxy — preserving server-side
enterprise tokens and the CSP posture — and the parallel Bitcoin polling is removed.
Liquid polling is unchanged.

**The send gate becomes per-rail.** The existing 15-minute gate prevents Liquid UTXO
conflicts. Spark is not UTXO-based, so applying that gate would make Lightning
payments needlessly slow. Liquid retains the existing gate. Spark receives a lighter
guard that prevents double-submission of the same payment only.

## 5. Balances and history

**Bitcoin (Spark) is the headline balance. Liquid is a labelled section beneath it.**

Lightning and on-chain Bitcoin both spend from the Spark balance, and that is the
common path. A single blended figure would let a user see a total and then be refused
for insufficient funds on a Lightning payment — the app showing money that cannot be
spent on the rail being used. Separating the balances makes the constraint visible
before it is hit. The Liquid section displays L-BTC and L-USDT as it does today.

**History is one merged list**, sorted by timestamp, each row tagged with its rail.

The IndexedDB transaction cache (`dgen_transactions` / `payments`) is keyed on Liquid
field names and receives a schema version bump. Because it caches derived data, the
upgrade drops and rebuilds from both SDKs. No migration logic.

## 6. Feature changes

### 6.1 Removed: swap-based refunds

`listRefundables`, `prepareRefund`, `refundSwap`, and `rescanOnchainSwaps` are
Boltz-swap recovery and have no Spark equivalent. Spark provides `refundDeposit` and
`refundPendingConversions` for a different failure mode. `RefundForm.svelte`,
`stores/refundables.ts`, and `/refunds/[swapAddress]` are rewritten against the Spark
deposit model.

Accepted by the client: existing balances were withdrawn ahead of this work and no
in-flight swaps remain, so there is nothing to recover.

### 6.2 Removed: BOLT12 receive

Spark's receive methods are `sparkAddress`, `sparkInvoice`, `bitcoinAddress`, and
`bolt11Invoice`. It can parse and pay BOLT12 but cannot generate an offer. The BOLT12
receive option is removed. Accepted by the client.

### 6.3 Removed: fee-acceptance screen

Spark claims deposits automatically within a configured ceiling rather than prompting
for approval. The prompt is replaced by the manual-claim screen (7.3).

### 6.4 Changed: Lightning address domain

Addresses move from `username@breez.fun` to `username@<dgen-domain>`. Every user's
address changes; this is unavoidable and was accepted by the client on the basis of
the current user base size.

This also resolves an existing defect. On the shared `breez.fun` domain, usernames
collide with other Breez applications, and the current code silently appends a random
number (10–1000) on conflict — a user requesting `alice` can become `alice473` without
being told. On a DGEN-owned domain the namespace is exclusive and the collision
handling becomes unnecessary.

Outstanding: the client selects the subdomain, and Breez adds it to the allowlist on
request.

### 6.5 Dead code: in-wallet asset exchange

`assetService.exchangeAssets` (L-USDT <-> L-BTC via SideSwap) exists but is called by
no component. It is unreachable and is removed. Confirm with the client that this was
never a shipped feature.

## 7. Error handling

**Rail degradation is a state, not an error.** Each rail reports
`connected | connecting | unavailable`. The UI reflects this per section rather than
raising a global error.

**Spark network status is surfaced.** `getSparkStatus()` requires no SDK instance and
returns `operational | degraded | partial | major | unknown`. Degraded or worse shows
a user-visible banner. Required by Breez's production checklist, and directly
addresses the lack of visibility during the Boltz outage.

**Deposit claiming.** The default `maxDepositClaimFee` of 1 sat/vbyte (~99 sats) is
below the provider's spread and would leave deposits unclaimed whenever fees rise.
The ceiling is set to the recommended fee rate at claim time, and a manual-claim
screen is built for cases that still exceed it — the pattern Breez uses in Glow.

**Send errors** route through the existing `txErrors.ts` mapper, extended with Spark
error strings so users see plain language rather than SDK text.

## 8. Testing

**Router tests carry the most weight.** Rail selection is a pure function —
destination in, rail out — testable without SDKs, network, or funds. Every routing
decision gets a test, including the ambiguous cases in 3.3.

**Adapter mapping tests.** A captured SDK payment fixture in, a `RailPayment` out.
Covers the `bigint` conversion, timestamp units, and status mapping.

**Lightning interoperability matrix.** Send and receive, both directions, against:

| Wallet            | Send to | Receive from |
| ----------------- | ------- | ------------ |
| Wallet of Satoshi |         |              |
| Breez             |         |              |
| Muun              |         |              |
| Bull Bitcoin      |         |              |
| Phoenix           |         |              |

Receiving is the half that matters most. Spark collects the sender's fee (~0.15%)
through route hints on the invoice. Sending wallets enforce their own maximum-fee
ceilings, so a wallet with a tight ceiling could reject an otherwise valid invoice.
Only paying _into_ DGEN from each wallet exposes this.

**`tests/browser/wallet.spec.ts` is deleted.** It has drifted out of sync with the
current `walletService` signatures, would fail today, and targets an architecture
being replaced. Repairing it would be wasted work, and leaving it prevents the suite
from ever passing in CI.

## 9. Out of scope

- **Passkey login.** Six documented Spark pages, and Glow is built around it. It is a
  complete rework of key custody, the vault, and recovery — a separate project with
  its own custody sign-off, not a rider on this one.
- **Spark tokens / Stable Balance.** USDB is a Spark-native token and Stable Balance
  is a whole-balance mode, not a second asset. Neither is a replacement for L-USDT,
  which is why Liquid is retained.
- **SwapSpace API integration.** The existing widget at `/swap` is unchanged.
  Orthogonal to this work and expands compliance surface.
- **Cross-chain USDC/USDT send.**
- **Android keystore credential rotation.** Tracked separately; unrelated to payments.

## 10. Open items

| Item                                       | Owner  | Blocks                          |
| ------------------------------------------ | ------ | ------------------------------- |
| Choose LNURL subdomain                     | Client | End-to-end address testing only |
| Submit domain to Breez for allowlisting    | Client | End-to-end address testing only |
| Confirm `exchangeAssets` was never shipped | Client | 6.5                             |
| Custody wording sign-off                   | Client | Launch                          |

None block design or the majority of implementation.
