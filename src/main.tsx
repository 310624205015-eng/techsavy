import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// If someone visits the site with a top-level query param like
// https://site/?regCode=abc#/event/123, HashRouter won't see the
// search part because the route lives in the hash. Detect regCode in
// window.location.search on initial load and rewrite the URL to the
// hash-based attendance route so the app navigates correctly.
(() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const regCode = params.get('regCode');
    if (regCode) {
      // If the current URL already has a hash path for an event like #/event/123,
      // rewrite it to include the regCode as a path segment: #/event/123/<regCode>
      const hash = window.location.hash || '';
      if (hash.startsWith('#')) {
        const hashPath = hash.slice(1); // remove '#'
        const eventMatch = hashPath.match(/^\/event\/(\w[\w-]*)/);
        if (eventMatch) {
          const eventId = eventMatch[1];
          const newUrl = `${window.location.origin}${window.location.pathname}#/event/${eventId}/${regCode}`;
          window.history.replaceState({}, '', newUrl);
          return;
        }
      }

      // Fallback: rewrite to attendance route
      const newUrl = `${window.location.origin}${window.location.pathname}#/attendance/${regCode}`;
      window.history.replaceState({}, '', newUrl);
    }
  } catch (e) {
    // If URL parsing fails for any reason, do nothing and let the app load normally
    // eslint-disable-next-line no-console
    console.error('Error handling regCode redirect:', e);
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
