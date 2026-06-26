# Precision Fix

Painel desktop (Electron / JavaScript) que aplica otimizacoes de Windows
voltadas pra GTA / FiveM. Cada tweak tem botao **Aplicar** e **Reverter**,
e o app salva o estado original antes de mexer em qualquer coisa.

> Aviso: estes tweaks mexem em registro do Windows, `bcdedit` e energia.
> Sao reversiveis pelo proprio app, mas crie um **ponto de restauracao**
> antes de usar pela primeira vez. Use por sua conta e risco.

## O que cada botao faz

| Botao | O que faz | Onde mexe |
|-------|-----------|-----------|
| Tracking | Prioridade de threads da CPU | `Win32PrioritySeparation` = 38 |
| Sensi | Curva MarkC 1:1 + desliga aceleracao do mouse | `HKCU\Control Panel\Mouse` (curvas X/Y, thresholds) |
| Sensi X/Y | Uniformiza sens. horizontal/vertical (6/11) | `MouseSensitivity` = 10 |
| Flick | Tempo de hover do mouse + desativa suspensao USB | `MouseHoverTime` + `powercfg` USB |
| Boost FiveM | Prioridade de CPU Alta pro jogo | IFEO `CpuPriorityClass` = 3 (GTA5.exe / FiveM.exe) |
| 0.5ms | Timers do Kernel | `bcdedit` disabledynamictick / useplatformtick / tscsyncpolicy |
| Registros Mouse | Fila de dados do mouse | `mouclass\MouseDataQueueSize` = 20 |
| ISLC | Drivers fixos na RAM + limpa standby list | `DisablePagingExecutive` + EmptyStandbyList.exe |
| FilterKeys | Remove atraso de repeticao do teclado | `Keyboard Response` + `KeyboardDelay/Speed` |
| Flags (GPU) | Prioridade de GPU pra jogos | MMCSS tarefa `Games` |
| Accessibility | Bloqueia StickyKeys / ToggleKeys | `Accessibility\StickyKeys` etc. |

## Pre-requisitos

- Windows 10/11
- Node.js LTS (https://nodejs.org)
- Rodar como **Administrador** (o app se reinicia pedindo UAC sozinho)

## Passo a passo

1. Baixe o `EmptyStandbyList.exe` e coloque na pasta `resources/`
   (veja `resources/COLOQUE_AQUI_EmptyStandbyList.txt`).

2. Instale as dependencias:
   ```
   npm install
   ```

3. Teste rodando direto (vai pedir permissao de admin):
   ```
   npm start
   ```

4. Gere o `.exe`:
   ```
   npm run dist
   ```
   Os instaladores e a versao portatil ficam na pasta `release/`:
   - `Precision Fix Setup x.x.x.exe`  (instalador)
   - `Precision Fix x.x.x.exe`        (portatil, roda direto)

### Icone (opcional)
Coloque um `icon.ico` (256x256) em `build/icon.ico` antes do `npm run dist`.
Se nao tiver, remova a linha `"icon"` do `package.json`.

## Reverter
Cada card tem o botao **Reverter**, e o topo tem **Reverter tudo**.
A reversao usa o backup salvo em
`%APPDATA%\Precision Fix\precision-fix-backup.json`.
Os tweaks de `0.5ms` (bcdedit) voltam aos valores padrao do Windows.

## Estrutura
```
precision-fix/
  main.js          processo principal (admin, IPC)
  preload.js       ponte segura renderer <-> main
  lib/
    runner.js      executa comandos / le e grava registro
    backup.js      salva e restaura estado original
    tweaks.js      definicao dos 11 tweaks + motor apply/revert
  src/
    index.html     interface
    renderer.js    logica dos botoes
    styles.css     estilo
  resources/       EmptyStandbyList.exe vai aqui
  build/           icon.ico (opcional)
```
