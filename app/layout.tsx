import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '중국어 수업 노트',
  description: '중국어 과외 수업 정리 & 평가 앱',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
