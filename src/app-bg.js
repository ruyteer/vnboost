"use strict";
// Fundo animado do painel inteiro (Vanta NET sobre three.js): pontos ligados
// por linhas que reagem ao mouse. Fica atras de tudo — sidebar inclusive — e
// vale pra todas as telas, nao so as de precisao.
//
// Sem three.js/vanta (offline, por exemplo) o painel funciona normal, so sem
// o fundo: por isso nada aqui derruba a interface se falhar.
(function () {
  const el = document.getElementById("app-bg");
  if (!el) return;

  // a classe liga a opacidade pelo CSS, entao o fundo entra com fade
  document.body.classList.add("bg-on");

  let tentativas = 0;
  function iniciar() {
    if (!window.VANTA || !window.VANTA.NET || !window.THREE) {
      // ~10s de tolerancia pro CDN; depois disso desiste em silencio
      if (++tentativas < 200) setTimeout(iniciar, 50);
      return;
    }
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

  if (document.readyState !== "loading") iniciar();
  else window.addEventListener("DOMContentLoaded", iniciar);
})();
