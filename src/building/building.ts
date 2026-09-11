import * as THREE from 'three';
import { columnCentres, stepsBetween } from "../helpers/helpers.ts";
import { loadParts } from "../loader/load_parts.ts";
import { GUI } from 'lil-gui';

const loading = document.getElementById('loading') as HTMLDivElement;
const COLUMN = { size: 0.15, height: 2.2 };
const STEP_COLUMN = 3;
const BEAM = 0.15;


const OUT_INNER = 0.18;       // "fascia overhang beyond column edge, 180 mm"
const OUT_OUTER = 0.2;
const Y_INNER_FASCIA = 0.1;   // "inner fascia 100 mm above top of column"
const Y_OUTER_FASCIA = 0.2;
const FASCIA = 0.02;

const JOIST = 0.05;                               // lodge_150x50x1000, joist width
const Y_JOIST = 0.15;   
const STEP_JOIST = 0.5; 

const FILLER = 0.2;  
const STEP_FILLER = 0.6; 


const PLANK = 0.19;                               // Lodge_20x190x1000_bevel, deck plank width
const Y_DECK = 0.3;           // "deck rests on the inner fascia"
const Y_MEMBRANE = 0.32;
const Y_FASCIA_TOP = 0.4;


const PROFILE = { height: 0.0668, width: 0.134 };

const gui = new GUI();


function buildBuilding(
  parts: Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material }>,
  floorTexture: THREE.Texture,
  floorNormalMap: THREE.Texture,
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
    // const meshAxesHelper = new THREE.AxesHelper( 5 );
    // mesh.add( meshAxesHelper );
    group.add(mesh);
  };

  const xs = columnCentres(width, COLUMN.size, STEP_COLUMN);
  const zs = columnCentres(depth, COLUMN.size, STEP_COLUMN);
   const top = height;            // level of column top
  const longX = width >= depth; 


  //floor
  const floorMap = floorTexture.clone();
  floorMap.repeat.set(width, depth);
  floorMap.needsUpdate = true;
  const floorNormal = floorNormalMap.clone();
  floorNormal.repeat.set(width, depth);
  floorNormal.needsUpdate = true;
  const floorMaterial = new THREE.MeshStandardMaterial({ map: floorMap, normalMap: floorNormal, side: THREE.DoubleSide });
  const floorGeometry = new THREE.PlaneGeometry(width, depth);
  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);


  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < zs.length; j++) {
      const onEdge = i === 0 || i === xs.length - 1 || j === 0 || j === zs.length - 1;
      if (!onEdge) continue; // no columns inside the area

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

  const beamX0 = -width / 2 + (longX ? BEAM : 0);
  const beamX1 = width / 2 - (longX ? BEAM : 0);
  const beamZ0 = -depth / 2 + (longX ? 0 : BEAM);
  const beamZ1 = depth / 2 - (longX ? 0 : BEAM);
  for (const z of [zs[0], zs[zs.length - 1]]) {
    add('balk_150x150x1000', [beamX0, top, z], 0, [beamX1 - beamX0, 1, 1]);
  }
  for (const x of [xs[0], xs[xs.length - 1]]) {
    add('balk_150x150x1000', [x, top, beamZ0], -Math.PI / 2, [beamZ1 - beamZ0, 1, 1]);
  }


    // --- fascias: 20x200 board on each side, inner and outer rows ---
  const addFascia = (out: number, y: number) => {
    const outerX = width / 2 + out;
    const outerZ = depth / 2 + out;
    // The long-side board butts against the short-side board, so it is shortened by its thickness.
    const x = longX ? outerX - FASCIA : outerX;
    const z = longX ? outerZ : outerZ - FASCIA;
    add('Lodge_20x200x1000', [-x, y, -outerZ], 0, [2 * x, 1, 1]);
    add('Lodge_20x200x1000', [x, y, outerZ], Math.PI, [2 * x, 1, 1]);
    add('Lodge_20x200x1000', [-outerX, y, z], Math.PI / 2, [2 * z, 1, 1]);
    add('Lodge_20x200x1000', [outerX, y, -z], -Math.PI / 2, [2 * z, 1, 1]);
  };
  addFascia(OUT_INNER, top + Y_INNER_FASCIA);
  addFascia(OUT_OUTER, top + Y_OUTER_FASCIA);

  // --- roof joists: lie on the ring beams across the long side ---
  // // "overhangs by half beyond the ring beam edge" — 75 mm on each side.
  let joistLength: number;
  let joistCentres: number[];
  if (longX) {
    joistLength = depth + BEAM;
    joistCentres = xs;
  } else {
    joistLength = width + BEAM;
    joistCentres = zs;
  }
  const joistSteps = stepsBetween(joistCentres, STEP_JOIST);
  for (let i = 0; i < joistSteps.length; i++) {
    const c = joistSteps[i];
    // The joist width grows from the pivot, so we shift by half the width so the joist
    // ends up centered on the step line (and centered on the column above the column).
    if (longX) {
      add('lodge_150x50x1000', [c + JOIST / 2, top + Y_JOIST, -joistLength / 2], -Math.PI / 2, [joistLength, 1, 1]);
    } else {
      add('lodge_150x50x1000', [-joistLength / 2, top + Y_JOIST, c - JOIST / 2], 0, [joistLength, 1, 1]);
    }
  }



  // --- fillers that close the gap between the outer beam and the inner fascia ---
  const half = (longX ? width : depth) / 2;
  const gapFrom = half - COLUMN.size / 2 + JOIST / 2;
  const gapTo = half + OUT_INNER - FASCIA;
  const fillerScale: [number, number, number] = [(gapTo - gapFrom) / FILLER, 1, 1];
  for (const c of stepsBetween(longX ? zs : xs, STEP_FILLER)) {
    if (longX) {
      add('lodge_150x50x200', [gapFrom, top + Y_JOIST, c - JOIST / 2], 0, fillerScale);
      add('lodge_150x50x200', [-gapFrom, top + Y_JOIST, c + JOIST / 2], Math.PI, fillerScale);
    } else {
      add('lodge_150x50x200', [c + JOIST / 2, top + Y_JOIST, gapFrom], -Math.PI / 2, fillerScale);
      add('lodge_150x50x200', [c - JOIST / 2, top + Y_JOIST, -gapFrom], Math.PI / 2, fillerScale);
    }
  }


   // --- deck: 20x190 planks along the long side, out to the outer edge of the fascia ---
  const deckX = width / 2 + OUT_INNER;
  const deckZ = depth / 2 + OUT_INNER;
  const plankRun = longX ? 2 * deckX : 2 * deckZ;
  const across = longX ? 2 * deckZ : 2 * deckX;
  const plankCount = Math.max(1, Math.round(across / PLANK));
  const plankWidth = across / plankCount;
  const plankScale: [number, number, number] = [plankWidth / PLANK, 1, plankRun];
  for (let i = 0; i < plankCount; i++) {
    const c = -across / 2 + (i + 0.5) * plankWidth;
    if (longX) add('Lodge_20x190x1000_bevel', [-deckX, top + Y_DECK, c], -Math.PI / 2, plankScale);
    else add('Lodge_20x190x1000_bevel', [c, top + Y_DECK, deckZ], 0, plankScale);
  }

  // --- roof covering, "fills the space between the outer fascias" ---
  add('ruberoid_1000x1000x2', [-deckX, top + Y_MEMBRANE, deckZ], 0, [2 * deckX, 1, 2 * deckZ]);

  //--- perimeter profile, covers the outer fascia ---
  const px = width / 2 -0.001 + OUT_OUTER;
  const pz = depth / 2 -0.001 + OUT_OUTER;
  const py = top + Y_FASCIA_TOP - 0.001 - PROFILE.height; // 1 mm offset to avoid z-fighting on the top faces
  const zRun = 2 * pz - 2 * PROFILE.width;
  add('profile_canopy_perimeter_closed', [-px, py, pz], 0, [2 * px, 1, 1]);
  add('profile_canopy_perimeter_closed', [px, py, -pz], Math.PI, [2 * px, 1, 1]);
  add('profile_canopy_perimeter_closed', [-px, py, -pz + PROFILE.width], -Math.PI / 2, [zRun, 1, 1]);
  add('profile_canopy_perimeter_closed', [px, py, pz - PROFILE.width], Math.PI / 2, [zRun, 1, 1]);



  return group;
}

export async function init(scene: THREE.Scene, modelsUrl: string) {
  let loaded: Awaited<ReturnType<typeof loadParts>>;
  try {
    loaded = await loadParts(modelsUrl);
  } catch (error) {
    loading.textContent = `Failed to load models: ${(error as Error).message}`;
    return;
  }
  const { parts, floorTexture, floorNormalMap } = loaded;

  const params = { width: 5, depth: 3, height: 2.2 };
  let building: THREE.Object3D | undefined;

  function rebuild() {
    if (building) scene.remove(building);
    building = buildBuilding(parts, floorTexture, floorNormalMap, params);
    scene.add(building);
  }

  gui.add(params, 'width', 1, 8, 0.1).onChange(rebuild);
  gui.add(params, 'depth', 1, 8, 0.1).onChange(rebuild);
  gui.add(params, 'height', COLUMN.height, 6, 0.1).onChange(rebuild);

  rebuild();
}