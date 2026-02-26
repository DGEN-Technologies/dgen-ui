import { error } from "@sveltejs/kit";
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

const resolveIpAddresses = async (hostname: string): Promise<string[]> => {
  const addresses = new Set<string>();
  const fetchDns = async (type: "A" | "AAAA") => {
    const resp = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
        hostname,
      )}&type=${type}`,
      { headers: { accept: "application/dns-json" } },
    );
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

const resolvesToPrivateIp = async (hostname: string): Promise<boolean> => {
  try {
    const addresses = await resolveIpAddresses(hostname);
    if (addresses.length === 0) return true;
    return addresses.some((address) => isPrivateIp(address));
  } catch {
    return true;
  }
};

const isAllowedCallback = async (target: URL): Promise<boolean> => {
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
  return !(await resolvesToPrivateIp(hostname));
};

export const GET = async ({ url, fetch }) => {
  const target = url.searchParams.get("url");
  if (!target) {
    throw error(400, "Missing LNURL callback URL");
  }

  let callbackUrl: URL;
  try {
    callbackUrl = new URL(target);
  } catch {
    throw error(400, "Invalid LNURL callback URL");
  }

  if (!(await isAllowedCallback(callbackUrl))) {
    throw error(400, "Unsupported LNURL callback URL");
  }

  url.searchParams.forEach((value, key) => {
    if (key === "url") return;
    callbackUrl.searchParams.set(key, value);
  });

  let response: Response;
  try {
    response = await fetch(callbackUrl.toString(), {
      headers: { accept: "application/json" },
    });
  } catch {
    throw error(502, "LNURL callback request failed");
  }

  if (!response.ok) {
    const detail = await response.text();
    console.warn("[LNURL] Callback rejected", {
      status: response.status,
      detail: detail?.slice(0, 200),
    });
    return new Response(
      JSON.stringify({ status: "ERROR", reason: "LNURL callback failed" }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const contentType =
    response.headers.get("content-type") || "application/json";
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
};
