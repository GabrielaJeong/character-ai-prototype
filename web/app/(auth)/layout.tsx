// (auth) route group — login/signup/reset 공통 레이아웃 자리
// 현재는 각 페이지에 자체 헤더 두므로 pass-through
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
