import { quoteChallengeAction } from './turnstile-action';

export async function verifyQuoteChallenge(token: string, secret: string, hostname: string) {
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
      signal: AbortSignal.timeout(5000),
      redirect: 'manual',
      cache: 'no-store',
    });
    if (!response.ok) return 'unavailable';

    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('success' in result)) return 'unavailable';
    if (result.success === false) {
      const codes = 'error-codes' in result ? result['error-codes'] : null;
      if (!Array.isArray(codes) || codes.some((code) => ['internal-error', 'missing-input-secret', 'invalid-input-secret'].includes(code))) {
        return 'unavailable';
      }
      return 'rejected';
    }
    if (result.success !== true) return 'unavailable';
    return 'hostname' in result && result.hostname === hostname && 'action' in result && result.action === quoteChallengeAction
      ? 'verified'
      : 'rejected';
  } catch {
    return 'unavailable';
  }
}
