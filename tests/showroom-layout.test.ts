import { describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { frameShowroom, visibleShowroomBounds } from '../src/game/showroomLayout';

describe('mobile showroom camera uses the space between controls', () => {
  it('ignores hidden shield and respawn geometry when sizing the visible car', () => {
    const model = new Group(), hidden = new Group();
    model.add(new Mesh(new BoxGeometry(3,2,4)));
    hidden.add(new Mesh(new BoxGeometry(20,20,20)));
    hidden.visible = false;
    model.add(hidden);
    expect(visibleShowroomBounds(model, new Box3()).getSize(new Vector3()).toArray()).toEqual([3,2,4]);
  });
  it('includes the placement of visible instanced vehicle parts', () => {
    const model = new Group();
    const wheels = new InstancedMesh(new BoxGeometry(1,1,1), new MeshBasicMaterial(), 2);
    wheels.setMatrixAt(0,new Matrix4().makeTranslation(-2,0,0));
    wheels.setMatrixAt(1,new Matrix4().makeTranslation(2,0,0));
    model.add(wheels);
    expect(visibleShowroomBounds(model,new Box3()).getSize(new Vector3()).toArray()).toEqual([5,1,1]);
  });
  for (const [width, height, slot] of [
    [568, 230, { x: 158, y: 50, width: 272, height: 112 }],
    [844, 250, { x: 245, y: 50, width: 400, height: 132 }],
    [844, 390, { x: 245, y: 56, width: 400, height: 254 }],
    [932, 430, { x: 220, y: 16, width: 640, height: 370 }],
  ] as const) {
    for (const size of [[3, 2.6, 4], [6, 2, 3], [1.5, 5.5, 1.5]]) {
      it(`keeps ${size.join('x')} subject inside ${width}x${height} reserved preview`, () => {
        const box = new Box3(new Vector3(-size[0]/2, 0, -size[2]/2), new Vector3(size[0]/2, size[1], size[2]/2));
        const camera = new PerspectiveCamera(36, width/height, .1, 3000);
        frameShowroom(camera, box, slot, width, height, new Vector3(-1.5,2.8,11.5), new Vector3(-3.6,1.6,0));
        for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
          const p = new Vector3(x,y,z).project(camera);
          const sx = (p.x+1)*width/2, sy = (1-p.y)*height/2;
          expect(sx).toBeGreaterThanOrEqual(slot.x+7.9);
          expect(sx).toBeLessThanOrEqual(slot.x+slot.width-7.9);
          expect(sy).toBeGreaterThanOrEqual(slot.y+7.9);
          expect(sy).toBeLessThanOrEqual(slot.y+slot.height-7.9);
          expect(p.z).toBeLessThan(1);
        }
      });
    }
  }
});
