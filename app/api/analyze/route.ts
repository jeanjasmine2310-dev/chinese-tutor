import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text, imageBase64, grading } = await req.json()

  // 채점 요청은 기존 방식 유지
  if (grading) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: [{ type: 'text', text }] }]
      })
    })
    const data = await res.json()
    const result = data.content?.map((c: any) => c.text || '').join('\n') || '오류'
    return NextResponse.json({ result })
  }

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
      max_tokens: 8000,
      system: `당신은 중국어 학습 도우미입니다. 수업 내용을 분석해서 아래 JSON 형식으로만 응답하세요. JSON 외에 다른 텍스트는 절대 쓰지 마세요.

{
  "summary": "## 📚 오늘 배운 단어/표현\\n(내용)\\n\\n## 📝 오늘 배운 문법\\n(내용)\\n\\n## 🗣 회화 실전 팁\\n(내용)",
  "questions": [
    { "question": "문제1 (중국어 포함시 병음 함께)", "answer": "정답1" },
    { "question": "문제2", "answer": "정답2" },
    { "question": "문제3", "answer": "정답3" },
    { "question": "문제4", "answer": "정답4" },
    { "question": "문제5", "answer": "정답5" }
  ]
}

규칙:
- 모든 중국어에는 반드시 병음 포함
- summary는 마크다운 형식으로 작성
- questions는 정확히 5개
- JSON만 반환, 마크다운 코드블록(\`\`\`)도 쓰지 말 것`,
      messages: [{ role: 'user', content: userContent }]
    })
  })

  const data = await res.json()
  const raw = data.content?.map((c: any) => c.text || '').join('\n') || ''

  try {
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return NextResponse.json({
      result: parsed.summary,
      questions: parsed.questions
    })
  } catch {
    return NextResponse.json({ result: raw, questions: [] })
  }
}
