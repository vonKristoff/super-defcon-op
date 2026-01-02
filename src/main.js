import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

let scene, camera, renderer, controls, model, mixer, clock;
let rotationSpeed = 0;
let ambientLight, directionalLight, gridHelper;

function init() {
  const canvas = document.getElementById("canvas");

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // Camera
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(5, 5, 5);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  // renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // renderer.outputEncoding = THREE.sRGBEncoding;
  // renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // renderer.toneMappingExposure = 1;

  // Orbit Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2;
  controls.maxDistance = 50;

  // Lights
  ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  // scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, 0.1);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -10;
  directionalLight.shadow.camera.right = 10;
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.bottom = -10;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  directionalLight.intensity = 3;
  ambientLight.intensity = 3;

  const pointLight1 = new THREE.PointLight(0x667eea, 0.5);
  pointLight1.position.set(-5, 5, -5);
  // scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x764ba2, 0.5);
  pointLight2.position.set(5, -5, 5);
  // scene.add(pointLight2);

  // Grid helper
  gridHelper = new THREE.GridHelper(10, 10, 0x84f484, 0x822222);
  scene.add(gridHelper);

  // Clock for animations
  clock = new THREE.Clock();

  // Event listeners
  window.addEventListener("resize", onWindowResize);
  document.getElementById("fileInput").addEventListener("change", loadModel);

  document.getElementById("rotationSpeed").addEventListener("input", (e) => {
    rotationSpeed = parseFloat(e.target.value);
    document.getElementById("rotSpeedValue").textContent =
      rotationSpeed.toFixed(1);
  });

  document.getElementById("lightIntensity").addEventListener("input", (e) => {
    const intensity = parseFloat(e.target.value);
    directionalLight.intensity = intensity;
    ambientLight.intensity = intensity * 0.5;
    document.getElementById("lightValue").textContent = intensity.toFixed(1);
  });

  document.getElementById("bgColor").addEventListener("input", (e) => {
    scene.background = new THREE.Color(e.target.value);
  });

  document.getElementById("showGrid").addEventListener("change", (e) => {
    gridHelper.visible = e.target.checked;
  });

  document.getElementById("wireframe").addEventListener("change", (e) => {
    if (model) {
      model.traverse((child) => {
        if (child.isMesh) {
          child.material.wireframe = e.target.checked;
        }
      });
    }
  });

  animate();
}

function loadModel(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("loading").style.display = "block";

  const reader = new FileReader();
  reader.onload = function (e) {
    const arrayBuffer = e.target.result;
    const blob = new Blob([arrayBuffer]);
    const url = URL.createObjectURL(blob);

    loadGLTF(url);
  };

  reader.onerror = function (error) {
    console.error("FileReader error:", error);
    document.getElementById("loading").style.display = "none";
    alert("Error reading file");
  };

  reader.readAsArrayBuffer(file);
}

// Function to load model from a path (for auto-loading)
function loadModelFromPath(path) {
  document.getElementById("loading").style.display = "block";
  loadGLTF(path);
}

// Shared GLTF loading logic
function loadGLTF(url) {
  const loader = new GLTFLoader();

  loader.load(
    url,
    function (gltf) {
      // Remove old model
      if (model) {
        scene.remove(model);
        model.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }

      model = gltf.scene;

      // Center and scale model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 4 / maxDim;
      model.scale.multiplyScalar(scale);

      // Recalculate box after scaling
      box.setFromObject(model);
      box.getCenter(center);
      model.position.sub(center);

      model.position.y += 0.08;

      // Enable shadows
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(model);

      // Handle animations
      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
          mixer.clipAction(clip).play();
        });
      }

      // Reset camera
      controls.reset();
      camera.position.set(size.x * 1.5, size.y * 1.5, size.z * 1.5);
      controls.update();

      document.getElementById("loading").style.display = "none";

      // Only revoke if it's a blob URL (from file upload)
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    },
    function (progress) {
      if (progress.total > 0) {
        console.log(
          "Loading:",
          ((progress.loaded / progress.total) * 100).toFixed(2) + "%"
        );
      }
    },
    function (error) {
      console.error("Error loading model:", error);
      document.getElementById("loading").style.display = "none";
      alert("Error loading model: " + error.message);

      // Only revoke if it's a blob URL
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    }
  );
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // Auto-rotate model
  if (model && rotationSpeed > 0) {
    model.rotation.y += rotationSpeed * 0.01;
  }

  // Update animations
  if (mixer) {
    mixer.update(delta);
  }

  // Update controls
  controls.update();

  renderer.render(scene, camera);
}

// Start the application
init();

// Auto-load default model on startup
// Place your model in the public folder (e.g., public/models/your-model.glb)
const DEFAULT_MODEL_PATH = "/assets/Game_Model_Baked.glb"; // Change this to your model path

// Uncomment the next line to auto-load the default model
loadModelFromPath(DEFAULT_MODEL_PATH);
