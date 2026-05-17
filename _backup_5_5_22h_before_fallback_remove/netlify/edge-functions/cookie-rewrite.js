// Netlify Edge Function: Rewrite Set-Cookie headers from beancraft.co.kr proxy
// Removes domain attribute so cookies work on the Netlify deployment domain

export default async (request, context) => {
  const response = await context.next();

  const setCookieHeaders = response.headers.getSetCookie();

  // If no Set-Cookie headers, return the response as-is
  if (!setCookieHeaders || setCookieHeaders.length === 0) {
    return response;
  }

  // Build new headers, copying everything except set-cookie
  const newHeaders = new Headers();
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() !== "set-cookie") {
      newHeaders.append(key, value);
    }
  }

  // Process each Set-Cookie header: strip domain attribute
  for (const cookie of setCookieHeaders) {
    const cleaned = cookie
      .replace(/;\s*domain=[^;]*/gi, "");
    newHeaders.append("set-cookie", cleaned);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
};

export const config = {
  path: [
    "/umember/*",
    "/uevent/*",
    "/uboard/*",
    "/uproduct/*",
    "/ushop/*",
  ],
};
