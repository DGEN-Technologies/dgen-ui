import type { Rail } from "./types";
import { sdkLogger } from "$lib/logger";

export interface RailDecision {
  rail: Rail;
  reason: string;
}

/**
 * Liquid address prefixes. Confidential addresses start `lq1` (mainnet
 * bech32) or `VJL`/`VT` (base58 confidential). Unconfidential mainnet
 * addresses start `ex1` or `H`/`G`.
 */
const LIQUID_PREFIXES = ["lq1", "ex1", "vjl", "vt"];

/**
 * Unconfidential base58 Liquid addresses: P2PKH starts Q, P2SH starts G or H.
 *
 * The prefix list above is matched lowercased, which cannot express these —
 * a bare "g"/"h"/"q" prefix would swallow any unrecognised input beginning
 * with those letters. Matched case-sensitively against the full base58 shape
 * instead, which is what the Bitcoin branch below already does.
 *
 * Their absence sent these addresses to Spark via the "unrecognised, default
 * rail" branch, so /send/liquid handed a Liquid address the app had just
 * validated to an SDK that cannot parse one.
 */
const LIQUID_BASE58 = /^[GHQ][1-9A-HJ-NP-Za-km-z]{25,34}$/;

function decideDestination(input: string): RailDecision {
  const trimmed = (input ?? "").trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return { rail: "spark", reason: "empty input, default rail" };
  }

  if (lower.startsWith("liquidnetwork:")) {
    return { rail: "liquid", reason: "liquidnetwork URI" };
  }

  // A Liquid address never contains "@". Without this guard, a Lightning
  // address whose username begins with a Liquid prefix — vtuber@..., or any
  // name starting lq1/ex1/vjl/vt — is sent to the Liquid rail, which cannot
  // pay it. "vt" is only two characters, so this is not a remote edge case.
  if (
    !trimmed.includes("@") &&
    LIQUID_PREFIXES.some((p) => lower.startsWith(p))
  ) {
    return { rail: "liquid", reason: "liquid address prefix" };
  }

  if (LIQUID_BASE58.test(trimmed)) {
    return { rail: "liquid", reason: "liquid base58 address" };
  }

  if (lower.startsWith("lightning:") || lower.startsWith("lnbc")) {
    return { rail: "spark", reason: "bolt11 invoice" };
  }

  if (lower.startsWith("lnurl")) {
    return { rail: "spark", reason: "lnurl" };
  }

  if (lower.startsWith("bitcoin:")) {
    return { rail: "spark", reason: "bitcoin URI" };
  }

  if (trimmed.includes("@")) {
    return { rail: "spark", reason: "lightning address" };
  }

  if (
    lower.startsWith("bc1") ||
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,39}$/.test(trimmed)
  ) {
    return { rail: "spark", reason: "bitcoin address" };
  }

  return { rail: "spark", reason: "unrecognised, default rail" };
}

/**
 * Which rail should handle sending to this destination.
 *
 * Every decision is logged with its reason. When a payment goes somewhere
 * unexpected, that must be diagnosable without reproducing it.
 */
export function railForDestination(input: string): Rail {
  const decision = decideDestination(input);
  sdkLogger.info(
    `[rails] send -> ${decision.rail} (${decision.reason}), len=${(input ?? "").trim().length}`,
  );
  return decision.rail;
}

/**
 * Which rail should handle this receive method. Keys match `types` in
 * `$lib/utils`. `bolt12` is absent: Spark cannot generate BOLT12 offers,
 * and the option is removed (spec 6.2).
 */
export function railForReceiveMethod(method: string): Rail {
  const rail: Rail =
    method === "liquid" || method === "usdt" ? "liquid" : "spark";
  sdkLogger.info(`[rails] receive method="${method}" -> ${rail}`);
  return rail;
}
