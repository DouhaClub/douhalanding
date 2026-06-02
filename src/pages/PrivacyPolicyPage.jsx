import { Link } from 'react-router-dom';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { resolveRouteMeta } from '../lib/siteMeta';
import { CONSENT_VERSION } from '../lib/consentStorage';

const STORAGE_ITEMS = [
  {
    key: 'douha_consent_v1',
    purpose: 'Registra se voce aceitou ou recusou cookies e cache opcional (banner de privacidade).',
  },
  {
    key: 'douha_calendar_focus_v1',
    purpose: 'Lembra qual mes/ano da agenda voce estava vendo ao voltar de outra pagina.',
  },
  {
    key: 'douha_site_photos_v1',
    purpose: 'Copia local da galeria de fotos quando o Supabase nao esta disponivel.',
  },
  {
    key: 'douha_role_photos_v2',
    purpose: 'Copia local das fotos do role quando o Supabase nao esta disponivel.',
  },
  {
    key: 'douha_site_content_v1',
    purpose: 'Copia local de textos e configuracoes do site (fallback offline).',
  },
  {
    key: 'douha_admin_auth_v1',
    purpose: 'Mantem a sessao do painel administrativo no navegador (somente apos login no /admin).',
  },
];

export function PrivacyPolicyPage({ siteContent }) {
  const meta = resolveRouteMeta('/privacidade');
  useDocumentMeta(meta);

  const contactEmail = String(siteContent?.contactEmail || '').trim() || 'contato@douhaclub.com.br';

  return (
    <main className="legal-page">
      <section className="section">
        <div className="container legal-page__inner">
          <p className="eyebrow">Privacidade e LGPD</p>
          <h1>Politica de privacidade</h1>
          <p className="legal-page__updated">Ultima atualizacao: maio de 2026 · versao do consentimento: {CONSENT_VERSION}</p>

          <div className="legal-page__prose">
            <p>
              Esta politica descreve como o <strong>Douha Club</strong> trata dados pessoais e tecnologias de
              armazenamento no site institucional. O controlador e o proprio Douha Club; para exercer seus
              direitos ou tirar duvidas, use a pagina de{' '}
              <Link to="/contato">Contato</Link> ou o e-mail{' '}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
            </p>

            <h2>O que coletamos</h2>
            <ul>
              <li>
                <strong>Dados que voce nos envia:</strong> mensagens por e-mail ou WhatsApp ao entrar em contato
                (conteudo definido por voce).
              </li>
              <li>
                <strong>Dados tecnicos automaticos:</strong> logs do provedor de hospedagem (IP, data/hora,
                pagina acessada), necessarios para seguranca e operacao.
              </li>
              <li>
                <strong>Armazenamento no seu navegador:</strong> chaves em <code>localStorage</code> listadas abaixo.
                Nao usamos cookies de publicidade de terceiros neste site.
              </li>
            </ul>

            <h2>Armazenamento local (localStorage)</h2>
            <p>
              O navegador guarda informacoes no seu aparelho para o site funcionar ou lembrar preferencias.
              Voce pode apagar tudo em Configuracoes do navegador → Privacidade → Limpar dados do site.
            </p>
            <table className="legal-table">
              <thead>
                <tr>
                  <th scope="col">Chave</th>
                  <th scope="col">Finalidade</th>
                </tr>
              </thead>
              <tbody>
                {STORAGE_ITEMS.map((row) => (
                  <tr key={row.key}>
                    <td><code>{row.key}</code></td>
                    <td>{row.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>Cookies e banner de consentimento</h2>
            <p>
              Ao visitar pela primeira vez, exibimos um aviso sobre cookies e armazenamento. Voce pode escolher:
            </p>
            <ul>
              <li>
                <strong>Apenas essenciais:</strong> o site continua funcionando; nao ativamos cache opcional
                (Service Worker) para visitas seguintes.
              </li>
              <li>
                <strong>Aceitar cookies e cache:</strong> além do essencial, registramos sua escolha e podemos
                usar Service Worker para acelerar paginas ja visitadas.
              </li>
            </ul>
            <p>
              A decisao fica salva em <code>douha_consent_v1</code>. Se mudarmos o que o aceite cobre, podemos
              pedir consentimento de novo (versao atual: {CONSENT_VERSION}).
            </p>

            <h2>Cache (Service Worker)</h2>
            <p>
              Somente se voce aceitar no banner, o navegador pode guardar copias de arquivos estaticos do site
              para carregamento mais rapido. Isso nao envia seus dados a terceiros; e cache local do proprio site.
            </p>

            <h2>Supabase e conteudo do site</h2>
            <p>
              Agenda, fotos, editorial e textos podem ser carregados de um banco Supabase (provedor de nuvem).
              O acesso publico usa chave anonima limitada; o painel <code>/admin</code> e restrito a operadores
              autorizados. Consulte tambem a politica do Supabase quando aplicavel.
            </p>

            <h2>YouTube</h2>
            <p>
              Na home e em Sets, podemos exibir miniaturas e links para videos do canal Douha no YouTube.
              Ao clicar, voce passa a estar sujeito aos termos e politica de privacidade do Google/YouTube.
            </p>

            <h2>Analytics (medição de audiencia)</h2>
            <p>
              Se voce aceitar cookies no banner, podemos carregar ferramentas de estatistica (Google Analytics 4
              e/ou Plausible), configuradas por variaveis de ambiente no deploy. Elas registram paginas visitadas
              de forma agregada. Sem aceite, analytics nao e carregado.
            </p>

            <h2>Base legal (LGPD)</h2>
            <ul>
              <li><strong>Consentimento:</strong> cache opcional e Service Worker, quando voce aceita no banner.</li>
              <li><strong>Legitimo interesse:</strong> seguranca, melhoria do site e resposta a contatos.</li>
              <li><strong>Execucao de procedimentos preliminares:</strong> quando voce solicita ingressos ou parcerias via canais oficiais.</li>
            </ul>

            <h2>Seus direitos</h2>
            <p>
              Voce pode solicitar confirmacao de tratamento, acesso, correcao, anonimizacao, portabilidade,
              eliminacao de dados tratados com consentimento, informacao sobre compartilhamento e revogacao do
              consentimento, nos termos da Lei 13.709/2018 (LGPD).
            </p>

            <h2>Retencao</h2>
            <p>
              Dados em <code>localStorage</code> permanecem ate voce limpar o navegador ou ate atualizarmos/removermos
              as chaves. Mensagens de contato sao mantidas pelo tempo necessario para atender sua solicitacao e
              obrigacoes legais.
            </p>

            <h2>Alteracoes</h2>
            <p>
              Podemos atualizar esta pagina. Mudancas relevantes no banner de cookies podem exigir novo
              consentimento.
            </p>
          </div>

          <p className="legal-page__back">
            <Link className="pill" to="/contato">Ir para Contato</Link>
            <Link className="pill pill-light" to="/">Voltar ao inicio</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
