import { getStateFromPath } from '@react-navigation/native';
import { linking } from '../navigation/linkingConfig';

export interface ResolvedInternalRoute {
  screen: string;
  params?: Record<string, any>;
}

/**
 * Determine whether a URL points to an internal fretiko.com/app route that the
 * app can render natively (e.g. https://fretiko.com/product/123 -> ProductDetails).
 *
 * Reuses the same deep-linking config that powers React Navigation's `linking`
 * prop (see src/navigation/linkingConfig.ts) as the single source of truth, so
 * this always stays in sync with the routes the app actually knows how to open.
 *
 * Returns null when the URL isn't a recognized internal route - callers should
 * fall back to opening it in the in-app browser (expo-web-browser) instead.
 */
export function resolveInternalRoute(url: string): ResolvedInternalRoute | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const isFretikoHost = hostname === 'fretiko.com' || hostname === 'www.fretiko.com';
    const isFretikoScheme = parsed.protocol === 'fretiko:';
    if (!isFretikoHost && !isFretikoScheme) {
      return null;
    }

    const path = `${parsed.pathname}${parsed.search}`;
    const state = getStateFromPath(path, linking.config);
    if (!state?.routes?.length) {
      return null;
    }

    // Drill down through any nested navigators (e.g. Main > Stories) to find
    // the deepest/actual screen that should be focused.
    let route: any = state.routes[state.routes.length - 1];
    while (route?.state?.routes?.length) {
      route = route.state.routes[route.state.routes.length - 1];
    }

    if (!route?.name) {
      return null;
    }

    return { screen: route.name, params: route.params };
  } catch (error) {
    return null;
  }
}
