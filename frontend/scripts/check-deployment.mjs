import process from "node:process";
import { URL } from "node:url";
// VITE_* values become public JavaScript. Only an API origin belongs here.
export function validateOrigin(value) {
  if (!value)
    throw new Error(
      "Set VITE_PUBLIC_API_BASE_URL to your deployed HTTPS FastAPI origin before building on Vercel.",
    );
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("VITE_PUBLIC_API_BASE_URL must be a valid HTTPS origin.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    value.endsWith("/") ||
    ["localhost", "127.0.0.1"].includes(url.hostname)
  ) {
    throw new Error(
      "VITE_PUBLIC_API_BASE_URL must be an HTTPS origin without credentials, /api, a trailing slash, query or fragment.",
    );
  }
  return url.origin;
}
if (process.env.VERCEL === "1")
  validateOrigin(process.env.VITE_PUBLIC_API_BASE_URL);
