import { Link } from 'react-router-dom';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { resolveRouteMeta } from '../lib/siteMeta';
import { CONSENT_VERSION } from '../lib/consentStorage';

export function PrivacyPolicyPage({ siteContent }) {
  const meta = resolveRouteMeta('/privacidade');
  useDocumentMeta(meta);

  const contactEmail = String(siteContent?.contactEmail || '').trim() || 'contato@douhaclub.com.br';

  return (
    <main className="legal-page">
      <section className="section">
        <div className="container legal-page__inner">
          <p className="eyebrow">Privacidade e LGPD</p>
          <h1>Política de privacidade</h1>
          <p className="legal-page__lead">
            Como o Douha Club trata dados pessoais, armazenamento no seu navegador e cookies neste site.
          </p>
          <p className="legal-page__updated">
            Última atualização: maio de 2026 · versão do consentimento: {CONSENT_VERSION}
          </p>

          <div className="legal-page__prose">
            <p>
              Esta política descreve como o <strong>Douha Club</strong> trata dados pessoais e tecnologias de
              armazenamento no site institucional. O controlador é o próprio Douha Club. Para exercer seus
              direitos ou tirar dúvidas, use a página de{' '}
              <Link to="/contato">Contato</Link> ou o e-mail{' '}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
            </p>

            <h2>O que coletamos</h2>
            <ul>
              <li>
                <strong>Dados que você nos envia:</strong> mensagens por e-mail ou WhatsApp ao entrar em contato
                (conteúdo definido por você).
              </li>
              <li>
                <strong>Dados técnicos automáticos:</strong> logs do provedor de hospedagem (IP, data/hora,
                página acessada), necessários para segurança e operação.
              </li>
              <li>
                <strong>Preferências no navegador:</strong> sua escolha no banner de cookies e informações
                necessárias para o site funcionar. Não usamos cookies de publicidade de terceiros.
              </li>
            </ul>

            <h2>Cookies e banner de consentimento</h2>
            <p>
              Ao visitar pela primeira vez, exibimos um aviso sobre cookies e armazenamento. Você pode escolher:
            </p>
            <ul>
              <li>
                <strong>Apenas essenciais:</strong> o site continua funcionando; não ativamos cache opcional
                para visitas seguintes.
              </li>
              <li>
                <strong>Aceitar cookies e cache:</strong> além do essencial, registramos sua escolha e podemos
                usar cache local para acelerar páginas já visitadas.
              </li>
            </ul>
            <p>
              Se mudarmos o que o aceite cobre, podemos pedir consentimento de novo (versão atual: {CONSENT_VERSION}).
              Você pode apagar dados do site nas configurações de privacidade do seu navegador.
            </p>

            <h2>Cache do site</h2>
            <p>
              Somente se você aceitar no banner, o navegador pode guardar cópias de arquivos estáticos do site
              para carregamento mais rápido. Isso não envia seus dados a terceiros; é cache local do próprio site.
            </p>

            <h2>Conteúdo do site</h2>
            <p>
              Agenda, fotos, editorial e textos são carregados de servidores em nuvem. O acesso público é
              limitado; o painel administrativo é restrito a operadores autorizados.
            </p>

            <h2>YouTube</h2>
            <p>
              Na home e em Sets, podemos exibir miniaturas e links para vídeos do canal Douha no YouTube.
              Ao clicar, você passa a estar sujeito aos termos e política de privacidade do Google/YouTube.
            </p>

            <h2>Analytics (medição de audiência)</h2>
            <p>
              Se você aceitar cookies no banner, podemos carregar ferramentas de estatística (Google Analytics 4
              e/ou Plausible), configuradas no deploy. Elas registram páginas visitadas de forma agregada.
              Sem aceite, analytics não é carregado.
            </p>

            <h2>Base legal (LGPD)</h2>
            <ul>
              <li><strong>Consentimento:</strong> cache opcional, quando você aceita no banner.</li>
              <li><strong>Legítimo interesse:</strong> segurança, melhoria do site e resposta a contatos.</li>
              <li><strong>Execução de procedimentos preliminares:</strong> quando você solicita ingressos ou parcerias via canais oficiais.</li>
            </ul>

            <h2>Seus direitos</h2>
            <p>
              Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade,
              eliminação de dados tratados com consentimento, informação sobre compartilhamento e revogação do
              consentimento, nos termos da Lei 13.709/2018 (LGPD).
            </p>

            <h2>Retenção</h2>
            <p>
              Preferências salvas no navegador permanecem até você limpar os dados do site ou trocar de aparelho.
              Mensagens de contato são mantidas pelo tempo necessário para atender sua solicitação e
              obrigações legais.
            </p>

            <h2>Alterações</h2>
            <p>
              Podemos atualizar esta página. Mudanças relevantes no banner de cookies podem exigir novo
              consentimento.
            </p>
          </div>

          <div className="legal-page__back">
            <Link className="pill" to="/contato">Ir para Contato</Link>
            <Link className="pill pill-light" to="/">Voltar ao início</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
