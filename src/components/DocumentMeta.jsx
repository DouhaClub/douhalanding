import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { resolveRouteMeta } from '../lib/siteMeta';

export function DocumentMeta() {
  const { pathname } = useLocation();
  const meta = useMemo(() => resolveRouteMeta(pathname), [pathname]);
  useDocumentMeta(meta);
  return null;
}
