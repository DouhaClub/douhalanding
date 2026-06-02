import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initAnalyticsIfConsented, trackPageView } from '../lib/analytics';
import { getConsentRecord } from '../lib/consentStorage';

export function Analytics() {
  const { pathname } = useLocation();

  useEffect(() => {
    initAnalyticsIfConsented();
  }, []);

  useEffect(() => {
    if (getConsentRecord()?.choice !== 'accepted') return;
    initAnalyticsIfConsented().then(() => {
      trackPageView(pathname, document.title);
    });
  }, [pathname]);

  return null;
}
