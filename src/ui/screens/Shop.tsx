import { useEffect, useMemo, useState } from 'react';
import { useProfile } from '../../net/profileStore';
import { getShell } from '../../game/shell';
import { TopBar, Modal, sfx } from '../common';
import { CATEGORIES, COSMETICS, COSMETIC_BY_ID, TIER_INFO, type CosCategory, type CosmeticDef } from '../../data/cosmetics';
import { WEAPONS, type WeaponDef } from '../../data/items';
import { VEHICLES } from '../../data/vehicles';
import { CHARACTERS, type CharId } from '../../data/characters';
import { priceOf, DISCOUNT } from '../../../shared/progress';
import { vehiclePrice } from '../../../shared/economy';
import { audio } from '../../audio/engine';
import { music } from '../../audio/music';
import { say } from '../../audio/voice';
import { portrait, vehicleThumb, cosmeticThumb, enqueueThumb } from '../portraits';
import { useApp } from '../../game/app';

type Tab = 'cos' | 'weapon' | 'vehicle' | 'special';

function CosThumb({ c, char }: { c: CosmeticDef; char: CharId }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    enqueueThumb(() => alive && setUrl(cosmeticThumb(char, c.category, c.id, 128)));
    return () => {
      alive = false;
    };
  }, [c.id, char]);
  return (
    <div style={{ width: 92, height: 92, margin: '0 auto', borderRadius: 14, background: 'repeating-linear-gradient(135deg,#fff 0 10px,#F4F9FF 10px 20px)', display: 'grid', placeItems: 'center' }}>
      {url ? <img src={url} style={{ width: 92, height: 92 }} alt="" /> : <div className="meter" style={{ width: 40, height: 8 }}><i style={{ width: '60%' }} /></div>}
    </div>
  );
}

function TierFrame({ tier, children }: { tier: CosmeticDef['tier']; children: React.ReactNode }) {
  const col = TIER_INFO[tier].color;
  const rainbow = tier === 'mythic';
  return (
    <div
      style={{
        borderRadius: 18,
        padding: 3,
        background: rainbow ? 'linear-gradient(90deg,#ffadad,#ffd6a5,#fdffb6,#b9fbc0,#a2d2ff,#C9D8EE,#ffadad)' : col,
        backgroundSize: rainbow ? '200% 100%' : undefined,
        animation: rainbow ? 'shine 3s linear infinite' : undefined,
        boxShadow: tier === 'legendary' || rainbow ? `0 0 14px ${rainbow ? '#e0b3ff' : '#ffd666'}` : undefined,
      }}
    >
      <div
        style={{
          background: tier === 'epic' || tier === 'legendary' || rainbow ? 'linear-gradient(115deg,#fff 30%,#fff7fd 45%,#ffffff 50%,#f5f0ff 60%,#fff 75%)' : '#fff',
          backgroundSize: '220% 100%',
          animation: tier === 'common' || tier === 'rare' ? undefined : 'shine 2.6s linear infinite',
          borderRadius: 15,
          padding: 8,
          height: '100%',
        }}
      >
        {children}
      </div>
    </div>
  );
}


export function Shop() {
  const { profile, buy, equip, setLoadout, member } = useProfile();
  const set = useApp((s) => s.set);
  const [tab, setTab] = useState<Tab>('cos');
  const [cat, setCat] = useState<CosCategory>('hat');
  const [char, setChar] = useState<CharId>(profile.selectedChar);
  const [trial, setTrial] = useState<Partial<Record<CosCategory, string>>>({});
  const [confirm, setConfirm] = useState<{ id: string; name: string; price: number } | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [weaponInfo, setWeaponInfo] = useState<WeaponDef | null>(null);
  const eq = profile.equipment[char] ?? {};
  const loadout = { ...eq, ...trial };
  for (const k of Object.keys(loadout) as CosCategory[]) if (!loadout[k]) delete loadout[k];
  useEffect(() => {
    getShell().showroom.setMode('shop');
    music.play('shop');
  }, []);
  useEffect(() => {
    getShell().showroom.setShopChar(char, loadout);
  }, [char, JSON.stringify(loadout)]);
  const list = useMemo(() => COSMETICS.filter((c) => c.category === cat), [cat]);
  const doBuy = async () => {
    if (!confirm) return;
    const e = await buy(confirm.id);
    if (e) {
      sfx.error();
      setMsg(e);
      setConfirm(null);
      return;
    }
    audio.play('buy');
    say(char, 'thanks', { tts: false });
    setOpened(confirm.id);
    setConfirm(null);
    getShell().showroom.shopPose();
  };
  const tryOn = (c: CosmeticDef) => {
    sfx.click();
    setTrial((t) => ({ ...t, [c.category]: t[c.category] === c.id ? undefined : c.id }));
    getShell().showroom.shopPose();
  };
  const owned = (id: string) => profile.inventory.includes(id);
  const priceTag = (id: string, base: number) => {
    const p = priceOf(profile, id) ?? base;
    const disc = p < base;
    return (
      <div style={{ fontSize: 13 }}>
        {disc && <s style={{ color: '#aaa', marginRight: 4 }}>{base.toLocaleString()}</s>}
        <b style={{ color: disc ? '#E8412C' : '#f0a400' }}>🪙{p.toLocaleString()}</b>
      </div>
    );
  };
  const gap = (price: number) => Math.max(0, price - profile.gold);
  return (
    <div className="screen shop-screen" onPointerMove={(e) => e.buttons === 1 && e.target === e.currentTarget && (getShell().showroom.dragVel += e.movementX * 0.02)}>
      <TopBar title="상점" />
      <div className="tabs" style={{ marginTop: 8 }}>
        {(
          [
            ['cos', '👗 꾸미기'],
            ['weapon', '🎯 무기'],
            ['vehicle', '🚗 차량'],
            ['special', '✨ 스페셜'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
        <div className="spacer" />
        {!member && <span className="chip">🔒 구매는 회원 전용 (시착은 자유!)</span>}
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0, marginTop: 8 }}>
        <div style={{ width: 'min(300px, 30vw)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="panel" style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
            {CHARACTERS.map((c) => (
              <img
                key={c.id}
                src={portrait(c.id, {}, 80)}
                onClick={() => {
                  sfx.click();
                  setChar(c.id);
                }}
                style={{ width: 44, height: 44, borderRadius: 22, border: `3px solid ${char === c.id ? '#FF6B3D' : '#fff'}`, background: '#fff', cursor: 'pointer' }}
                alt={c.name}
              />
            ))}
            <div style={{ width: '100%', textAlign: 'center', fontSize: 13, color: '#3cb36a' }}>✔ 모든 캐릭터 착용 가능 · 1회 구매로 전 캐릭터 사용</div>
          </div>
          <div className="spacer" />
          {Object.keys(trial).length > 0 && (
            <button className="btn ghost small" onClick={() => setTrial({})}>
              시착 해제
            </button>
          )}
        </div>
        <div className="spacer" />
        <div className="panel scroll" style={{ width: 'min(470px, 48vw)', padding: 10 }}>
          {tab === 'cos' && (
            <>
              <div className="tabs" style={{ marginBottom: 8 }}>
                {CATEGORIES.map((c) => (
                  <button key={c.id} className={`tab ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)} style={{ fontSize: 14, padding: '6px 10px' }}>
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 8 }}>
                {list.map((c) => {
                  const own = owned(c.id);
                  const worn = eq[c.category] === c.id;
                  return (
                    <TierFrame key={c.id} tier={c.tier}>
                      <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => tryOn(c)}>
                        <div style={{ fontSize: 11, color: TIER_INFO[c.tier].color === 'rainbow' ? '#2F6FDB' : TIER_INFO[c.tier].color }}>{TIER_INFO[c.tier].name}</div>
                        <CosThumb c={c} char={char} />
                        <div style={{ fontSize: 13, minHeight: 34, lineHeight: 1.2 }}>{c.name}</div>
                        {own ? <div style={{ fontSize: 13, color: '#3cb36a' }}>{worn ? '착용 중 ✔' : '보유 ✔'}</div> : priceTag(c.id, c.price)}
                        {trial[c.category] === c.id && <div style={{ fontSize: 11, color: '#FF5A36' }}>시착 중</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 4 }}>
                        {own ? (
                          <button
                            className="btn small mint"
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => {
                              sfx.click();
                              equip(char, worn ? null : c.id, c.category);
                              setTrial((t) => ({ ...t, [c.category]: undefined }));
                            }}
                          >
                            {worn ? '벗기' : '장착'}
                          </button>
                        ) : (
                          <button
                            className="btn small"
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => {
                              if (!member) {
                                set({ modal: 'promo' });
                                return;
                              }
                              setConfirm({ id: c.id, name: c.name, price: priceOf(profile, c.id) ?? c.price });
                            }}
                          >
                            구매
                          </button>
                        )}
                      </div>
                      {!own && gap(priceOf(profile, c.id) ?? c.price) > 0 && (
                        <div style={{ height: 5, background: '#E3ECF7', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, (profile.gold / (priceOf(profile, c.id) ?? c.price)) * 100)}%`, height: '100%', background: '#ffd166' }} />
                        </div>
                      )}
                    </TierFrame>
                  );
                })}
              </div>
            </>
          )}
          {tab === 'weapon' && (
            <>
              <div className="chip" style={{ marginBottom: 8 }}>
                장착 슬롯: {[0, 1, 2].map((i) => <span key={i} style={{ margin: '0 4px' }}>{i + 1}. {profile.weaponLoadout[i] ? WEAPONS.find((w) => w.id === profile.weaponLoadout[i])?.icon : '➖'}</span>)}
              </div>
              <div style={{ fontSize: 13, color: '#4B5A78', marginBottom: 8 }}>장착한 무기(최대 3개)는 아이템 박스 룰렛에 추가돼요. 비쌀수록 화려하고 특이하지만 등장 순위가 제한돼요!</div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {WEAPONS.map((w) => {
                  const own = owned(w.id);
                  const on = profile.weaponLoadout.includes(w.id);
                  return (
                    <div key={w.id} className={`card ${on ? 'sel' : ''}`} style={{ padding: 8 }} onClick={() => setWeaponInfo(w)}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 30, animation: on ? 'wiggle 1s infinite' : undefined }}>{w.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15 }}>
                            {w.no}. {w.name}
                          </div>
                          <div style={{ fontSize: 12, color: '#2F6FDB' }}>
                            {w.type} · 등장 {w.allowedRanks[0]}~{w.allowedRanks[1]}위 · {'★'.repeat(w.power)}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, margin: '4px 0' }}>{w.desc}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {own ? <span style={{ color: '#3cb36a', fontSize: 13 }}>보유 ✔</span> : priceTag(w.id, w.price)}
                        {own ? (
                          <button
                            className={`btn small ${on ? 'ghost' : 'mint'}`}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              sfx.click();
                              const cur = profile.weaponLoadout;
                              if (on) setLoadout(cur.filter((x) => x !== w.id));
                              else if (cur.length < 3) setLoadout([...cur, w.id]);
                              else setMsg('장착 슬롯은 최대 3개예요');
                            }}
                          >
                            {on ? '해제' : '장착'}
                          </button>
                        ) : (
                          <button
                            className="btn small"
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!member) return set({ modal: 'promo' });
                              setConfirm({ id: w.id, name: w.name, price: priceOf(profile, w.id) ?? w.price });
                            }}
                          >
                            구매
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {tab === 'vehicle' && (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {VEHICLES.filter((v) => !profile.unlockedVehicles.includes(v.id)).map((v) => {
                const price = vehiclePrice(v.id);
                return (
                  <div key={v.id} className="card" style={{ padding: 6, textAlign: 'center' }}>
                    <img src={vehicleThumb(v.id, char, 140)} style={{ width: '100%' }} alt="" />
                    <div style={{ fontSize: 13 }}>{v.name}</div>
                    {price ? (
                      <button
                        className="btn small gold"
                        style={{ fontSize: 12, padding: '4px 10px', marginTop: 4 }}
                        onClick={() => {
                          if (!member) return set({ modal: 'promo' });
                          setConfirm({ id: 'veh:' + v.id, name: v.name, price });
                        }}
                      >
                        🪙{price.toLocaleString()}
                      </button>
                    ) : (
                      <div style={{ fontSize: 12, color: '#2F6FDB' }}>{v.unlock.kind === 'level' ? `레벨 ${v.unlock.level} 해금` : v.unlock.kind === 'stars' ? `별 ${v.unlock.stars}개 해금` : ''}</div>
                    )}
                  </div>
                );
              })}
              {VEHICLES.every((v) => profile.unlockedVehicles.includes(v.id)) && <div>모든 차량을 보유하고 있어요! 🎉</div>}
            </div>
          )}
          {tab === 'special' && (
            <>
              <div style={{ fontSize: 18, marginBottom: 6 }}>⏰ 오늘의 할인 (매일 자정 교체 · {Math.round(DISCOUNT * 100)}% OFF)</div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {profile.daily.discounts.map((id) => {
                  const c = COSMETIC_BY_ID[id];
                  if (!c) return null;
                  return (
                    <TierFrame key={id} tier={c.tier}>
                      <div style={{ textAlign: 'center' }} onClick={() => tryOn(c)}>
                        <CosThumb c={c} char={char} />
                        <div style={{ fontSize: 13 }}>{c.name}</div>
                        {owned(id) ? <div style={{ color: '#3cb36a' }}>보유 ✔</div> : priceTag(id, c.price)}
                        {!owned(id) && (
                          <button
                            className="btn small"
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!member) return set({ modal: 'promo' });
                              setConfirm({ id, name: c.name, price: priceOf(profile, id) ?? c.price });
                            }}
                          >
                            구매
                          </button>
                        )}
                      </div>
                    </TierFrame>
                  );
                })}
              </div>
            </>
          )}
          {msg && <div style={{ color: '#E8412C', marginTop: 8 }}>{msg}</div>}
        </div>
      </div>
      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <h2 style={{ marginTop: 0 }}>구매할까요?</h2>
          <p style={{ fontSize: 20 }}>
            「{confirm.name}」 — 🪙 {confirm.price.toLocaleString()}
          </p>
          {profile.gold < confirm.price ? (
            <>
              <p style={{ color: '#E8412C' }}>{(confirm.price - profile.gold).toLocaleString()}골드 더 모으면 살 수 있어요!</p>
              <div style={{ height: 12, background: '#E3ECF7', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(profile.gold / confirm.price) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#ffd166,#FF6B3D)' }} />
              </div>
              <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setConfirm(null)}>
                확인
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn gold" onClick={doBuy}>
                구매하기
              </button>
              <button className="btn ghost" onClick={() => setConfirm(null)}>
                취소
              </button>
            </div>
          )}
        </Modal>
      )}
      {opened && (
        <Modal onClose={() => setOpened(null)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 80, animation: 'popIn .6s cubic-bezier(.3,1.8,.5,1) both' }}>🎁</div>
            <h2>띵동~ 구매 완료!</h2>
            <p>{COSMETIC_BY_ID[opened]?.name ?? WEAPONS.find((w) => w.id === opened)?.name ?? '차량'}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {COSMETIC_BY_ID[opened] && (
                <button
                  className="btn mint"
                  onClick={() => {
                    const c = COSMETIC_BY_ID[opened];
                    equip(char, c.id, c.category);
                    setTrial((t) => ({ ...t, [c.category]: undefined }));
                    setOpened(null);
                  }}
                >
                  바로 장착하기
                </button>
              )}
              <button className="btn ghost" onClick={() => setOpened(null)}>
                닫기
              </button>
            </div>
          </div>
        </Modal>
      )}
      {weaponInfo && (
        <Modal onClose={() => setWeaponInfo(null)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 72, animation: 'bob 1s ease-in-out infinite' }}>{weaponInfo.icon}</div>
            <h2 style={{ margin: 4 }}>{weaponInfo.name}</h2>
            <div className="chip">
              {weaponInfo.type} · 위력 {'★'.repeat(weaponInfo.power)} · 등장 {weaponInfo.allowedRanks[0]}~{weaponInfo.allowedRanks[1]}위
            </div>
            <p style={{ fontSize: 18 }}>{weaponInfo.desc}</p>
            <WeaponPreview w={weaponInfo} />
            <button className="btn ghost" onClick={() => setWeaponInfo(null)}>
              닫기
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Looping mini-animation preview of a weapon's effect (CSS-driven). */
function WeaponPreview({ w }: { w: WeaponDef }) {
  const b = w.behavior;
  const anim =
    b.kind === 'projectile' && (b.motion === 'homing' || b.motion === 'leader')
      ? 'homingPrev'
      : b.kind === 'projectile' && b.motion === 'rollBack'
        ? 'backPrev'
        : b.kind === 'trap' || b.kind === 'zone'
          ? 'dropPrev'
          : b.kind === 'shield' || b.kind === 'intangible'
            ? 'shieldPrev'
            : 'shootPrev';
  return (
    <div style={{ position: 'relative', height: 90, background: 'linear-gradient(#e9f4ff,#EEF6FF)', borderRadius: 16, overflow: 'hidden', margin: '8px 0' }}>
      <style>{`
        @keyframes shootPrev { 0%{left:18%;opacity:1} 80%{left:78%;opacity:1} 100%{left:82%;opacity:0} }
        @keyframes homingPrev { 0%{left:18%;top:50%} 50%{left:50%;top:20%} 100%{left:80%;top:50%} }
        @keyframes backPrev { 0%{left:20%;opacity:1} 100%{left:-10%;opacity:0} }
        @keyframes dropPrev { 0%{left:20%;top:30%} 40%{left:12%;top:58%} 100%{left:12%;top:58%} }
        @keyframes shieldPrev { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.25)} }
      `}</style>
      <span style={{ position: 'absolute', left: '20%', top: '50%', transform: 'translate(-50%,-50%)', fontSize: 34 }}>🚗</span>
      <span style={{ position: 'absolute', left: '80%', top: '50%', transform: 'translate(-50%,-50%)', fontSize: 30 }}>🚙</span>
      <span style={{ position: 'absolute', top: '50%', transform: 'translate(-50%,-50%)', fontSize: 28, animation: `${anim} 1.6s ease-in-out infinite` }}>{w.icon}</span>
    </div>
  );
}
