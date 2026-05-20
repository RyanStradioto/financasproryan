/**
 * Helpers for the onboarding/welcome screen dismissal state.
 *
 * Kept in a tiny standalone module so that App.tsx can import the check
 * without pulling in the entire WelcomePage chunk (the page itself is
 * lazy-loaded). If we imported these from WelcomePage.tsx directly, the
 * bundler would have to include the page in the initial bundle.
 */

const WELCOME_DISMISSED_KEY = (userId: string) => `financaspro:welcome-dismissed:${userId}`;

export function isWelcomeDismissed(userId: string | undefined): boolean {
  if (!userId || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(WELCOME_DISMISSED_KEY(userId)) === '1';
  } catch {
    return false;
  }
}

export function dismissWelcome(userId: string | undefined) {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WELCOME_DISMISSED_KEY(userId), '1');
  } catch {
    /* ignore quota errors */
  }
}

export function clearWelcomeDismissal(userId: string | undefined) {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(WELCOME_DISMISSED_KEY(userId));
  } catch {
    /* ignore */
  }
}
