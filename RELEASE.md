# Como publicar atualizações (GitHub Releases + auto-update)

O app usa `electron-updater`. Quando você publica uma versão nova no GitHub
Releases, os apps instalados detectam, baixam em segundo plano e instalam ao
reiniciar.

## Pré-requisitos (1 vez só)
1. Crie um repositório no GitHub para o projeto (ex: `vn7-panel`).
2. No `package.json`, em `build.publish`, preencha:
   ```json
   "owner": "SEU-USUARIO-GITHUB",
   "repo":  "vn7-panel"
   ```
3. Crie um Personal Access Token no GitHub:
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Marque o escopo **repo** e gere. Guarde o token (`ghp_...`).

## A cada atualização
1. Faça suas mudanças no código.
2. Suba o número da versão no `package.json` (ex: `1.0.0` → `1.0.1`).
3. No PowerShell, defina o token e publique:
   ```powershell
   $env:GH_TOKEN="ghp_SEU_TOKEN_AQUI"
   npm run release
   ```
   Isso gera o instalador + o `latest.yml` e sobe tudo num **Release** do GitHub.
4. Pronto. Quem tem o app instalado recebe a atualização automaticamente na
   próxima vez que abrir (baixa em background e instala ao reiniciar).

## Observações
- Auto-update funciona na versão **instalador (NSIS)**, não na portátil.
- O repositório pode ser **público** (mais simples). Se for privado, o app
  precisa de um token embutido — evite, use público só para os releases.
- Como o app **não é assinado**, o Windows SmartScreen mostra um aviso na
  primeira instalação (o update em si funciona normalmente). Para remover o
  aviso seria preciso um certificado de assinatura de código (pago).
- Sempre incremente a versão; o updater compara a versão do `latest.yml` com a
  instalada.

## Onde testar
- Em `npm start` (dev) o auto-update **não roda** (só no `.exe` empacotado).
- Para testar de verdade: publique a 1.0.0, instale, publique a 1.0.1 e abra o
  app instalado — ele deve atualizar.
