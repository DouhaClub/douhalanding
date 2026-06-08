import { Link } from 'react-router-dom';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export function NotFoundPage() {
  useDocumentMeta({
    title: 'Página não encontrada | Douha Club',
    description: 'O endereço que você acessou não existe no site do Douha Club.',
    canonicalPath: '/404',
    noIndex: true,
  });

  return (
    <main className="not-found-page">
      <section className="section">
        <div className="container not-found-page__inner">
          <p className="eyebrow">404</p>
          <h1>Página não encontrada</h1>
          <p className="about-copy">
            Esse endereço não existe ou foi movido. Volte para a home ou use o menu acima.
          </p>
          <div className="not-found-page__actions">
            <Link className="pill pill-light" to="/">Ir para a home</Link>
            <Link className="pill" to="/calendario">Ver calendário</Link>
            <Link className="pill" to="/contato">Contato</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
