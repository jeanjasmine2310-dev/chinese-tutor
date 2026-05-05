# 중국어 수업 노트 앱

## 배포 방법

### 1. GitHub에 올리기
1. github.com 접속 → 우상단 `+` → `New repository`
2. Repository name: `chinese-tutor`
3. `Create repository` 클릭
4. 이 폴더 전체를 GitHub Desktop으로 올리거나 아래 명령어 사용

### 2. Vercel 배포
1. vercel.com 접속 → `Add New Project`
2. GitHub에서 `chinese-tutor` 저장소 선택
3. **Environment Variables** 섹션에서:
   - Name: `ANTHROPIC_API_KEY`
   - Value: 발급받은 API 키 붙여넣기
4. `Deploy` 클릭

완료! 자동으로 URL이 생성됩니다.
