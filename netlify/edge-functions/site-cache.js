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

    // Strip target="_top" and target="_parent" to keep navigation inside iframe
    html = html.replace(/\starget\s*=\s*["'](_top|_parent)["']/gi, '');

    // Inject script before </body> to handle JS-based navigation
    const navScript = `<script>
(function() {
  // Strip target="_top" and target="_parent" from all links
  function stripTargets() {
    var links = document.querySelectorAll('a[target="_top"], a[target="_parent"]');
    for (var i = 0; i < links.length; i++) {
      links[i].removeAttribute('target');
    }
  }
  stripTargets();
  var obs = new MutationObserver(function() { stripTargets(); });
  obs.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a) return;
    // Remove target that would escape iframe
    var t = a.getAttribute('target');
    if (t === '_top' || t === '_parent') a.removeAttribute('target');
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
  // Intercept window.open to stay in iframe
  var origOpen = window.open;
  window.open = function(url, target) {
    if (target === '_top' || target === '_parent') target = '_self';
    return origOpen.call(window, rewriteUrl(url || ''), target);
  };
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
