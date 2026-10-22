import type { TrackDef } from './tracks';
import { roundRoute, type Vec3T } from '../tracks/path';

// Every circuit is independently laid out in metres, with a readable start straight,
// two route choices, an elevated crossing and a purpose-built jump landing.
const points = (rows: number[][]): Vec3T[] => rows.map(([x, z, y]) => [x, y, z]);
const course = (d: Pick<TrackDef, 'id' | 'no' | 'name' | 'theme' | 'desc' | 'points'> & Partial<TrackDef>): TrackDef => ({
  bpm: 145, width: 23, shoulder: 4, boostPads: [{ u: 0.025, t: 0 }, { u: 0.26, t: 0 }, { u: 0.53, t: 0 }, { u: 0.81, t: 0 }],
  ramps: [], gaps: [], itemRows: [0.15, 0.36, 0.59, 0.86],
  coins: [{ u: 0.18, t: -4, n: 6 }, { u: 0.46, t: 4, n: 6 }, { u: 0.7, t: 0, n: 7 }],
  zones: [], shortcuts: [], hazards: [], medals: { gold: 180000, silver: 205000, bronze: 240000 }, par: 205000,
  ...d,
  points: roundRoute(d.points, true),
});

export const ADVENTURE_TRACKS: TrackDef[] = [
  course({ id: 't1', no: 1, name: '별사탕 구름 협곡', theme: 'candy',
    desc: '과자 협곡을 오르는 구름 다리. 수정 동굴과 전망길 중 원하는 길을 골라요.',
    points: points([[0,0,20],[115,0,20],[230,-10,30],[300,-80,58],[280,-170,82],[210,-220,88],[115,-220,66],[65,-160,42],[135,-120,24],[120,-60,20],[30,-70,36],[-45,-140,64],[-140,-220,78],[-225,-185,52],[-255,-95,26],[-205,-25,16],[-100,0,20]]),
    bridge: [{ u0: 0.13, u1: 0.37 }, { u0: 0.61, u1: 0.8 }],
    adventures: [{ u0: 0.42, u1: 0.52, kind: 'cave' }],
    shortcuts: [
      { fromU: 0.16, toU: 0.35, via: [[230,105,-145]], width: 15, surface: 'road', boostPad: true, label: '구름 전망길' },
      { fromU: 0.63, toU: 0.81, via: [[-220,26,-230]], width: 15, surface: 'road', boostPad: true, label: '협곡 숲길' },
    ],
  }),
  course({ id: 't2', no: 2, name: '하늘강 공중 수로', theme: 'hangang',
    desc: '폭포 위 현수교와 수상도시. 높은 다리와 낮은 강변길이 다시 만나요.',
    points: points([[0,0,14],[125,0,14],[240,0,20],[310,60,42],[310,155,72],[240,215,96],[145,220,90],[95,160,60],[160,115,38],[155,55,24],[70,65,20],[-5,145,32],[-100,225,58],[-205,205,78],[-265,120,65],[-240,35,36],[-130,0,14]]),
    bridge: [{ u0: 0.16, u1: 0.41 }, { u0: 0.66, u1: 0.84 }], water: { y: 0, color: '#37B9D8', area: 'all' },
    adventures: [{ u0: 0.57, u1: 0.66, kind: 'ruins' }],
    shortcuts: [
      { fromU: 0.18, toU: 0.36, via: [[390,30,160]], width: 16, surface: 'road', boostPad: true, label: '강변 수로' },
      { fromU: 0.64, toU: 0.84, via: [[-130,110,125]], width: 15, surface: 'road', boostPad: true, label: '폭포 위 다리' },
    ],
  }),
  course({ id: 't3', no: 3, name: '네온 오비탈 시티', theme: 'neon', bpm: 154,
    desc: '빌딩 사이 360° 자기장 루프와 공중 교차로. 네온 터널로 뛰어들어요.',
    points: points([[0,0,30],[120,0,30],[250,0,30],[340,-70,62],[350,-165,102],[275,-245,126],[160,-250,108],[110,-185,78],[185,-140,62],[190,-80,50],[95,-70,44],[10,-135,60],[-90,-245,92],[-210,-225,115],[-280,-120,86],[-235,-30,48],[-120,0,30]]),
    loops: [{ u0: 0.05, u1: 0.085, radius: 27 }],
    bridge: [{ u0: 0.12, u1: 0.4 }, { u0: 0.64, u1: 0.87 }], tunnel: [{ u0: 0.43, u1: 0.53 }],
    shortcuts: [
      { fromU: 0.17, toU: 0.37, via: [[430,65,-170]], width: 16, surface: 'road', boostPad: true, label: '도시 외곽선' },
      { fromU: 0.62, toU: 0.84, via: [[-120,135,-130]], width: 15, surface: 'road', boostPad: true, label: '스카이 익스프레스' },
    ],
  }),
  course({ id: 't4', no: 4, name: '수정 동굴 대탐험', theme: 'cavern',
    desc: '거대한 보랏빛 수정과 지하 호수. 동굴 깊은 길과 지상 절벽길을 탐험해요.',
    points: points([[0,0,38],[110,0,38],[215,5,24],[285,75,5],[260,175,-14],[170,235,-22],[65,225,-8],[20,155,12],[95,115,26],[100,55,42],[15,60,65],[-55,135,86],[-145,220,72],[-240,185,46],[-265,90,18],[-210,15,28],[-100,0,38]]),
    adventures: [{ u0: 0.15, u1: 0.42, kind: 'cave' }, { u0: 0.65, u1: 0.86, kind: 'cave' }],
    bridge: [{ u0: 0.44, u1: 0.63 }], water: { y: -32, color: '#6B4CB6', area: 'all' },
    shortcuts: [
      { fromU: 0.17, toU: 0.37, via: [[350,36,155]], width: 16, surface: 'road', boostPad: true, label: '절벽 전망길' },
      { fromU: 0.62, toU: 0.83, via: [[-140,-12,125]], width: 15, surface: 'road', boostPad: true, label: '지하 호수길' },
    ],
  }),
  course({ id: 't5', no: 5, name: '화산 심연 랠리', theme: 'volcano', bpm: 158,
    desc: '용암 바다 위 360° 루프와 무너진 다리 점프. 분화구 안쪽으로 향해요.',
    points: points([[0,0,32],[125,0,32],[255,0,32],[350,-70,58],[350,-170,90],[270,-245,112],[155,-240,100],[100,-175,74],[175,-130,52],[160,-65,36],[65,-65,30],[-15,-140,55],[-100,-230,86],[-215,-200,105],[-270,-105,78],[-225,-20,44],[-110,0,32]]),
    loops: [{ u0: 0.05, u1: 0.085, radius: 28 }],
    bridge: [{ u0: 0.1, u1: 0.4 }, { u0: 0.62, u1: 0.87 }],
    adventures: [{ u0: 0.42, u1: 0.55, kind: 'lava' }, { u0: 0.67, u1: 0.8, kind: 'lava' }],
    water: { y: 5, color: '#FF5720', area: 'all' },
    shortcuts: [
      { fromU: 0.19, toU: 0.36, via: [[440,48,-165]], width: 16, surface: 'road', boostPad: true, label: '용암 해안길' },
      { fromU: 0.63, toU: 0.84, via: [[-135,128,-115]], width: 16, surface: 'road', boostPad: true, label: '분화구 능선' },
    ],
  }),
  course({ id: 't6', no: 6, name: '오로라 빙하 익스프레스', theme: 'icecream', bpm: 152,
    desc: '푸른 빙하 동굴과 얼음 아치. 크레바스를 점프하고 정상의 길을 선택해요.',
    points: points([[0,0,26],[120,0,26],[240,0,40],[315,70,68],[300,165,104],[220,225,128],[110,220,116],[55,155,88],[130,115,64],[130,50,46],[40,55,38],[-35,140,64],[-130,225,98],[-225,190,112],[-270,95,84],[-220,20,48],[-110,0,26]]),
    adventures: [{ u0: 0.17, u1: 0.39, kind: 'glacier' }, { u0: 0.65, u1: 0.83, kind: 'glacier' }],
    bridge: [{ u0: 0.43, u1: 0.64 }], water: { y: 0, color: '#2485BA', area: 'all' },
    zones: [{ u0: 0.26, u1: 0.3, t0: -7, t1: 7, surface: 'ice' }],
    shortcuts: [
      { fromU: 0.18, toU: 0.37, via: [[365,64,170]], width: 16, surface: 'road', boostPad: true, label: '빙하 해안길' },
      { fromU: 0.64, toU: 0.85, via: [[-145,148,110]], width: 16, surface: 'road', boostPad: true, label: '오로라 정상길' },
    ],
  }),
  course({ id: 't7', no: 7, name: '폭포 유적 하이랜드', theme: 'jeju', bpm: 150,
    desc: '폭포 사이 유적과 구름에 닿는 현수교. 깊은 동굴과 높은 능선으로 갈라져요.',
    points: points([[0,0,22],[120,0,22],[240,5,36],[315,80,68],[295,180,108],[205,240,138],[95,225,122],[45,150,86],[120,110,60],[125,45,40],[35,55,44],[-45,140,78],[-145,230,116],[-240,185,126],[-275,85,92],[-215,10,50],[-105,0,22]]),
    bridge: [{ u0: 0.16, u1: 0.4 }, { u0: 0.61, u1: 0.86 }],
    adventures: [{ u0: 0.41, u1: 0.53, kind: 'ruins' }, { u0: 0.69, u1: 0.8, kind: 'cave' }],
    water: { y: -3, color: '#3CBFB8', area: 'all' },
    shortcuts: [
      { fromU: 0.18, toU: 0.37, via: [[385,52,165]], width: 16, surface: 'road', boostPad: true, label: '폭포 해안길' },
      { fromU: 0.62, toU: 0.84, via: [[-135,160,115]], width: 16, surface: 'road', boostPad: true, label: '고대 하늘길' },
    ],
  }),
  course({ id: 't8', no: 8, name: '성운 드래곤 스카이웨이', theme: 'rainbow', bpm: 165,
    desc: '우주 구름 사이 360° 루프와 공중 점프. 세 갈래 하늘길을 자유롭게 달려요.',
    points: points([[0,0,68],[125,0,68],[255,0,68],[350,-75,100],[335,-180,144],[245,-250,172],[125,-240,158],[70,-170,126],[150,-125,98],[150,-55,82],[55,-60,90],[-25,-140,128],[-130,-240,165],[-245,-205,150],[-285,-100,116],[-225,-15,88],[-110,0,68]]),
    loops: [{ u0: 0.05, u1: 0.085, radius: 30 }], voidWorld: true,
    lowGravity: [{ u0: 0.43, u1: 0.52 }],
    shortcuts: [
      { fromU: 0.18, toU: 0.38, via: [[440,122,-180]], width: 16, surface: 'road', boostPad: true, label: '별빛 바깥길' },
      { fromU: 0.18, toU: 0.38, via: [[200,205,-120]], width: 16, surface: 'road', boostPad: true, label: '드래곤 정상길' },
      { fromU: 0.63, toU: 0.85, via: [[-160,200,-100]], width: 16, surface: 'road', boostPad: true, label: '성운 지름길' },
    ],
  }),
];

// Same takeoff/landing design for every circuit: the jump follows a safe straight.
for (const track of ADVENTURE_TRACKS) {
  track.gaps = [{ u0: 0.905, u1: 0.912 }];
  track.ramps = [{ u: 0.904, len: 12, h: 4.8, t0: -10.5, t1: 10.5 }];
  track.noWall = [{ u0: 0.899, u1: 0.916, side: 'both' }];
  track.boostPads.push({ u: 0.886, t: 0 });
}
