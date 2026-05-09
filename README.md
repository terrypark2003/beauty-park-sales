# 뷰티파크의원 매출 보고 시스템

엑셀 템플릿(`뷰티파크의원_매출보고_템플릿.xlsx`)을 그대로 웹화한 일일 매출 보고 시스템입니다.

## 기능

- 사용자 이름 입력 후 보고서 작성
- CRM 매출 (비보험 과세/면세) + 단말기 매출 (1~5번) 입력
- **CRM 합계와 단말기 합계가 일치하지 않으면 제출 불가** (프론트/서버 양쪽 검증)
- 제출 시 자동 이메일 발송 (Resend)
- Vercel KV에 영구 저장
- 관리자 페이지에서 전체 보고서 조회/필터/CSV 다운로드

## 로컬 실행

```bash
npm install
cp .env.example .env.local
# .env.local 값 채우기
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## Vercel 배포 (단계별 가이드)

### 1. GitHub 저장소 만들기

이 폴더(`beauty-park-sales`)를 GitHub에 푸시합니다.

```bash
cd beauty-park-sales
git init
git add .
git commit -m "Initial commit"
gh repo create beauty-park-sales --private --source=. --push
# 또는 GitHub 웹사이트에서 새 저장소를 만들고 push
```

### 2. Resend 계정 생성 및 API 키 발급

1. https://resend.com 회원가입 (무료, 월 3,000통)
2. **API Keys** 메뉴에서 **Create API Key** → 복사
3. (선택) **Domains**에서 본인 도메인 추가하면 발신자 주소를 본인 도메인으로 변경 가능. 안 하면 기본 `onboarding@resend.dev`로 발송됨.

### 3. Vercel 프로젝트 임포트

1. https://vercel.com 로그인
2. **Add New → Project** → GitHub 저장소 선택 → **Import**
3. 아무 설정 변경 없이 **Deploy** 클릭 (Next.js 자동 인식)

### 4. Vercel KV 연결

1. 배포된 프로젝트 → **Storage** 탭
2. **Create Database → KV (Upstash)** 선택
3. 이름 입력 후 **Create**
4. 해당 프로젝트에 **Connect** → 환경 변수 자동 주입됨

### 5. 환경 변수 추가

프로젝트 → **Settings → Environment Variables** 에서 다음 추가:

| 변수명 | 값 |
| --- | --- |
| `RESEND_API_KEY` | Resend에서 받은 키 (`re_...`) |
| `EMAIL_FROM` | `onboarding@resend.dev` (또는 본인 도메인) |
| `EMAIL_TO` | `jiscompanylimited@gmail.com` |
| `ADMIN_PASSWORD` | 관리자 페이지에서 사용할 비밀번호 |

`KV_*` 변수들은 4단계에서 자동으로 들어가 있습니다.

### 6. 재배포

환경 변수를 추가한 뒤 **Deployments → 가장 최근 배포 → ⋯ → Redeploy** 클릭.

배포가 끝나면 `https://your-project.vercel.app` 에서 사용 가능합니다.

## 페이지

- `/` — 이름 입력 후 입장
- `/report` — 매출 보고서 작성/제출
- `/admin` — 관리자 페이지 (`ADMIN_PASSWORD` 입력 필요)

## 검증 로직

CRM과 단말기의 카드/현금/총합이 모두 일치(차액 0원)해야 제출 가능합니다.

- 카드: `비보험(과세) 카드 + 비보험(면세) 카드` = `Σ 단말기 카드`
- 현금/이체: `현금영수증 + 통장입금` = `Σ 단말기 현금/이체`
- 총 매출: 위 두 항목 합계

차액이 있으면 제출 버튼이 비활성화되고, 클라이언트가 우회하더라도 서버에서 다시 검증해 차단합니다.
