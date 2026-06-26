# VN Boost · License API

API de licenciamento por HWID + painel admin. Node + Express + Postgres.

## Endpoints
- `POST /api/activate`  `{ key, hwid }` — ativa e vincula a chave ao HWID no 1º uso.
- `POST /api/validate`  `{ key, hwid }` — valida (usado a cada abertura do app).
- `GET  /admin` — painel de gerenciamento (pede o ADMIN_TOKEN).
- Admin (header `x-admin-token`): `GET/POST /api/admin/keys`, `/revoke`, `/restore`, `/unbind`, `DELETE`.

## Rodar local
```
cd server
npm install
copy .env.example .env   (e preencha DATABASE_URL e ADMIN_TOKEN)
npm run initdb           (cria as tabelas)
npm start
```
Abra http://localhost:3000/admin

## Deploy no Railway
1. Crie um projeto no Railway e adicione o plugin **Postgres** (gera o DATABASE_URL).
2. Suba a pasta `server/` (via GitHub ou `railway up`). O Railway detecta Node e roda `npm start`.
3. Em **Variables**, defina:
   - `ADMIN_TOKEN` = um token secreto longo
   - `DATABASE_URL` = (o Railway já injeta a do Postgres; se não, cole a "Postgres Connection URL")
4. O schema é criado sozinho no 1º start. (Ou rode `npm run initdb` uma vez.)
5. Pegue a URL pública (ex: `https://vn-boost-api.up.railway.app`).

## Ligar o app à API
No app, edite **`lib/license.js`** e troque `API_BASE` pela URL pública do Railway:
```js
const API_BASE = process.env.VN_API_BASE || "https://SUA-API.up.railway.app";
```

## Fluxo
1. Você gera uma chave no `/admin` (nasce "não usada").
2. Entrega a chave ao cliente.
3. Ele cola na tela de bloqueio do app → a chave vincula ao HWID dele.
4. Se alguém tentar usar a mesma chave em outro PC → bloqueado (HWID diferente).
5. Você pode **revogar** ou **desvincular** (resetar o HWID) a qualquer momento no admin.
