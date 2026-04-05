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

    // Rewrite absolute URLs: href="https://www.beancraft.co.kr/xxx" → href="/site/xxx"
    html = html.replace(
      /((?:href|action|src)\s*=\s*["'])https?:\/\/(?:www\.)?beancraft\.co\.kr\//gi,
      "$1/site/"
    );

    // Inject script before </body> to handle JS-based navigation
    const navScript = `<script>
(function() {
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href) return;
    try {
      var url = new URL(href, location.href);
      if (url.hostname === 'www.beancraft.co.kr' || url.hostname === 'beancraft.co.kr') {
        href = url.pathname + url.search + url.hash;
      }
    } catch(ex) {}
    if (href.charAt(0) === '/' && href.indexOf('/site/') !== 0) {
      e.preventDefault();
      location.href = '/site' + href;
    }
  }, true);
  var origAssign = location.assign;
  var origReplace = location.replace;
  function rewriteUrl(url) {
    try {
      var u = new URL(url, location.href);
      if (u.hostname === 'www.beancraft.co.kr' || u.hostname === 'beancraft.co.kr') {
        return '/site' + u.pathname + u.search + u.hash;
      }
      if (u.hostname === location.hostname && u.pathname.charAt(0) === '/' && u.pathname.indexOf('/site/') !== 0) {
        return '/site' + u.pathname + u.search + u.hash;
      }
    } catch(ex) {}
    return url;
  }
  location.assign = function(url) { origAssign.call(location, rewriteUrl(url)); };
  location.replace = function(url) { origReplace.call(location, rewriteUrl(url)); };
})();
</script>`;

    if (html.includes('</body>')) {
      html = html.replace('</body>', navScript + '</body>');
    } else {
      html += navScript;
    }

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
