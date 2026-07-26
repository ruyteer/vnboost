"use strict";
// ===========================================================================
// Cena 3D do PrecisionFix
//   - Mouse gamer estilizado, montado com primitivas do three.js (domo + base
//     + anel RGB + scroll), com wireframe vermelho por cima pro visual "tech".
//   - Reage ao cursor (inclina) e brilha mais conforme os tweaks vao sendo
//     aplicados (window.pfSetLevel, chamado pelo refreshStatus).
//   - Fundo animado (Vanta NET) inicia so na primeira vez que a tela aparece.
//   - Nada disso e essencial: se o three.js nao carregar (offline), a tela
//     continua funcionando sem a cena.
// ===========================================================================
(function () {
  const canvas = document.getElementById("pf-mouse");
  const screen = document.getElementById("screen-precision");
  if (!canvas || !screen) return;

  const RED = 0xe10600;

  let renderer, scene, camera, rig, wheel, ring, pool, keyLight;
  let accentMat, wireMat;
  let started = false;
  let vantaOn = false;
  let t = 0;
  // alvo do cursor (-1..1) e valor suavizado
  let tx = 0, ty = 0, cx = 0, cy = 0;
  // nivel de "ativo" (0..1) -> intensidade do brilho
  let level = 0.12, levelTarget = 0.12;

  function visible() {
    return screen.classList.contains("active") && !screen.hidden;
  }

  // ---- monta o mouse ----
  function buildMouse(THREE) {
    const g = new THREE.Group();

    const shell = new THREE.MeshStandardMaterial({
      color: 0x141419,
      roughness: 0.4,
      metalness: 0.5,
    });
    accentMat = new THREE.MeshStandardMaterial({
      color: 0x230607,
      roughness: 0.25,
      metalness: 0.6,
      emissive: RED,
      emissiveIntensity: 0.5,
    });
    wireMat = new THREE.LineBasicMaterial({
      color: RED,
      transparent: true,
      opacity: 0.22,
    });

    // proporcao do casco: baixo e alongado (silhueta de mouse, nao de ovo).
    // A frente (rodinha) fica em +Z, virada pra camera.
    const SX = 1, SY = 0.8, SZ = 1.62;

    // corpo: meia-esfera (domo) alongada = o "casco"
    const domeGeo = new THREE.SphereGeometry(1, 64, 26, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, shell);
    dome.scale.set(SX, SY, SZ);
    g.add(dome);

    // wireframe por cima do casco (visual techy)
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(domeGeo, 12), wireMat);
    wire.scale.set(SX * 1.005, SY * 1.005, SZ * 1.005);
    g.add(wire);

    // base achatada (elipse) — apoia o casco
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.97, 0.13, 64), shell);
    base.scale.set(SX, 1, SZ);
    base.position.y = -0.065;
    g.add(base);

    // anel de luz na base (o "RGB" do mouse gamer)
    ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.028, 8, 96), accentMat);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(SX, SZ, 1); // torus roda no plano XY -> Y vira o eixo Z
    ring.position.y = -0.02;
    g.add(ring);

    // vinco dos botoes: arco que acompanha a curva do casco (do topo ate a
    // frente). E um meio-torus no plano YZ, escalado igual ao domo.
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.017, 8, 80, Math.PI * 0.62),
      accentMat
    );
    seam.rotation.y = Math.PI / 2; // leva o torus pro plano YZ
    seam.scale.set(SZ * 1.012, SY * 1.012, 1); // X do torus = Z do mundo
    g.add(seam);

    // scroll wheel encaixada na frente-topo (sobre a superficie do domo)
    wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 28), accentMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, SY * 0.72, SZ * 0.47);
    g.add(wheel);

    return g;
  }

  function start() {
    if (started || !window.THREE) return;
    started = true;
    const THREE = window.THREE;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 2.15, 4.6);
    camera.lookAt(0, 0.18, 0);

    rig = new THREE.Group();
    rig.add(buildMouse(THREE));
    rig.rotation.y = -0.5;
    scene.add(rig);

    // poça de luz no "chao"
    pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, 48),
      new THREE.MeshBasicMaterial({
        color: RED,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = -0.14;
    pool.scale.set(1, 1.35, 1);
    scene.add(pool);

    // luzes: ambiente fraca + key vermelha + rim branca
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    keyLight = new THREE.PointLight(RED, 2.4, 14);
    keyLight.position.set(2.4, 2.8, 1.6);
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0xffffff, 0.85);
    rim.position.set(-2.6, 2.2, -1.4);
    scene.add(rim);

    resize();
    window.addEventListener("resize", resize);

    // cursor inclina a cena
    window.addEventListener(
      "mousemove",
      (e) => {
        tx = (e.clientX / window.innerWidth - 0.5) * 2;
        ty = (e.clientY / window.innerHeight - 0.5) * 2;
      },
      { passive: true }
    );
  }

  function resize() {
    if (!renderer) return;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function initVanta() {
    if (vantaOn || !window.VANTA || !window.VANTA.NET || !window.THREE) return;
    vantaOn = true;
    try {
      window.VANTA.NET({
        el: "#pf-bg",
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1,
        scaleMobile: 1,
        color: RED,
        backgroundColor: 0x0a0a0c,
        points: 8,
        maxDistance: 20,
        spacing: 18,
      });
    } catch (e) {
      /* fundo animado e opcional */
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    // So monta/desenha quando a tela do PrecisionFix esta aberta: quem usa o
    // plano full nunca cria contexto WebGL nem carrega o fundo animado.
    if (!visible()) return;
    if (!started) return start();
    if (!renderer) return;

    if (canvas.clientWidth && canvas.width !== canvas.clientWidth * renderer.getPixelRatio()) resize();
    initVanta();

    t += 0.016;
    // suaviza cursor e nivel
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    level += (levelTarget - level) * 0.05;

    // idle: gira devagar + flutua
    rig.rotation.y = -0.5 + Math.sin(t * 0.35) * 0.32 + cx * 0.45;
    rig.rotation.x = -0.06 + cy * 0.16;
    rig.position.y = Math.sin(t * 0.9) * 0.045;

    wheel.rotation.y += 0.03; // scroll girando

    // brilho acompanha os tweaks aplicados
    const glow = 0.35 + level * 2.6;
    accentMat.emissiveIntensity = glow;
    wireMat.opacity = 0.16 + level * 0.4;
    keyLight.intensity = 1.6 + level * 2.6;
    pool.material.opacity = 0.08 + level * 0.22;

    renderer.render(scene, camera);
  }

  // chamado pelo refreshStatus: 0..1
  window.pfSetLevel = function (v) {
    const n = Number(v);
    levelTarget = Math.max(0, Math.min(1, isFinite(n) ? n : 0));
  };

  if (document.readyState !== "loading") loop();
  else window.addEventListener("DOMContentLoaded", loop);
})();
