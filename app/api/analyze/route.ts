import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5'
const HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': process.env.ANTHROPIC_API_KEY!,
  'anthropic-version': '2023-06-01'
}

async function callClaude(system: string, userContent: any[], maxTokens = 8000) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }]
    })
  })
  const data = await res.json()
  return data.content?.map((c: any) => c.text || '').join('\n') || ''
}

// 텍스트를 청크로 분할 (단어 중간에 자르지 않음)
function splitIntoChunks(text: string, chunkSize = 800): string[] {
  if (text.length <= chunkSize) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = start + chunkSize
    if (end < text.length) {
      // 줄바꿈 기준으로 자르기
      const lastNewline = text.lastIndexOf('\n', end)
      if (lastNewline > start) end = lastNewline
    }
    chunks.push(text.slice(start, end).trim())
    start = end
  }
  return chunks.filter(c => c.length > 0)
}

export async function POST(req: NextRequest) {
  const { text, imageBase64, grading } = await req.json()

  // 채점 요청
  if (grading) {
    const raw = await callClaude('', [{ type: 'text', text }], 1000)
    return NextResponse.json({ result: raw || '오류' })
  }

  const chunks = splitIntoChunks(text)

  try {
    let allWords: any[] = []

    // 수업 내용이 길면 청크별로 단어/표현 먼저 추출
    if (chunks.length > 1) {
      const wordExtractionPromises = chunks.map(chunk =>
        callClaude(
          `수업 내용에서 중국어 단어와 표현을 빠짐없이 추출하세요.
반드시 JSON 배열만 반환하세요. 다른 텍스트 없이.
형식: [{"word":"你好","pinyin":"nǐ hǎo","meaning":"안녕하세요"}]
규칙:
- 모든 중국어 단어/표현 포함 (하나도 빠뜨리지 말 것)
- 병음 반드시 포함
- 뜻은 한국어로
- JSON만 반환, 마크다운 코드블록 금지`,
          [{ type: 'text', text: chunk }],
          4000
        )
      )

      const wordResults = await Promise.all(wordExtractionPromises)

      for (const raw of wordResults) {
        try {
          const cleaned = raw.replace(/```json|```/g, '').trim()
          const parsed = JSON.parse(cleaned)
          if (Array.isArray(parsed)) allWords = [...allWords, ...parsed]
        } catch {
          // 파싱 실패한 청크는 스킵
        }
      }
    }

    // 최종 분석: 전체 텍스트 + 추출된 단어 목록 활용
    const userContent: any[] = []

    if (imageBase64) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
      })
    }

    const wordListNote = allWords.length > 0
      ? `\n\n[사전 추출된 단어 목록 - 반드시 전부 포함할 것]\n${JSON.stringify(allWords)}`
      : ''

    userContent.push({
      type: 'text',
      text: `수업 내용:\n${text}${wordListNote}`
    })

    const raw = await callClaude(
      `당신은 중국어 학습 도우미입니다. 수업 내용을 분석해서 아래 JSON 형식으로만 응답하세요. JSON 외에 다른 텍스트는 절대 쓰지 마세요.

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
- 수업에 나온 단어/표현은 하나도 빠짐없이 전부 포함 (생략 절대 금지)
- 모든 중국어에 병음 반드시 표기
- 뜻은 한국어로 반드시 표기
- summary는 마크다운 형식으로 작성
- questions는 정확히 5개
- JSON만 반환, 마크다운 코드블록(\`\`\`) 쓰지 말 것`,
      userContent,
      16000
    )

    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json({
      result: parsed.summary,
      questions: parsed.questions ?? []
    })
  } catch {
    return NextResponse.json({ result: text, questions: [] })
  }
}
