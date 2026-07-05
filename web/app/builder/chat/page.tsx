'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useBuilderStore } from '@/store/builder';
import { api, ApiError } from '@/lib/api';
import { cleanBuilderReply, extractCharReady } from '@/lib/builder';
import { ChatInput } from '@/components/ChatInput';
import { ModelPicker } from '@/components/ModelPicker';
import { BuilderLoading } from '@/components/BuilderLoading';
import styles from './page.module.css';

/**
 * AI 빌더 챗 — `/builder/chat`
 *
 * 원본: index.html L652~670 (#screen-builder-chat) + app.js L2948~3098, L3196~3275.
 *
 * 흐름:
 *   - 마운트 시 reset + 첫 메시지('시작해줘') 자동 전송 (1회 재시도)
 *   - 대화 진행 → 응답에 [CHARACTER_READY] 포함되면 "캐릭터 생성하기" CTA 표시
 *   - CTA → /api/builder/generate → systemMd 저장 후 /builder/preview 이동
 */
interface BuilderMsg {
  role: 'user' | 'assistant';
  text: string;
  ready?: boolean; // [CHARACTER_READY] 감지된 assistant 메시지
}

interface ChatResponse {
  reply: string;
  builderSessionId: string;
  isReady: boolean;
}

export default function BuilderChatPage() {
  const router = useRouter();
  const setAppReady = useUIStore((s) => s.setAppReady);
  const showToast = useUIStore((s) => s.showToast);
  const { user, ready } = useRequireAuth('/builder/chat', {
    title: '캐릭터 제작',
    desc: '캐릭터를 제작하려면 로그인이 필요합니다.',
  });

  const model = useBuilderStore((s) => s.model);
  const setModel = useBuilderStore((s) => s.setModel);
  const setSession = useBuilderStore((s) => s.setSession);
  const setCharData = useBuilderStore((s) => s.setCharData);
  const setSystemMd = useBuilderStore((s) => s.setSystemMd);
  const reset = useBuilderStore((s) => s.reset);

  const [messages, setMessages] = useState<BuilderMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [progress, setProgress] = useState<number | null>(null); // null = 로딩 아님

  const messagesRef = useRef<HTMLDivElement>(null);
  const initedRef = useRef(false); // StrictMode 이중 실행 가드 (L-018/ML-011)

  useEffect(() => {
    setAppReady(true);
  }, [setAppReady]);

  // 스크롤 하단 고정
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // 첫 대화 자동 시작
  useEffect(() => {
    if (!ready || !user || initedRef.current) return;
    initedRef.current = true;
    reset();

    const initConversation = async () => {
      setSending(true);
      setTyping(true);

      const attempt = () =>
        api.post<ChatResponse>('/api/builder/chat', {
          message: '시작해줘',
          builderSessionId: null,
          model: useBuilderStore.getState().model,
        });

      let data: ChatResponse | null = null;
      try {
        data = await attempt();
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          data = await attempt();
        } catch {
          data = null;
        }
      }

      setTyping(false);
      if (data) {
        setSession(data.builderSessionId);
        pushAssistant(data.reply, data.isReady);
      } else {
        pushAssistant('(연결에 실패했습니다. 다시 시도해주세요.)', false);
      }
      setSending(false);
    };

    initConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  const pushAssistant = (reply: string, isReady: boolean) => {
    setMessages((prev) => [...prev, { role: 'assistant', text: reply, ready: isReady }]);
    if (isReady) {
      const data = extractCharReady(reply);
      if (data) setCharData(data);
    }
  };

  const onSend = async (text: string) => {
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setTyping(true);

    try {
      const data = await api.post<ChatResponse>('/api/builder/chat', {
        message: text,
        builderSessionId: useBuilderStore.getState().sessionId,
        model: useBuilderStore.getState().model,
      });
      setTyping(false);
      setSession(data.builderSessionId);
      pushAssistant(data.reply, data.isReady);
    } catch {
      setTyping(false);
      pushAssistant('(연결에 실패했습니다. 다시 시도해주세요.)', false);
    }
    setSending(false);
  };

  // 캐릭터 생성 → systemPrompt 생성 후 preview 이동
  const startGenerating = async () => {
    const charData = useBuilderStore.getState().charData;
    if (!charData) return;

    setProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p = Math.min(p + (Math.random() * 12 + 4), 85);
      setProgress(p);
    }, 500);

    try {
      const data = await api.post<{ systemPrompt: string }>('/api/builder/generate', {
        characterData: charData,
      });
      clearInterval(interval);
      setProgress(100);
      setSystemMd(data.systemPrompt);
      setTimeout(() => router.push('/builder/preview'), 400);
    } catch (err) {
      clearInterval(interval);
      setProgress(null);
      showToast(err instanceof ApiError ? err.message : '생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  if (!ready || !user) {
    return <div className={styles.wrap} />;
  }

  return (
    <div className={styles.wrap}>
      {progress !== null && <BuilderLoading progress={progress} />}

      <div className={styles.header}>
        <button
          type="button"
          className={styles.btnBack}
          onClick={() => router.push('/builder')}
          aria-label="뒤로"
        >
          ←
        </button>
        <div className={styles.headerAvatar}>✦</div>
        <div className={styles.headerInfo}>
          <span className={styles.charName}>Folio Builder</span>
          <span className={styles.charStatus}>캐릭터 제작 어시스턴트</span>
        </div>
      </div>

      <div className={styles.messages} ref={messagesRef}>
        {messages.map((m, i) =>
          m.role === 'assistant' ? (
            <div key={i} className={`${styles.msg} ${styles.msgAssistant}`}>
              <div className={styles.builderAvatar}>✦</div>
              <div className={styles.msgInner}>
                <div className={styles.msgSender}>Folio Builder</div>
                <div className={styles.msgBubble}>{cleanBuilderReply(m.text)}</div>
                {m.ready && useBuilderStore.getState().charData && (
                  <button type="button" className={styles.btnGenerate} onClick={startGenerating}>
                    ✦ 캐릭터 생성하기
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div key={i} className={`${styles.msg} ${styles.msgUser}`}>
              <div className={styles.msgInnerUser}>
                <div className={styles.msgSender}>나</div>
                <div className={styles.msgBubble}>{m.text}</div>
              </div>
            </div>
          ),
        )}
        {typing && (
          <div className={`${styles.msg} ${styles.msgAssistant}`}>
            <div className={styles.builderAvatar}>✦</div>
            <div className={styles.msgInner}>
              <div className={styles.msgSender}>Folio Builder</div>
              <div className={styles.typingBubble}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.modelBar}>
        <ModelPicker value={model} onChange={setModel} />
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={onSend}
        disabled={sending}
        placeholder="메시지를 입력하세요"
        autoFocus
      />
    </div>
  );
}
