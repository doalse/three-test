import * as THREE from "three"
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const textureLoader = new THREE.TextureLoader();

export async function loadParts(modelsUrl: string) {
  const gltf = await new GLTFLoader().loadAsync(modelsUrl);
   const parts = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material  }>();

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

  const floorTexture = textureLoader.load('textures/texture_wood.jpg');
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.colorSpace = THREE.SRGBColorSpace;

  const floorNormalMap = textureLoader.load('textures/texture_wood_normal.jpg');
  floorNormalMap.wrapS = THREE.RepeatWrapping;
  floorNormalMap.wrapT = THREE.RepeatWrapping;

  return { parts, floorTexture, floorNormalMap };
}