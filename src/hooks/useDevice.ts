import { useMediaQuery } from './useMediaQuery';

export type Device = 'mobile' | 'tabletPortrait' | 'tabletLandscape' | 'desktop';

// Yatay telefonlar genişlik olarak tablete yaklaştığı için ekran yüksekliğiyle mobil sayılır.
const MOBILE_QUERY =
  '(max-width: 599.98px), (orientation: landscape) and (max-height: 500px) and (pointer: coarse)';

const TABLET_PORTRAIT_QUERY = '(min-width: 600px) and (max-width: 1050px) and (orientation: portrait)';

// Dizüstü bilgisayarlardan ayırmak için dokunmatik işaretçi şartı aranır.
const TABLET_LANDSCAPE_QUERY =
  '(min-width: 600px) and (max-width: 1400px) and (min-height: 500.02px) and (orientation: landscape) and (pointer: coarse)';

// Yatay dar pencerelerde de menü sığmadığı için 1024 px altı her zaman hamburger olur.
const NAV_COLLAPSED_QUERY = `${MOBILE_QUERY}, ${TABLET_PORTRAIT_QUERY}, (max-width: 1023.98px)`;

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}

export function useIsTabletPortrait(): boolean {
  return useMediaQuery(TABLET_PORTRAIT_QUERY);
}

export function useIsTabletLandscape(): boolean {
  return useMediaQuery(TABLET_LANDSCAPE_QUERY);
}

export function useIsNavCollapsed(): boolean {
  return useMediaQuery(NAV_COLLAPSED_QUERY);
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}

export function useHasFinePointer(): boolean {
  return useMediaQuery(FINE_POINTER_QUERY);
}

export function useDevice(): Device {
  const isMobile = useIsMobile();
  const isTabletPortrait = useIsTabletPortrait();
  const isTabletLandscape = useIsTabletLandscape();

  if (isMobile) return 'mobile';
  if (isTabletPortrait) return 'tabletPortrait';
  if (isTabletLandscape) return 'tabletLandscape';
  return 'desktop';
}
