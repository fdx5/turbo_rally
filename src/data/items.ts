/**
 * Data-driven item definitions. Every basic item (12), shop weapon (40) and vehicle skill (20)
 * maps onto a small set of behaviour archetypes implemented in src/items/itemSystem.ts.
 */
export type HitFx =
  | 'spin'
  | 'stop'
  | 'launch'
  | 'slow'
  | 'slip'
  | 'float'
  | 'freeze'
  | 'reverse'
  | 'sleep'
  | 'wobble'
  | 'shrink'
  | 'blind'
  | 'flash'
  | 'seal'
  | 'pull'
  | 'squash'
  | 'push';
export interface Hit {
  fx: HitFx;
  dur: number;
  amt?: number;
  coins?: number;
}
export type Model =
  | 'jelly'
  | 'heart'
  | 'comet'
  | 'pudding'
  | 'fakebox'
  | 'candy'
  | 'cloud'
  | 'bolt'
  | 'star'
  | 'bubble'
  | 'balloon'
  | 'marshmallow'
  | 'honey'
  | 'acorn'
  | 'popcorn'
  | 'yoyo'
  | 'duck'
  | 'top'
  | 'snowball'
  | 'gum'
  | 'magnet'
  | 'camera'
  | 'sheep'
  | 'mushroom'
  | 'choco'
  | 'bee'
  | 'beachball'
  | 'mirror'
  | 'missile'
  | 'blackhole'
  | 'portal'
  | 'meteor'
  | 'dragon'
  | 'crown'
  | 'box'
  | 'letter'
  | 'yogurt'
  | 'cement'
  | 'stop'
  | 'trashbag'
  | 'sand'
  | 'icecream'
  | 'tteok'
  | 'golfball'
  | 'deliverybox'
  | 'water';

export type Behavior =
  | { kind: 'boost'; dur: number; mult: number; uses?: number }
  | { kind: 'shield'; dur: number; hits: number; reflect?: boolean; knock?: boolean }
  | { kind: 'invincible'; dur: number; mult: number; scale?: number; cleanse?: boolean; pushRadius?: number }
  | { kind: 'intangible'; dur: number }
  | {
      kind: 'projectile';
      motion: 'straight' | 'homing' | 'lob' | 'rollBack' | 'boomerang' | 'centerline' | 'wander' | 'leader' | 'trackFly' | 'rain';
      count?: number;
      speed?: number;
      life?: number;
      bounces?: number;
      target?: 'ahead' | 'ahead2' | 'leader' | 'random';
      hit: Hit;
      radius?: number;
      aoe?: number;
      pierce?: number;
      zone?: { radius: number; dur: number; hit: Hit; tint: string };
      model: Model;
      orbit?: boolean; // triple items orbit the kart before firing
    }
  | { kind: 'trap'; count?: number; scatter?: number; model: Model; hit: Hit; radius?: number; life?: number; proximity?: number; heldShield?: boolean }
  | { kind: 'zone'; at: 'behind' | 'trail'; radius: number; dur: number; hit: Hit; tint: string; model?: Model; wall?: boolean; pull?: boolean }
  | { kind: 'area'; shape: 'cone' | 'beam' | 'radius' | 'aheadRange' | 'allOthers' | 'aheadAll' | 'aheadN'; range?: number; n?: number; hit: Hit; byRank?: boolean }
  | { kind: 'teleport'; dist: number }
  | { kind: 'glide'; dur: number }
  | { kind: 'autopilot'; dur: number; mult: number }
  | { kind: 'steal' }
  | { kind: 'lucky' }
  | { kind: 'lockon'; dur: number; hit: Hit }
  | { kind: 'stomp'; radius: number; hit: Hit }
  | { kind: 'suck'; dur: number; radius: number; then?: Behavior };

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  type: string;
  desc: string;
  behavior: Behavior;
  sfx?: string;
}

const SPIN = (d = 1.2, coins = 3): Hit => ({ fx: 'spin', dur: d, coins });

export const BASIC_ITEMS: ItemDef[] = [
  { id: 'sugar', name: '슈가 대시', icon: '🍬', type: '부스트', desc: '1초간 +35% 가속, 오프로드 무시', behavior: { kind: 'boost', dur: 1.0, mult: 1.35 } },
  { id: 'sugar3', name: '트리플 슈가 대시', icon: '🍭', type: '부스트', desc: '슈가 대시 3회', behavior: { kind: 'boost', dur: 1.0, mult: 1.35, uses: 3 } },
  { id: 'pudding', name: '푸딩 슬릭', icon: '🍮', type: '설치', desc: '밟으면 미끄러져요. 뒤에 들고 방패로도!', behavior: { kind: 'trap', model: 'pudding', hit: SPIN(1.0, 3), heldShield: true } },
  { id: 'jelly', name: '젤리볼', icon: '🟢', type: '투척', desc: '벽에 5번 튕기며 직진', behavior: { kind: 'projectile', motion: 'straight', speed: 52, bounces: 5, life: 7, hit: SPIN(1.2), model: 'jelly' } },
  { id: 'jelly3', name: '트리플 젤리볼', icon: '🫧', type: '투척', desc: '3발이 공전하다 하나씩 발사', behavior: { kind: 'projectile', motion: 'straight', speed: 52, bounces: 5, life: 7, count: 3, orbit: true, hit: SPIN(1.2), model: 'jelly' } },
  { id: 'heart', name: '하트 미사일', icon: '💗', type: '유도', desc: '바로 앞 순위를 쫓아가요', behavior: { kind: 'projectile', motion: 'homing', target: 'ahead', speed: 48, life: 12, hit: { fx: 'launch', dur: 1.2, coins: 3 }, model: 'heart' } },
  { id: 'comet', name: '별똥별 혜성', icon: '☄️', type: '1등 추격', desc: '1등에게 낙하 폭발!', behavior: { kind: 'projectile', motion: 'leader', target: 'leader', speed: 75, life: 20, aoe: 9, hit: { fx: 'stop', dur: 1.8, coins: 3 }, model: 'comet' } },
  { id: 'bubble', name: '버블 실드', icon: '🫧', type: '방어', desc: '8초 동안 1회 피격 무효', behavior: { kind: 'shield', dur: 8, hits: 1 } },
  { id: 'cotton', name: '솜사탕 구름', icon: '☁️', type: '교란', desc: '앞 순위 전원 화면을 솜사탕으로 가려요(4초)', behavior: { kind: 'area', shape: 'aheadAll', hit: { fx: 'blind', dur: 4 } } },
  { id: 'mini', name: '미니미 번개', icon: '⚡', type: '전체', desc: '나 빼고 전원 축소(3~6초)', behavior: { kind: 'area', shape: 'allOthers', byRank: true, hit: { fx: 'shrink', dur: 4.5, coins: 0 } } },
  { id: 'rainbow', name: '무지개 별', icon: '🌟', type: '무적', desc: '7초 무적 + 속도 +20%, 닿은 상대를 날려요', behavior: { kind: 'invincible', dur: 7, mult: 1.2 } },
  { id: 'fakebox', name: '가짜 선물상자', icon: '🎁', type: '설치', desc: '아이템 박스와 닮은 함정', behavior: { kind: 'trap', model: 'fakebox', hit: SPIN(1.2) } },
];

/** itemOdds[rank-1][itemIndex] — front ranks get defensive/trap items, back ranks get catch-up items (§5.1). */
export const ITEM_ODDS: number[][] = [
  [12, 0, 25, 20, 4, 0, 0, 15, 0, 0, 0, 24],
  [15, 3, 15, 18, 10, 12, 0, 12, 5, 0, 0, 10],
  [18, 6, 10, 12, 12, 16, 2, 10, 7, 1, 1, 5],
  [20, 10, 6, 8, 12, 18, 4, 8, 7, 2, 3, 2],
  [18, 14, 4, 5, 10, 18, 6, 6, 8, 3, 6, 2],
  [15, 18, 2, 3, 8, 16, 8, 4, 8, 5, 12, 1],
  [12, 22, 0, 2, 5, 12, 10, 3, 8, 7, 18, 1],
  [10, 25, 0, 0, 3, 10, 12, 2, 8, 9, 21, 0],
];

export interface WeaponDef extends ItemDef {
  no: number;
  price: number;
  power: number; // 1..5
  rarityWeight: number;
  allowedRanks: [number, number];
  cooldownTag: string;
}
const W = (
  no: number,
  id: string,
  name: string,
  price: number,
  type: string,
  icon: string,
  desc: string,
  behavior: Behavior,
  power: number,
  rarityWeight: number,
  allowedRanks: [number, number],
  cooldownTag = id,
): WeaponDef => ({ no, id, name, price, type, icon, desc, behavior, power, rarityWeight, allowedRanks, cooldownTag });

export const WEAPONS: WeaponDef[] = [
  W(1, 'w_slingshot', '젤리 새총', 2000, '투척', '🪀', '작은 젤리 3연발 직진, 각 0.6초 감속', { kind: 'projectile', motion: 'straight', count: 3, speed: 58, bounces: 1, life: 4, hit: { fx: 'slow', dur: 0.6, amt: 0.6 }, model: 'jelly' }, 1, 10, [1, 8]),
  W(2, 'w_bubblegun', '비눗방울 건', 2500, '투척', '🫧', '맞으면 방울에 갇혀 1초 공중 부유', { kind: 'projectile', motion: 'straight', speed: 40, bounces: 2, life: 5, hit: { fx: 'float', dur: 1.0 }, model: 'bubble' }, 1, 10, [1, 8]),
  W(3, 'w_waterballoon', '물풍선', 3000, '포물선', '🎈', '착탄 반경 물보라, 1초 감속', { kind: 'projectile', motion: 'lob', speed: 34, aoe: 6, hit: { fx: 'slow', dur: 1.0, amt: 0.55 }, model: 'balloon' }, 1, 10, [1, 8]),
  W(4, 'w_marshmallow', '마시멜로 폭탄', 3000, '포물선', '🍡', '끈적 지대 3초 생성', { kind: 'projectile', motion: 'lob', speed: 34, aoe: 4, hit: { fx: 'slow', dur: 0.8, amt: 0.6 }, zone: { radius: 5, dur: 3, hit: { fx: 'slow', dur: 0.5, amt: 0.55 }, tint: '#FFF0F5' }, model: 'marshmallow' }, 1, 9, [1, 8]),
  W(5, 'w_honey', '꿀단지 트랩', 4000, '설치', '🍯', '밟으면 2초 끈적 감속', { kind: 'trap', model: 'honey', hit: { fx: 'slow', dur: 2, amt: 0.5 } }, 1, 9, [1, 8]),
  W(6, 'w_acorn', '도토리 흩뿌리기', 4500, '설치', '🌰', '후방에 도토리 5개 산개', { kind: 'trap', model: 'acorn', count: 5, scatter: 3.5, radius: 0.9, hit: { fx: 'spin', dur: 0.7, coins: 1 } }, 2, 9, [1, 8]),
  W(7, 'w_popcorn', '팝콘 지뢰', 5000, '설치', '🍿', '근접하면 팡! 튀어올라요', { kind: 'trap', model: 'popcorn', proximity: 4, hit: { fx: 'launch', dur: 1.0, coins: 2 } }, 2, 8, [1, 8]),
  W(8, 'w_yoyo', '요요 부메랑', 6000, '투척', '🪀', '전방으로 나갔다 돌아와요(2회 판정)', { kind: 'projectile', motion: 'boomerang', speed: 45, life: 3.2, pierce: 2, hit: SPIN(1.0, 2), model: 'yoyo' }, 2, 8, [1, 8]),
  W(9, 'w_duck', '고무오리 어뢰', 7000, '유도(약)', '🦆', '트랙 중앙선을 따라 전진', { kind: 'projectile', motion: 'centerline', speed: 46, life: 9, hit: SPIN(1.2), model: 'duck' }, 2, 8, [1, 8]),
  W(10, 'w_top', '회오리 팽이', 8000, '배회', '🌀', '6초간 트랙을 배회하며 스핀', { kind: 'projectile', motion: 'wander', speed: 14, life: 6, pierce: 9, hit: SPIN(1.0, 2), model: 'top' }, 2, 7, [1, 8]),
  W(11, 'w_heart2', '하트 유도탄 2연', 10000, '유도', '💞', '앞 2명을 각각 추적', { kind: 'projectile', motion: 'homing', target: 'ahead2', count: 2, speed: 48, life: 12, hit: { fx: 'launch', dur: 1.2, coins: 3 }, model: 'heart' }, 3, 7, [2, 8]),
  W(12, 'w_snowball', '스노우볼 캐논', 12000, '투척', '⛄', '명중 시 1.5초 빙결', { kind: 'projectile', motion: 'straight', speed: 60, bounces: 1, life: 5, hit: { fx: 'freeze', dur: 1.5 }, model: 'snowball' }, 3, 7, [1, 8]),
  W(13, 'w_gumwall', '풍선껌 벽', 14000, '설치', '🫧', '후방 차선 절반을 막는 벽 4초', { kind: 'zone', at: 'behind', radius: 4.5, dur: 4, wall: true, hit: { fx: 'stop', dur: 0.6 }, tint: '#FF9EC7', model: 'gum' }, 3, 6, [1, 8]),
  W(14, 'w_magnetpunch', '자석 펀치', 16000, '유도', '🧲', '앞 상대를 0.8초 뒤로 끌어당겨요', { kind: 'projectile', motion: 'homing', target: 'ahead', speed: 60, life: 8, hit: { fx: 'pull', dur: 0.8 }, model: 'magnet' }, 3, 6, [2, 8]),
  W(15, 'w_flash', '반짝 플래시 카메라', 18000, '범위', '📸', '전방 콘 범위 섬광(1.5초)', { kind: 'area', shape: 'cone', range: 45, hit: { fx: 'flash', dur: 1.5 } }, 3, 6, [1, 8]),
  W(16, 'w_laser', '무지개 레이저', 20000, '빔', '🌈', '1초 전방 직선 빔, 닿으면 스핀', { kind: 'area', shape: 'beam', range: 70, hit: SPIN(1.2) }, 3, 5, [2, 8]),
  W(17, 'w_thundercloud', '미니 번개구름', 22000, '지정', '🌩️', '바로 앞 2명에게 번개(축소 3초)', { kind: 'area', shape: 'aheadN', n: 2, hit: { fx: 'shrink', dur: 3 } }, 3, 5, [2, 8]),
  W(18, 'w_sheep', '잠꾸러기 양', 24000, '유도', '🐑', '맞으면 1.2초 "쿨쿨" 자동 감속', { kind: 'projectile', motion: 'homing', target: 'ahead', speed: 44, life: 12, hit: { fx: 'sleep', dur: 1.2 }, model: 'sheep' }, 3, 5, [2, 8]),
  W(19, 'w_mushroom', '거꾸로 버섯', 26000, '유도', '🍄', '1.5초 조향 반전', { kind: 'projectile', motion: 'homing', target: 'ahead', speed: 46, life: 12, hit: { fx: 'reverse', dur: 1.5 }, model: 'mushroom' }, 3, 5, [2, 8]),
  W(20, 'w_choco', '초코 분수', 28000, '설치', '🍫', '후방 초코 웅덩이 5초(오프로드)', { kind: 'zone', at: 'behind', radius: 6, dur: 5, hit: { fx: 'slow', dur: 0.4, amt: 0.5 }, tint: '#8B5A3C', model: 'choco' }, 3, 5, [1, 8]),
  W(21, 'w_bees', '벌집 드론', 30000, '유도', '🐝', '꿀벌 드론 3기가 각각 추적', { kind: 'projectile', motion: 'homing', target: 'random', count: 3, speed: 42, life: 10, hit: SPIN(0.9, 2), model: 'bee' }, 4, 4, [2, 8]),
  W(22, 'w_tsunami', '푸딩 쓰나미', 34000, '범위', '🌊', '후방 전 차선 파도 1회', { kind: 'projectile', motion: 'rollBack', speed: 30, life: 5, radius: 9, pierce: 9, hit: SPIN(1.0, 2), model: 'pudding' }, 4, 4, [1, 8]),
  W(23, 'w_beachball', '거대 비치볼', 38000, '투척(후방)', '🏐', '커다란 공이 역주행하며 굴러가요', { kind: 'projectile', motion: 'rollBack', speed: 26, life: 8, radius: 3.2, pierce: 9, hit: { fx: 'launch', dur: 1.0, coins: 2 }, model: 'beachball' }, 4, 4, [1, 8]),
  W(24, 'w_mirror', '반사 거울', 40000, '방어', '🪞', '다음 투사체 1회 반사(10초)', { kind: 'shield', dur: 10, hits: 1, reflect: true }, 4, 4, [1, 8]),
  W(25, 'w_ghost', '유령 망토', 45000, '방어', '👻', '2.5초 반투명, 모든 피격 무시', { kind: 'intangible', dur: 2.5 }, 4, 4, [1, 8]),
  W(26, 'w_itemmagnet', '아이템 자석', 50000, '교란', '🧲', '가장 가까운 상대의 아이템 강탈', { kind: 'steal' }, 4, 3, [2, 8]),
  W(27, 'w_candymissiles', '캔디 미사일 편대', 55000, '유도', '🚀', '소형 유도 미사일 5발 분산', { kind: 'projectile', motion: 'homing', target: 'random', count: 5, speed: 50, life: 9, hit: SPIN(0.8, 1), model: 'missile' }, 4, 3, [3, 8]),
  W(28, 'w_blackhole', '미니 블랙홀', 60000, '설치', '🕳️', '3초간 주변 카트를 빨아들여 감속', { kind: 'zone', at: 'behind', radius: 9, dur: 3, pull: true, hit: { fx: 'slow', dur: 0.3, amt: 0.5 }, tint: '#9B7BD8', model: 'blackhole' }, 4, 3, [2, 8]),
  W(29, 'w_portal', '순간이동 포털', 65000, '이동', '🌀', '전방 40m 순간이동 + 원위치에 함정 포털', { kind: 'teleport', dist: 40 }, 4, 3, [3, 8]),
  W(30, 'w_meteorshower', '별똥별 샤워', 70000, '범위', '🌠', '전방 구간에 운석 6개 무작위 낙하', { kind: 'projectile', motion: 'rain', count: 6, life: 2.5, aoe: 5, hit: { fx: 'launch', dur: 1.0, coins: 2 }, model: 'meteor' }, 4, 3, [3, 8]),
  W(31, 'w_glider', '구름 글라이더', 80000, '이동', '🪁', '3초 비행(장애물 무시)', { kind: 'glide', dur: 3 }, 5, 2, [3, 8]),
  W(32, 'w_superbubble', '슈퍼 버블 실드', 90000, '방어', '🔮', '2회 방어 + 접촉 상대 튕김', { kind: 'shield', dur: 12, hits: 2, knock: true }, 5, 2, [1, 8]),
  W(33, 'w_timestop', '시간 정지 시계', 100000, '전체', '⏱️', '나 빼고 전원 1초 슬로모션', { kind: 'area', shape: 'allOthers', hit: { fx: 'slow', dur: 1.0, amt: 0.3 } }, 5, 2, [3, 8]),
  W(34, 'w_unicorn', '크리스탈 유니콘 돌진', 110000, '무적돌진', '🦄', '3초 무적 돌진, 경로 상대 날림', { kind: 'invincible', dur: 3, mult: 1.45 }, 5, 2, [4, 8]),
  W(35, 'w_dragon', '황금 드래곤 연', 125000, '관통', '🐉', '용 연이 트랙을 따라 날며 전방 3명 타격', { kind: 'projectile', motion: 'trackFly', speed: 62, life: 9, pierce: 3, radius: 3, hit: { fx: 'launch', dur: 1.1, coins: 2 }, model: 'dragon' }, 5, 2, [4, 8]),
  W(36, 'w_rainbowcomet', '무지개 혜성', 140000, '1등 추격', '🌈', '1등 추격 + 경로 상 상대 스핀', { kind: 'projectile', motion: 'leader', target: 'leader', speed: 80, life: 20, aoe: 9, pierce: 9, hit: { fx: 'stop', dur: 1.6, coins: 3 }, model: 'comet' }, 5, 1.5, [4, 8]),
  W(37, 'w_aurora', '오로라 폭풍', 155000, '범위', '🌌', '전방 300m 내 전원 스핀 1초', { kind: 'area', shape: 'aheadRange', range: 300, hit: SPIN(1.0, 2) }, 5, 1.5, [4, 8]),
  W(38, 'w_platinum', '플래티넘 로켓', 170000, '자동주행', '🚀', '4초 자동 고속 주행(뒤 순위 전용)', { kind: 'autopilot', dur: 4, mult: 1.5 }, 5, 1.2, [5, 8]),
  W(39, 'w_diamondcrown', '다이아 왕관 미사일', 185000, '1등 추격', '👑', '1등 명중 시 금가루 폭발(코인 흡수)', { kind: 'projectile', motion: 'leader', target: 'leader', speed: 78, life: 20, aoe: 10, hit: { fx: 'stop', dur: 1.8, coins: 5 }, model: 'crown' }, 5, 1.2, [4, 8]),
  W(40, 'w_legend', '터보 레전드 유성우', 200000, '궁극', '🌠', '별 비가 내려 나 빼고 전원 순차 타격(8~3위만)', { kind: 'area', shape: 'allOthers', hit: { fx: 'launch', dur: 1.2, coins: 2 } }, 5, 1, [3, 8]),
];
export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

/** Vehicle unique skills (§5.4/§7.3). */
export const SKILLS: Record<string, ItemDef> = {
  rocketBox: { id: 'rocketBox', name: '로켓 택배 박스', icon: '📦', type: '고유기', desc: '', behavior: { kind: 'projectile', motion: 'lob', count: 3, speed: 36, aoe: 4, hit: SPIN(1.2), model: 'box' } },
  loveLetter: { id: 'loveLetter', name: '러브레터 유도탄', icon: '💌', type: '고유기', desc: '', behavior: { kind: 'projectile', motion: 'homing', target: 'ahead2', count: 2, speed: 50, life: 10, hit: { fx: 'slow', dur: 1.0, amt: 0.5 }, model: 'letter' } },
  yogurtBomb: { id: 'yogurtBomb', name: '요구르트 병 폭탄', icon: '🥛', type: '고유기', desc: '', behavior: { kind: 'zone', at: 'behind', radius: 5.5, dur: 6, hit: { fx: 'slip', dur: 2 }, tint: '#FFFFFF', model: 'yogurt' } },
  cementTrail: { id: 'cementTrail', name: '시멘트 트레일', icon: '🧱', type: '고유기', desc: '', behavior: { kind: 'zone', at: 'trail', radius: 3.5, dur: 3, hit: { fx: 'slow', dur: 0.5, amt: 0.55 }, tint: '#B8B4C0', model: 'cement' } },
  emp: { id: 'emp', name: 'EMP 펄스', icon: '⚡', type: '고유기', desc: '', behavior: { kind: 'area', shape: 'radius', range: 15, hit: { fx: 'seal', dur: 3 } } },
  waterCannon: { id: 'waterCannon', name: '물대포', icon: '💦', type: '고유기', desc: '', behavior: { kind: 'area', shape: 'cone', range: 32, hit: { fx: 'slip', dur: 1.2 } } },
  sirenChase: { id: 'sirenChase', name: '사이렌 체이스', icon: '🚨', type: '고유기', desc: '', behavior: { kind: 'lockon', dur: 2.2, hit: SPIN(1.2) } },
  medShield: { id: 'medShield', name: '응급 보호막', icon: '⛑️', type: '고유기', desc: '', behavior: { kind: 'invincible', dur: 3, mult: 1.05, cleanse: true, pushRadius: 7 } },
  busRush: { id: 'busRush', name: '정류장 돌진', icon: '🚌', type: '고유기', desc: '', behavior: { kind: 'invincible', dur: 2, mult: 1.3, scale: 1.5 } },
  honkWave: { id: 'honkWave', name: '빵빵 쇼크웨이브', icon: '📣', type: '고유기', desc: '', behavior: { kind: 'area', shape: 'radius', range: 10, hit: { fx: 'push', dur: 0.6 } } },
  stopBarricade: { id: 'stopBarricade', name: 'STOP 바리케이드', icon: '🛑', type: '고유기', desc: '', behavior: { kind: 'zone', at: 'behind', radius: 4, dur: 3, wall: true, hit: { fx: 'stop', dur: 0.8 }, tint: '#FF6B6B', model: 'stop' } },
  trashBomb: { id: 'trashBomb', name: '쓰레기봉투 폭탄', icon: '🗑️', type: '고유기', desc: '', behavior: { kind: 'suck', dur: 2, radius: 12, then: { kind: 'projectile', motion: 'lob', speed: 34, aoe: 5, hit: SPIN(1.1), model: 'trashbag' } } },
  sandFall: { id: 'sandFall', name: '모래 폭포', icon: '⛰️', type: '고유기', desc: '', behavior: { kind: 'zone', at: 'behind', radius: 7, dur: 4, hit: { fx: 'slow', dur: 0.4, amt: 0.5 }, tint: '#F2D49B', model: 'sand' } },
  bucketSwing: { id: 'bucketSwing', name: '버킷 스윙', icon: '🪣', type: '고유기', desc: '', behavior: { kind: 'area', shape: 'radius', range: 8, hit: { fx: 'launch', dur: 1.0, coins: 2 } } },
  iceBeam: { id: 'iceBeam', name: '아이스크림 빔', icon: '🍦', type: '고유기', desc: '', behavior: { kind: 'projectile', motion: 'homing', target: 'ahead', speed: 70, life: 6, hit: { fx: 'freeze', dur: 1.5 }, model: 'icecream' } },
  luckyCargo: { id: 'luckyCargo', name: '짐칸 럭키박스', icon: '🎲', type: '고유기', desc: '', behavior: { kind: 'lucky' } },
  spicyMissile: { id: 'spicyMissile', name: '매운 떡 미사일', icon: '🌶️', type: '고유기', desc: '', behavior: { kind: 'projectile', motion: 'homing', target: 'ahead', speed: 52, life: 10, hit: { fx: 'wobble', dur: 1.5 }, model: 'tteok' } },
  jumpStomp: { id: 'jumpStomp', name: '점프 스톰프', icon: '💥', type: '고유기', desc: '', behavior: { kind: 'stomp', radius: 11, hit: SPIN(1.0, 2) } },
  niceShot: { id: 'niceShot', name: '나이스 샷', icon: '⛳', type: '고유기', desc: '', behavior: { kind: 'projectile', motion: 'straight', count: 3, speed: 60, bounces: 6, life: 6, hit: SPIN(1.0, 2), model: 'golfball' } },
  boxBoomerang: { id: 'boxBoomerang', name: '배달통 부메랑', icon: '🪃', type: '고유기', desc: '', behavior: { kind: 'projectile', motion: 'boomerang', speed: 48, life: 3.2, pierce: 3, hit: SPIN(1.1, 2), model: 'deliverybox' } },
};

export const ALL_ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [...BASIC_ITEMS, ...WEAPONS, ...Object.values(SKILLS)].map((i) => [i.id, i]),
);
