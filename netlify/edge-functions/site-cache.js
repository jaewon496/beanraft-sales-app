export default async (request, context) => {
  const response = await context.next();

  // Add browser cache header to reduce proxy requests
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=7200");

  const contentType = response.headers.get("content-type") || "";

  // For HTML responses, rewrite internal absolute paths to /site/ prefix
  if (contentType.includes("text/html")) {
    let html = await response.text();

    // Rewrite href="/xxx", action="/xxx", src="/xxx" to href="/site/xxx"
    // Skip: already-prefixed /site/, and protocol-relative //
    html = html.replace(
      /((?:href|action|src)\s*=\s*["'])\/((?!\/|site\/))/gi,
      "$1/site/$2"
    );

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
};

export const config = {
  path: "/site/*",
};
