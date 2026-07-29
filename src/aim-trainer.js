"use strict";
/* ==========================================================================
   TREINO DE MIRA + DIAGNOSTICO DO MOUSE

   A tela usa pointer lock: o cursor do Windows some e a mira e desenhada por
   nos a partir do movimento cru (movementX/Y). Isso e o que torna o treino
   parecido com o jogo — e, de quebra, e a unica forma de ler o mouse sem a
   interferencia da aceleracao/curva do ponteiro do Windows.

   O diagnostico roda junto com o treino, sem etapa separada: enquanto a
   pessoa mira, medimos o ritmo dos relatorios do mouse e o tempo de frame.
   ========================================================================== */
(function () {
  const cv = document.getElementById("aimCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d", { alpha: false });

  const $ = (s) => document.querySelector(s);
  const LS_SENS = "vn_aim_sens", LS_REC = "vn_aim_recordes";

  // ---------------- modos ----------------
  const MODOS = {
    flick: {
      nome: "Flick", raio: 26,
      dica: "Um alvo por vez, em qualquer lugar. Treina o estalo do pulso.",
    },
    precisao: {
      nome: "Precisão", raio: 12, perto: true,
      dica: "Alvos pequenos e proximos. Treina o micro-ajuste fino.",
    },
    tracking: {
      nome: "Tracking", raio: 38, movel: true,
      dica: "Alvo em movimento. Vale o tempo que voce fica em cima dele.",
    },
  };
  const DURACOES = [30, 60];

  // ---------------- estado ----------------
  let modo = "flick", duracao = 30;
  let sens = parseFloat(localStorage.getItem(LS_SENS) || "1") || 1;

  let rodando = false, travado = false, raf = 0;
  let restante = 0, ultimoFrame = 0, ultimoDiag = 0;
  let mira = { x: 0, y: 0 };
  let alvo = null;
  let acertos = 0, erros = 0, reacoes = [], msNoAlvo = 0;
  let W = 0, H = 0; // tamanho logico (CSS px)

  // ---------------- diagnostico ----------------
  // deltas = intervalo entre relatorios do mouse; frames = intervalo de rAF.
  const diag = { deltas: [], frames: [], ultimoRaw: 0 };
  function zerarDiag() { diag.deltas.length = 0; diag.frames.length = 0; diag.ultimoRaw = 0; }

  const media = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  function mediana(a) {
    if (!a.length) return 0;
    const s = Array.prototype.slice.call(a).sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  }
  // taxas que os mouses realmente usam — a medida cai perto de uma delas
  const HZ_PADRAO = [125, 250, 500, 1000, 2000, 4000, 8000];
  const hzPadrao = (hz) => HZ_PADRAO.reduce((a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a));

  function registrarRaw(e) {
    if (!rodando) return;
    // comparacao estrita: se o evento nao trouxer movementX (undefined), ele
    // ainda conta — pointerrawupdate so dispara com entrada real. Usar
    // `|| 0` aqui descartaria tudo e o diagnostico nunca sairia do zero.
    if (e.movementX === 0 && e.movementY === 0) return;
    const t = performance.now();
    if (diag.ultimoRaw) {
      const d = t - diag.ultimoRaw;
      // >30ms = a pessoa parou a mao no meio; nao e intervalo de polling
      if (d >= 0.05 && d <= 30) diag.deltas.push(d);
    }
    diag.ultimoRaw = t;
  }

  function analisar() {
    const d = mediana(diag.deltas);
    const hz = d ? 1000 / d : 0;
    const nominal = hz ? hzPadrao(hz) : 0;
    // quantos relatorios sairam do ritmo em mais de 50% do intervalo tipico
    const fora = d ? diag.deltas.filter((x) => Math.abs(x - d) > d * 0.5).length : 0;
    const instavel = diag.deltas.length ? fora / diag.deltas.length : 0;

    const fMedio = media(diag.frames);
    const piores = Array.prototype.slice.call(diag.frames).sort((a, b) => b - a)
      .slice(0, Math.max(1, Math.round(diag.frames.length * 0.01)));
    const f1 = media(piores);

    return {
      amostras: diag.deltas.length,
      intervalo: d, hz, nominal, instavel,
      fMedio, f1,
      // media do mouse (meio intervalo) + o frame. Nao inclui monitor/GPU.
      latencia: (d ? d / 2 : 0) + fMedio,
    };
  }

  // ---------------- canvas ----------------
  function redimensionar() {
    const r = cv.parentElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mira.x = Math.min(mira.x || W / 2, W);
    mira.y = Math.min(mira.y || H / 2, H);
    if (!rodando) desenhar();
  }
  if (window.ResizeObserver) new ResizeObserver(redimensionar).observe(cv.parentElement);
  window.addEventListener("resize", redimensionar);

  // ---------------- alvos ----------------
  function novoAlvo() {
    const m = MODOS[modo];
    const pad = m.raio + 14;
    let x, y;
    if (m.perto && alvo) {
      // fica perto do anterior pra forcar o ajuste fino em vez do giro grande
      const ang = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 150;
      x = Math.min(W - pad, Math.max(pad, alvo.x + Math.cos(ang) * dist));
      y = Math.min(H - pad, Math.max(pad, alvo.y + Math.sin(ang) * dist));
    } else {
      x = pad + Math.random() * (W - pad * 2);
      y = pad + Math.random() * (H - pad * 2);
    }
    const vel = m.movel ? 0.16 + Math.random() * 0.1 : 0;
    const ang = Math.random() * Math.PI * 2;
    alvo = { x, y, r: m.raio, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, nasceu: performance.now() };
  }

  function moverAlvo(dt) {
    if (!alvo || !MODOS[modo].movel) return;
    // pequena guinada aleatoria: sem isso o alvo vira linha reta previsivel
    alvo.vx += (Math.random() - 0.5) * 0.02;
    alvo.vy += (Math.random() - 0.5) * 0.02;
    const v = Math.hypot(alvo.vx, alvo.vy), max = 0.34;
    if (v > max) { alvo.vx = (alvo.vx / v) * max; alvo.vy = (alvo.vy / v) * max; }
    alvo.x += alvo.vx * dt; alvo.y += alvo.vy * dt;
    const pad = alvo.r + 8;
    if (alvo.x < pad || alvo.x > W - pad) { alvo.vx *= -1; alvo.x = Math.min(W - pad, Math.max(pad, alvo.x)); }
    if (alvo.y < pad || alvo.y > H - pad) { alvo.vy *= -1; alvo.y = Math.min(H - pad, Math.max(pad, alvo.y)); }
  }

  // ---------------- desenho ----------------
  function desenhar() {
    ctx.fillStyle = "#0b0b0e";
    ctx.fillRect(0, 0, W, H);

    // grade discreta so pra dar referencia espacial
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 64) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let y = 0; y <= H; y += 64) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();

    if (alvo) {
      const noAlvo = Math.hypot(mira.x - alvo.x, mira.y - alvo.y) <= alvo.r;
      ctx.save();
      ctx.shadowColor = "rgba(225,6,0,0.85)";
      ctx.shadowBlur = noAlvo ? 34 : 22;
      const g = ctx.createRadialGradient(alvo.x, alvo.y - alvo.r * 0.3, 2, alvo.x, alvo.y, alvo.r);
      g.addColorStop(0, noAlvo ? "#ff6b57" : "#ff3b30");
      g.addColorStop(1, noAlvo ? "#c41400" : "#8f0f00");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(alvo.x, alvo.y, alvo.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(alvo.x, alvo.y, alvo.r, 0, Math.PI * 2); ctx.stroke();
    }

    // mira
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(mira.x - 11, mira.y); ctx.lineTo(mira.x - 4, mira.y);
    ctx.moveTo(mira.x + 4, mira.y); ctx.lineTo(mira.x + 11, mira.y);
    ctx.moveTo(mira.x, mira.y - 11); ctx.lineTo(mira.x, mira.y - 4);
    ctx.moveTo(mira.x, mira.y + 4); ctx.lineTo(mira.x, mira.y + 11);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillRect(mira.x - 1, mira.y - 1, 2, 2);
  }

  // ---------------- HUD ----------------
  function hud() {
    const total = acertos + erros;
    $("#hudTempo").textContent = Math.max(0, Math.ceil(restante / 1000));
    if (MODOS[modo].movel) {
      $("#hudAcertos").textContent = (msNoAlvo / 1000).toFixed(1) + "s";
      $("#hudAcertosLbl").textContent = "no alvo";
      const decorrido = duracao * 1000 - restante;
      $("#hudPrec").textContent = decorrido > 0 ? Math.round((msNoAlvo / decorrido) * 100) + "%" : "—";
      $("#hudPrecLbl").textContent = "do tempo";
      $("#hudRt").textContent = "—";
    } else {
      $("#hudAcertos").textContent = acertos;
      $("#hudAcertosLbl").textContent = "acertos";
      $("#hudPrec").textContent = total ? Math.round((acertos / total) * 100) + "%" : "—";
      $("#hudPrecLbl").textContent = "precisão";
      $("#hudRt").textContent = reacoes.length ? Math.round(media(reacoes)) + "ms" : "—";
    }
  }

  function diagAoVivo() {
    const a = analisar();
    const el = $("#aimDiag");
    if (a.amostras < 40) {
      el.innerHTML = `<div class="diag-vazio">Mexa o mouse pra começar a medir…</div>`;
      return;
    }
    el.innerHTML = [
      linhaDiag("Taxa de relatório", Math.round(a.hz) + " Hz", a.nominal >= 500 ? "ok" : a.nominal >= 250 ? "warn" : "bad"),
      linhaDiag("Intervalo típico", a.intervalo.toFixed(2) + " ms", ""),
      linhaDiag("Instabilidade", Math.round(a.instavel * 100) + "%", a.instavel < 0.15 ? "ok" : a.instavel < 0.3 ? "warn" : "bad"),
      linhaDiag("Frame médio", a.fMedio.toFixed(1) + " ms", a.fMedio <= 12 ? "ok" : a.fMedio <= 18 ? "warn" : "bad"),
      linhaDiag("1% pior frame", a.f1.toFixed(1) + " ms", a.f1 < a.fMedio * 2.5 ? "ok" : "warn"),
      linhaDiag("Latência estimada", a.latencia.toFixed(1) + " ms", a.latencia <= 10 ? "ok" : a.latencia <= 16 ? "warn" : "bad"),
    ].join("");
  }
  const linhaDiag = (k, v, s) =>
    `<div class="diag-linha"><span>${k}</span><b class="${s}">${v}</b></div>`;

  // ---------------- loop ----------------
  function frame(agora) {
    if (!rodando) return;
    raf = requestAnimationFrame(frame);
    const dt = agora - ultimoFrame;
    ultimoFrame = agora;
    if (dt > 0 && dt < 250) diag.frames.push(dt);

    restante -= dt;
    if (restante <= 0) { terminar(); return; }

    moverAlvo(dt);
    if (MODOS[modo].movel && alvo && Math.hypot(mira.x - alvo.x, mira.y - alvo.y) <= alvo.r) msNoAlvo += dt;

    desenhar();
    hud();
    // 5x por segundo: o painel lateral remonta HTML, nao vale fazer por frame
    if (agora - ultimoDiag > 200) { ultimoDiag = agora; diagAoVivo(); }
  }

  // ---------------- sessao ----------------
  function comecar() {
    acertos = 0; erros = 0; reacoes = []; msNoAlvo = 0;
    restante = duracao * 1000;
    zerarDiag();
    mira.x = W / 2; mira.y = H / 2;
    alvo = null; novoAlvo();
    $("#aimFeedback").innerHTML = "";
    $("#aimOverlay").hidden = true;
    rodando = true;
    ultimoFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function terminar() {
    rodando = false;
    cancelAnimationFrame(raf);
    if (document.pointerLockElement === cv) document.exitPointerLock();
    const a = analisar();
    salvarRecorde();
    mostrarResultado(a);
    diagAoVivo();
  }

  function abortar() {
    if (!rodando) return;
    rodando = false;
    cancelAnimationFrame(raf);
    mostrarOverlay("Treino pausado", "Clique pra recomeçar do zero.");
  }

  function mostrarOverlay(titulo, texto) {
    $("#aimOverTitle").textContent = titulo;
    $("#aimOverText").innerHTML = texto;
    $("#aimOverlay").hidden = false;
  }

  // ---------------- recordes ----------------
  function getRecordes() { try { return JSON.parse(localStorage.getItem(LS_REC) || "{}"); } catch { return {}; } }
  function salvarRecorde() {
    const r = getRecordes();
    const chave = modo + "_" + duracao;
    const total = acertos + erros;
    const valor = MODOS[modo].movel
      ? Math.round((msNoAlvo / (duracao * 1000)) * 100)
      : Math.round(acertos * (total ? acertos / total : 0));
    if (!r[chave] || valor > r[chave]) { r[chave] = valor; localStorage.setItem(LS_REC, JSON.stringify(r)); return true; }
    return false;
  }

  // ---------------- resultado + conselhos ----------------
  function mostrarResultado(a) {
    const total = acertos + erros;
    const prec = total ? Math.round((acertos / total) * 100) : 0;
    const rec = getRecordes()[modo + "_" + duracao];

    const resumo = MODOS[modo].movel
      ? [["Tempo no alvo", (msNoAlvo / 1000).toFixed(1) + "s"],
         ["Aproveitamento", Math.round((msNoAlvo / (duracao * 1000)) * 100) + "%"],
         ["Recorde", (rec || 0) + "%"]]
      : [["Acertos", String(acertos)],
         ["Precisão", prec + "%"],
         ["Reação média", reacoes.length ? Math.round(media(reacoes)) + "ms" : "—"],
         ["Alvos/min", Math.round(acertos / (duracao / 60)) + ""],
         ["Recorde", String(rec || 0)]];

    const conselhos = aconselhar(a);
    $("#aimFeedback").innerHTML = `
      <div class="aim-resultado">
        <h3>Fim do treino — ${MODOS[modo].nome}</h3>
        <div class="aim-nums">${resumo.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join("")}</div>
      </div>
      <div class="aim-conselhos">${conselhos.map(cardConselho).join("")}</div>`;

    $("#aimFeedback").querySelectorAll("[data-tweak]").forEach((b) =>
      b.addEventListener("click", async () => {
        b.disabled = true;
        const ok = await (window.vnAplicarTweak ? window.vnAplicarTweak(b.dataset.tweak) : false);
        b.textContent = ok ? "APLICADO" : "FALHOU";
        if (!ok) b.disabled = false;
      }));

    mostrarOverlay("Treino concluído", "Veja o diagnóstico abaixo. Clique pra treinar de novo.");
  }

  const cardConselho = (c) => `
    <div class="conselho ${c.nivel}">
      <div class="conselho-top"><b>${c.titulo}</b><span class="conselho-tag">${
        c.nivel === "bad" ? "corrigir" : c.nivel === "warn" ? "atenção" : "ok"}</span></div>
      <p>${c.texto}</p>
      ${c.tweak ? `<button class="btn btn-primary btn-sm" data-tweak="${c.tweak}">${c.acao}</button>` : ""}
    </div>`;

  /* As mensagens abaixo so falam do que da pra medir por software. Click-to-photon
     (clique ate o pixel mudar) exige hardware; nao inventamos esse numero. */
  function aconselhar(a) {
    const out = [];

    if (a.amostras < 300) {
      out.push({ nivel: "warn", titulo: "Poucos dados de movimento",
        texto: "Treine uma sessão inteira mexendo o mouse pra medição do polling ficar confiável." });
      return out;
    }

    if (a.nominal <= 125) {
      out.push({ nivel: "bad", titulo: `Mouse reportando ~${a.nominal} Hz`,
        texto: `Cada relatório chega a cada ${a.intervalo.toFixed(1)} ms, o que sozinho já adiciona <b>~${(a.intervalo / 2).toFixed(1)} ms</b> de atraso médio. Suba o polling pra 1000 Hz no software do mouse (G HUB, Synapse, iCUE…). Isso é firmware do mouse — nenhum tweak de registro resolve.` });
    } else if (a.nominal <= 250) {
      out.push({ nivel: "warn", titulo: `Mouse reportando ~${a.nominal} Hz`,
        texto: `Dá pra melhorar: em 1000 Hz o atraso médio cai de ${(a.intervalo / 2).toFixed(1)} ms pra ~0,5 ms. Ajuste no software do mouse.` });
    } else {
      out.push({ nivel: "ok", titulo: `Polling em ~${a.nominal} Hz`,
        texto: `O mouse está reportando no ritmo certo (${a.intervalo.toFixed(2)} ms entre relatórios). Nada a fazer aqui.` });
    }

    if (a.instavel >= 0.3) {
      out.push({ nivel: "bad", titulo: "Polling instável",
        texto: `${Math.round(a.instavel * 100)}% dos relatórios chegaram fora do ritmo. Quase sempre é porta USB: tire de hub e de extensor, troque pra uma porta traseira e evite dividir o controlador com headset/webcam.`,
        tweak: "flick", acao: "DESLIGAR SUSPENSÃO DE USB" });
    } else if (a.instavel >= 0.15) {
      out.push({ nivel: "warn", titulo: "Pequena variação no polling",
        texto: `${Math.round(a.instavel * 100)}% dos relatórios saíram do ritmo. Costuma sumir trocando a porta USB ou desligando a suspensão seletiva.`,
        tweak: "flick", acao: "DESLIGAR SUSPENSÃO DE USB" });
    }

    if (a.fMedio > 18) {
      out.push({ nivel: "bad", titulo: `Painel rodando a ${Math.round(1000 / a.fMedio)} fps`,
        texto: `Frame médio de ${a.fMedio.toFixed(1)} ms. Se está assim aqui, no jogo está pior — vale rodar as otimizações de GPU e energia.`,
        tweak: "hags", acao: "APLICAR GPU SCHEDULING" });
    } else if (a.f1 > a.fMedio * 3) {
      out.push({ nivel: "warn", titulo: "Travadas de frame",
        texto: `O frame médio é ${a.fMedio.toFixed(1)} ms, mas o 1% pior chegou a ${a.f1.toFixed(1)} ms. Esse tipo de engasgo costuma vir do timer do kernel e da paginação de drivers.`,
        tweak: "halfms", acao: "APLICAR 0.5MS" });
    }

    out.push({ nivel: a.latencia <= 10 ? "ok" : a.latencia <= 16 ? "warn" : "bad",
      titulo: `Latência estimada: ${a.latencia.toFixed(1)} ms`,
      texto: `Soma do que dá pra medir daqui: metade do intervalo do mouse (${(a.intervalo / 2).toFixed(1)} ms) + o tempo de frame (${a.fMedio.toFixed(1)} ms). <b>Não inclui monitor, GPU nem o jogo</b> — medir o clique-até-o-pixel exige hardware externo, então isso é a parte do caminho que o PC controla.` });

    return out;
  }

  // ---------------- entrada ----------------
  document.addEventListener("pointerlockchange", () => {
    travado = document.pointerLockElement === cv;
    if (travado) { if (!rodando) comecar(); }
    else if (rodando) abortar();
  });

  cv.addEventListener("click", () => { if (!travado) cv.requestPointerLock(); });

  document.addEventListener("mousemove", (e) => {
    if (!travado || !rodando) return;
    mira.x = Math.min(W, Math.max(0, mira.x + (e.movementX || 0) * sens));
    mira.y = Math.min(H, Math.max(0, mira.y + (e.movementY || 0) * sens));
  });

  // pointerrawupdate nao passa pela juncao de eventos por frame — e o que
  // permite enxergar o ritmo real do mouse. Sem ele, cai pro mousemove.
  const eventoRaw = "onpointerrawupdate" in window ? "pointerrawupdate" : "mousemove";
  document.addEventListener(eventoRaw, registrarRaw);

  document.addEventListener("mousedown", (e) => {
    if (!travado || !rodando || e.button !== 0) return;
    if (MODOS[modo].movel) return; // tracking nao e por clique
    if (alvo && Math.hypot(mira.x - alvo.x, mira.y - alvo.y) <= alvo.r) {
      acertos++;
      reacoes.push(performance.now() - alvo.nasceu);
      novoAlvo();
    } else erros++;
  });

  // ---------------- controles ----------------
  function montarControles() {
    const m = $("#aimModos");
    m.innerHTML = "";
    Object.keys(MODOS).forEach((k) => {
      const b = document.createElement("button");
      b.className = "aim-opt" + (k === modo ? " on" : "");
      b.textContent = MODOS[k].nome;
      b.title = MODOS[k].dica;
      b.addEventListener("click", () => {
        modo = k;
        montarControles();
        $("#aimDica").textContent = MODOS[k].dica;
        if (rodando) abortar();
      });
      m.appendChild(b);
    });

    const d = $("#aimDur");
    d.innerHTML = "";
    DURACOES.forEach((s) => {
      const b = document.createElement("button");
      b.className = "aim-opt" + (s === duracao ? " on" : "");
      b.textContent = s + "s";
      b.addEventListener("click", () => { duracao = s; montarControles(); if (rodando) abortar(); });
      d.appendChild(b);
    });
  }

  const slider = $("#aimSens");
  slider.value = String(sens);
  $("#aimSensVal").textContent = sens.toFixed(2);
  slider.addEventListener("input", () => {
    sens = parseFloat(slider.value);
    $("#aimSensVal").textContent = sens.toFixed(2);
    localStorage.setItem(LS_SENS, String(sens));
  });

  montarControles();
  $("#aimDica").textContent = MODOS[modo].dica;
  diagAoVivo();

  // renderer avisa quando a tela entra/sai
  window.VNAim = {
    telaAtiva(ativa) {
      if (ativa) { redimensionar(); mostrarOverlay("Clique pra começar", "O cursor fica preso na área. <b>ESC</b> sai a qualquer momento."); }
      else if (rodando) { abortar(); if (document.pointerLockElement === cv) document.exitPointerLock(); }
    },
  };
})();
