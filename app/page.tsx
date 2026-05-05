'use client'
import { useState, useEffect, useRef } from 'react'

type Lesson = {
  id: number
  date: string
  num: number
  text: string
  summary: string
  wordCount: number
  grammarCount: number
}

const STORAGE_KEY = 'chinese_tutor_lessons'

function loadLessons(): Lesson[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveLessons(lessons: Lesson[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons))
}

function getWeekKey(date: string) {
  const d = new Date(date)
  const start = new Date(d)
  start.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return start.toISOString().split('T')[0]
}

export default function Home() {
  const [tab, setTab] = useState<'input' | 'history' | 'weekly' | 'monthly'>('input')
  const [lessons, setLessons] = useState<Lesson[]>([])

  // Input tab
  const [date, setDate] = useState('')
  const [num, setNum] = useState('')
  const [text, setText] = useState('')
  const [imgBase64, setImgBase64] = useState<string | null>(null)
  const [imgName, setImgName] = useState('')
  const [imgPreview, setImgPreview] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState('')

  // Weekly
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [weeklyResult, setWeeklyResult] = useState('')

  // Monthly
  const [selectedMonth, setSelectedMonth] = useState('')
  const [monthLessons, setMonthLessons] = useState<Lesson[]>([])
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [monthlyResult, setMonthlyResult] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLessons(loadLessons())
    setDate(new Date().toISOString().split('T')[0])
  }, [])

  const handleImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImgName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result as string
      setImgPreview(data)
      setImgBase64(data.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  const analyze = async () => {
    if (!text.trim()) { alert('수업 내용을 입력해주세요'); return }
    setAnalyzing(true)
    setResult('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageBase64: imgBase64 })
      })
      const data = await res.json()
      setResult(data.result)
    } catch {
      setResult('오류가 발생했습니다. 다시 시도해주세요.')
    }
    setAnalyzing(false)
  }

  const saveLesson = () => {
    if (!result) { alert('먼저 수업을 분석해주세요'); return }
    const rowMatches = result.match(/\|[^|\n]+\|[^|\n]+\|[^|\n]+\|/g) || []
    const lesson: Lesson = {
      id: Date.now(),
      date: date || new Date().toISOString().split('T')[0],
      num: parseInt(num) || lessons.length + 1,
      text,
      summary: result,
      wordCount: Math.max(0, rowMatches.length - 1),
      grammarCount: (result.match(/^\d+\./gm) || []).length
    }
    const updated = [lesson, ...lessons].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setLessons(updated)
    saveLessons(updated)
    setText(''); setNum(''); setImgBase64(null); setImgPreview(''); setImgName(''); setResult('')
    setDate(new Date().toISOString().split('T')[0])
    alert('저장됐어요!')
  }

  const deleteLesson = (id: number) => {
    if (!confirm('삭제할까요?')) return
    const updated = lessons.filter(l => l.id !== id)
    setLessons(updated)
    saveLessons(updated)
  }

  // Group by week
  const byWeek: Record<string, Lesson[]> = {}
  lessons.forEach(l => {
    const k = getWeekKey(l.date)
    if (!byWeek[k]) byWeek[k] = []
    byWeek[k].push(l)
  })

  const toggleWeek = (id: number) => {
    const s = new Set(selectedIds)
    if (s.has(id)) s.delete(id); else s.add(id)
    setSelectedIds(s)
  }

  const generateWeekly = async () => {
    const sel = lessons.filter(l => selectedIds.has(l.id))
    if (!sel.length) { alert('수업을 선택해주세요'); return }
    setWeeklyLoading(true); setWeeklyResult('')
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: sel, type: 'weekly' })
      })
      const data = await res.json()
      setWeeklyResult(data.result)
    } catch { setWeeklyResult('오류가 발생했습니다.') }
    setWeeklyLoading(false)
  }

  const months = [...new Set(lessons.map(l => l.date.substring(0, 7)))].sort((a, b) => b.localeCompare(a))

  const loadMonth = () => {
    if (!selectedMonth) { alert('월을 선택해주세요'); return }
    setMonthLessons(lessons.filter(l => l.date.startsWith(selectedMonth)))
  }

  const generateMonthly = async () => {
    if (!monthLessons.length) { alert('먼저 월을 선택하고 불러오기를 눌러주세요'); return }
    setMonthlyLoading(true); setMonthlyResult('')
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: monthLessons, type: 'monthly' })
      })
      const data = await res.json()
      setMonthlyResult(data.result)
    } catch { setMonthlyResult('오류가 발생했습니다.') }
    setMonthlyLoading(false)
  }

  const copy = (t: string) => { navigator.clipboard.writeText(t); alert('복사됐어요!') }

  const totalWords = lessons.reduce((s, l) => s + (l.wordCount || 0), 0)
  const totalGrammar = lessons.reduce((s, l) => s + (l.grammarCount || 0), 0)

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <h1 className="app-title">중국어 수업 노트</h1>
        <p className="app-subtitle">회화 · 듣기 집중 학습 트래커</p>
      </header>

      <div className="tabs">
        {(['input', 'history', 'weekly', 'monthly'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'input' ? '수업 입력' : t === 'history' ? '수업 기록' : t === 'weekly' ? '주간 평가' : '월간 평가'}
          </button>
        ))}
      </div>

      {/* 수업 입력 */}
      {tab === 'input' && (
        <div>
          <div className="card">
            <div className="card-title">수업 정보</div>
            <div className="field-row">
              <div className="field">
                <label>수업 날짜</label>
                <input type="text" value={date} onChange={e => setDate(e.target.value)} placeholder="2024-01-15" />
              </div>
              <div className="field">
                <label>회차</label>
                <input type="number" value={num} onChange={e => setNum(e.target.value)} placeholder="예: 5" min={1} />
              </div>
            </div>
            <div className="field">
              <label>수업 내용 / 대화 메모</label>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="수업 중 기록한 대화, 선생님 설명, 예문 등을 여기 붙여넣으세요..." />
            </div>
            <div className="field">
              <label>책 / 노트 사진 (선택)</label>
              <div className="upload-zone" onClick={() => fileRef.current?.click()}>
                {imgName || '사진을 클릭해서 업로드하세요'}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImg} />
              </div>
              {imgPreview && <img src={imgPreview} alt="preview" className="img-preview" />}
            </div>
          </div>

          <button className="btn btn-primary btn-full" onClick={analyze} disabled={analyzing}>
            {analyzing ? <span className="loading-dots"><span/><span/><span/></span> : '수업 정리 + 문제 만들기 →'}
          </button>

          {result && (
            <div>
              <div className="result-box">{result}</div>
              <div className="btn-row">
                <button className="btn btn-sm" onClick={() => copy(result)}>복사하기</button>
                <button className="btn btn-red btn-sm" onClick={saveLesson}>이 수업 저장하기</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 수업 기록 */}
      {tab === 'history' && (
        <div>
          <div className="stats-row">
            <div className="stat"><div className="stat-n">{lessons.length}</div><div className="stat-l">총 수업</div></div>
            <div className="stat"><div className="stat-n">{totalWords}</div><div className="stat-l">배운 단어</div></div>
            <div className="stat"><div className="stat-n">{totalGrammar}</div><div className="stat-l">배운 문법</div></div>
          </div>

          {!lessons.length ? (
            <div className="empty"><span className="empty-char">無</span>아직 저장된 수업이 없어요</div>
          ) : (
            Object.keys(byWeek).sort((a, b) => b.localeCompare(a)).map(week => {
              const d = new Date(week)
              const end = new Date(d); end.setDate(d.getDate() + 6)
              return (
                <div className="week-group" key={week}>
                  <div className="week-label">{d.getMonth()+1}월 {d.getDate()}일 ~ {end.getMonth()+1}월 {end.getDate()}일</div>
                  {byWeek[week].map(l => (
                    <div className="lesson-row" key={l.id}>
                      <div>
                        <div className="lesson-name">{l.num}회차 수업</div>
                        <div className="lesson-meta">{l.date} · 단어 {l.wordCount}개 · 문법 {l.grammarCount}개</div>
                      </div>
                      <div className="lesson-actions">
                        <button className="btn btn-sm" onClick={() => alert(l.summary)}>보기</button>
                        <button className="btn btn-sm" style={{color:'var(--red)'}} onClick={() => deleteLesson(l.id)}>삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* 주간 평가 */}
      {tab === 'weekly' && (
        <div>
          <div className="card">
            <div className="card-title">이번 주 수업 선택</div>
            {!lessons.length ? (
              <div className="empty" style={{padding:'1rem'}}><span className="empty-char">無</span>저장된 수업이 없어요</div>
            ) : (
              <div className="check-list">
                {lessons.slice(0, 12).map(l => (
                  <label className="check-item" key={l.id}>
                    <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleWeek(l.id)} />
                    <span>{l.date} · {l.num}회차</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary btn-full" onClick={generateWeekly} disabled={weeklyLoading}>
            {weeklyLoading ? <span className="loading-dots"><span/><span/><span/></span> : '주간 평가 문제 만들기 →'}
          </button>
          {weeklyResult && (
            <div>
              <div className="result-box">{weeklyResult}</div>
              <div className="btn-row">
                <button className="btn btn-sm" onClick={() => copy(weeklyResult)}>복사하기</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 월간 평가 */}
      {tab === 'monthly' && (
        <div>
          <div className="card">
            <div className="card-title">월 선택</div>
            <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{flex:1}}>
                <option value="">월을 선택하세요</option>
                {months.map(m => {
                  const [y, mo] = m.split('-')
                  return <option key={m} value={m}>{y}년 {parseInt(mo)}월</option>
                })}
              </select>
              <button className="btn" onClick={loadMonth}>불러오기</button>
            </div>
            {monthLessons.length > 0 && (
              <div className="month-info">{monthLessons.length}회 수업 불러옴</div>
            )}
          </div>
          <button className="btn btn-primary btn-full" onClick={generateMonthly} disabled={monthlyLoading}>
            {monthlyLoading ? <span className="loading-dots"><span/><span/><span/></span> : '월간 평가 문제 만들기 →'}
          </button>
          {monthlyResult && (
            <div>
              <div className="result-box">{monthlyResult}</div>
              <div className="btn-row">
                <button className="btn btn-sm" onClick={() => copy(monthlyResult)}>복사하기</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
