'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { useCharacters } from '@/lib/hooks';
import { useUIStore } from '@/store/ui';
import { useChatPrepStore } from '@/store/chatPrep';
import { api, ApiError } from '@/lib/api';
import { CHAT_DEFAULT_MODEL } from '@/lib/models';
import { ChatInput } from '@/components/ChatInput';
import { ModelPicker } from '@/components/ModelPicker';
import type { PersonaData, Safety } from '@/lib/types';
import styles from './page.module.css';

/**
 * 채팅 — `/character/[id]/chat`
 *
 * 원본: index.html L450~508 (#screen-chat) + app.js sendMessage (L2412~2456) / regenerate (L2606~2639) / renderMessage (L2477~2577).
 *
 * 데이터 흐름:
 *   1. 페르소나 setup이 useChatPrepStore에 prep 세팅 후 이 페이지로 navigate
 *   2. 첫 마운트에 prep 소비 — 없으면 /character/[id] (인트로)로 reroute
 *   3. sessionId는 클라이언트 생성 (`session-<ts>-<rand>`)
 *   4. 첫 메시지 POST 시 백엔드가 세션 생성 (persona + safety + characterId 함께 전송)
 *   5. 이후 메시지는 sessionId만으로 컨텍스트 유지
 *
 * 기능:
 *   - 메시지 송수신 (POST /api/chat)
 *   - 응답 재생성 (POST /api/chat/regenerate) + 버전 페이지네이션
 *   - 채팅 ↔ 소설 모드 토글 (UI만, 백엔드 영향 없음)
 *   - 모델 선택 (POST 시 model 함께 전송)
 *   - typing indicator
 *
 * 미구현 (다음 단계):
 *   - 노트 모달 (사용자 노트 저장)
 *   - 캐릭터 프로필 모달 (헤더 프로필 클릭)
 *   - 기존 세션 로드 (history → 이 페이지로 재진입)
 */

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

    try {
      // 새 세션이면 persona/characterId/safety 함께. 기존이면 sessionId만.
      const isFirstMessage = messages.length === 0;
      const body: Record<string, unknown> = { sessionId, message: text, model };
      if (isFirstMessage) {
        body.persona = persona;
        body.characterId = char.id;
        body.safety = safety;
      }
      const data = await api.post<{ reply: string; sessionId: string; model: string }>(
        '/api/chat',
        body,
      );
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', sender: charName, versions: [data.reply], vIdx: 0 },
      ]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '연결에 실패했습니다.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', sender: charName, versions: [`(${msg})`], vIdx: 0 },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onRegenerate = async (idx: number) => {
    if (sending) return;
    setSending(true);
    setRegeneratingIdx(idx);
    try {
      // Codex F1: 현재 model을 body에 함께 전달 — 백엔드가 session.model 갱신
      const data = await api.post<{ reply: string }>('/api/chat/regenerate', { sessionId, model });
      setMessages((prev) =>
        prev.map((m, i) => {
          if (i !== idx) return m;
          const newVersions = [...m.versions, data.reply];
          return { ...m, versions: newVersions, vIdx: newVersions.length - 1 };
        }),
      );
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '재생성에 실패했습니다.');
    } finally {
      setSending(false);
      setRegeneratingIdx(null);
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
            // 재생성 중인 정확한 메시지에만 typing 표시 (Codex F2)
            sending={regeneratingIdx === i}
            onRegenerate={() => onRegenerate(i)}
            onPrev={() => onVersion(i, -1)}
            onNext={() => onVersion(i, +1)}
          />
        ))}
        {/* 신규 전송 typing은 별도 bubble로 끝에 — 직전 assistant는 그대로 유지 */}
        {sending && regeneratingIdx === null && (
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
  sending: boolean;
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
  sending,
  onRegenerate,
  onPrev,
  onNext,
}: MsgProps) {
  const text = msg.versions[msg.vIdx];
  const isUser = msg.role === 'user';
  const versionsCount = msg.versions.length;
  const isNovel = mode === 'novel';

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
        {sending ? (
          <div className={styles.typingBubble}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        ) : (
          <>
            <div className={styles.msgBubble}>
              {isNovel ? highlightDialogue(text) : text}
            </div>
            {versionsCount > 1 && (
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
            {isLastAssistant && (
              <button
                type="button"
                className={styles.btnRegenerate}
                onClick={onRegenerate}
              >
                ↺ 다시 생성
              </button>
            )}
          </>
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
