export type StatKey = 'speed' | 'accel' | 'handling' | 'weight' | 'drift' | 'offroad';
export const STAT_KEYS: StatKey[] = ['speed', 'accel', 'handling', 'weight', 'drift', 'offroad'];
export const STAT_LABEL: Record<StatKey, string> = {
  speed: '최고속도',
  accel: '가속',
  handling: '핸들링',
  weight: '무게',
  drift: '드리프트',
  offroad: '오프로드',
};
export type Stats = Record<StatKey, number>;
export type EngineClass = 'small' | 'medium' | 'large';

export type Unlock =
  | { kind: 'start' }
  | { kind: 'level'; level: number }
  | { kind: 'gold'; price: number }
  | { kind: 'stars'; stars: number };

export interface VehicleDef {
  id: string;
  no: number;
  name: string;
  parodyName: string;
  desc: string;
  stats: Stats;
  engine: EngineClass;
  skill: { id: string; name: string; desc: string };
  unlock: Unlock;
}
const s = (speed: number, accel: number, handling: number, weight: number, drift: number, offroad: number): Stats => ({
  speed,
  accel,
  handling,
  weight,
  drift,
  offroad,
});

export const VEHICLES: VehicleDef[] = [
  { id: 'coupang', no: 1, name: '쿠팡 로켓배송 트럭', parodyName: '쿠빵 로켓배송 트럭', desc: '흰 박스 탑차에 다색 워드마크와 로켓배송 문구', stats: s(6, 5, 5, 7, 5, 5), engine: 'medium', skill: { id: 'rocketBox', name: '로켓 택배 박스', desc: '택배 박스 3개를 포물선으로 던져요. 맞으면 1.2초 스핀!' }, unlock: { kind: 'start' } },
  { id: 'epost', no: 2, name: '우체국 택배트럭', parodyName: '우채국 택배트럭', desc: '빨강 차체, 제비 심볼과 우체국택배 문구', stats: s(6, 6, 5, 6, 5, 5), engine: 'medium', skill: { id: 'loveLetter', name: '러브레터 유도탄', desc: '편지봉투 2통이 앞 순위를 추적! 맞으면 하트에 감싸여 1초 감속' }, unlock: { kind: 'start' } },
  { id: 'yakult', no: 3, name: '야쿠르트 전동카트(코코)', parodyName: '야구르트 전동카트', desc: '아이보리·주황 냉장 카트, 서서 운전', stats: s(3, 9, 8, 2, 7, 4), engine: 'small', skill: { id: 'yogurtBomb', name: '요구르트 병 폭탄', desc: '뒤에 설치! 터지면 하얀 웅덩이에서 2초간 미끄러져요' }, unlock: { kind: 'start' } },
  { id: 'remicon', no: 4, name: '레미콘 트럭', parodyName: '레미콘 트럭', desc: '줄무늬 회전 믹서 드럼', stats: s(7, 3, 3, 10, 4, 6), engine: 'large', skill: { id: 'cementTrail', name: '시멘트 트레일', desc: '3초간 뒤에 회색 감속 지대를 깔아요' }, unlock: { kind: 'gold', price: 12000 } },
  { id: 'cybertruck', no: 5, name: '테슬라 사이버트럭', parodyName: '테슬로 사이보트럭', desc: '스테인리스 삼각 실루엣과 라이트 바', stats: s(9, 4, 4, 7, 4, 5), engine: 'medium', skill: { id: 'emp', name: 'EMP 펄스', desc: '반경 15m 상대의 아이템을 3초 봉인 + 감속' }, unlock: { kind: 'start' } },
  { id: 'firetruck', no: 6, name: '119 소방차', parodyName: '119 소방차', desc: '빨강 차체, 사다리와 물대포', stats: s(6, 5, 4, 8, 4, 6), engine: 'large', skill: { id: 'waterCannon', name: '물대포', desc: '전방 부채꼴 물줄기! 맞으면 1.2초 미끄러짐' }, unlock: { kind: 'level', level: 3 } },
  { id: 'police', no: 7, name: '대한민국 경찰차', parodyName: '대한민국 경찰차', desc: '흰·파랑 투톤, 경광등 바', stats: s(8, 6, 6, 5, 5, 3), engine: 'medium', skill: { id: 'sirenChase', name: '사이렌 체이스', desc: '앞 1명을 락온하고 고속 돌진 범프!' }, unlock: { kind: 'start' } },
  { id: 'ambulance', no: 8, name: '119 구급차', parodyName: '119 구급차', desc: '흰 차체에 빨강·주황 라인, 생명의 별', stats: s(5, 6, 6, 6, 5, 5), engine: 'medium', skill: { id: 'medShield', name: '응급 보호막', desc: '3초 무적 + 상태이상 해제 + 주변 밀어내기' }, unlock: { kind: 'level', level: 5 } },
  { id: 'seoulbus', no: 9, name: '서울 시내버스', parodyName: '서울 시내버스', desc: '파랑 간선버스, 행선지 LED', stats: s(5, 4, 4, 10, 4, 6), engine: 'large', skill: { id: 'busRush', name: '정류장 돌진', desc: '2초간 차체가 커지며 돌진, 닿은 카트를 튕겨내요' }, unlock: { kind: 'gold', price: 15000 } },
  { id: 'taxi', no: 10, name: '서울 주황 택시', parodyName: '서울 주황 택시', desc: '주황 차체, 지붕 TAXI 표시등', stats: s(6, 6, 8, 4, 8, 1), engine: 'small', skill: { id: 'honkWave', name: '빵빵 쇼크웨이브', desc: '경적 음파로 주변 상대를 밀쳐내요' }, unlock: { kind: 'level', level: 2 } },
  { id: 'schoolbus', no: 11, name: '노란 어린이 통학버스', parodyName: '노란 어린이 통학버스', desc: '노랑 미니버스, 어린이 보호차량 표지', stats: s(4, 5, 5, 9, 4, 6), engine: 'large', skill: { id: 'stopBarricade', name: 'STOP 바리케이드', desc: '뒤에 정지 표지판 벽(3초)! 부딪히면 정지' }, unlock: { kind: 'gold', price: 8000 } },
  { id: 'garbage', no: 12, name: '쓰레기 수거차', parodyName: '쓰레기 수거차', desc: '초록 청소차, 후면 압축기, 재활용 마크', stats: s(5, 5, 4, 8, 4, 7), engine: 'large', skill: { id: 'trashBomb', name: '쓰레기봉투 폭탄', desc: '봉투 폭탄 투척 + 2초간 주변 코인 흡입' }, unlock: { kind: 'gold', price: 10000 } },
  { id: 'dump', no: 13, name: '덤프트럭', parodyName: '덤프트럭', desc: '노랑 건설용, 거대 바퀴, 들리는 짐칸', stats: s(6, 4, 3, 9, 3, 8), engine: 'large', skill: { id: 'sandFall', name: '모래 폭포', desc: '짐칸을 들어 뒤에 모래 언덕(4초)' }, unlock: { kind: 'stars', stars: 6 } },
  { id: 'excavator', no: 14, name: '포클레인(굴착기)', parodyName: '포크레인', desc: '노랑 붐과 버킷', stats: s(3, 5, 5, 9, 3, 8), engine: 'large', skill: { id: 'bucketSwing', name: '버킷 스윙', desc: '좌우 근접 상대를 퍼 올려 날려요' }, unlock: { kind: 'gold', price: 25000 } },
  { id: 'icecream', no: 15, name: '아이스크림 트럭', parodyName: '아이스크림 트럭', desc: '분홍·하늘 푸드트럭, 지붕 위 거대 콘', stats: s(5, 7, 7, 4, 6, 4), engine: 'small', skill: { id: 'iceBeam', name: '아이스크림 빔', desc: '앞 상대를 1.5초 빙결!' }, unlock: { kind: 'level', level: 8 } },
  { id: 'porter', no: 16, name: '현대 포터', parodyName: '현다이 포타', desc: '파랑 1톤 트럭, PORTER 엠블럼', stats: s(6, 7, 6, 5, 5, 4), engine: 'medium', skill: { id: 'luckyCargo', name: '짐칸 럭키박스', desc: '무작위 기본 아이템 1개를 즉시 획득' }, unlock: { kind: 'gold', price: 5000 } },
  { id: 'tteokbokki', no: 17, name: '떡볶이 푸드트럭', parodyName: '떡볶이 푸드트럭', desc: '빨강 포장마차형, 떡꼬치 간판', stats: s(6, 6, 6, 5, 6, 4), engine: 'medium', skill: { id: 'spicyMissile', name: '매운 떡 미사일', desc: '떡꼬치 미사일! 맞으면 "맵다!" 1.5초 조향 흔들림' }, unlock: { kind: 'stars', stars: 12 } },
  { id: 'monster', no: 18, name: '몬스터트럭', parodyName: '몬스터트럭', desc: '초대형 바퀴 4개, 파스텔 화염 페인팅', stats: s(5, 5, 4, 8, 3, 8), engine: 'large', skill: { id: 'jumpStomp', name: '점프 스톰프', desc: '크게 점프 후 착지 충격파로 주변 스핀' }, unlock: { kind: 'gold', price: 40000 } },
  { id: 'golfcart', no: 19, name: '전동 골프카트', parodyName: '전동 골프카트', desc: '흰·민트 오픈 카트, 차양 지붕, 골프백', stats: s(4, 8, 9, 2, 7, 3), engine: 'small', skill: { id: 'niceShot', name: '나이스 샷', desc: '벽에 튕기는 골프공 3발!' }, unlock: { kind: 'start' } },
  { id: 'scooter', no: 20, name: '삼륜 배달 스쿠터', parodyName: '삼륜 배달 스쿠터', desc: '세 바퀴와 뒤 배달통', stats: s(5, 9, 8, 1, 8, 2), engine: 'small', skill: { id: 'boxBoomerang', name: '배달통 부메랑', desc: '배달통이 앞으로 날아갔다 돌아와요' }, unlock: { kind: 'gold', price: 60000 } },
];
export const VEHICLE_BY_ID: Record<string, VehicleDef> = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));
