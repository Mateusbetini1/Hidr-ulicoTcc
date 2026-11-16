'use client';

import { useEffect, useRef, useState } from 'react';
import { quoteChallengeAction } from '../lib/turnstile-action';

type Turnstile = {
  render(container: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
    'response-field': false;
  }): string;
  remove(widgetId: string): void;
};

let loading: Promise<Turnstile> | undefined;

function loadTurnstile() {
  const turnstileWindow = window as Window & { turnstile?: Turnstile };
  if (turnstileWindow.turnstile) return Promise.resolve(turnstileWindow.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const timeout = window.setTimeout(fail, 12000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error('Turnstile indisponível'));
    }
    script.onload = () => {
      window.clearTimeout(timeout);
      if (turnstileWindow.turnstile) resolve(turnstileWindow.turnstile);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

export function useQuoteChallenge() {
  const [token, setToken] = useState('');
  const [attempt, setAttempt] = useState(0);
  return {
    token,
    widget: <QuoteChallenge key={attempt} onToken={setToken} />,
    reset() { setToken(''); setAttempt((current) => current + 1); },
  };
}

function QuoteChallenge({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let dispose: (() => void) | undefined;
    const clear = () => { if (!controller.signal.aborted) onToken(''); };
    const fail = () => { if (!controller.signal.aborted) { clear(); setFailed(true); } };
    clear();

    async function mount() {
      const response = await fetch('/api/solicitacoes', {
        cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      });
      const config = await response.json() as { siteKey?: string };
      if (!response.ok || !config.siteKey) throw new Error('Turnstile indisponível');
      if (controller.signal.aborted) return;
      const api = await loadTurnstile();
      if (controller.signal.aborted || !container.current) return;
      const widgetId = api.render(container.current, {
        sitekey: config.siteKey,
        action: quoteChallengeAction,
        callback: (token) => { if (!controller.signal.aborted) { setFailed(false); onToken(token); } },
        'expired-callback': clear,
        'error-callback': fail,
        'response-field': false,
      });
      dispose = () => api.remove(widgetId);
    }
    mount().catch(fail);
    return () => { controller.abort(); dispose?.(); };
  }, [attempt, onToken]);

  return <div>
    <div ref={container} aria-label="Verificação de segurança" />
    {failed && <p role="status">Verificação indisponível. <button type="button" onClick={() => {
      setFailed(false); setAttempt((current) => current + 1);
    }}>Tentar novamente</button></p>}
  </div>;
}
