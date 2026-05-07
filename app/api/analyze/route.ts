import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text, imageBase64 } = await req.json()

  const userContent: any[] = []
  if (imageBase64) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
    })
  }
  userContent.push({ type: 'text', text: `수업 내용:\n${text}` })

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
      system: `당신은 중국어 학습 도우미입니다. 사용자가 보내는 중국어 수업 내용을 분석해서 다음 형식으로 정리해주세요. 목표: 회화 및 듣기 향상.

**중요: 모든 중국어 단어와 문장에는 반드시 병음(拼音)을 함께 표기하세요. 병음 없이 중국어만 단독으로 쓰는 것은 절대 금지입니다.**

## 📚 오늘 배운 단어/표현
(중국어 | 병음 | 뜻 | 예문 형식으로, 예문에도 반드시 병음 포함)
## 📝 오늘 배운 문법
(각 문법 포인트 번호로, 설명 + 예문. 모든 예문에 병음 포함)
## 🗣 회화 실전 팁
(오늘 내용 기반 실전 회화/듣기 팁 2~3가지. 중국어 표현마다 병음 포함)
## ✏️ 연습 문제 (5문제)
(빈칸 채우기, 번역, 회화 완성 혼합. 중국어 문장마다 병음 포함)
## ✅ 정답
한국어로 설명, 중국어와 병음은 그대로 표기.`,
      messages: [{ role: 'user', content: userContent }]
    })
  })

  const data = await res.json()
  const result = data.content?.map((c: any) => c.text || '').join('\n') || '오류가 발생했습니다.'
  return NextResponse.json({ result })
}
