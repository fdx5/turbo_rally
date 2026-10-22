import * as THREE from 'three';
import type { KartBody } from '../physics/kart';
import { Proj, type TrackPath } from '../tracks/path';
import { groundPose } from './groundPose';

const MAGIC = -731601,
  VERSION = 3,
  STRIDE = 12,
  RATE = 0.05;
const qa = new THREE.Quaternion(),
  qb = new THREE.Quaternion(),
  euler = new THREE.Euler();
const up = new THREE.Vector3(0, 1, 0),
  forward = new THREE.Vector3();
const projection = new Proj();

/** Store the actual full orientation, including the airborne 360-degree trick. */
export function recordReplayFrame(data: number[], body: KartBody, seconds?: number) {
  if (!data.length) data.push(MAGIC, VERSION, STRIDE, RATE);
  const timestamp = seconds ?? ((data.length - 4) / STRIDE) * RATE;
  const pose = groundPose(body.proj, body.yaw);
  qa.setFromAxisAngle(up, body.yaw);
  qa.multiply(
    qb.setFromEuler(
      euler.set(body.grounded ? pose.pitch : -body.vy * 0.012, 0, body.grounded ? pose.roll : 0),
    ),
  );
  qa.multiply(qb.setFromAxisAngle(up, body.trickAngle + body.driftVisual + body.spinAngle));
  data.push(
    body.x,
    body.y,
    body.z,
    qa.x,
    qa.y,
    qa.z,
    qa.w,
    body.proj.s,
    body.proj.t,
    body.onPath,
    body.grounded ? 1 : 0,
    timestamp,
  );
}

export function sampleReplay(
  data: Float32Array,
  seconds: number,
  paths: TrackPath[],
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
): boolean {
  // Old recordings describe the retired layouts and cannot safely be placed on these roads.
  if (data[0] !== MAGIC || data[1] !== VERSION || data[2] !== STRIDE) return false;
  const count = Math.floor((data.length - 4) / STRIDE);
  if (count < 2 || seconds < data[4 + 11] || seconds >= data[4 + (count - 1) * STRIDE + 11]) return false;
  let low = 0,
    high = count - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (data[4 + mid * STRIDE + 11] <= seconds) low = mid;
    else high = mid;
  }
  const a = 4 + low * STRIDE,
    b = a + STRIDE;
  const k = THREE.MathUtils.clamp((seconds - data[a + 11]) / (data[b + 11] - data[a + 11]), 0, 1);
  position.set(
    data[a] + (data[b] - data[a]) * k,
    data[a + 1] + (data[b + 1] - data[a + 1]) * k,
    data[a + 2] + (data[b + 2] - data[a + 2]) * k,
  );
  qa.fromArray(data, a + 3);
  qb.fromArray(data, b + 3);
  quaternion.slerpQuaternions(qa, qb, k);
  const path = paths[data[a + 9]];
  if (path && data[a + 9] === data[b + 9] && data[a + 10] && data[b + 10]) {
    let delta = data[b + 7] - data[a + 7];
    if (path.closed && Math.abs(delta) > path.length / 2) delta += delta > 0 ? -path.length : path.length;
    const s = data[a + 7] + delta * k,
      t = data[a + 8] + (data[b + 8] - data[a + 8]) * k;
    path.pointAt(s, t, position);
    path.project(position.x, position.y, position.z, path.idxAtS(s), projection, 4);
    forward.set(0, 0, 1).applyQuaternion(quaternion);
    const yaw = Math.atan2(forward.x, forward.z),
      pose = groundPose(projection, yaw);
    quaternion.setFromAxisAngle(up, yaw).multiply(qb.setFromEuler(euler.set(pose.pitch, 0, pose.roll)));
  }
  position.addScaledVector(forward.copy(up).applyQuaternion(quaternion), 0.025);
  return true;
}
