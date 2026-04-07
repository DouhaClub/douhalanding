# Douha Club — site (landing)

Front-end em **React + Vite** para o site do Douha Club (agenda, galeria, editorial, admin).

## Desenvolvimento

```bash
cp .env.example .env   # preencha as chaves do Supabase
npm install
npm run dev              # http://localhost:5180
```

```bash
npm run build
npm run lint
```

## Repositório no GitHub (só este projeto)

Este diretório é o **repositório Git próprio** do site Douha (fora do monorepo `dj-booking-saas`).

1. Crie um repositório **vazio** na org/conta Douha no GitHub (sem README se for o primeiro push).
2. Na pasta deste projeto:

```bash
cd c:\Users\Vini_\douha-club-landing
git remote add origin https://github.com/SEU_USUARIO_OU_ORG/douha-club-landing.git
git branch -M main
git push -u origin main
```

3. Configure o deploy (Vercel, Netlify, Cloudflare Pages, etc.) apontando para esse repo, build `npm run build`, pasta de saída `dist`.

## Variáveis de ambiente

Copie `.env.example` para `.env` e defina as URLs/chaves do Supabase usadas pelo app. **Não commite** o arquivo `.env`.
