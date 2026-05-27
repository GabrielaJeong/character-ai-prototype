'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { useCharacters } from '@/lib/hooks';
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
  type: 'delta' | 'done' | 'error';
  text?: string;
  error?: string;
  sessionId?: string;
  model?: string;
  characterId?: string;
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
  const router = useRouter();
  const { characters, isLoading } = useCharacters();
  const showToast = useUIStore((s) => s.showToast);
  const setAppReady = useUIStore((s) => s.setAppReady);
  const consumePrep = useChatPrepStore((s) => s.consume);

  const char = characters.find((c) => c.id === params.id) ?? null;

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

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // prep 소비 — 캐릭터 데이터 로드 후 한 번만 (ref 가드로 StrictMode 안전, ML-011 참조)
  useEffect(() => {
    if (consumedRef.current) return;
    if (isLoading) return;
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
  }, [isLoading, params.id, consumePrep]);

  // 캐릭터 없는 경우 (또는 prep 없이 들어온 경우) → 페르소나 setup으로
  useEffect(() => {
    if (hasPersona === false) {
      router.replace(`/persona?char=${encodeURIComponent(params.id)}`);
    }
  }, [hasPersona, params.id, router]);

  // 메시지 추가 시 스크롤 하단으로
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  if (!isLoading && characters.length > 0 && !char) notFound();
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
    // user 메시지 즉시 추가
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

    let accumulated = '';
    let assistantPlaced = false;
    let streamError: string | null = null;

    try {
      for await (const ev of streamSSE<SSEEvent>('/api/chat', body)) {
        if (ev.type === 'delta' && ev.text) {
          accumulated += ev.text;
          if (!assistantPlaced) {
            // 첫 delta — assistant 메시지 append
            assistantPlaced = true;
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', sender: charName, versions: [accumulated], vIdx: 0 },
            ]);
          } else {
            // 이후 delta — 마지막 메시지 (= 방금 추가한 assistant) versions[0] 갱신
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const next = prev.slice();
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, versions: [accumulated] };
              return next;
            });
          }
        } else if (ev.type === 'error') {
          streamError = ev.error ?? '응답에 실패했습니다.';
        }
        // done은 별도 처리 불필요 (loop 자체가 끝남)
      }
    } catch (err) {
      streamError = err instanceof ApiError ? err.message : '연결에 실패했습니다.';
    } finally {
      setSending(false);
    }

    if (streamError) {
      if (assistantPlaced) {
        // partial 텍스트가 있으면 끝에 에러 안내 덧붙임
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const next = prev.slice();
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            versions: [`${accumulated}\n\n(${streamError})`],
          };
          return next;
        });
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', sender: charName, versions: [`(${streamError})`], vIdx: 0 },
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

    let accumulated = '';
    let streamError: string | null = null;

    try {
      for await (const ev of streamSSE<SSEEvent>('/api/chat/regenerate', { sessionId, model })) {
        if (ev.type === 'delta' && ev.text) {
          accumulated += ev.text;
          setMessages((prev) =>
            prev.map((m, i) => {
              if (i !== idx) return m;
              const last = m.versions.length - 1;
              const newVersions = m.versions.map((v, vi) => (vi === last ? accumulated : v));
              return { ...m, versions: newVersions };
            }),
          );
        } else if (ev.type === 'error') {
          streamError = ev.error ?? '재생성에 실패했습니다.';
        }
      }
    } catch (err) {
      streamError = err instanceof ApiError ? err.message : '재생성에 실패했습니다.';
    } finally {
      setSending(false);
      setRegeneratingIdx(null);
    }

    if (streamError) {
      // 빈 새 버전 제거 (실패 시 원래 버전으로 복귀)
      if (!accumulated) {
        setMessages((prev) =>
          prev.map((m, i) => {
            if (i !== idx) return m;
            const newVersions = m.versions.slice(0, -1);
            return { ...m, versions: newVersions, vIdx: newVersions.length - 1 };
          }),
        );
      }
      showToast(streamError);
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
