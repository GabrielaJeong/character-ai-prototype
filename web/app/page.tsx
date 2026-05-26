export default function HomePage() {
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
        gap: 16,
      }}
    >
      <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>Folio</h1>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
        React 마이그레이션 진행 중
      </p>
      <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 24 }}>
        Phase A — Next.js 14 + TypeScript scaffolding 완료
      </p>
    </main>
  );
}
