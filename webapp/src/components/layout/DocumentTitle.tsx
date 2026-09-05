import { useEffect } from 'react';

import { useLocation } from 'react-router-dom';

import { titleForPath } from '@/lib/page-title';

/**
 * Keeps the browser tab in step with the route. Renders nothing.
 *
 * Mounted above <Routes> so its effect runs before any page's own
 * `useDocumentTitle`, letting a screen that knows something more specific — a
 * league's name, an opponent's — overwrite the generic route title in the same
 * commit rather than a frame later.
 */
export function DocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = titleForPath(pathname);
  }, [pathname]);

  return null;
}
