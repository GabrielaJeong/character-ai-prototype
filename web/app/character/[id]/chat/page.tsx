'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, notFound } from 'next/navigation';
import { useCharacters, useCharacterDetail, useSession } from '@/lib/hooks';
import { useUIStore } from '@/store/ui';
import { useChatPrepStore } from '@/store/chatPrep';
import { ApiError, streamSSE } from '@/lib/api';
import { CHAT_DEFAULT_MODEL } from '@/lib/models';
import { ChatInput } from '@/components/ChatInput';
import { ModelPicker } from '@/components/ModelPicker';
import type { PersonaData, Safety } from '@/lib/types';
import styles from './page.module.css';

/**
 * 채팅 — `/character/[id]/chat`
 *
 * 원본: index.html L450~508 (#screen-chat) + app.js sendMessage / regenerate / renderMessage.
 *
 * 데이터 흐름:
 *   1. 페르소나 setup이 useChatPrepStore에 prep 세팅 후 이 페이지로 navigate
 *   2. 첫 마운트에 prep 소비 — 없으면 /character/[id] (인트로)로 reroute
 *   3. sessionId는 클라이언트 생성 (`session-<ts>-<rand>`)
 *   4. 첫 메시지 POST 시 백엔드가 세션 생성 (persona + safety + characterId 함께 전송)
 *   5. 이후 메시지는 sessionId만으로 컨텍스트 유지
 *
 * SSE 스트리밍 (Day 6.x):
 *   - POST /api/chat 과 /api/chat/regenerate는 SSE로 응답
 *   - 첫 delta 도착 전에는 typing dots (기존 동작)
 *   - delta 도착하면 그 시점부터 메시지 텍스트가 점진적으로 채워짐 (ChatGPT 같은 UX)
 *   - done 이벤트 = 종료, error 이벤트 = 메시지 추가
 *
 * 기능:
 *   - 메시지 송수신 (POST /api/chat — SSE)
 *   - 응답 재생성 (POST /api/chat/regenerate — SSE) + 버전 페이지네이션
 *   - 채팅 ↔ 소설 모드 토글
 *   - 모델 선택 (model 변경 시 다음 요청부터 적용)
 *   - typing indicator (첫 delta 도착 전까지만)
 *
 * 미구현 (다음 단계):
 *   - 노트 모달 / 캐릭터 프로필 모달 / 기존 세션 로드
 */
interface SSEEvent {
  type: 'delta' | 'done' | 'error' | 'session';
  text?: string;
  error?: string;
  sessionId?: string;
  model?: string;
  characterId?: string;
}

/**
 * SSE delta들을 누적해서 target에 저장하고, requestAnimationFrame 루프가 displayed를
 * 일정 속도(typewriter)로 따라잡으며 onDisplay를 호출. 사용자에겐 chunk size 무관하게
 * 글자 단위로 자연스럽게 흘러가 보임.
 *
 * 속도:
 *   - 기본 60 chars/sec (한글 음절 17ms 간격 정도, 자연스러운 읽기 속도)
 *   - target이 30자 이상 앞서 있으면 최대 4배 가속 (catch-up)
 *
 * 종료:
 *   - SSE iteration 끝 + displayed가 target에 도달하면 resolve
 *   - error 이벤트는 error 필드로 반환 (호출자가 분기)
 */
async function consumeSmoothStream(
  source: AsyncIterable<SSEEvent>,
  onDisplay: (displayed: string) => void,
  onSession: (sessionId: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; error: string | null; aborted: boolean }> {
  let target = '';
  let displayed = '';
  let streamDone = false;
  let error: string | null = null;
  let rafId: number | null = null;
  let lastTime = 0;
  const BASE_CPS = 60;

  const tick = (ts: number) => {
    if (lastTime === 0) lastTime = ts;
    const dt = ts - lastTime;
    lastTime = ts;

    if (displayed.length < target.length) {
      const ahead = target.length - displayed.length;
      let chars = (dt / 1000) * BASE_CPS;
      if (ahead > 30) chars *= Math.min(4, ahead / 30);
      const advance = Math.max(1, Math.floor(chars));
      displayed = target.slice(0, Math.min(displayed.length + advance, target.length));
      onDisplay(displayed);
    }

    if (displayed.length < target.length || !streamDone) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  };
  rafId = requestAnimationFrame(tick);

  let aborted = false;
  try {
    for await (const ev of source) {
      if (signal?.aborted) { aborted = true; break; }
      if (ev.type === 'session' && ev.sessionId) {
        // Codex R3 F3: 세션 생성 직후 URL 갱신 — stream 실패해도 안전
        onSession(ev.sessionId);
      } else if (ev.type === 'delta' && ev.text) {
        target += ev.text;
      } else if (ev.type === 'error') {
        error = ev.error ?? '응답에 실패했습니다.';
      }
    }
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
      aborted = true;
    } else {
      error = err instanceof ApiError ? err.message : '연결에 실패했습니다.';
    }
  }

  streamDone = true;

  if (aborted) {
    // 페이지 이탈 등 — drain 기다리지 않고 즉시 종료
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    return { text: target, error: null, aborted: true };
  }

  // tick 루프가 drain 끝낼 때까지 대기
  await new Promise<void>((resolve) => {
    const check = () => {
      if (rafId === null) resolve();
      else setTimeout(check, 30);
    };
    check();
  });

  return { text: target, error, aborted: false };
}

type Role = 'user' | 'assistant';
interface Msg {
  role: Role;
  sender: string;
  versions: string[];
  vIdx: number;
}

type Mode = 'chat' | 'novel';

function newSessionId() {
  return 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

/** 큰따옴표(직접+곡선) 안 텍스트를 dialogue 스팬으로 감싸 highlight. 원본 highlightDialogue. */
function highlightDialogue(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /([“][^”\n]*[”]|"[^"\n]+")/g;
  let lastIdx = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    parts.push(<span key={key++} className={styles.dialogue}>{match[0]}</span>);
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

export default function ChatPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className={styles.wrap} />}>
      <ChatInner params={params} />
    </Suspense>
  );
}

function ChatInner({ params }: { params: { id: string } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const sessionParam = sp.get('session');
  const isExistingSession = !!sessionParam;

  const { characters, isLoading } = useCharacters();
  const { session: loadedSession, isLoading: sessionLoading, error: sessionError } =
    useSession(sessionParam);
  const showToast = useUIStore((s) => s.showToast);
  const setAppReady = useUIStore((s) => s.setAppReady);
  const consumePrep = useChatPrepStore((s) => s.consume);

  // Codex R3 F2: 필터링된 list에 없으면 단건 fallback. 성인 토글 OFF 상태에서
  // 본인이 과거에 대화한 adult_only 캐릭터 세션도 열려야 함.
  const charInList = characters.find((c) => c.id === params.id) ?? null;
  const needFallback = !isLoading && !charInList;
  const { character: charFallback, isLoading: fallbackLoading } = useCharacterDetail(
    needFallback ? params.id : null,
  );
  const char = charInList ?? charFallback;

  // chat session state
  const [persona, setPersona] = useState<PersonaData | null>(null);
  const [safety, setSafety] = useState<Safety>('on');
  const [sessionId, setSessionId] = useState<string>('');
  const [model, setModel] = useState<string>(CHAT_DEFAULT_MODEL);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<Mode>('chat');
  const [hasPersona, setHasPersona] = useState<boolean | null>(null); // null=확인 전
  // 재생성 중인 메시지 인덱스. null이면 신규 전송(또는 idle). 신규 전송 typing은 별도 bubble로.
  // (Codex F2: 직전 assistant bubble이 typing으로 잠깐 바뀌던 버그 fix)
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  // StrictMode에서 useEffect가 두 번 호출되어도 consume이 한 번만 일어나도록 가드.
  // useState 가드는 closure가 stale해서 두 번 다 통과 → 두 번째 consume이 null 반환하는 버그를 일으킴.
  const consumedRef = useRef(false);
  // Codex R2 F4: 현재 in-flight 스트림의 AbortController. 페이지 이탈/새 전송 시 cancel.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // 페이지 unmount 시 in-flight 스트림 abort (Codex R2 F4)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Hydration — `?session=<id>` 있으면 백엔드 세션 로드, 없으면 chatPrep 소비.
  // ref 가드로 StrictMode 안전 (ML-011).
  useEffect(() => {
    if (consumedRef.current) return;
    if (isLoading) return;
    // char fallback 로드 중이면 대기 (F2)
    if (!char) return;

    if (isExistingSession) {
      // 기존 세션 모드 — useSession 응답 대기
      if (sessionLoading) return;
      if (sessionError || !loadedSession) {
        consumedRef.current = true;
        setHasPersona(false);
        return;
      }
      // character_id 불일치 (URL 조작) → 안전 차단
      if (loadedSession.character_id !== params.id) {
        consumedRef.current = true;
        setHasPersona(false);
        return;
      }
      consumedRef.current = true;
      setPersona(loadedSession.persona);
      setSafety((loadedSession.safety === 'off' ? 'off' : 'on') as Safety);
      setSessionId(loadedSession.id);
      if (loadedSession.model) setModel(loadedSession.model);

      // messages → Msg[] 변환
      const personaName = loadedSession.persona.name || '유저';
      const charName_ = char?.name ?? '캐릭터';
      const hydratedMessages = (loadedSession.messages ?? []).map((m) => ({
        role: m.role,
        sender: m.role === 'user' ? personaName : charName_,
        versions: [m.content],
        vIdx: 0,
      }));
      setMessages(hydratedMessages);
      setHasPersona(true);
    } else {
      // 새 채팅 모드 — chatPrep 소비
      consumedRef.current = true;
      const prep = consumePrep();
      if (prep && prep.characterId === params.id) {
        setPersona(prep.persona);
        setSafety(prep.safety);
        setSessionId(newSessionId());
        setHasPersona(true);
      } else {
        setHasPersona(false);
      }
    }
  }, [isLoading, isExistingSession, sessionLoading, sessionError, loadedSession, params.id, consumePrep, char?.name]);

  // 실패 시 redirect — 기존 세션 로드 실패면 /history, 신규 prep 없으면 /persona
  useEffect(() => {
    if (hasPersona === false) {
      if (isExistingSession) {
        router.replace('/history');
      } else {
        router.replace(`/persona?char=${encodeURIComponent(params.id)}`);
      }
    }
  }, [hasPersona, isExistingSession, params.id, router]);

  // 메시지 추가 시 스크롤 하단으로
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // notFound: list 로드 끝났고 fallback도 끝났는데 char가 없으면 진짜 없는 캐릭터.
  if (!isLoading && !fallbackLoading && needFallback && !charFallback) notFound();
  if (!char || hasPersona !== true || !persona) {
    return <div className={styles.wrap} />;
  }

  const charName = char.name;
  const userName = persona.name || '유저';
  const status = [char.team, char.role].filter(Boolean).join(' · ');

  const onSend = async (text: string) => {
    if (sending) return;
    setSending(true);
    setInput('');
    setMessages((prev) => [
      ...prev,
      { role: 'user', sender: userName, versions: [text], vIdx: 0 },
    ]);

    const isFirstMessage = messages.length === 0;
    const body: Record<string, unknown> = { sessionId, message: text, model };
    if (isFirstMessage) {
      body.persona = persona;
      body.characterId = char.id;
      body.safety = safety;
    }

    // 첫 displayed (1자라도) 도착 시 assistant 메시지 append. 이후엔 마지막 메시지 갱신.
    let assistantPlaced = false;
    const onDisplay = (displayed: string) => {
      if (!assistantPlaced) {
        assistantPlaced = true;
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', sender: charName, versions: [displayed], vIdx: 0 },
        ]);
      } else {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const next = prev.slice();
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, versions: [displayed] };
          return next;
        });
      }
    };

    // session event 도착 시 URL 즉시 갱신 (Codex R3 F3) — stream 실패해도 안전
    const onSession = (newSessionId: string) => {
      if (!isExistingSession && isFirstMessage) {
        router.replace(`/character/${char.id}/chat?session=${encodeURIComponent(newSessionId)}`);
      }
    };

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const { text: finalText, error, aborted } = await consumeSmoothStream(
      streamSSE<SSEEvent>('/api/chat', body, { signal: ctrl.signal }),
      onDisplay,
      onSession,
      ctrl.signal,
    );
    abortRef.current = null;

    setSending(false);

    if (aborted) return; // 페이지 이탈 등 — UI 업데이트 안 함

    if (error) {
      if (assistantPlaced) {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const next = prev.slice();
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            versions: [`${finalText}\n\n(${error})`],
          };
          return next;
        });
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', sender: charName, versions: [`(${error})`], vIdx: 0 },
        ]);
      }
    }
  };

  const onRegenerate = async (idx: number) => {
    if (sending) return;
    setSending(true);
    setRegeneratingIdx(idx);

    // 빈 새 버전을 미리 추가하고 vIdx 이동 → 그 자리에 typing dots가 보임
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        return { ...m, versions: [...m.versions, ''], vIdx: m.versions.length };
      }),
    );

    const onDisplay = (displayed: string) => {
      setMessages((prev) =>
        prev.map((m, i) => {
          if (i !== idx) return m;
          const last = m.versions.length - 1;
          const newVersions = m.versions.map((v, vi) => (vi === last ? displayed : v));
          return { ...m, versions: newVersions };
        }),
      );
    };

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const { text: finalText, error, aborted } = await consumeSmoothStream(
      streamSSE<SSEEvent>('/api/chat/regenerate', { sessionId, model }, { signal: ctrl.signal }),
      onDisplay,
      () => { /* regenerate는 세션 생성 안 함 — no-op */ },
      ctrl.signal,
    );
    abortRef.current = null;

    setSending(false);
    setRegeneratingIdx(null);

    if (aborted) {
      // 페이지 이탈 시 — 백엔드는 partial 저장. 프론트 UI 업데이트 안 함 (어차피 unmount).
      return;
    }

    if (error) {
      if (!finalText) {
        // 빈 새 버전 제거 (실패 시 원래 버전으로 복귀)
        setMessages((prev) =>
          prev.map((m, i) => {
            if (i !== idx) return m;
            const newVersions = m.versions.slice(0, -1);
            return { ...m, versions: newVersions, vIdx: newVersions.length - 1 };
          }),
        );
      }
      showToast(error);
    }
  };

  const onVersion = (idx: number, dir: -1 | 1) => {
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        const ni = m.vIdx + dir;
        if (ni < 0 || ni >= m.versions.length) return m;
        return { ...m, vIdx: ni };
      }),
    );
  };

  const onBack = () => router.push(`/character/${char.id}`);
  const toggleMode = () => setMode((m) => (m === 'chat' ? 'novel' : 'chat'));

  // 마지막 assistant 메시지 인덱스 (재생성 버튼은 가장 최근 assistant에만)
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIdx = i;
      break;
    }
  }

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <button type="button" className={styles.btnBack} onClick={onBack} aria-label="뒤로">←</button>
        <button type="button" className={styles.profileBtn} onClick={() => showToast('프로필 모달 준비중')}>
          {char.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={char.image} alt={charName} className={styles.avatar} />
          ) : (
            <div className={styles.avatarPlaceholder}>{charName[0]}</div>
          )}
          <div className={styles.headerInfo}>
            <span className={styles.charName}>{charName}</span>
            {status && <span className={styles.charStatus}>{status}</span>}
          </div>
        </button>
        <button type="button" className={styles.btnMode} onClick={toggleMode}>
          {mode === 'novel' ? '💬 채팅' : '📖 소설'}
        </button>
        <button
          type="button"
          className={styles.btnNote}
          onClick={() => showToast('노트 모달 준비중')}
          title="유저 노트"
          aria-label="유저 노트"
        >
          📝
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className={`${styles.messages} ${mode === 'novel' ? styles.novelMode : ''}`}
      >
        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            msg={m}
            mode={mode}
            charImage={char.image}
            charName={charName}
            isLastAssistant={i === lastAssistantIdx}
            // streaming 중이면 controls(regen/pagination) 숨김 (Codex F2 + streaming UX)
            streaming={regeneratingIdx === i || (sending && i === lastAssistantIdx && regeneratingIdx === null)}
            onRegenerate={() => onRegenerate(i)}
            onPrev={() => onVersion(i, -1)}
            onNext={() => onVersion(i, +1)}
          />
        ))}
        {/* 신규 전송: assistant 메시지가 첫 delta로 추가되기 전까지만 typing dots 표시 */}
        {sending && regeneratingIdx === null && (messages.length === 0 || messages[messages.length - 1].role === 'user') && (
          <TypingMessage charImage={char.image} charName={charName} mode={mode} />
        )}
      </div>

      {/* Model bar */}
      <div className={styles.modelBar}>
        <ModelPicker value={model} onChange={setModel} />
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={onSend}
        disabled={sending}
        placeholder={`${charName}에게 메시지를 보내세요...`}
        autoFocus
      />
    </div>
  );
}

interface MsgProps {
  msg: Msg;
  mode: Mode;
  charImage?: string;
  charName: string;
  isLastAssistant: boolean;
  /** true면 controls (pagination / regen 버튼) 숨김 — streaming/regen in progress */
  streaming: boolean;
  onRegenerate: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function MessageBubble({
  msg,
  mode,
  charImage,
  charName,
  isLastAssistant,
  streaming,
  onRegenerate,
  onPrev,
  onNext,
}: MsgProps) {
  const text = msg.versions[msg.vIdx];
  const isUser = msg.role === 'user';
  const versionsCount = msg.versions.length;
  const isNovel = mode === 'novel';
  // streaming 중에 아직 텍스트가 없으면 typing dots (regen 초기, 새 메시지 첫 delta 전).
  // 텍스트가 한 글자라도 오면 즉시 점진 표시.
  const showTyping = streaming && (!text || text.length === 0);

  if (isUser) {
    return (
      <div className={`${styles.msg} ${styles.msgUser}`}>
        <div className={styles.msgInnerUser}>
          <div className={styles.msgSender}>{msg.sender}</div>
          <div className={styles.msgBubble}>{text}</div>
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className={`${styles.msg} ${styles.msgAssistant}`}>
      {charImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={charImage} alt={charName} className={styles.msgAvatar} />
      ) : (
        <div className={styles.msgAvatarPlaceholder}>{charName[0]}</div>
      )}
      <div className={styles.msgInner}>
        <div className={styles.msgSender}>{msg.sender}</div>
        {showTyping ? (
          <div className={styles.typingBubble}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        ) : (
          <div className={styles.msgBubble}>
            {isNovel ? highlightDialogue(text) : text}
          </div>
        )}
        {/* streaming 중엔 controls 숨김 — 사용자 spam 방지 */}
        {!streaming && versionsCount > 1 && (
          <div className={styles.msgPagination}>
            <button
              type="button"
              className={styles.btnPg}
              onClick={onPrev}
              disabled={msg.vIdx === 0}
              aria-label="이전 버전"
            >
              ←
            </button>
            <span className={styles.pgCounter}>
              {msg.vIdx + 1} / {versionsCount}
            </span>
            <button
              type="button"
              className={styles.btnPg}
              onClick={onNext}
              disabled={msg.vIdx === versionsCount - 1}
              aria-label="다음 버전"
            >
              →
            </button>
          </div>
        )}
        {!streaming && isLastAssistant && (
          <button
            type="button"
            className={styles.btnRegenerate}
            onClick={onRegenerate}
          >
            ↺ 다시 생성
          </button>
        )}
      </div>
    </div>
  );
}

function TypingMessage({ charImage, charName, mode }: { charImage?: string; charName: string; mode: Mode }) {
  return (
    <div className={`${styles.msg} ${styles.msgAssistant}`}>
      {charImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={charImage} alt={charName} className={styles.msgAvatar} />
      ) : (
        <div className={styles.msgAvatarPlaceholder}>{charName[0]}</div>
      )}
      <div className={styles.msgInner}>
        {mode === 'chat' && <div className={styles.msgSender}>{charName}</div>}
        <div className={styles.typingBubble}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      </div>
    </div>
  );
}
