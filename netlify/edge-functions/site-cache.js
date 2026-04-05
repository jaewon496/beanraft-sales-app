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

    // Inject CSS to hide CreatorLink footer icons
    const hideFooterCSS = `<style>
.creatorlink-footer, .cl-footer, .footer-sns, .sns-wrap, .footer_sns,
[class*="creatorlink"] footer, footer .sns, .cl-bottom-bar,
.footer-bottom .sns-list, .mobile-bottom-bar, #cl-footer,
.footer-area .sns-area, .bottom-fixed-bar, .cl-mobile-bottom {
  display: none !important;
}
</style>`;

    // Inject script before </body> to handle JS-based navigation
    const navScript = `<script>
(function() {
  // Hide CreatorLink footer/bottom bar by scanning for SNS icon patterns
  function hideCreatorFooter() {
    // Hide footer sections with broken SNS icons
    var footers = document.querySelectorAll('footer, [class*="footer"], [class*="bottom"]');
    for (var i = 0; i < footers.length; i++) {
      var el = footers[i];
      var imgs = el.querySelectorAll('img');
      var hasBroken = false;
      for (var j = 0; j < imgs.length; j++) {
        var src = imgs[j].getAttribute('src') || '';
        if (src.indexOf('sns') !== -1 || src.indexOf('icon') !== -1 || src.indexOf('creatorlink') !== -1 || imgs[j].naturalWidth === 0) {
          hasBroken = true; break;
        }
      }
      if (hasBroken && imgs.length > 0) el.style.display = 'none';
    }
    // Also hide any fixed bottom bars from CreatorLink
    var allEls = document.querySelectorAll('[style*="position: fixed"][style*="bottom"]');
    for (var k = 0; k < allEls.length; k++) {
      var links = allEls[k].querySelectorAll('a');
      if (links.length > 0 && allEls[k].offsetHeight < 80) {
        allEls[k].style.display = 'none';
      }
    }
  }

  // Strip target="_top" and target="_parent" from all links
  function stripTargets() {
    var links = document.querySelectorAll('a[target="_top"], a[target="_parent"]');
    for (var i = 0; i < links.length; i++) {
      links[i].removeAttribute('target');
    }
  }
  stripTargets();
  hideCreatorFooter();
  var obs = new MutationObserver(function() { stripTargets(); hideCreatorFooter(); });
  obs.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a) return;
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

  // Rewrite URL helper
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

  // Intercept location methods
  var origAssign = location.assign;
  var origReplace = location.replace;
  location.assign = function(url) { origAssign.call(location, rewriteUrl(url)); };
  location.replace = function(url) { origReplace.call(location, rewriteUrl(url)); };

  // Intercept window.open
  var origOpen = window.open;
  window.open = function(url, target) {
    if (target === '_top' || target === '_parent') target = '_self';
    return origOpen.call(window, rewriteUrl(url || ''), target);
  };

  // Intercept history.pushState / replaceState to prefix /site/
  var origPush = history.pushState;
  var origRepl = history.replaceState;
  function rewritePath(url) {
    if (!url) return url;
    var s = String(url);
    if (s.charAt(0) === '/' && s.indexOf('/site/') !== 0) return '/site' + s;
    return s;
  }
  history.pushState = function(state, title, url) {
    return origPush.call(history, state, title, rewritePath(url));
  };
  history.replaceState = function(state, title, url) {
    return origRepl.call(history, state, title, rewritePath(url));
  };

  // Handle popstate — if URL somehow lost /site/ prefix, redirect
  window.addEventListener('popstate', function() {
    if (location.pathname.charAt(0) === '/' && location.pathname.indexOf('/site/') !== 0) {
      location.replace('/site' + location.pathname + location.search + location.hash);
    }
  });
})();
</script>`;

    // Inject CSS into <head>
    if (html.includes('</head>')) {
      html = html.replace('</head>', hideFooterCSS + '</head>');
    } else if (html.includes('<body')) {
      html = html.replace('<body', hideFooterCSS + '<body');
    }

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
