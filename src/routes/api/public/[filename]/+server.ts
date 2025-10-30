import { error } from "@sveltejs/kit";
import { PUBLIC_DGEN_URL } from "$env/static/public";

// Proxy public file requests to backend
const BACKEND_URL = PUBLIC_DGEN_URL || "http://localhost:3119";

export async function GET({ params }) {
  try {
    const { filename } = params;
    const url = `${BACKEND_URL}/public/${filename}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw error(response.status, `File not found: ${filename}`);
    }

    // Forward the response with proper headers
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    return new Response(buffer, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": response.headers.get("cache-control") || "public, max-age=3600",
        "access-control-allow-origin": "*",
      },
    });
  } catch (err: any) {
    console.error(`Public file proxy error:`, err);
    throw error(err.status || 500, err.message || "Failed to load file");
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
