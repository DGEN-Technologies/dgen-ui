const blockedHostSuffixes = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
];

const isPrivateIpv4 = (ip: string): boolean => {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part)))
    return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
};

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true; // link-local fe80::/10
  }
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.replace("::ffff:", "");
    return isPrivateIpv4(v4);
  }
  return false;
};

const isIpv4Literal = (value: string): boolean => {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const num = Number.parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

const isIpv6Literal = (value: string): boolean => {
  if (!value.includes(":")) return false;
  if (!/^[0-9a-fA-F:]+$/.test(value)) return false;
  return true;
};

const isIpLiteral = (value: string): boolean => {
  return isIpv4Literal(value) || isIpv6Literal(value);
};

const isPrivateIp = (ip: string): boolean => {
  if (isIpv4Literal(ip)) return isPrivateIpv4(ip);
  if (isIpv6Literal(ip)) return isPrivateIpv6(ip);
  return true;
};

const isAbortError = (err: unknown): boolean => {
  return (
    !!err &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name?: string }).name === "AbortError"
  );
};

const fetchWithTimeout = async (
  fetchFn: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const resolveIpAddresses = async (
  hostname: string,
  fetchFn: typeof fetch,
): Promise<string[]> => {
  const addresses = new Set<string>();
  const fetchDns = async (type: "A" | "AAAA") => {
    const dnsUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
      hostname,
    )}&type=${type}`;
    let resp: Response;
    try {
      resp = await fetchWithTimeout(
        fetchFn,
        dnsUrl,
        { headers: { accept: "application/dns-json" } },
        5000,
      );
    } catch (err) {
      if (isAbortError(err)) {
        throw new Error("DNS lookup timed out");
      }
      throw err;
    }
    if (!resp.ok) return;
    const data = await resp.json();
    if (!Array.isArray(data?.Answer)) return;
    for (const answer of data.Answer) {
      if (typeof answer?.data === "string" && isIpLiteral(answer.data)) {
        addresses.add(answer.data);
      }
    }
  };
  await Promise.all([fetchDns("A"), fetchDns("AAAA")]);
  return Array.from(addresses);
};

const resolveSystemIpAddresses = async (
  hostname: string,
): Promise<string[]> => {
  try {
    const dns = await import("node:dns");
    const records = await dns.promises.lookup(hostname, { all: true });
    return records.map((record) => record.address).filter(isIpLiteral);
  } catch (error) {
    console.warn("[LNURL] System DNS lookup failed:", error);
    return [];
  }
};

const resolvesToPrivateIp = async (
  hostname: string,
  fetchFn: typeof fetch,
): Promise<boolean> => {
  try {
    const [dohAddresses, systemAddresses] = await Promise.all([
      resolveIpAddresses(hostname, fetchFn),
      resolveSystemIpAddresses(hostname),
    ]);
    if (systemAddresses.length === 0) return true;
    if (systemAddresses.some((address) => isPrivateIp(address))) return true;

    if (dohAddresses.length > 0) {
      const dohSet = new Set(dohAddresses);
      if (systemAddresses.some((address) => !dohSet.has(address))) {
        return true;
      }
    }

    return false;
  } catch {
    return true;
  }
};

export const isAllowedLnurlHost = async (
  target: URL,
  fetchFn: typeof fetch,
): Promise<boolean> => {
  if (target.protocol !== "https:") return false;
  const hostname = target.hostname;
  if (!hostname) return false;
  const lowered = hostname.toLowerCase();
  if (lowered === "localhost") return false;
  if (blockedHostSuffixes.some((suffix) => lowered.endsWith(suffix))) {
    return false;
  }
  if (isIpLiteral(hostname)) {
    return !isPrivateIp(hostname);
  }
  return !(await resolvesToPrivateIp(hostname, fetchFn));
};
