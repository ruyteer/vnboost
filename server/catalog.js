"use strict";

const MARKC_X =
  "0000000000000000" + "C0CC0C0000000000" + "8099190000000000" +
  "4066260000000000" + "0033330000000000";
const MARKC_Y =
  "0000000000000000" + "0000380000000000" + "0000700000000000" +
  "0000A80000000000" + "0000E00000000000";


const HKCU_MOUSE = "HKCU\\Control Panel\\Mouse";
const HKCU_KBD = "HKCU\\Control Panel\\Keyboard";
const HKCU_ACC = "HKCU\\Control Panel\\Accessibility";
const MMCSS = "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile";
const GAMES_TASK = MMCSS + "\\Tasks\\Games";
const IFEO = "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options";

// ===========================================================================
// TWEAKS  (cat: precision | windows | system)
//   reg[]     -> backup/revert automatico
//   cmds[]    -> comandos extras de aplicacao
//   revert[]  -> comandos de reversao
//   special   -> rotina especial ('standbylist' | 'ramfull')
//   action    -> true = acao unica (so botao Executar, sem reverter)
//   confirm   -> texto de confirmacao antes de executar
//   note      -> aviso exibido no card
// ===========================================================================
const TWEAKS = [
  // ---------------- PRECISION (os originais) ----------------
  { id: "tracking", cat: "precision", name: "Tracking",
    desc: "Altera prioridade de threads de CPU (Win32PrioritySeparation).",
    reg: [{ path: "HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl",
      name: "Win32PrioritySeparation", type: "REG_DWORD", data: "38" }] },

  { id: "sensi", cat: "precision", name: "Sensi",
    desc: "Curva MarkC 1:1 (resposta fisica) e desliga a aceleracao do mouse.",
    reg: [
      { path: HKCU_MOUSE, name: "MouseSpeed", type: "REG_SZ", data: "0" },
      { path: HKCU_MOUSE, name: "MouseThreshold1", type: "REG_SZ", data: "0" },
      { path: HKCU_MOUSE, name: "MouseThreshold2", type: "REG_SZ", data: "0" },
      { path: HKCU_MOUSE, name: "SmoothMouseXCurve", type: "REG_BINARY", data: MARKC_X },
      { path: HKCU_MOUSE, name: "SmoothMouseYCurve", type: "REG_BINARY", data: MARKC_Y },
    ] },

  { id: "sensixy", cat: "precision", name: "Sensi X/Y",
    desc: "Uniformiza a sensibilidade horizontal e vertical (sens neutra 6/11).",
    reg: [{ path: HKCU_MOUSE, name: "MouseSensitivity", type: "REG_SZ", data: "10" }] },

  { id: "flick", cat: "precision", name: "Flick",
    desc: "Ajusta o tempo de hover do mouse e desativa a suspensao seletiva de USB.",
    reg: [{ path: HKCU_MOUSE, name: "MouseHoverTime", type: "REG_SZ", data: "10" }],
    cmds: [
      'powercfg /SETACVALUEINDEX SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0',
      'powercfg /SETDCVALUEINDEX SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0',
      'powercfg /S SCHEME_CURRENT',
    ],
    revert: [
      'powercfg /SETACVALUEINDEX SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 1',
      'powercfg /SETDCVALUEINDEX SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 1',
      'powercfg /S SCHEME_CURRENT',
    ] },

  { id: "boostfivem", cat: "precision", name: "Boost FiveM",
    desc: "Prioridade de CPU Alta para GTA5.exe e FiveM.exe.",
    reg: [
      { path: IFEO + "\\GTA5.exe\\PerfOptions", name: "CpuPriorityClass", type: "REG_DWORD", data: "3" },
      { path: IFEO + "\\FiveM.exe\\PerfOptions", name: "CpuPriorityClass", type: "REG_DWORD", data: "3" },
    ] },

  { id: "halfms", cat: "precision", name: "0.5ms",
    desc: "Ajusta os timers do Kernel via bcdedit (dynamic tick / platform tick / TSC).",
    cmds: [
      "bcdedit /set disabledynamictick yes",
      "bcdedit /set useplatformtick yes",
      "bcdedit /set tscsyncpolicy Enhanced",
    ],
    revert: [
      "bcdedit /set disabledynamictick no",
      "bcdedit /deletevalue useplatformtick",
      "bcdedit /deletevalue tscsyncpolicy",
    ],
    note: "Precisa reiniciar o PC para valer." },

  { id: "mouseregs", cat: "precision", name: "Registros Mouse",
    desc: "Ajusta o tamanho da fila de dados do mouse (MouseDataQueueSize).",
    reg: [{ path: "HKLM\\SYSTEM\\CurrentControlSet\\Services\\mouclass\\Parameters",
      name: "MouseDataQueueSize", type: "REG_DWORD", data: "20" }],
    note: "Precisa reiniciar o PC para valer." },

  { id: "islc", cat: "precision", name: "ISLC",
    desc: "Impede paginacao de drivers na RAM (DisablePagingExecutive) e limpa a standby list.",
    reg: [{ path: "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management",
      name: "DisablePagingExecutive", type: "REG_DWORD", data: "1" }],
    special: "standbylist" },

  { id: "filterkeys", cat: "precision", name: "FilterKeys",
    desc: "Remove o atraso fisico de repeticao do teclado e desliga o FilterKeys.",
    reg: [
      { path: HKCU_ACC + "\\Keyboard Response", name: "Flags", type: "REG_SZ", data: "122" },
      { path: HKCU_ACC + "\\Keyboard Response", name: "DelayBeforeAcceptance", type: "REG_SZ", data: "0" },
      { path: HKCU_ACC + "\\Keyboard Response", name: "AutoRepeatDelay", type: "REG_SZ", data: "0" },
      { path: HKCU_ACC + "\\Keyboard Response", name: "AutoRepeatRate", type: "REG_SZ", data: "0" },
      { path: HKCU_KBD, name: "KeyboardDelay", type: "REG_SZ", data: "0" },
      { path: HKCU_KBD, name: "KeyboardSpeed", type: "REG_SZ", data: "31" },
    ] },

  { id: "flags", cat: "precision", name: "Flags (GPU)",
    desc: "Ajusta a prioridade da GPU para processos de jogos (MMCSS - tarefa Games).",
    reg: [
      { path: GAMES_TASK, name: "GPU Priority", type: "REG_DWORD", data: "8" },
      { path: GAMES_TASK, name: "Priority", type: "REG_DWORD", data: "6" },
      { path: GAMES_TASK, name: "Scheduling Category", type: "REG_SZ", data: "High" },
      { path: GAMES_TASK, name: "SFIO Priority", type: "REG_SZ", data: "High" },
      { path: MMCSS, name: "SystemResponsiveness", type: "REG_DWORD", data: "10" },
    ] },

  { id: "accessibility", cat: "precision", name: "Accessibility",
    desc: "Bloqueia StickyKeys, ToggleKeys e atalhos inconvenientes.",
    reg: [
      { path: HKCU_ACC + "\\StickyKeys", name: "Flags", type: "REG_SZ", data: "506" },
      { path: HKCU_ACC + "\\ToggleKeys", name: "Flags", type: "REG_SZ", data: "58" },
      { path: HKCU_ACC + "\\Keyboard Response", name: "Flags", type: "REG_SZ", data: "122" },
    ] },

  { id: "kbdqueue", cat: "precision", name: "Registros Teclado",
    desc: "Reduz a fila de dados do teclado (KeyboardDataQueueSize) para menos latencia.",
    reg: [{ path: "HKLM\\SYSTEM\\CurrentControlSet\\Services\\kbdclass\\Parameters", name: "KeyboardDataQueueSize", type: "REG_DWORD", data: "20" }],
    note: "Precisa reiniciar o PC para valer." },

  { id: "kbresponse", cat: "precision", name: "Resposta do Teclado",
    desc: "Repeticao instantanea e menus sem atraso (afeta digitacao/menus, nao o WASD).",
    reg: [
      { path: "HKCU\\Control Panel\\Keyboard", name: "KeyboardDelay", type: "REG_SZ", data: "0" },
      { path: "HKCU\\Control Panel\\Keyboard", name: "KeyboardSpeed", type: "REG_SZ", data: "31" },
      { path: "HKCU\\Control Panel\\Desktop", name: "MenuShowDelay", type: "REG_SZ", data: "0" },
    ] },

  { id: "hags", cat: "precision", name: "GPU Scheduling (HAGS)",
    desc: "Liga o agendamento de GPU por hardware, que pode reduzir a latencia de entrada.",
    reg: [{ path: "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers", name: "HwSchMode", type: "REG_DWORD", data: "2" }],
    note: "Precisa reiniciar e GPU compativel. Se piorar a sensacao, reverta." },

  { id: "fse", cat: "precision", name: "Otimizar Fullscreen (FSE)",
    desc: "Ajusta o comportamento de tela cheia exclusiva para reduzir input lag.",
    reg: [
      { path: "HKCU\\System\\GameConfigStore", name: "GameDVR_FSEBehaviorMode", type: "REG_DWORD", data: "2" },
      { path: "HKCU\\System\\GameConfigStore", name: "GameDVR_DXGIHonorFSEWindowsCompatible", type: "REG_DWORD", data: "1" },
      { path: "HKCU\\System\\GameConfigStore", name: "GameDVR_HonorUserFSEBehaviorMode", type: "REG_DWORD", data: "1" },
      { path: "HKCU\\System\\GameConfigStore", name: "GameDVR_EFSEFeatureFlags", type: "REG_DWORD", data: "0" },
    ] },

  { id: "nagle", cat: "precision", name: "Rede: Nagle OFF",
    desc: "Desativa o algoritmo de Nagle nas interfaces de rede (melhora o hit-registration no FiveM).",
    special: "nagle",
    note: "Reduz latencia de pacotes pequenos. Reverter restaura o padrao." },

  // ---------------- WINDOWS ----------------
  { id: "energia", cat: "windows", name: "Otimizar Energia",
    desc: "Cria/ativa plano de Alto Desempenho e desativa o idle do processador.",
    cmds: [
      "powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61",
      "powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR IdleDisable 0",
      "powercfg /setactive SCHEME_CURRENT",
    ],
    revert: ["powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e"],
    note: "Reverter volta ao plano Balanceado." },

  { id: "efeitos", cat: "windows", name: "Desat. Efeitos Visuais",
    desc: "Desliga animacoes, transparencia e efeitos para ganhar desempenho.",
    reg: [
      { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects", name: "VisualFXSetting", type: "REG_DWORD", data: "2" },
      { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize", name: "EnableTransparency", type: "REG_DWORD", data: "0" },
      { path: "HKCU\\Control Panel\\Desktop", name: "UserPreferencesMask", type: "REG_BINARY", data: "9012038010000000" },
      { path: "HKCU\\Control Panel\\Desktop", name: "VisualFXSetting", type: "REG_DWORD", data: "2" },
    ] },

  { id: "appsbg", cat: "windows", name: "Desat. Apps 2o Plano",
    desc: "Impede aplicativos de rodarem em segundo plano.",
    reg: [
      { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications", name: "GlobalUserDisabled", type: "REG_DWORD", data: "1" },
      { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced", name: "Start_TrackProgs", type: "REG_DWORD", data: "0" },
    ] },

  { id: "servicos", cat: "windows", name: "Desat. Servicos Inuteis",
    desc: "Desativa WerSvc, DiagTrack, dmwappushservice, WbioSrvc e Spooler.",
    cmds: [
      "sc stop WerSvc", "sc config WerSvc start= disabled",
      "sc stop DiagTrack", "sc config DiagTrack start= disabled",
      "sc stop dmwappushservice", "sc config dmwappushservice start= disabled",
      "sc stop WbioSrvc", "sc config WbioSrvc start= disabled",
      "sc stop Spooler", "sc config Spooler start= disabled",
    ],
    revert: [
      "sc config WerSvc start= demand",
      "sc config DiagTrack start= auto",
      "sc config dmwappushservice start= demand",
      "sc config WbioSrvc start= demand",
      "sc config Spooler start= auto", "sc start Spooler",
    ],
    note: "Desativa o Spooler (impressao). Reverter religa tudo." },

  { id: "gamebar", cat: "windows", name: "Otimizar GameBar",
    desc: "Desliga GameDVR/Game Bar e a captura em segundo plano.",
    reg: [
      { path: "HKCU\\System\\GameConfigStore", name: "GameDVR_Enabled", type: "REG_DWORD", data: "0" },
      { path: "HKCU\\System\\GameConfigStore", name: "GameDVR_FSEBehaviorMode", type: "REG_DWORD", data: "2" },
      { path: "HKCU\\Software\\Microsoft\\GameBar", name: "ShowStartupPanel", type: "REG_DWORD", data: "0" },
      { path: "HKCU\\Software\\Microsoft\\GameBar", name: "UseNexusForGameBarEnabled", type: "REG_DWORD", data: "0" },
      { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR", name: "AppCaptureEnabled", type: "REG_DWORD", data: "0" },
    ] },

  { id: "werror", cat: "windows", name: "Desat. Relatorios de Erro",
    desc: "Desativa o Windows Error Reporting.",
    reg: [{ path: "HKLM\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting", name: "Disabled", type: "REG_DWORD", data: "1" }],
    cmds: ["sc stop WerSvc", "sc config WerSvc start= disabled"],
    revert: ["sc config WerSvc start= demand"] },

  { id: "telemetria", cat: "windows", name: "Desat. Telemetria",
    desc: "Bloqueia envio de dados, anuncios e conteudo de consumidor.",
    reg: [
      { path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection", name: "AllowTelemetry", type: "REG_DWORD", data: "0" },
      { path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System", name: "AllowAppDataCollection", type: "REG_DWORD", data: "0" },
      { path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AdvertisingInfo", name: "DisableWindowsAdvertising", type: "REG_DWORD", data: "1" },
      { path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent", name: "DisableMicrosoftConsumerExperience", type: "REG_DWORD", data: "1" },
      { path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate", name: "DoNotConnectToWindowsUpdateInternetLocations", type: "REG_DWORD", data: "1" },
    ] },

  { id: "hibernacao", cat: "windows", name: "Desat. Hibernacao",
    desc: "Desativa a hibernacao e libera espaco do hiberfil.sys.",
    cmds: ["powercfg -h off"],
    revert: ["powercfg -h on"] },

  { id: "memcomp", cat: "windows", name: "Desat. Compressao de Memoria",
    desc: "Desliga a compressao de memoria do Windows.",
    cmds: ['powershell -Command "Disable-MMAgent -MemoryCompression"'],
    revert: ['powershell -Command "Enable-MMAgent -MemoryCompression"'],
    note: "Indicado para PCs com mais de 8GB de RAM." },

  { id: "indexacao", cat: "windows", name: "Desat. Indexacao",
    desc: "Desativa o servico de indexacao de pesquisa (WSearch).",
    cmds: ['net stop "Windows Search"', "sc config WSearch start= disabled"],
    revert: ["sc config WSearch start= delayed-auto", "sc start WSearch"] },

  { id: "menuiniciar", cat: "windows", name: "Otimizar Menu Iniciar",
    desc: "Desliga pesquisa online/Bing e sugestoes do menu iniciar.",
    reg: [
      { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search", name: "BingSearchEnabled", type: "REG_DWORD", data: "0" },
      { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search", name: "CortanaConsent", type: "REG_DWORD", data: "0" },
      { path: "HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer", name: "DisableSearchBoxSuggestions", type: "REG_DWORD", data: "1" },
      { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search", name: "SearchboxTaskbarMode", type: "REG_DWORD", data: "0" },
    ] },

  { id: "cortana", cat: "windows", name: "Desat. Cortana",
    desc: "Desativa a Cortana via politica do sistema.",
    reg: [{ path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search", name: "AllowCortana", type: "REG_DWORD", data: "0" }] },

  { id: "prefetch", cat: "windows", name: "Desat. Prefetch/Superfetch",
    desc: "Desliga Prefetcher/Superfetch e o servico SysMain.",
    reg: [
      { path: "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters", name: "EnablePrefetcher", type: "REG_DWORD", data: "0" },
      { path: "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters", name: "EnableSuperfetch", type: "REG_DWORD", data: "0" },
    ],
    cmds: ["sc stop SysMain", "sc config SysMain start= disabled"],
    revert: ["sc config SysMain start= auto", "sc start SysMain"],
    note: "Indicado para HDD. Em SSD, so se houver uso de disco 100%." },

  { id: "priocpugpu", cat: "windows", name: "Prioridade CPU/GPU",
    desc: "Aumenta a prioridade de CPU/GPU para jogos (MMCSS, SystemResponsiveness=0).",
    reg: [
      { path: MMCSS, name: "SystemResponsiveness", type: "REG_DWORD", data: "0" },
      { path: GAMES_TASK, name: "GPU Priority", type: "REG_DWORD", data: "8" },
      { path: GAMES_TASK, name: "Priority", type: "REG_DWORD", data: "6" },
      { path: GAMES_TASK, name: "Scheduling Category", type: "REG_SZ", data: "High" },
      { path: GAMES_TASK, name: "SFIO Priority", type: "REG_SZ", data: "High" },
    ] },

  { id: "prioforeground", cat: "windows", name: "Prioridade Foreground",
    desc: "Prioriza a janela em foco (Win32PrioritySeparation=38 + tarefa Games).",
    reg: [
      { path: "HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl", name: "Win32PrioritySeparation", type: "REG_DWORD", data: "38" },
      { path: GAMES_TASK, name: "GPU Priority", type: "REG_DWORD", data: "8" },
      { path: GAMES_TASK, name: "Priority", type: "REG_DWORD", data: "6" },
      { path: GAMES_TASK, name: "Scheduling Category", type: "REG_SZ", data: "High" },
    ] },

  // ---------------- SYSTEM (acoes) ----------------
  { id: "ping", cat: "system", name: "Melhorar Ping/DNS",
    desc: "Limpa o cache DNS e renova o IP (flushdns + release + renew).",
    cmds: ["ipconfig /flushdns", "ipconfig /release", "ipconfig /renew"],
    action: true, note: "A conexao cai por alguns segundos." },

  { id: "ramfull", cat: "system", name: "Limpar Memoria RAM",
    desc: "Limpeza completa: working sets + modified page list + standby list.",
    special: "ramfull", action: true },

  { id: "explorer", cat: "system", name: "Reiniciar Explorer",
    desc: "Reinicia o Windows Explorer (resolve travadas da barra/desktop).",
    cmds: ["taskkill /f /im explorer.exe", "start explorer.exe"],
    action: true },

  { id: "limparcache", cat: "system", name: "Limpar Cache do Windows",
    desc: "Apaga temporarios, cache do Windows Update e esvazia a lixeira.",
    cmds: [
      'del /s /f /q "%windir%\\Temp\\*.*"',
      'del /s /f /q "%temp%\\*.*"',
      'del /s /f /q "%APPDATA%\\Microsoft\\Windows\\Recent\\*.*"',
      "ipconfig /flushdns",
      "net stop wuauserv",
      'del /s /f /q "%windir%\\SoftwareDistribution\\Download\\*.*"',
      "net start wuauserv",
      'powershell -NoProfile -Command "Clear-RecycleBin -Force"',
    ],
    action: true },

  { id: "sfc", cat: "system", name: "Verificar/Arrumar Arquivos",
    desc: "Roda DISM RestoreHealth e SFC /scannow para reparar o sistema.",
    cmds: ["DISM /Online /Cleanup-Image /RestoreHealth", "sfc /scannow"],
    action: true, note: "Demora varios minutos. Aguarde terminar." },

  { id: "restart", cat: "system", name: "Reiniciar PC",
    desc: "Reinicia o computador agora (aplica os tweaks que precisam de reboot).",
    cmds: ["shutdown /r /t 0"],
    action: true, confirm: "Isso vai REINICIAR o PC agora. Salve tudo antes. Continuar?" },
];

// ===========================================================================
// JOGOS - prioridade de CPU (IFEO CpuPriorityClass = 3)
// ===========================================================================
const GAMES = [
  { name: "Fortnite", exes: ["FortniteClient-Win64-Shipping.exe"] },
  { name: "GTA V", exes: ["GTA5.exe"] },
  { name: "FiveM", exes: ["FiveM_b2372_GTAProcess.exe"] },
  { name: "CS2", exes: ["cs2.exe"] },
  { name: "Minecraft", exes: ["javaw.exe"] },
  { name: "Valorant", exes: ["VALORANT-Win64-Shipping.exe"] },
  { name: "League of Legends", exes: ["LeagueClient.exe"] },
  { name: "Warzone / CoD", exes: ["cod.exe"] },
  { name: "Apex Legends", exes: ["r5apex.exe"] },
  { name: "Roblox", exes: ["RobloxPlayerBeta.exe"] },
  { name: "God of War", exes: ["GoW.exe"] },
  { name: "God of War Ragnarok", exes: ["GoWRagnarok.exe"] },
  { name: "MTA: San Andreas", exes: ["Multi Theft Auto.exe", "gta_sa.exe"] },
  { name: "Euro Truck Simulator 1", exes: ["eurotrucks.exe"] },
  { name: "Euro Truck Simulator 2", exes: ["ets2.exe"] },
  { name: "Rainbow Six Siege", exes: ["RainbowSix.exe"] },
  { name: "Cult of the Lamb", exes: ["CultOfTheLamb.exe"] },
  { name: "ULTRAKILL", exes: ["ULTRAKILL.exe"] },
  { name: "Blood Strike", exes: ["BloodStrike.exe"] },
  { name: "Arena Breakout", exes: ["ArenaBreakout.exe"] },
  { name: "Resident Evil 4 Remake", exes: ["re4.exe"] },
  { name: "Resident Evil 2 Remake", exes: ["re2.exe"] },
  { name: "Resident Evil Village", exes: ["re8.exe"] },
  { name: "Free Fire (BlueStacks)", exes: ["HD-Player.exe"] },
  { name: "Battlefield 2042", exes: ["BF2042.exe"] },
  { name: "Battlefield 4", exes: ["bf4.exe"] },
  { name: "Battlefield 6", exes: ["BF6.exe"] },
  { name: "The Last of Us I & II", exes: ["tlou-i.exe", "tlou-ii.exe"] },
  { name: "PUBG", exes: ["tslgame.exe"] },
  { name: "Rocket League", exes: ["RocketLeague.exe"] },
  { name: "Cyberpunk 2077", exes: ["Cyberpunk2077.exe"] },
  { name: "Terraria", exes: ["Terraria.exe"] },
  { name: "Red Dead Redemption 2", exes: ["RDR2.exe"] },
  { name: "Choo Choo Charles", exes: ["Charles.exe"] },
  { name: "Hell Let Loose", exes: ["HLL.exe"] },
  { name: "Farming Simulator 22", exes: ["FarmingSimulator2022.exe"] },
  { name: "Farming Simulator 25", exes: ["FarmingSimulator2025.exe"] },
  { name: "Hollow Knight", exes: ["hollow_knight.exe"] },
  { name: "Genshin Impact", exes: ["GenshinImpact.exe"] },
  { name: "Point Blank", exes: ["PointBlank.exe"] },
  { name: "My Summer Car", exes: ["mysummercar.exe"] },
  { name: "DayZ", exes: ["DayZ.exe"] },
  { name: "Street Fighter 6", exes: ["StreetFighter6.exe"] },
  { name: "Rust", exes: ["RustClient.exe"] },
  { name: "Chivalry 2", exes: ["Chivalry2-Win64-Shipping.exe"] },
  { name: "Subnautica", exes: ["Subnautica.exe"] },
  { name: "Left 4 Dead 1 & 2", exes: ["left4dead.exe", "left4dead2.exe"] },
  { name: "Marvel Rivals", exes: ["MarvelRivals.exe"] },
  { name: "Warface", exes: ["Warface.exe"] },
  { name: "Deadlock", exes: ["Deadlock.exe"] },
  { name: "Cuphead", exes: ["Cuphead.exe"] },
  { name: "Escape from Tarkov", exes: ["EscapeFromTarkov.exe"] },
  { name: "Death Stranding 1 & 2", exes: ["ds.exe", "DeathStranding2.exe"] },
  { name: "Poppy Playtime (todos)", exes: ["Poppy_Playtime.exe", "PoppyPlaytimeChapter4.exe", "PoppyPlaytimeChapter5.exe", "Playtime_Multiplayer.exe", "ProjectPlaytime.exe"] },
  { name: "Resident Evil Requiem", exes: ["re9.exe"] },
];

// ---- acessores ----
function metaList() {
  return TWEAKS.map((t) => ({
    id: t.id, cat: t.cat, name: t.name, desc: t.desc,
    action: !!t.action, confirm: t.confirm || null, note: t.note || null,
  }));
}
function gameNames() { return GAMES.map((g) => ({ name: g.name })); }
function instruction(id, op) {
  const t = TWEAKS.find((x) => x.id === id);
  if (!t) return null;
  if (op === "revert") return { id: t.id, name: t.name, action: !!t.action, revert: t.revert || [] };
  return { id: t.id, name: t.name, action: !!t.action, reg: t.reg || [], cmds: t.cmds || [], special: t.special || null };
}
function gameExes(name) {
  const g = GAMES.find((x) => x.name === name);
  return g ? g.exes : null;
}

module.exports = { metaList, gameNames, instruction, gameExes };
