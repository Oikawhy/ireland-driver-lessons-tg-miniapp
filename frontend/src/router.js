/**
 * Hash-based SPA router.
 */
const routes = {};
let currentCleanup = null;

/**
 * Register a route handler.
 * @param {string} path - Route path (e.g., 'menu', 'exam', 'settings')
 * @param {Function} handler - Function that returns HTML string or renders to #app
 */
export function route(path, handler) {
  routes[path] = handler;
}

/**
 * Navigate to a route.
 */
export function navigate(path) {
  window.location.hash = path;
}

/**
 * Get current route params from hash.
 * Ignores Telegram WebApp hash data (tgWebAppData, tgWebAppVersion, etc.)
 */
export function getParams() {
  let hash = window.location.hash.slice(1);

  // Telegram WebApp injects #tgWebAppData=... — ignore it
  if (hash.startsWith('tgWebApp') || hash.includes('tgWebAppData')) {
    hash = '';
  }

  const [path, query] = hash.split('?');
  const params = {};
  if (query) {
    query.split('&').forEach(p => {
      const [k, v] = p.split('=');
      params[k] = decodeURIComponent(v);
    });
  }
  return { path, params };
}

/**
 * Initialize the router.
 */
export function initRouter() {
  async function handleRoute() {
    const { path, params } = getParams();
    const routeName = path || 'menu';
    const handler = routes[routeName];

    // Cleanup previous page
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }

    const app = document.getElementById('app');
    if (!app) return;

    if (handler) {
      try {
        const cleanup = await handler(app, params);
        if (typeof cleanup === 'function') {
          currentCleanup = cleanup;
        }
      } catch (err) {
        console.error(`Route error [${routeName}]:`, err);
        app.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>${err.message}</p></div>`;
      }
    } else {
      app.innerHTML = '<div class="empty-state"><div class="emoji">🤷</div><p>Page not found</p></div>';
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
