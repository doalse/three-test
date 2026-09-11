import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { loadParts } from "./loader/load_parts.ts";
import { init } from './building/building.ts';



 // balk_150x150x2200
const modelsUrl = 'models/Canopy_Models.glb';
const HDR_URL = 'textures/studio.hdr';


const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe4ea);

const axesHelper = new THREE.AxesHelper( 5 );
scene.add( axesHelper );

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
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

const directionalLight = new THREE.DirectionalLight(0xffffff, Math.PI/2)
directionalLight.position.set(8, 7, -6)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(2048, 2048)
directionalLight.shadow.camera.left = -10
directionalLight.shadow.camera.right = 10
directionalLight.shadow.camera.top = 10
directionalLight.shadow.camera.bottom = -10
scene.add(directionalLight)

let environmentTexture: THREE.DataTexture;
const hdr_loader = new HDRLoader();
hdr_loader.load(HDR_URL, (texture) => {
  environmentTexture = texture;
  environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = environmentTexture;
  scene.environmentIntensity = 0.5;
})

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
// scene.add(ground);


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
})

const controls = new OrbitControls(camera, renderer.domElement);

loadParts(modelsUrl);

// console.log(loadParts(modelsUrl));



init(scene, modelsUrl);


function animate() {
  requestAnimationFrame(animate)

  renderer.render(scene, camera)
  controls.update();
}


animate()