import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'lil-gui';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';


const loading = document.getElementById('loading') as HTMLDivElement;
const COLUMN = { size: 0.15, height: 2.2 };       // balk_150x150x2200
const modelsUrl = 'models/Canopy_Models.glb';
const HDR_URL = 'textures/studio.hdr';
const STEP_COLUMN = 3;


const scene = new THREE.Scene()
scene.background = new THREE.Color(0xdfe4ea);

const axesHelper = new THREE.AxesHelper( 5 );
scene.add( axesHelper );

const gui = new GUI();

const size = 10;
const divisions = 10;
const gridHelper = new THREE.GridHelper( size, divisions );
scene.add( gridHelper );

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 4, -12);
// const helper = new THREE.CameraHelper( camera );
// scene.add( helper );

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const directionalLight = new THREE.DirectionalLight(0xffffff, Math.PI)
directionalLight.position.set(1, 1, 1)
scene.add(directionalLight)

let environmentTexture: THREE.DataTexture;
const hdr_loader = new HDRLoader();
hdr_loader.load(HDR_URL, (texture) => {
  environmentTexture = texture;
  environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = environmentTexture;
  scene.environmentIntensity = 1;
})

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
})

const controls = new OrbitControls(camera, renderer.domElement);


type PartsType = [
  string,
  { geometry: THREE.BufferGeometry; material: THREE.Material }
];

async function loadParts() {
  const gltf = await new GLTFLoader().loadAsync(modelsUrl);
   const parts = new Map<PartsType[0], PartsType[1]>();

  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;


    const geometry:THREE.BufferGeometry = node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);


    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material.map) {
        material.map.wrapS = THREE.RepeatWrapping;
        material.map.wrapT = THREE.RepeatWrapping;
      }
      if (material.normalMap) {
        material.normalMap.wrapS = THREE.RepeatWrapping;
        material.normalMap.wrapT = THREE.RepeatWrapping;
      }
      material.side = THREE.FrontSide;
    }

    parts.set(node.name, { geometry, material: node.material });
  });

  return parts;
}

console.log(loadParts());

function split(from: number, to: number, max: number) {
  const steps = Math.max(1, Math.ceil((to - from) / max - 1e-9));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    points.push(from + ((to - from) * i) / steps);
  }
  console.log("points: ", points)
  return points;
}

function columnCentres(size: number) {
  const half = COLUMN.size / 2;
  return split(-size / 2 + half, size / 2 - half, STEP_COLUMN);
}

function buildBuilding(
  parts: Map<PartsType[0], PartsType[1]>,
  { width, depth, height }: { width: number; depth: number; height: number }
) {
  const group = new THREE.Group();

  const add = (
    name: string,
    [x, y, z]: [number, number, number],
    rotY = 0,
    scale: [number, number, number] = [1, 1, 1]
  ) => {
    const part = parts.get(name);
    if (!part) {
       throw new Error(`Unknown part: ${name}`);
    }
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const meshAxesHelper = new THREE.AxesHelper( 5 );
    mesh.add( meshAxesHelper );
    group.add(mesh);
  };

  const xs = columnCentres(width);
  const zs = columnCentres(depth);


  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < zs.length; j++) {
      const onEdge = i === 0 || i === xs.length - 1 || j === 0 || j === zs.length - 1;
      if (!onEdge) continue; // всередині майданчика колон немає

      const [x, z] = [xs[i], zs[j]];
      add('balk_150x150x2200', [x, 0, z], 0, [1, height / COLUMN.height, 1]);

   
      const braceY = height - COLUMN.height;
      if (j === 0 || j === zs.length - 1) {
        if (i > 0) {
          add('balk_corner', [x, braceY, z], Math.PI);
        }
        if (i < xs.length - 1) {
          add('balk_corner', [x, braceY, z], 0);
        }
      }
      if (i === 0 || i === xs.length - 1) {
        if (j > 0) {
          add('balk_corner', [x, braceY, z], Math.PI / 2);
        }
        if (j < zs.length - 1) {
          add('balk_corner', [x, braceY, z], -Math.PI / 2);
        }
      }
    }
  }

  return group;
}

async function init() {
  let parts: Awaited<ReturnType<typeof loadParts>>;
  try {
    parts = await loadParts();
  } catch (error) {
    loading.textContent = `Failed to load models: ${(error as Error).message}`;
    return;
  }

  const params = { width: 5, depth: 3, height: 2.2 };
  let building: THREE.Object3D | undefined;

  function rebuild() {
    if (building) scene.remove(building);
    building = buildBuilding(parts, params);
    scene.add(building);
  }

  gui.add(params, 'width', 1, 8, 0.1).onChange(rebuild);
  gui.add(params, 'depth', 1, 8, 0.1).onChange(rebuild);
  gui.add(params, 'height', COLUMN.height, 6, 0.1).onChange(rebuild);

  rebuild();
}

init();


function animate() {
  requestAnimationFrame(animate)

  renderer.render(scene, camera)
  controls.update();
}


animate()