import type { Proj } from '../tracks/path';

/** Convert the road plane to the kart's local axes, including sideways/reverse driving. */
export function groundPose(pr: Proj, yaw: number): { pitch: number; roll: number } {
  const h = Math.hypot(pr.fx, pr.fz) || 1;
  const grade = pr.fy / h;
  const gx = pr.fx / h * grade + pr.hx * pr.bankTan;
  const gz = pr.fz / h * grade + pr.hz * pr.bankTan;
  const forwardGrade = gx * Math.sin(yaw) + gz * Math.cos(yaw);
  const sideGrade = gx * Math.cos(yaw) - gz * Math.sin(yaw);
  const pitch = -Math.atan(forwardGrade);
  // XYZ Euler order: compensate for pitch when fitting the transverse tangent.
  return { pitch, roll: Math.atan(sideGrade * Math.cos(pitch)) };
}
