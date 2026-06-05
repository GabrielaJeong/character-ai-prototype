'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/ui';
import { api, ApiError } from '@/lib/api';
import type {
  AdminCuration,
  CurationBroadcast,
  CurationCollection,
  CurationUpcoming,
  BcSnapshot,
  ColSnapshot,
} from '@/lib/admin';
import a from '../admin.module.css';
import c from './curation.module.css';

/**
 * 어드민 큐레이션 관리 — `/admin/curation`.
 *
 * 원본: admin.html #page-curation + admin.js 큐레이션 전부 + routes/admin.js /curation, /upload, /*-history.
 *
 * 메인홈(creators/genres=개발예정, upcoming) / 탐색(broadcast/tags/collections) 탭.
 * 드래그 정렬은 **핸들 전용 draggable**(행 전체 draggable이면 input 편집이 불편 → UX 개선),
 * 항목별 이미지 업로드(POST /upload), 스냅샷 히스토리(복원/삭제), 라이브 미리보기, 섹션/전체 저장.
 */
type LandingSub = 'creators' | 'genres' | 'upcoming';
type ExploreSub = 'broadcast' | 'tags' | 'collections';

const DragIcon = () => (
  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
    <circle cx="4" cy="3" r="1.5" /><circle cx="8" cy="3" r="1.5" />
    <circle cx="4" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" />
    <circle cx="4" cy="13" r="1.5" /><circle cx="8" cy="13" r="1.5" />
  </svg>
);

/** 핸들 전용 드래그 reorder */
function useReorder(onReorder: (from: number, to: number) => void) {
  const fromRef = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const handleProps = (i: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      fromRef.current = i;
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: () => {
      fromRef.current = null;
      setOver(null);
    },
  });
  const rowProps = (i: number) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(i);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const f = fromRef.current;
      if (f != null && f !== i) onReorder(f, i);
      setOver(null);
    },
  });
  return { over, handleProps, rowProps };
}

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}

/** 파일 → base64 업로드 → path */
async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.split(',')[1];
  const res = await api.post<{ path: string }>('/api/admin/upload', { data: base64, ext });
  return res.path;
}

export default function AdminCurationPage() {
  const setAppReady = useUIStore((s) => s.setAppReady);
  const showToast = useUIStore((s) => s.showToast);

  const [cur, setCur] = useState<AdminCuration | null>(null);
  const [tab, setTab] = useState<'landing' | 'explore'>('landing');
  const [landingSub, setLandingSub] = useState<LandingSub>('creators');
  const [exploreSub, setExploreSub] = useState<ExploreSub>('broadcast');
  const [bcActive, setBcActive] = useState(0);
  const [colActive, setColActive] = useState(0);
  const [bcHist, setBcHist] = useState<BcSnapshot[]>([]);
  const [colHist, setColHist] = useState<ColSnapshot[]>([]);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  const loadHistories = useCallback(async () => {
    try {
      setBcHist(await api.get<BcSnapshot[]>('/api/admin/broadcast-history'));
    } catch { /* noop */ }
    try {
      setColHist(await api.get<ColSnapshot[]>('/api/admin/collection-history'));
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    api.get<AdminCuration>('/api/admin/curation').then(setCur).catch(() => showToast('큐레이션 로드 실패'));
    loadHistories();
  }, [loadHistories, showToast]);

  // ── 불변 업데이트 헬퍼 ──
  const patchArray = <T,>(key: keyof AdminCuration, idx: number, patch: Partial<T>) =>
    setCur((p) => {
      if (!p) return p;
      const arr = [...((p[key] as T[]) ?? [])];
      arr[idx] = { ...arr[idx], ...patch };
      return { ...p, [key]: arr };
    });
  const deleteAt = (key: keyof AdminCuration, idx: number) =>
    setCur((p) => (p ? { ...p, [key]: ((p[key] as unknown[]) ?? []).filter((_, i) => i !== idx) } : p));
  const addItem = (key: keyof AdminCuration, item: unknown) =>
    setCur((p) => (p ? { ...p, [key]: [...((p[key] as unknown[]) ?? []), item] } : p));
  const reorderKey = (key: keyof AdminCuration, from: number, to: number) =>
    setCur((p) => (p ? { ...p, [key]: reorder((p[key] as unknown[]) ?? [], from, to) } : p));

  // ── 저장 ──
  const saveSection = async (key: 'upcoming' | 'tags' | 'broadcast' | 'collections') => {
    if (!cur) return;
    try {
      if (key === 'broadcast') {
        await api.post('/api/admin/broadcast-history', { banners: cur.broadcast ?? [] });
      }
      if (key === 'collections') {
        await api.post('/api/admin/collection-history', { collections: cur.collections ?? [] });
      }
      await api.put('/api/admin/curation', cur);
      if (key === 'broadcast' || key === 'collections') await loadHistories();
      showToast(`${key} 저장됐습니다.`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '저장 실패');
    }
  };
  const saveAll = async () => {
    if (!cur) return;
    try {
      await api.put('/api/admin/curation', cur);
      showToast('전체 큐레이션 저장됐습니다.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '저장 실패');
    }
  };

  if (!cur) {
    return (
      <>
        <div className={a.pageHeader}><h1 className={a.pageTitle}>큐레이션 관리</h1></div>
        <p className={a.dim}>불러오는 중...</p>
      </>
    );
  }

  return (
    <>
      <div className={a.pageHeader}>
        <h1 className={a.pageTitle}>큐레이션 관리</h1>
        <button className={`${a.btn} ${a.btnPrimary}`} style={{ marginLeft: 'auto' }} onClick={saveAll}>전체 저장</button>
      </div>

      <div className={c.tabBar}>
        <button className={`${c.tab} ${tab === 'landing' ? c.tabActive : ''}`} onClick={() => setTab('landing')}>메인 홈</button>
        <button className={`${c.tab} ${tab === 'explore' ? c.tabActive : ''}`} onClick={() => setTab('explore')}>탐색</button>
      </div>

      {tab === 'landing' && (
        <>
          <div className={c.subTabBar}>
            <SubTab active={landingSub === 'creators'} onClick={() => setLandingSub('creators')}>TOP.creators</SubTab>
            <SubTab active={landingSub === 'genres'} onClick={() => setLandingSub('genres')}>GENRE.catalog</SubTab>
            <SubTab active={landingSub === 'upcoming'} onClick={() => setLandingSub('upcoming')}>UPCOMING.feed</SubTab>
          </div>

          {landingSub === 'creators' && (
            <DevNotice
              title="크리에이터 연동 개발 예정"
              desc={<>이 섹션은 실제 크리에이터 유저 데이터와 연동이 필요합니다.<br />크리에이터 검색 → 선택 시 프로필 이미지 · 캐릭터 수가 자동으로 채워지는 방식으로<br />크리에이터 기능 개발 시 함께 구현될 예정입니다.</>}
              current={`${cur.creators?.length || 0}명 (${(cur.creators ?? []).map((x) => x.handle).join(', ')})`}
            />
          )}
          {landingSub === 'genres' && (
            <DevNotice
              title="장르 카탈로그 개발 예정"
              desc={<>장르는 서비스 내 캐릭터 태그 데이터를 기반으로 자동 집계되는 방식으로 구현될 예정입니다.<br />장르 분류 체계 확정 후 어드민에서 노출 순서 · 대표 이미지를 관리할 수 있도록 개발될 예정입니다.</>}
              current={`${cur.genres?.length || 0}개 (${(cur.genres ?? []).map((x) => x.label).join(', ')})`}
            />
          )}
          {landingSub === 'upcoming' && (
            <UpcomingPanel
              items={cur.upcoming ?? []}
              onPatch={(i, p) => patchArray<CurationUpcoming>('upcoming', i, p)}
              onDelete={(i) => deleteAt('upcoming', i)}
              onAdd={() => addItem('upcoming', { name: '', role: '', img: '' })}
              onReorder={(f, t) => reorderKey('upcoming', f, t)}
              onSave={() => saveSection('upcoming')}
            />
          )}
        </>
      )}

      {tab === 'explore' && (
        <>
          <div className={c.subTabBar}>
            <SubTab active={exploreSub === 'broadcast'} onClick={() => setExploreSub('broadcast')}>BROADCAST</SubTab>
            <SubTab active={exploreSub === 'tags'} onClick={() => setExploreSub('tags')}>TAG.CLOUD</SubTab>
            <SubTab active={exploreSub === 'collections'} onClick={() => setExploreSub('collections')}>EDITOR.PICKS</SubTab>
          </div>

          {exploreSub === 'broadcast' && (
            <BroadcastPanel
              items={cur.broadcast ?? []}
              active={bcActive}
              setActive={setBcActive}
              hist={bcHist}
              onPatch={(i, p) => patchArray<CurationBroadcast>('broadcast', i, p)}
              onDelete={(i) => { deleteAt('broadcast', i); setBcActive((x) => Math.max(0, Math.min(x, (cur.broadcast?.length ?? 1) - 2))); }}
              onAdd={() => { addItem('broadcast', { title: '', subtitle: '', img: '' }); setBcActive(cur.broadcast?.length ?? 0); }}
              onReorder={(f, t) => reorderKey('broadcast', f, t)}
              onSave={() => saveSection('broadcast')}
              onRestore={(snap) => { setCur((p) => (p ? { ...p, broadcast: JSON.parse(JSON.stringify(snap.banners)) } : p)); setBcActive(0); showToast('복원했습니다. 저장으로 반영하세요.'); }}
              onDeleteSnap={async (si) => {
                try { await api.delete(`/api/admin/broadcast-history/${si}`); setBcHist((h) => h.filter((_, i) => i !== si)); showToast('히스토리 삭제됐습니다.'); }
                catch (err) { showToast(err instanceof ApiError ? err.message : '삭제 실패'); }
              }}
              showToast={showToast}
            />
          )}
          {exploreSub === 'tags' && (
            <TagsPanel
              tags={cur.tags ?? []}
              onChange={(i, v) => setCur((p) => { if (!p) return p; const t = [...(p.tags ?? [])]; t[i] = v; return { ...p, tags: t }; })}
              onDelete={(i) => deleteAt('tags', i)}
              onAdd={() => addItem('tags', '#새태그')}
              onSave={() => saveSection('tags')}
            />
          )}
          {exploreSub === 'collections' && (
            <CollectionPanel
              items={cur.collections ?? []}
              active={colActive}
              setActive={setColActive}
              hist={colHist}
              onPatch={(i, p) => patchArray<CurationCollection>('collections', i, p)}
              onDelete={(i) => { deleteAt('collections', i); setColActive((x) => Math.max(0, Math.min(x, (cur.collections?.length ?? 1) - 2))); }}
              onAdd={() => { addItem('collections', { num: 'COLLECTION.00', title: '', meta: '', img: '' }); setColActive(cur.collections?.length ?? 0); }}
              onReorder={(f, t) => reorderKey('collections', f, t)}
              onSave={() => saveSection('collections')}
              onRestore={(snap) => { setCur((p) => (p ? { ...p, collections: JSON.parse(JSON.stringify(snap.collections)) } : p)); setColActive(0); showToast('복원했습니다. 저장으로 반영하세요.'); }}
              onDeleteSnap={async (si) => {
                try { await api.delete(`/api/admin/collection-history/${si}`); setColHist((h) => h.filter((_, i) => i !== si)); showToast('히스토리 삭제됐습니다.'); }
                catch (err) { showToast(err instanceof ApiError ? err.message : '삭제 실패'); }
              }}
              showToast={showToast}
            />
          )}
        </>
      )}
    </>
  );
}

// ── 작은 프레젠테이션 컴포넌트 ──
function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`${c.subTab} ${active ? c.subTabActive : ''}`} onClick={onClick}>{children}</button>;
}

function SectionHeader({ title, onAdd, addLabel, onSave }: { title: string; onAdd?: () => void; addLabel?: string; onSave?: () => void }) {
  return (
    <div className={c.sectionHeader}>
      <span className={c.sectionTitle}>{title}</span>
      <div className={c.sectionActions}>
        {onAdd && <button className={c.btnSm} onClick={onAdd}>{addLabel || '+ 추가'}</button>}
        {onSave && <button className={`${c.btnSm} ${c.saveBtn}`} onClick={onSave}>저장</button>}
      </div>
    </div>
  );
}

function DevNotice({ title, desc, current }: { title: string; desc: React.ReactNode; current: string }) {
  return (
    <div className={`${a.card} ${a.cardPad} ${c.section}`}>
      <div className={c.devNotice}>
        <div className={c.devIcon}>🔧</div>
        <div className={c.devTitle}>{title}</div>
        <div className={c.devDesc}>{desc}</div>
        <div className={c.devCurrent}>현재 더미 데이터 유지 중 — <span>{current}</span></div>
      </div>
    </div>
  );
}

function UploadRow({ img, onUpload }: { img?: string; onUpload: (file: File) => void }) {
  return (
    <div className={c.bcUploadRow}>
      <div className={c.bcUploadThumb} style={img ? { backgroundImage: `url('${img}')` } : undefined} />
      <label className={`${c.btnSm} ${c.bcUploadBtn}`}>
        이미지 업로드
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f); }} />
      </label>
      <span className={c.bcUploadPath}>{img || ''}</span>
    </div>
  );
}

// ── UPCOMING ──
function UpcomingPanel({ items, onPatch, onDelete, onAdd, onReorder, onSave }: {
  items: CurationUpcoming[];
  onPatch: (i: number, p: Partial<CurationUpcoming>) => void;
  onDelete: (i: number) => void;
  onAdd: () => void;
  onReorder: (f: number, t: number) => void;
  onSave: () => void;
}) {
  const { over, handleProps, rowProps } = useReorder(onReorder);
  const fields: { key: keyof CurationUpcoming; label: string; ph: string }[] = [
    { key: 'name', label: '이름', ph: '강도윤' },
    { key: 'role', label: '역할', ph: '로스쿨 학생' },
    { key: 'img', label: '이미지', ph: '/images/coming1.jpg' },
  ];
  return (
    <div className={`${a.card} ${a.cardPad} ${c.section}`}>
      <SectionHeader title="UPCOMING.feed" onAdd={onAdd} onSave={onSave} />
      <div className={c.itemList}>
        {items.length === 0 && <div className={c.emptyHint}>항목이 없습니다. + 추가를 눌러 추가하세요.</div>}
        {items.map((item, i) => (
          <div key={i} className={`${c.itemRow} ${over === i ? c.dragOver : ''}`} {...rowProps(i)}>
            <div className={c.itemDrag} {...handleProps(i)} title="드래그로 순서 변경"><DragIcon /></div>
            <div className={c.itemNum}>{i + 1}</div>
            <div className={c.itemFields}>
              {fields.map((f) => (
                <div key={f.key} className={c.itemField}>
                  <label className={c.itemLabel}>{f.label}</label>
                  <input className={c.itemInput} value={item[f.key] || ''} placeholder={f.ph} onChange={(e) => onPatch(i, { [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
            <button className={c.delBtn} onClick={() => onDelete(i)} title="삭제">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TAGS ──
function TagsPanel({ tags, onChange, onDelete, onAdd, onSave }: {
  tags: string[];
  onChange: (i: number, v: string) => void;
  onDelete: (i: number) => void;
  onAdd: () => void;
  onSave: () => void;
}) {
  return (
    <div className={`${a.card} ${a.cardPad} ${c.section}`}>
      <SectionHeader title="TAG.CLOUD" onAdd={onAdd} onSave={onSave} />
      <div className={c.tagList}>
        {tags.map((t, i) => (
          <div key={i} className={c.tagItem}>
            <input className={c.tagInput} value={t} onChange={(e) => onChange(i, e.target.value)} />
            <button className={c.tagDel} onClick={() => onDelete(i)} title="삭제">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BROADCAST ──
function BroadcastPanel(props: {
  items: CurationBroadcast[];
  active: number;
  setActive: (i: number) => void;
  hist: BcSnapshot[];
  onPatch: (i: number, p: Partial<CurationBroadcast>) => void;
  onDelete: (i: number) => void;
  onAdd: () => void;
  onReorder: (f: number, t: number) => void;
  onSave: () => void;
  onRestore: (snap: BcSnapshot) => void;
  onDeleteSnap: (si: number) => void;
  showToast: (m: string) => void;
}) {
  const { items, active, setActive, hist, onPatch, onDelete, onAdd, onReorder, onSave, onRestore, onDeleteSnap, showToast } = props;
  const { over, handleProps, rowProps } = useReorder(onReorder);
  const cur = items[active];

  const upload = async (i: number, file: File) => {
    try { onPatch(i, { img: await uploadImage(file) }); } catch (err) { showToast(err instanceof ApiError ? err.message : '업로드 실패'); }
  };

  return (
    <>
      {/* 미리보기 */}
      <div className={c.bcPreviewWrap}>
        <div className={c.bcPreviewLabel}>미리보기</div>
        <div className={c.bcAdminPreview}>
          {cur ? (
            <div className={c.bcPreviewBanner}>
              {cur.img && <div className={c.bcPreviewImg} style={{ backgroundImage: `url('${cur.img}')` }} />}
              <div className={c.bcPreviewInner}>
                <div className={c.bcPreviewBadge}><span className={c.bcPreviewDot} />BROADCAST · NOW</div>
                <div className={c.bcPreviewTitle}>
                  {(cur.title || '제목 없음').split('\\n').map((line, j, arr) => (
                    <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
                  ))}
                </div>
                <div className={c.bcPreviewMeta}>{cur.subtitle || '부제목 없음'}</div>
              </div>
            </div>
          ) : (
            <div className={c.bcPreviewEmpty}>배너를 선택하면 미리보기가 표시됩니다</div>
          )}
        </div>
      </div>

      {/* 목록 */}
      <div className={`${a.card} ${a.cardPad} ${c.section}`}>
        <SectionHeader title="BROADCAST 배너" onAdd={onAdd} addLabel="+ 배너 추가" onSave={onSave} />
        <div className={c.itemList}>
          {items.length === 0 && <div className={c.emptyHint}>배너가 없습니다. + 배너 추가를 눌러 추가하세요.</div>}
          {items.map((bc, i) => (
            <div key={i} className={`${c.itemRow} ${c.bcItemRow} ${i === active ? c.bcItemActive : ''} ${over === i ? c.dragOver : ''}`} {...rowProps(i)} onClick={() => setActive(i)}>
              <div className={c.itemDrag} {...handleProps(i)} title="드래그로 순서 변경"><DragIcon /></div>
              <div className={c.itemNum}>{i + 1}</div>
              <div className={c.bcItemBody}>
                <div className={c.bcItemInputs}>
                  <div className={c.itemField}>
                    <label className={c.itemLabel}>{'제목 (줄바꿈: \\n)'}</label>
                    <input className={c.itemInput} value={bc.title || ''} placeholder={'신작: 지하 서점의\\n마지막 능력자'} onChange={(e) => onPatch(i, { title: e.target.value })} />
                  </div>
                  <div className={c.itemField}>
                    <label className={c.itemLabel}>부제목</label>
                    <input className={c.itemInput} value={bc.subtitle || ''} placeholder="박재헌 · 3.2k 사용자가 읽는 중" onChange={(e) => onPatch(i, { subtitle: e.target.value })} />
                  </div>
                  <div className={c.itemField}>
                    <label className={c.itemLabel}>이미지</label>
                    <UploadRow img={bc.img} onUpload={(f) => upload(i, f)} />
                  </div>
                </div>
              </div>
              <button className={c.delBtn} onClick={(e) => { e.stopPropagation(); onDelete(i); }} title="삭제">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* 히스토리 */}
      <div className={`${a.card} ${a.cardPad} ${c.section}`}>
        <div className={c.sectionHeader}><span className={c.sectionTitle}>배너 히스토리</span></div>
        <HistoryTable
          rows={hist.map((snap) => ({ items: snap.banners, savedAt: snap.savedAt }))}
          titleOf={(it) => ((it as CurationBroadcast).title || '').replace(/\\n/g, ' ')}
          onRestore={(si) => onRestore(hist[si])}
          onDelete={onDeleteSnap}
        />
      </div>
    </>
  );
}

// ── COLLECTIONS ──
function CollectionPanel(props: {
  items: CurationCollection[];
  active: number;
  setActive: (i: number) => void;
  hist: ColSnapshot[];
  onPatch: (i: number, p: Partial<CurationCollection>) => void;
  onDelete: (i: number) => void;
  onAdd: () => void;
  onReorder: (f: number, t: number) => void;
  onSave: () => void;
  onRestore: (snap: ColSnapshot) => void;
  onDeleteSnap: (si: number) => void;
  showToast: (m: string) => void;
}) {
  const { items, active, setActive, hist, onPatch, onDelete, onAdd, onReorder, onSave, onRestore, onDeleteSnap, showToast } = props;
  const { over, handleProps, rowProps } = useReorder(onReorder);
  const cur = items[active];

  const upload = async (i: number, file: File) => {
    try { onPatch(i, { img: await uploadImage(file) }); } catch (err) { showToast(err instanceof ApiError ? err.message : '업로드 실패'); }
  };

  const fields: { key: keyof CurationCollection; label: string; ph: string }[] = [
    { key: 'num', label: '번호', ph: 'COLLECTION.07' },
    { key: 'title', label: '제목', ph: '비 오는 날의 대화' },
    { key: 'meta', label: '메타', ph: '9 characters · 서늘한 공기, 낮은 목소리' },
  ];

  return (
    <>
      {/* 미리보기 */}
      <div className={c.bcPreviewWrap}>
        <div className={c.bcPreviewLabel}>미리보기</div>
        <div className={c.colAdminPreview}>
          {cur ? (
            <div className={c.colPreviewCard}>
              {cur.img && <div className={c.colPreviewImg} style={{ backgroundImage: `url('${cur.img}')` }} />}
              <div className={c.colPreviewInner}>
                <div>
                  <div className={c.colPreviewNum}>{cur.num || 'COLLECTION.00'}</div>
                  <div className={c.colPreviewTitle}>{cur.title || '제목 없음'}</div>
                </div>
                <div className={c.colPreviewMeta}>{cur.meta || ''}</div>
              </div>
            </div>
          ) : (
            <div className={c.bcPreviewEmpty}>컬렉션을 선택하면 미리보기가 표시됩니다</div>
          )}
        </div>
      </div>

      {/* 목록 */}
      <div className={`${a.card} ${a.cardPad} ${c.section}`}>
        <SectionHeader title="EDITOR.PICKS 컬렉션" onAdd={onAdd} onSave={onSave} />
        <div className={c.itemList}>
          {items.length === 0 && <div className={c.emptyHint}>컬렉션이 없습니다. + 추가를 눌러 추가하세요.</div>}
          {items.map((col, i) => (
            <div key={i} className={`${c.itemRow} ${c.bcItemRow} ${i === active ? c.bcItemActive : ''} ${over === i ? c.dragOver : ''}`} {...rowProps(i)} onClick={() => setActive(i)}>
              <div className={c.itemDrag} {...handleProps(i)} title="드래그로 순서 변경"><DragIcon /></div>
              <div className={c.itemNum}>{i + 1}</div>
              <div className={c.bcItemBody}>
                <div className={c.bcItemInputs}>
                  {fields.map((f) => (
                    <div key={f.key} className={c.itemField}>
                      <label className={c.itemLabel}>{f.label}</label>
                      <input className={c.itemInput} value={col[f.key] || ''} placeholder={f.ph} onChange={(e) => onPatch(i, { [f.key]: e.target.value })} />
                    </div>
                  ))}
                  <div className={c.itemField}>
                    <label className={c.itemLabel}>이미지</label>
                    <UploadRow img={col.img} onUpload={(f) => upload(i, f)} />
                  </div>
                </div>
              </div>
              <button className={c.delBtn} onClick={(e) => { e.stopPropagation(); onDelete(i); }} title="삭제">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* 히스토리 */}
      <div className={`${a.card} ${a.cardPad} ${c.section}`}>
        <div className={c.sectionHeader}><span className={c.sectionTitle}>컬렉션 히스토리</span></div>
        <HistoryTable
          rows={hist.map((snap) => ({ items: snap.collections, savedAt: snap.savedAt }))}
          titleOf={(it) => (it as CurationCollection).title || ''}
          onRestore={(si) => onRestore(hist[si])}
          onDelete={onDeleteSnap}
        />
      </div>
    </>
  );
}

// ── 히스토리 테이블 (broadcast/collection 공용) ──
function HistoryTable({ rows, titleOf, onRestore, onDelete }: {
  rows: { items: { img?: string }[]; savedAt: string }[];
  titleOf: (it: { img?: string }) => string;
  onRestore: (si: number) => void;
  onDelete: (si: number) => void;
}) {
  if (rows.length === 0) {
    return <div className={c.histEmpty}>저장된 히스토리가 없습니다. 저장하면 여기에 기록됩니다.</div>;
  }
  return (
    <table className={c.histTable}>
      <thead><tr><th>썸네일</th><th>목록</th><th>저장 일시</th><th>작업</th></tr></thead>
      <tbody>
        {rows.map((snap, si) => (
          <tr key={si}>
            <td>
              <div className={c.histThumbs}>
                {snap.items.map((it, k) => (
                  <div key={k} className={c.histThumb} style={it.img ? { backgroundImage: `url('${it.img}')` } : undefined} />
                ))}
              </div>
            </td>
            <td className={c.histTitles}>
              {snap.items.map((it, k) => (
                <div key={k} className={c.histTitleRow}><span className={c.histNum}>{k + 1}</span><span>{titleOf(it)}</span></div>
              ))}
            </td>
            <td className={c.histDate}>{snap.savedAt}</td>
            <td className={c.histActions}>
              <button className={c.btnSm} onClick={() => onRestore(si)}>복원</button>
              <button className={`${c.btnSm} ${c.histDelBtn}`} onClick={() => onDelete(si)}>삭제</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
