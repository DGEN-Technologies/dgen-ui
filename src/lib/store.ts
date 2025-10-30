import { browser } from "$app/environment";
import { writable } from "svelte/store";

const persistSession = (key, defaultValue = undefined) => {
  const s = writable(
    browser &&
      sessionStorage.getItem(key) &&
      sessionStorage.getItem(key) !== "undefined"
      ? JSON.parse(sessionStorage.getItem(key) || "")
      : defaultValue,
  );

  s.subscribe((v) => {
    browser && sessionStorage.setItem(key, JSON.stringify(v));
  });

  return s;
};

const persistLocal = (key, defaultValue: any = undefined) => {
  const s = writable(
    browser &&
      localStorage.getItem(key) &&
      localStorage.getItem(key) !== "undefined"
      ? JSON.parse(localStorage.getItem(key) || "")
      : defaultValue,
  );

  s.subscribe((v) => {
    try {
      if (browser) {
        if (v) {
          localStorage.setItem(key, JSON.stringify(v));
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.log("problem setting key", v);
      console.log(e);
    }
  });

  return s;
};

export const account = writable();
export const amountPrompt = persistLocal("amountPrompt", false);
export const avatar = writable();
export const banner = writable();
export const event = writable();
export const events = writable({});
export const fiat = persistLocal("fiat", true);
export const installPrompt = writable();
export const invoice = writable();
export const last = writable();
export const loginRedirect = writable();
export const decrypted = persistLocal("decrypted", {});
export const ignore = persistLocal("ignore", []);
export const mnemonic = writable<string | null>(null);
export const unitPreference = persistLocal("unitPreference", "btc"); // "btc" or "sats"
export const newPayment = persistLocal("newPayment");
export const password = writable<string | undefined>();
export const passwordPrompt = writable();
export const eventToSign = writable();
export const pubkey = persistLocal("pubkey");
export const signer = persistLocal("signer");
export const camera = persistLocal("camera");
export const selectSigner = writable();
export const pin = persistLocal("pin");
export const rate = writable();
export const request = writable();
export const requestRedirect = writable();
// Force dark mode only for now - light mode needs more work
export const theme = writable("dark");
export const token = persistSession("token");
export const ndef = writable();
export const nfcEnabled = writable(false);
export const showQr = persistLocal("showQr", true);
export const save = writable();
// PRO mode for animations - defaults to false for reduced animations
export const proMode = persistLocal("proMode", false);
