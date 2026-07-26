"use strict";
// Fundo animado da tela PrecisionFix (Vanta NET sobre three.js).
// Sobe so na primeira vez que a tela e aberta: quem usa o plano full nunca
// paga o custo. Se o three.js/vanta nao carregar (offline), a tela funciona
// normal, so sem o fundo.
(function () {
  const el = document.getElementById("pf-bg");
  const screen = document.getElementById("screen-precision");
  if (!el || !screen) return;

  let on = false;

  function visible() {
    return screen.classList.contains("active") && !screen.hidden;
  }

  function tick() {
    requestAnimationFrame(tick);
    if (on || !visible()) return;
    if (!window.VANTA || !window.VANTA.NET || !window.THREE) return; // ainda carregando
    on = true;
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
