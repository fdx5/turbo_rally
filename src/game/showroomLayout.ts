import { Box3, PerspectiveCamera, Quaternion, Vector3, type Object3D, type Mesh, type InstancedMesh } from 'three';

export interface ShowroomArea { x: number; y: number; width: number; height: number }
let area: ShowroomArea | null = null;
export const setShowroomArea = (value: ShowroomArea | null) => { area = value; };
export const getShowroomArea = () => area;
const center = new Vector3(), corner = new Vector3(), direction = new Vector3();
const inverse = new Quaternion();
const meshBounds = new Box3();

/** Hidden shields, respawn clouds and inactive expressions are not part of the preview. */
export function visibleShowroomBounds(subject: Object3D, box: Box3) {
  subject.updateWorldMatrix(true, true);
  box.makeEmpty();
  subject.traverseVisible(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const instanced = mesh as InstancedMesh;
    if (instanced.isInstancedMesh) {
      instanced.computeBoundingBox();
      if (instanced.boundingBox) box.union(meshBounds.copy(instanced.boundingBox).applyMatrix4(mesh.matrixWorld));
    } else {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) box.union(meshBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld));
    }
  });
  return box;
}

/** Fit every model corner inside the DOM's unobstructed area, including rotating wide vehicles/hats. */
export function frameShowroom(camera: PerspectiveCamera, box: Box3, slot: ShowroomArea, width: number, height: number, from: Vector3, look: Vector3) {
  box.getCenter(center);
  direction.subVectors(from, look).normalize();
  camera.position.copy(center).add(direction);
  camera.lookAt(center);
  inverse.copy(camera.quaternion).invert();
  const tan = Math.tan(camera.fov * Math.PI / 360);
  const tx = tan * Math.max(1, slot.width - 16) / height;
  const ty = tan * Math.max(1, slot.height - 16) / height;
  let distance = 1;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        corner.set(x, y, z).sub(center).applyQuaternion(inverse);
        distance = Math.max(distance, corner.z + Math.abs(corner.x) / tx, corner.z + Math.abs(corner.y) / ty);
      }
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.setViewOffset(width, height, width / 2 - slot.x - slot.width / 2, height / 2 - slot.y - slot.height / 2, width, height);
  camera.updateMatrixWorld(true);
}
