export const DESKTOP_ORIGIN = 'https://leul-t-agonafer.vercel.app';
export const MOBILE_ORIGIN = 'https://leul-t-agonafer-x.vercel.app';

const PRODUCTION_HOSTS = new Set([
  'leul-t-agonafer.vercel.app',
  'leul-t-agonafer-x.vercel.app',
  'portifolio-leul.vercel.app',
  'portifolio-x-leul.vercel.app',
]);

export interface DeviceIdentity {
  userAgent: string;
  maxTouchPoints?: number;
  userAgentData?: { mobile: boolean };
}

/** Phone identity is independent of window size, orientation, and laptop touch input. */
export function isPhone({ userAgent, maxTouchPoints = 0, userAgentData }: DeviceIdentity): boolean {
  if (/iPad|Tablet/i.test(userAgent) ||
      (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return false;
  return /iPhone|iPod|Windows Phone|Android.*Mobile/i.test(userAgent) ||
    userAgentData?.mobile === true;
}

export function portfolioRedirect(href: string, device: DeviceIdentity): string | null {
  const current = new URL(href);
  if (!PRODUCTION_HOSTS.has(current.hostname)) return null;
  const target = new URL(isPhone(device) ? MOBILE_ORIGIN : DESKTOP_ORIGIN);
  if (current.origin === target.origin) return null;
  current.protocol = target.protocol;
  current.host = target.host;
  current.port = target.port;
  return current.href;
}

export async function routeOrStart(
  href: string,
  device: DeviceIdentity,
  replace: (destination: string) => void,
  load: () => Promise<unknown>,
): Promise<void> {
  const destination = portfolioRedirect(href, device);
  if (destination) replace(destination);
  else await load();
}
