import { error } from "@sveltejs/kit";
import { PUBLIC_DGEN_URL } from "$env/static/public";

// Universal backend proxy for ALL API calls
// This ensures Netlify serverless functions can properly access the backend

// In production builds, PUBLIC_DGEN_URL is injected at build time
const BACKEND_URL = PUBLIC_DGEN_URL || "http://localhost:3119";

console.log(`[Backend Proxy] Using backend: ${BACKEND_URL}`);

async function handleRequest(
  method: string,
  path: string,
  request: Request,
  cookies: any
) {
  try {
    // Get the query string from the original request URL
    const requestUrl = new URL(request.url);
    const queryString = requestUrl.search; // This includes the "?" if present
    
    const url = `${BACKEND_URL}/${path}${queryString}`;
    console.log(`[Backend Proxy] ${method} ${url}`);
    
    // For public files and uploads, don't override content-type headers
    const headers: HeadersInit = {};
    
    // Only set content-type for non-public and non-upload paths
    if (!path.startsWith("public/") && !path.startsWith("upload/")) {
      headers["content-type"] = request.headers.get("content-type") || "application/json";
      headers["accept"] = request.headers.get("accept") || "application/json";
    } else if (path.startsWith("upload/")) {
      // For uploads, don't set content-type - let the browser set the boundary for multipart/form-data
      // The original content-type has the boundary parameter needed for multipart forms
    }
    
    // Forward CF-Connecting-IP if available
    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp) headers["cf-connecting-ip"] = cfIp;
    
    // Forward authorization if available
    const auth = request.headers.get("authorization");
    if (auth) headers["authorization"] = auth;
    
    // Forward cookies as authorization header if token exists
    const token = cookies.get("token");
    if (token && !auth) {
      headers["authorization"] = `Bearer ${token}`;
    }
    
    let body = undefined;
    let isFormData = false;
    
    if (method !== "GET" && method !== "HEAD") {
      const contentType = request.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        body = await request.text();
        // Debug logging for registration
        if (path === "register") {
          console.log(`[Backend Proxy] Register request body:`, body);
        }
      } else if (contentType?.includes("multipart/form-data")) {
        // For file uploads, get the raw body
        const formData = await request.formData();
        
        // Recreate FormData for the backend request
        const newFormData = new FormData();
        for (const [key, value] of formData.entries()) {
          newFormData.append(key, value);
        }
        body = newFormData;
        isFormData = true;
      } else {
        body = await request.text();
      }
    }
    
    // Don't set content-type for FormData - fetch will set it with the correct boundary
    const fetchHeaders = isFormData ? 
      Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'content-type')) 
      : headers;
    
    const response = await fetch(url, {
      method,
      headers: fetchHeaders,
      body,
    });
    
    // For public files (images, etc), pass through as-is
    if (path.startsWith("public/")) {
      const contentType = response.headers.get("content-type");
      return new Response(response.body, {
        status: response.status,
        headers: {
          "content-type": contentType || "application/octet-stream",
          "cache-control": response.headers.get("cache-control") || "public, max-age=3600",
        },
      });
    }
    
    const responseText = await response.text();
    
    // Debug logging for registration
    if (path === "register" && response.status >= 400) {
      console.log(`[Backend Proxy] Register response (${response.status}):`, responseText);
    }
    
    // Try to parse as JSON, otherwise return as text
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    
    return new Response(
      typeof responseData === "string" ? responseData : JSON.stringify(responseData),
      {
        status: response.status,
        headers: {
          "content-type": response.headers.get("content-type") || "application/json",
        },
      }
    );
  } catch (err) {
    console.error(`Backend proxy error for ${path}:`, err);
    throw error(500, `Backend request failed: ${err.message}`);
  }
}

export async function GET({ params, request, cookies }) {
  return handleRequest("GET", params.path, request, cookies);
}

export async function POST({ params, request, cookies }) {
  return handleRequest("POST", params.path, request, cookies);
}

export async function PUT({ params, request, cookies }) {
  return handleRequest("PUT", params.path, request, cookies);
}

export async function DELETE({ params, request, cookies }) {
  return handleRequest("DELETE", params.path, request, cookies);
}

export async function PATCH({ params, request, cookies }) {
  return handleRequest("PATCH", params.path, request, cookies);
}
