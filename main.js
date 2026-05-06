import * as THREE from "three";
import GUI from "lil-gui";

// --- CONFIGURATION & GUI PARAMS ---
const params = {
  imageUrl1: "https://picsum.photos/id/1025/1024/768",
  imageUrl2: "https://picsum.photos/id/1015/1024/768",
  stripeCount: 400,
  ghosting: 0.1,
  waviness: 0.001,
  chromaticAberration: 0.001,
  transitionBlur: 0.004,
  roomLightIntensity: 0.6,
  smudgeIntensity: 0.5,
  scratchIntensity: 0.04,
  stiffness: 0.07,
  damping: 0.82,
  wobbleAmount: 0.001,
};

let scene, camera, renderer, material, mesh;
let mouseX = -1.0;
let mouseY = 0;

// Spring Physics Variables
let rotY = 0,
  velY = 0;
let rotX = 0,
  velX = 0;

const container = document.getElementById("canvas-container");

const vertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
  `;

const fragmentShader = `
      precision highp float;

      uniform sampler2D uTexture1;
      uniform sampler2D uTexture2;
      uniform float uAngle;
      uniform float uStripes;

      // GUI Driven Uniforms
      uniform float uGhosting;
      uniform float uWaviness;
      uniform float uChromaticAberration;
      uniform float uTransitionBlur;
      uniform float uRoomLightIntensity;
      uniform float uSmudgeIntensity;
      uniform float uScratchIntensity;

      varying vec2 vUv;
      varying vec3 vNormal;

      float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                     mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      void main() {
          if (abs(vNormal.z) < 0.5) {
              float edgeShade = 0.6 + vNormal.x * 0.1 + vNormal.y * 0.1;
              gl_FragColor = vec4(vec3(edgeShade), 1.0);
              return;
          }

          // Waviness
          float warp = noise(vUv * vec2(15.0, 60.0)) * uWaviness;
          float warpedX = vUv.x + warp;

          float id = floor(warpedX * uStripes);
          float isOdd = mod(id, 2.0);
          float flipThreshold = mix(0.4, 0.6, isOdd);
          float baseFlip = smoothstep(flipThreshold - 0.05, flipThreshold + 0.05, uAngle);

          float transitionAmount = 1.0 - abs(baseFlip - 0.5) * 2.0;
          float parallaxStrength = 0.025;
          vec2 uv1 = vec2(vUv.x + (0.5 - uAngle) * parallaxStrength, vUv.y);
          vec2 uv2 = vec2(vUv.x - (0.5 - uAngle) * parallaxStrength, vUv.y);

          float blurAmount = transitionAmount * uTransitionBlur;
          vec2 blurOffset = vec2(blurAmount, 0.0);
          float aberration = uChromaticAberration;

          // Sampling with Blur + Aberration
          float r1 = texture2D(uTexture1, uv1 + blurOffset + vec2(-aberration, 0.0)).r;
          float g1 = texture2D(uTexture1, uv1).g;
          float b1 = texture2D(uTexture1, uv1 - blurOffset + vec2(aberration, 0.0)).b;
          vec4 color1 = vec4(r1, g1, b1, 1.0);

          float r2 = texture2D(uTexture2, uv2 + blurOffset + vec2(-aberration, 0.0)).r;
          float g2 = texture2D(uTexture2, uv2).g;
          float b2 = texture2D(uTexture2, uv2 - blurOffset + vec2(aberration, 0.0)).b;
          vec4 color2 = vec4(r2, g2, b2, 1.0);

          // Ghosting (Crosstalk)
          float mixFactor = mix(uGhosting, 1.0 - uGhosting, baseFlip);
          vec4 finalColor = mix(color1, color2, mixFactor);

          // Room Light Specular + Smudge
          float subStripe = fract(warpedX * uStripes);
          float lensCurve = 1.0 - abs(subStripe - 0.5) * 2.0;

          float lightSweep = 1.0 - uAngle;
          float roomLight = smoothstep(0.2, 0.4, lightSweep) - smoothstep(0.4, 0.6, lightSweep);
          float smudge = noise(vUv * 5.0);

          // Modulate light by smudge intensity
          float lightSpec = pow(lensCurve, 4.0) * roomLight * (1.0 - uSmudgeIntensity + smudge * uSmudgeIntensity);
          finalColor.rgb += lightSpec * uRoomLightIntensity;

          float baseHighlight = pow(lensCurve, 8.0) * 0.1;
          finalColor.rgb += baseHighlight;

          // Micro-scratches
          float scratches = noise(vUv * vec2(200.0, 2000.0));
          scratches = smoothstep(0.82, 0.88, scratches);
          finalColor.rgb += scratches * uScratchIntensity;

          gl_FragColor = finalColor;
      }
  `;

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.z = 3;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const loader = new THREE.TextureLoader();
  const texture1 = loader.load(params.imageUrl1);
  const texture2 = loader.load(params.imageUrl2);

  [texture1, texture2].forEach((tex) => {
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
  });

  material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture1: { value: texture1 },
      uTexture2: { value: texture2 },
      uAngle: { value: 0.0 },
      uStripes: { value: params.stripeCount },
      uGhosting: { value: params.ghosting },
      uWaviness: { value: params.waviness },
      uChromaticAberration: { value: params.chromaticAberration },
      uTransitionBlur: { value: params.transitionBlur },
      uRoomLightIntensity: { value: params.roomLightIntensity },
      uSmudgeIntensity: { value: params.smudgeIntensity },
      uScratchIntensity: { value: params.scratchIntensity },
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });

  const aspectRatio = 4 / 3;
  const geometry = new THREE.BoxGeometry(2.5 * aspectRatio, 2.5, 0.04);
  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // --- SETUP GUI ---
  const gui = new GUI();

  const lensFolder = gui.addFolder("Lens");
  lensFolder
    .add(params, "stripeCount", 20, 800, 1)
    .name("Stripe Count (LPI)")
    .onChange((v) => (material.uniforms.uStripes.value = v));
  lensFolder
    .add(params, "ghosting", 0.0, 0.5)
    .name("Ghosting")
    .onChange((v) => (material.uniforms.uGhosting.value = v));
  lensFolder
    .add(params, "waviness", 0.0, 0.005)
    .name("Waviness")
    .onChange((v) => (material.uniforms.uWaviness.value = v));
  lensFolder
    .add(params, "chromaticAberration", 0.0, 0.005)
    .name("Color Fringing")
    .onChange((v) => (material.uniforms.uChromaticAberration.value = v));
  lensFolder
    .add(params, "transitionBlur", 0.0, 0.01)
    .name("Transition Blur")
    .onChange((v) => (material.uniforms.uTransitionBlur.value = v));
  lensFolder.open();

  const surfaceFolder = gui.addFolder("Surface & Light");
  surfaceFolder
    .add(params, "roomLightIntensity", 0.0, 1.5)
    .name("Light Intensity")
    .onChange((v) => (material.uniforms.uRoomLightIntensity.value = v));
  surfaceFolder
    .add(params, "smudgeIntensity", 0.0, 1.0)
    .name("Smudge Intensity")
    .onChange((v) => (material.uniforms.uSmudgeIntensity.value = v));
  surfaceFolder
    .add(params, "scratchIntensity", 0.0, 0.1)
    .name("Scratch Intensity")
    .onChange((v) => (material.uniforms.uScratchIntensity.value = v));
  surfaceFolder.open();

  const physicsFolder = gui.addFolder("Physics");
  physicsFolder.add(params, "stiffness", 0.01, 0.2).name("Spring Stiffness");
  physicsFolder.add(params, "damping", 0.5, 0.99).name("Spring Damping");
  physicsFolder.add(params, "wobbleAmount", 0.0, 0.01).name("Hand Wobble");
  physicsFolder.close(); // Start closed to keep UI clean

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("resize", onWindowResize);
}

function onMouseMove(event) {
  mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onTouchMove(event) {
  if (event.touches.length > 0) {
    mouseX = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now() * 0.001;

  let targetRotY = mouseX * 0.35;
  let targetRotX = mouseY * 0.15;

  // Apply physics params
  targetRotY += Math.sin(time * 0.7) * params.wobbleAmount;
  targetRotX += Math.cos(time * 0.9) * params.wobbleAmount;

  // Spring Physics calculation
  let forceY = targetRotY - rotY;
  velY += forceY * params.stiffness;
  velY *= params.damping;
  rotY += velY;

  let forceX = targetRotX - rotX;
  velX += forceX * params.stiffness;
  velX *= params.damping;
  rotX += velX;

  mesh.rotation.y = rotY;
  mesh.rotation.x = rotX;

  // Synchronize Lenticular Flip
  let calculatedAngle = rotY / 0.7 + 0.5;
  calculatedAngle = Math.max(0.0, Math.min(1.0, calculatedAngle));

  let currentAngle = material.uniforms.uAngle.value;
  material.uniforms.uAngle.value += (calculatedAngle - currentAngle) * 0.2;

  renderer.render(scene, camera);
}

init();
animate();
