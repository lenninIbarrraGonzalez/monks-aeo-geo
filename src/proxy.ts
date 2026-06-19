import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Proxy de Next.js 16 (antes `middleware`). Aplica el enrutamiento i18n de
 * next-intl: detecta el locale y reescribe/redirige según `routing`.
 */
export default createMiddleware(routing);

export const config = {
  // Coincide con todos los pathnames salvo API, assets internos y archivos con extensión.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
