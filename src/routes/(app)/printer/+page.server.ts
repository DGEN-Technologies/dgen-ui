import { env } from "$env/dynamic/public";
import { fd } from "$lib/utils";
import { hex } from "@scure/base";

export const actions = {
  default: async ({ fetch, request, url }) => {
    const body = await fd(request);
    const baseUrl = url.origin;
    const res = await fetch(`${baseUrl}/api/backend/printer`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        accept: "application/octet-stream",
      },
    });

    return { data: hex.encode(new Uint8Array(await res.arrayBuffer())) };
  },
};
