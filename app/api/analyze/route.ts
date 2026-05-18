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
      `당신은 중국어 학습 도우미입니다. 수업 필기 내용을 분석해서 아래 JSON 형식으로만 응답하세요. JSON 외에 다른 텍스트는 절대 쓰지 마세요.

[한자 오류 수정]
- 이 내용은 중국어 학습자가 수업 중 필기한 내용임
- 모든 내용은 중국어 학습과 관련된 단어/표현/문법임
- 병음이 같거나 비슷한데 한자가 어색하면 반드시 올바른 한자로 수정
- 고유명사(앱 이름, 브랜드명, 회사명 등)로 절대 해석하지 말 것
- 수정한 단어 옆에 (✏️ 수정됨) 표시

오류 수정 예시:
- 玩橙(wán chéng) → 完成(wán chéng) - 완성하다 ← 학습자가 한자를 잘못 씀
- 还没玩橙 → 还没完成 (hái méi wán chéng) - 아직 완성하지 않았다

[summary 구성 - 줄바꿈은 \\n으로]

## 📚 오늘 배운 단어/표현
- 의미상 연관된 단어끼리 ### 소제목으로 묶기 (예: ### 요일 표현, ### 시간 표현, ### 생활 표현)
- 각 단어: - **단어 (병음)** - 뜻  형식
- 관련 단어 묶음은 한 항목으로 정리 (예: 요일 3가지 방식을 하나의 ### 아래에)
- 모든 단어에 병음 필수

## 📝 오늘 배운 문법
- ### 번호. 문법명 형식으로 작성
- 각 문법: 의미 설명 + 예문(한자 (병음) - 한국어 해석) 포함

## 🗣 회화 실전 팁
- ### 번호. 주제 형식으로 작성
- 단어 단순 나열 금지
- 실제 사용 맥락, 뉘앙스 차이, 활용 문장 위주로 작성

[questions 규칙]
- 정확히 5개
- 단순 단어 뜻 묻기보다 문법/문장 활용 위주로 출제
- 모든 중국어에 병음 포함

JSON 형식:
{
  "summary": "(위 형식대로 작성)",
  "questions": [
    { "question": "문제1", "answer": "정답1" },
    { "question": "문제2", "answer": "정답2" },
    { "question": "문제3", "answer": "정답3" },
    { "question": "문제4", "answer": "정답4" },
    { "question": "문제5", "answer": "정답5" }
  ]
}

JSON만 반환, 마크다운 코드블록(\`\`\`) 절대 금지`,
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
