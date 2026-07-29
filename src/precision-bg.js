"use strict";
// Fundo animado global (Vanta NET sobre three.js).
// Fica atras de tudo — inclusive da sidebar — e so aparece nas telas de
// precisao (Mouse / Teclado). Sobe na primeira vez que uma delas e aberta:
// quem usa o plano full nunca paga o custo. Sem three.js/vanta (offline) as
// telas funcionam normal, so sem o fundo.
(function () {
  const el = document.getElementById("app-bg");
  if (!el) return;

  const TELAS = ["screen-precision", "screen-teclado"];
  let iniciado = false;

  function telaDePrecisao() {
    const ativa = document.querySelector(".screen.active");
    return !!ativa && TELAS.includes(ativa.id);
  }

  function tick() {
    requestAnimationFrame(tick);
    const mostrar = telaDePrecisao();
    document.body.classList.toggle("bg-on", mostrar);

    if (iniciado || !mostrar) return;
    if (!window.VANTA || !window.VANTA.NET || !window.THREE) return; // ainda carregando
    iniciado = true;
    try {
      window.VANTA.NET({
        el: el,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1,
        scaleMobile: 1,
        color: 0xe10600,
        backgroundColor: 0x0a0a0c,
        // poucos pontos e bem espacados: fundo limpo, so uma malha sutil
        points: 4,
        maxDistance: 17,
        spacing: 26,
      });
    } catch (e) {
      /* fundo e opcional */
    }
  }

  if (document.readyState !== "loading") tick();
  else window.addEventListener("DOMContentLoaded", tick);
})();
