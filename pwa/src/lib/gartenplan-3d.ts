import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { GardenPlan, GardenPlanPlacement, PlantData } from './types';
import { displayRadiusM } from './growth-model';
import { deriveLayer, LAYER_STYLE, type PlantLayer } from './plant-layer';
import { seededRandom } from './blob-shape';
import { pointInPolygon } from './gartenplan-geometry';

/**
 * Full 3D editing view for a garden plan — camera-orbit for viewing,
 * raycasting for placing/dragging plants directly in the scene. Reuses the
 * exact same growth-model sizing and layer colors as the 2D SVG editor so
 * both views stay visually consistent; a tree trunk is the one 3D-only
 * addition (2D is a top-down view and never drew one).
 *
 * Data-flow: this module never mutates `plan` — it only reads it. Every
 * user action (place/drag/select) is reported back via `callbacks`, so
 * `editing.placements` mutation stays centralized on the page, exactly
 * like the 2D code, and the page can still drive its existing sidebar
 * (picker/suggestions/unplaced/selected panels) unchanged.
 */

export interface GardenPlan3DCallbacks {
  onGroundTap(xM: number, yM: number): void;
  onPlacementDragEnd(placementId: string, xM: number, yM: number): void;
  onPlacementSelected(placementId: string): void;
}

export interface GardenPlan3DView {
  updateYears(years: number): void;
  refreshPlacements(): void;
  setArmedPlant(plantId: string | null): void;
  setSelectedPlacement(placementId: string | null): void;
  dispose(): void;
}

const DRAG_THRESHOLD_PX = 4;

/** Moves each vertex of an icosahedron along its own (already-normalized)
 *  position vector by a seeded ± fraction of the radius — same determinism
 *  guarantee as the 2D blob outline (blob-shape.ts): a given placement
 *  always gets the same wobbly canopy shape across re-renders/reloads. */
function jitterVertices(geometry: THREE.BufferGeometry, seed: string, wobble: number, radius: number) {
  const rand = seededRandom(seed);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const scale = 1 - wobble / 2 + rand() * wobble;
    v.multiplyScalar(radius * scale);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

function buildPlantMesh(placement: GardenPlanPlacement, plant: PlantData | undefined, years: number): THREE.Group {
  const group = new THREE.Group();
  const radiusM = plant ? displayRadiusM(plant, years) : 0.2;
  const layer: PlantLayer = plant ? deriveLayer(plant) : 'shrub';
  const style = LAYER_STYLE[layer];

  if (layer === 'tree') {
    // These floors exist only to avoid a degenerate zero-size mesh — they
    // must stay below displayRadiusM()'s own MIN_DISPLAY_RADIUS_M (0.08) run
    // through the same multipliers, or they silently override the age-based
    // scaling below that floor. The old floors (0.3 / 0.04 / 0.05) sat ABOVE
    // radiusM's guaranteed minimum scaled by these multipliers (0.08*1.2 =
    // 0.096 etc.) — for any plant whose widthM defaults to 0.5 (unset, e.g.
    // not yet PFAF-enriched), the mature trunk height (0.25*1.2 = 0.3) never
    // exceeded that floor either, so the trunk rendered at a fixed size for
    // the entire 0-30 year slider range while the canopy still visibly grew.
    const trunkHeight = Math.max(0.05, radiusM * 1.2);
    const trunkGeom = new THREE.CylinderGeometry(
      Math.max(0.01, radiusM * 0.06), Math.max(0.012, radiusM * 0.08), trunkHeight, 8,
    );
    const trunk = new THREE.Mesh(trunkGeom, new THREE.MeshStandardMaterial({ color: 0x78350f }));
    trunk.position.y = trunkHeight / 2;
    group.add(trunk);

    const canopyGeom = new THREE.IcosahedronGeometry(radiusM, 1);
    jitterVertices(canopyGeom, placement.id, style.wobble, radiusM);
    const canopy = new THREE.Mesh(canopyGeom, new THREE.MeshStandardMaterial({ color: style.fill, flatShading: true }));
    canopy.position.y = trunkHeight + radiusM * 0.7;
    group.add(canopy);
  } else if (layer === 'shrub') {
    const shrubGeom = new THREE.IcosahedronGeometry(radiusM, 1);
    jitterVertices(shrubGeom, placement.id, style.wobble, radiusM);
    shrubGeom.scale(1, 0.7, 1);
    const shrub = new THREE.Mesh(shrubGeom, new THREE.MeshStandardMaterial({ color: style.fill, flatShading: true }));
    shrub.position.y = radiusM * 0.6;
    group.add(shrub);
  } else if (layer === 'climber') {
    // A slim leafy column, as if grown up a support.
    const h = Math.max(0.1, radiusM * 2);
    const columnGeom = new THREE.CylinderGeometry(radiusM * 0.35, radiusM * 0.5, h, 8);
    jitterVertices(columnGeom, placement.id, style.wobble, radiusM * 0.4);
    const column = new THREE.Mesh(columnGeom, new THREE.MeshStandardMaterial({ color: style.fill, flatShading: true }));
    column.position.y = h / 2;
    group.add(column);
  } else {
    // herb and rhizo: a low disc (rhizo in its own earthy color)
    const h = Math.max(0.08, radiusM * 0.15);
    const herbGeom = new THREE.CylinderGeometry(radiusM, radiusM * 1.1, h, 12);
    const herb = new THREE.Mesh(herbGeom, new THREE.MeshStandardMaterial({ color: style.fill }));
    herb.position.y = h / 2;
    group.add(herb);
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radiusM * 1.05, radiusM * 1.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.name = 'selection-ring';
  ring.visible = false;
  group.add(ring);

  group.position.set(placement.xM, 0, placement.yM);
  group.userData.placementId = placement.id;
  return group;
}

function buildGridLines(widthM: number, heightM: number, spacingM: number): THREE.LineSegments {
  const pos: number[] = [];
  for (let x = 0; x <= widthM + 1e-6; x += spacingM) pos.push(x, 0.01, 0, x, 0.01, heightM);
  for (let z = 0; z <= heightM + 1e-6; z += spacingM) pos.push(0, 0.01, z, widthM, 0.01, z);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: 0xd6d3d1, transparent: true, opacity: 0.6 }));
}

function buildBoundaryMesh(plan: GardenPlan): THREE.Mesh {
  const contour = plan.boundary.map(p => new THREE.Vector2(p.xM, p.yM));
  const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
  const positions = new Float32Array(plan.boundary.flatMap(p => [p.xM, 0.005, p.yM]));
  const indices = triangles.flat();
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  // Winding depends on the user's click order while drawing (arbitrary) —
  // verified against the real triangulation output, not assumed — so a
  // one-sided material would randomly render the fill invisible from above
  // for some plans. DoubleSide is the robust fix, not winding-detection.
  const mat = new THREE.MeshStandardMaterial({ color: 0x15803d, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
  return new THREE.Mesh(geom, mat);
}

function buildGroundMesh(widthM: number, heightM: number): THREE.Mesh {
  const positions = new Float32Array([
    0, 0, 0, widthM, 0, 0, widthM, 0, heightM,
    0, 0, 0, widthM, 0, heightM, 0, 0, heightM,
  ]);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0xf5f5f4, side: THREE.DoubleSide }));
}

function boundaryCentroid(plan: GardenPlan): { x: number; z: number } {
  if (plan.boundary.length === 0) return { x: plan.areaWidthM / 2, z: plan.areaHeightM / 2 };
  const sum = plan.boundary.reduce((acc, p) => ({ x: acc.x + p.xM, z: acc.z + p.yM }), { x: 0, z: 0 });
  return { x: sum.x / plan.boundary.length, z: sum.z / plan.boundary.length };
}

export function createGardenPlan3DView(
  container: HTMLElement,
  plan: GardenPlan,
  plantsById: Map<string, PlantData>,
  callbacks: GardenPlan3DCallbacks,
): GardenPlan3DView {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(50, Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight), 0.1, 500);
  const maxDim = Math.max(plan.areaWidthM, plan.areaHeightM, 2);
  const { x: cx, z: cz } = boundaryCentroid(plan);
  camera.position.set(cx + maxDim * 0.6, maxDim * 0.8, cz + maxDim * 0.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8b8378, 1.1));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(cx + maxDim, maxDim * 1.5, cz + maxDim * 0.5);
  scene.add(dirLight);

  scene.add(buildGroundMesh(plan.areaWidthM, plan.areaHeightM));
  scene.add(buildGridLines(plan.areaWidthM, plan.areaHeightM, plan.gridSpacingM));
  scene.add(buildBoundaryMesh(plan));

  const plantsGroup = new THREE.Group();
  scene.add(plantsGroup);

  let years = plan.yearsSincePlanting;
  let armedPlantId: string | null = null;
  let selectedPlacementId: string | null = null;

  function rebuildPlacements() {
    plantsGroup.clear();
    for (const placement of plan.placements) {
      const mesh = buildPlantMesh(placement, plantsById.get(placement.plantId), years);
      const ring = mesh.getObjectByName('selection-ring');
      if (ring) ring.visible = placement.id === selectedPlacementId;
      plantsGroup.add(mesh);
    }
    requestRender();
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(cx, 0, cz);
  controls.minDistance = 1;
  controls.maxDistance = maxDim * 3;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.enableDamping = false;
  controls.update();

  let renderQueued = false;
  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderer.render(scene, camera);
    });
  }
  controls.addEventListener('change', requestRender);

  // ── Interaction: raycasting for place/drag, letting OrbitControls handle
  // everything else untouched (see CHANGELOG.md "Gartenplan: 3D-Ansicht mit
  // vollem Editing" for why a capture-phase listener on the container, not
  // the canvas, reliably wins the race against OrbitControls' own
  // pointerdown handler). ──
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();

  function setNdcFromEvent(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function findPlacementId(obj: THREE.Object3D | null): string | null {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.userData?.placementId) return cur.userData.placementId as string;
      cur = cur.parent;
    }
    return null;
  }

  let dragState: { placementId: string; moved: boolean; startClientX: number; startClientY: number } | null = null;

  function onPlantPointerMove(e: PointerEvent) {
    if (!dragState) return;
    if (!dragState.moved && Math.hypot(e.clientX - dragState.startClientX, e.clientY - dragState.startClientY) > DRAG_THRESHOLD_PX) {
      dragState.moved = true;
    }
    if (!dragState.moved) return;
    setNdcFromEvent(e);
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;
    const mesh = plantsGroup.children.find(c => c.userData.placementId === dragState!.placementId);
    if (mesh) mesh.position.set(hit.x, 0, hit.z);
    requestRender();
  }

  function onPlantPointerUp(e: PointerEvent) {
    if (!dragState) return;
    const { placementId, moved } = dragState;
    dragState = null;
    renderer.domElement.removeEventListener('pointermove', onPlantPointerMove);
    controls.enabled = true;
    if (moved) {
      setNdcFromEvent(e);
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        // No boundary re-check here — matches the 2D drag code, which also
        // only validates the boundary on the initial placement tap, not on
        // drag-commit. Deliberate parity, not an oversight.
        callbacks.onPlacementDragEnd(placementId, hit.x, hit.z);
      }
    } else {
      selectedPlacementId = placementId;
      callbacks.onPlacementSelected(placementId);
    }
  }

  function onContainerPointerDown(e: PointerEvent) {
    setNdcFromEvent(e);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(plantsGroup.children, true)[0];
    const hitId = hit ? findPlacementId(hit.object) : null;

    if (hitId) {
      controls.enabled = false;
      dragState = { placementId: hitId, moved: false, startClientX: e.clientX, startClientY: e.clientY };
      renderer.domElement.setPointerCapture(e.pointerId);
      renderer.domElement.addEventListener('pointermove', onPlantPointerMove);
      renderer.domElement.addEventListener('pointerup', onPlantPointerUp, { once: true });
      return;
    }

    if (armedPlantId) {
      const groundHit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, groundHit)
        && pointInPolygon({ xM: groundHit.x, yM: groundHit.z }, plan.boundary)) {
        controls.enabled = false;
        callbacks.onGroundTap(groundHit.x, groundHit.z);
        renderer.domElement.addEventListener('pointerup', () => { controls.enabled = true; }, { once: true });
      }
    }
    // No hit, nothing armed: fall through untouched — OrbitControls handles it.
  }

  container.style.touchAction = 'none';
  container.addEventListener('pointerdown', onContainerPointerDown, { capture: true });

  function onResize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    requestRender();
  }
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  rebuildPlacements();
  requestRender();

  return {
    updateYears(newYears: number) {
      years = newYears;
      rebuildPlacements();
    },
    refreshPlacements() {
      rebuildPlacements();
    },
    setArmedPlant(plantId: string | null) {
      armedPlantId = plantId;
    },
    setSelectedPlacement(placementId: string | null) {
      selectedPlacementId = placementId;
      for (const mesh of plantsGroup.children) {
        const ring = mesh.getObjectByName('selection-ring');
        if (ring) ring.visible = mesh.userData.placementId === placementId;
      }
      requestRender();
    },
    dispose() {
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', onContainerPointerDown, { capture: true } as any);
      renderer.domElement.removeEventListener('pointermove', onPlantPointerMove);
      controls.dispose();
      scene.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as any).material;
        if (Array.isArray(mat)) mat.forEach((m: THREE.Material) => m.dispose());
        else if (mat) mat.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    },
  };
}
