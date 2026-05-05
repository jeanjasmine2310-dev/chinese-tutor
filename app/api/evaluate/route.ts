import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { lessons, type } = await req.json()

  const combined = lessons.map((l: any) => `[${l.date} ${l.num}회차]\n${l.summary}`).join('\n\n---\n\n')

  const isMonthly = type === 'monthly'
  const prompt = isMonthly
    ? `이번 달 ${lessons.length}회 수업 내용으로 월간 평가를 만들어주세요:\n\n${combined}\n\n형식:\n## 📅 이번 달 학습 총정리\n## 📈 성장 포인트\n## 🏆 월간 종합 평가 (15문제)\n- 단어/표현 5문제\n- 문법 5문제\n- 회화 상황 3문제\n- 작문 2문제\n## ✅ 정답\n## 🎯 다음 달 목표 제안`
    : `이번 주 ${lessons.length}회차 수업으로 주간 평가를 만들어주세요:\n\n${combined}\n\n형식:\n## 📊 이번 주 학습 요약\n## 🎯 주간 복습 문제 (10문제)\n- 단어/표현 4문제\n- 문법 3문제\n- 회화 완성 3문제\n## ✅ 정답\n## 💬 이번 주 한마디`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: '중국어 학습 도우미. 회화/듣기 목표에 맞는 실용적인 평가 문제를 만들어주세요. 한국어로 설명.',
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await res.json()
  const result = data.content?.map((c: any) => c.text || '').join('\n') || '오류가 발생했습니다.'
  return NextResponse.json({ result })
}
