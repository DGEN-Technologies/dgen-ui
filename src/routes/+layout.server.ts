import {
  defaultLocale,
  loadTranslations,
  locales,
} from "$lib/translations/index";
import { auth, g, sleep } from "$lib/utils";

export const load = async ({ cookies, request, url, fetch }) => {
  const { host, pathname } = url;
  let user;
  const token = cookies.get("token");
  if (token) {
    try {
      user = await g("/me", fetch, auth(cookies));
    } catch (e: any) {
      // If backend is not available or rate limited, continue without user
      if (e.message && e.message.startsWith("Rate")) {
        await sleep(3000);
        try {
          user = await g("/me", fetch, auth(cookies));
        } catch {
          // Backend still not available
        }
      }
    }
  }

  // Try to get the locale from cookie
  let locale = user?.language || (cookies.get("lang") || "").toLowerCase();

  // Get user preferred locale
  if (!locale) {
    locale = `${`${request.headers.get("accept-language")}`.match(
      /[a-zA-Z]+?(?=-|_|,|;)/,
    )}`.toLowerCase();
  }

  // Get defined locales
  const supportedLocales = locales.get().map((l) => l.toLowerCase());

  // Use default locale if current locale is not supported
  if (!supportedLocales.includes(locale)) {
    locale = defaultLocale;
  }

  await loadTranslations(locale, pathname); // keep this just before the `return`

  // Force dark mode only for now - light mode needs more work
  const theme = "dark"; // cookies.get("theme") || "light";

  return {
    theme,
    host,
    pathname,
    i18n: { locale, route: pathname },
    user,
  };
};
