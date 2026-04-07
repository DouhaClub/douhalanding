import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { needsConsentBanner, saveConsentChoice } from '../lib/consentStorage';
import { registerServiceWorkerIfAccepted, unregisterServiceWorker } from '../lib/registerServiceWorker';

export function CookieConsentBanner() {
  const [open, setOpen] = useState(() => needsConsentBanner());

  const onAccept = useCallback(async () => {
    saveConsentChoice('accepted');
    setOpen(false);
    await registerServiceWorkerIfAccepted();
  }, []);

  const onReject = useCallback(async () => {
    saveConsentChoice('rejected');
    setOpen(false);
    await unregisterServiceWorker();
  }, []);

  if (!open) return null;

  return (
    <div
      className="cookie-consent"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
    >
      <div className="cookie-consent-backdrop" aria-hidden="true" />
      <div className="cookie-consent-panel">
        <div className="cookie-consent-inner">
          <div className="cookie-consent-text">
            <p className="cookie-consent-eyebrow">Privacidade</p>
            <h2 id="cookie-consent-title" className="cookie-consent-heading">
              Cookies, dados locais e cache
            </h2>
            <p id="cookie-consent-desc" className="cookie-consent-copy">
              Este site pode usar <strong>cookies</strong> e <strong>armazenamento local</strong> para
              funcionar (por exemplo, preferencias). Se voce aceitar, tambem usamos{' '}
              <strong>cache no navegador</strong> (Service Worker) para as proximas visitas
              carregarem mais rapido. Isso nao substitui uma politica de privacidade completa — em
              duvida, fale conosco em <Link to="/contato">Contato</Link>.
            </p>
          </div>
          <div className="cookie-consent-actions">
            <button type="button" className="pill cookie-consent-btn-reject" onClick={onReject}>
              Apenas essenciais
            </button>
            <button type="button" className="pill pill-light cookie-consent-btn-accept" onClick={onAccept}>
              Aceitar cookies e cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
