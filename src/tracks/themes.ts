import type { ThemeId } from '../data/tracks';

export interface ThemeDef {
  sky: { top: string; horizon: string; bottom: string; sun: string; sunDir: [number, number, number]; stars?: boolean; aurora?: boolean };
  fog: { color: string; near: number; far: number };
  light: { sun: string; sunI: number; hemiSky: string; hemiGround: string; hemiI: number; amb: number };
  ground: [string, string, string];
  shoulder: string;
  road: { base: string; speck: string; line: string; edge: string; glowEdge?: string; rainbow?: boolean };
  curb: [string, string];
  wall: { style: 'candy' | 'fence' | 'neon' | 'stone' | 'barrier' | 'snow' | 'basalt' | 'cloud'; a: string; b: string };
  props: string[];
  landmarks: string[];
  clouds: number;
  particles?: 'petals' | 'snow' | 'sparkle' | 'leaves' | 'bubbles';
  ambience: 'birds' | 'city' | 'market' | 'machines' | 'wind' | 'waves' | 'chimes' | 'sweet';
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  candy: {
    sky: { top: '#FF9EC7', horizon: '#FFE3EF', bottom: '#FFF6E9', sun: '#FFF4C2', sunDir: [0.5, 0.75, 0.35] },
    fog: { color: '#FFE3EF', near: 160, far: 720 },
    light: { sun: '#FFF1E0', sunI: 2.3, hemiSky: '#FFD6EA', hemiGround: '#FFE9C9', hemiI: 1.25, amb: 0.25 },
    ground: ['#C8F2C3', '#B6EDB8', '#FFE1F0'],
    shoulder: '#FBD3E6',
    road: { base: '#F2D7E4', speck: '#E6C3D4', line: '#FFFFFF', edge: '#FFFFFF' },
    curb: ['#FF8FB8', '#FFFFFF'],
    wall: { style: 'candy', a: '#FF8FB8', b: '#FFFFFF' },
    props: ['lollipop', 'cookieHouse', 'cupcake', 'gumdrop', 'candyCane', 'lollipop', 'donutStand'],
    landmarks: ['creamHill', 'creamHill', 'cakeCastle'],
    clouds: 26,
    particles: 'sparkle',
    ambience: 'sweet',
  },
  hangang: {
    sky: { top: '#7EC8F8', horizon: '#E4F4FF', bottom: '#FFF6E9', sun: '#FFF7D6', sunDir: [-0.4, 0.7, 0.5] },
    fog: { color: '#E4F4FF', near: 170, far: 760 },
    light: { sun: '#FFF6E8', sunI: 2.3, hemiSky: '#CFE9FF', hemiGround: '#E9F7D8', hemiI: 1.2, amb: 0.25 },
    ground: ['#B9EBA6', '#A7E19A', '#D8F5C0'],
    shoulder: '#C6EEB0',
    road: { base: '#DCD9E8', speck: '#CBC7DA', line: '#FFFFFF', edge: '#FFE066' },
    curb: ['#FFB3C7', '#FFFFFF'],
    wall: { style: 'fence', a: '#F5E1C8', b: '#FFB3C7' },
    props: ['cherryTree', 'cherryTree', 'picnic', 'bench', 'lamp', 'cherryTree', 'bike'],
    landmarks: ['apartments', 'archBridge', 'apartments', 'n63'],
    clouds: 24,
    particles: 'petals',
    ambience: 'birds',
  },
  neon: {
    sky: { top: '#2B2457', horizon: '#9C6FC9', bottom: '#F7A8D0', sun: '#FFE9F7', sunDir: [0.3, 0.6, -0.6], stars: true },
    fog: { color: '#7D5CB8', near: 140, far: 680 },
    light: { sun: '#E4D2FF', sunI: 1.4, hemiSky: '#A88BFF', hemiGround: '#FF9ED2', hemiI: 1.15, amb: 0.35 },
    ground: ['#5D4F8C', '#6A5A9E', '#7B66AD'],
    shoulder: '#6E5FA3',
    road: { base: '#4A4170', speck: '#564C80', line: '#FFE7A6', edge: '#7DF9FF', glowEdge: '#7DF9FF' },
    curb: ['#FF7EC8', '#7DF9FF'],
    wall: { style: 'neon', a: '#5B4E8F', b: '#FF7EC8' },
    props: ['tower', 'tower', 'busStop', 'neonSign', 'lamp', 'tower', 'trafficLight'],
    landmarks: ['namsan', 'skyline', 'skyline', 'skyline'],
    clouds: 10,
    particles: 'sparkle',
    ambience: 'city',
  },
  hanok: {
    sky: { top: '#FFB88C', horizon: '#FFE7C9', bottom: '#FFF6E9', sun: '#FFE1A8', sunDir: [-0.6, 0.55, 0.4] },
    fog: { color: '#FFE7C9', near: 150, far: 700 },
    light: { sun: '#FFE6C8', sunI: 2.2, hemiSky: '#FFD5B5', hemiGround: '#E8D9B5', hemiI: 1.2, amb: 0.28 },
    ground: ['#D9E8B0', '#CDE0A2', '#EBDDB8'],
    shoulder: '#E9D7B3',
    road: { base: '#E3D3BD', speck: '#D4C1A8', line: '#FFF6E9', edge: '#FFF6E9' },
    curb: ['#C77D5F', '#F3E3C8'],
    wall: { style: 'stone', a: '#D8CDBF', b: '#B3A291' },
    props: ['hanok', 'hanok', 'lanternPole', 'stall', 'pine', 'hanok', 'jar'],
    landmarks: ['gate', 'mountain', 'mountain', 'pagoda'],
    clouds: 18,
    particles: 'leaves',
    ambience: 'market',
  },
  construction: {
    sky: { top: '#8CC8F0', horizon: '#FFF0D2', bottom: '#FFF6E9', sun: '#FFF1C2', sunDir: [0.5, 0.7, -0.3] },
    fog: { color: '#FFF0D2', near: 160, far: 720 },
    light: { sun: '#FFF3DE', sunI: 2.3, hemiSky: '#D6ECFF', hemiGround: '#F4DEB4', hemiI: 1.2, amb: 0.25 },
    ground: ['#F2D9A6', '#EBCB91', '#D9E9B0'],
    shoulder: '#F0D39B',
    road: { base: '#D8D2D9', speck: '#C6BFC9', line: '#FFE066', edge: '#FFFFFF' },
    curb: ['#FFB067', '#FFFFFF'],
    wall: { style: 'barrier', a: '#FFB067', b: '#FFFFFF' },
    props: ['cone', 'container', 'sandPile', 'barrel', 'scaffold', 'cone', 'pipes'],
    landmarks: ['crane', 'crane', 'unfinished', 'unfinished'],
    clouds: 20,
    ambience: 'machines',
  },
  icecream: {
    sky: { top: '#9FB8FF', horizon: '#F0E8FF', bottom: '#FFFFFF', sun: '#FFFFFF', sunDir: [0.3, 0.6, 0.6], aurora: true },
    fog: { color: '#F0E8FF', near: 150, far: 700 },
    light: { sun: '#FFFFFF', sunI: 2.1, hemiSky: '#E0E6FF', hemiGround: '#FFFFFF', hemiI: 1.3, amb: 0.3 },
    ground: ['#FFFFFF', '#F4F2FF', '#FFEFF6'],
    shoulder: '#F7F5FF',
    road: { base: '#C9D4F2', speck: '#B9C5E8', line: '#FFFFFF', edge: '#FFC8DD' },
    curb: ['#A2D2FF', '#FFFFFF'],
    wall: { style: 'snow', a: '#FFFFFF', b: '#CDE5FF' },
    props: ['snowPine', 'snowman', 'popsicle', 'snowPine', 'iceCrystal', 'scoopTree'],
    landmarks: ['iceMountain', 'iceMountain', 'iceMountain', 'igloo'],
    clouds: 16,
    particles: 'snow',
    ambience: 'wind',
  },
  jeju: {
    sky: { top: '#5EC6F2', horizon: '#D6F6FF', bottom: '#FFF6E9', sun: '#FFF8DC', sunDir: [0.4, 0.75, 0.4] },
    fog: { color: '#D6F6FF', near: 180, far: 800 },
    light: { sun: '#FFF7E6', sunI: 2.4, hemiSky: '#C6EEFF', hemiGround: '#FFF0C9', hemiI: 1.2, amb: 0.25 },
    ground: ['#B7EBA0', '#FFF0C2', '#A5E294'],
    shoulder: '#FFF0C2',
    road: { base: '#E0DAD0', speck: '#CFC8BC', line: '#FFFFFF', edge: '#FFFFFF' },
    curb: ['#FFAA5C', '#FFFFFF'],
    wall: { style: 'basalt', a: '#8D8A99', b: '#6F6C7D' },
    props: ['palm', 'hareubang', 'tangerineTree', 'umbrella', 'palm', 'rock'],
    landmarks: ['hallasan', 'lighthouse', 'hallasan'],
    clouds: 22,
    particles: 'bubbles',
    ambience: 'waves',
  },
  rainbow: {
    sky: { top: '#B6A6FF', horizon: '#FFE0F5', bottom: '#FFF6FF', sun: '#FFFBE0', sunDir: [0.2, 0.8, 0.5] },
    fog: { color: '#FBE4FF', near: 170, far: 760 },
    light: { sun: '#FFF8F0', sunI: 2.2, hemiSky: '#E6DCFF', hemiGround: '#FFE6F4', hemiI: 1.3, amb: 0.3 },
    ground: ['#FFFFFF', '#F7F0FF', '#FFF0FA'],
    shoulder: '#FFFFFF',
    road: { base: '#FFFFFF', speck: '#F2ECFF', line: '#FFFFFF', edge: '#FFFFFF', rainbow: true },
    curb: ['#FFD6A5', '#CDB4DB'],
    wall: { style: 'cloud', a: '#FFFFFF', b: '#F3EAFF' },
    props: ['starDeco', 'balloonBunch', 'cloudPuff', 'starDeco'],
    landmarks: ['castle', 'floatIsland', 'floatIsland', 'rainbowArch'],
    clouds: 40,
    particles: 'sparkle',
    ambience: 'chimes',
  },
};
