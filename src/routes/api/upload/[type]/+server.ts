import { error } from "@sveltejs/kit";
import { PUBLIC_DGEN_URL } from "$env/static/public";

// Proxy uploads to backend to avoid CORS issues in production
const BACKEND_URL = PUBLIC_DGEN_URL || "http://localhost:3119";

export async function POST({ params, request, cookies }) {
  try {
    const { type } = params;
    const url = `${BACKEND_URL}/upload/${type}`;
    
    // Get the authorization header or token from cookies
    const auth = request.headers.get("authorization");
    const token = cookies.get("token");
    
    const headers: HeadersInit = {};
    if (auth) {
      headers["authorization"] = auth;
    } else if (token) {
      headers["authorization"] = `Bearer ${token}`;
    }
    
    // Forward the FormData as-is
    const formData = await request.formData();
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw error(response.status, errorText);
    }
    
    const result = await response.text();
    
    return new Response(result, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (err: any) {
    console.error(`Upload proxy error:`, err);
    const message = err?.body?.message || err?.message || JSON.stringify(err);
    throw error(500, `Upload failed: ${message}`);
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}