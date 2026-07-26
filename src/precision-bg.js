"use strict";
// Fundo animado das telas de precisao (Vanta NET sobre three.js).
// Cada tela (Mouse / Teclado) tem o seu, e so sobe na primeira vez que a tela
// e aberta: quem usa o plano full nunca paga o custo. Se o three.js/vanta nao
// carregar (offline), as telas funcionam normal, so sem o fundo.
(function () {
  const nodes = Array.prototype.map.call(
    document.querySelectorAll(".pf-bg"),
    (el) => ({ el: el, screen: el.closest(".screen"), on: false }),
  );
  if (!nodes.length) return;

  function tick() {
    requestAnimationFrame(tick);
    if (!window.VANTA || !window.VANTA.NET || !window.THREE) return; // ainda carregando
    for (const n of nodes) {
      if (n.on || !n.screen || !n.screen.classList.contains("active")) continue;
      n.on = true;
      try {
        window.VANTA.NET({
          el: n.el,
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
  }

  if (document.readyState !== "loading") tick();
  else window.addEventListener("DOMContentLoaded", tick);
})();
