# 생명 마블 by 용쌤 (v1.1)

생명과학 학습용 부루마블 스타일 보드게임

## 📂 파일 구조

```
bio_marble/
├── index.html                게임 본체
├── admin.html                문제 관리자 페이지 (비번: 1q2w3e4r)
├── css/
│   ├── game.css
│   └── admin.css
├── js/
│   ├── audio.js              BGM/SFX/볼륨 관리
│   ├── quiz.js               문제 풀 사이클 관리
│   ├── render.js             보드/토큰/3D 동물원/3D 주사위
│   ├── game-core.js          게임 로직/상태/턴
│   └── admin.js              관리자 CRUD
├── data/
│   └── default-quizzes.json  기본 19문제
├── assets/
│   ├── bgm/                  bgm-01/02/03.mp3 (순서대로 반복)
│   └── sfx/                  9종 효과음
├── reference/                원본 기획 자료 (PPT, PDF, 원본 오디오)
└── 생명마블by용쌤_v.1.0.html  이전 버전 백업 (참고용)
```

## 🎮 게임 규칙

### 기본
- **보드**: 10×6 그리드, 28칸 시계방향
- **시작 코인**: 30 (v1.0의 25에서 증가)
- **플레이어**: 2~4 모둠
- **이동**: 주사위 2개 합산 (2~12칸)

### 칸 효과
| 칸 | 효과 |
|----|------|
| START 통과 | +2 코인 |
| START 도착 | +3 코인 |
| **생물보호구역** | **+5 코인** (v2.0 변경) |
| 감옥 | 2턴 정지 또는 3코인 탈출 |
| 세계동물여행 | 원하는 동물 칸으로 이동 |
| 생물구조열쇠 | 12종 랜덤 카드 |

### 동물 칸 퀴즈 플로우 (v2.0)
1. 동물 칸 도착 → **[문제 시작] 버튼** 표시
2. 버튼 클릭 → **3-2-1 카운트다운** 풀스크린
3. **풀스크린 퀴즈** 등장 + 10초 타이머
4. 타이머 종료 → **[정답 공개] 버튼** (자동공개 X)
5. 진행자가 정답 확인 후 **[⭕성공] [❌실패]** 자가판정

### 문제 출제 방식 (v2.0 핵심)
- 모든 문제가 **셔플된 큐**에서 하나씩 추첨
- 한 사이클 안에서 중복 출제 없음
- 게임 시작 시마다 큐 리셋 (새로 셔플)
- 풀 소진 시 자동 재셔플

### 동물원
- **Lv.1** 건설: 성공 시 2코인 / 실패 시 2+세금
- **Lv.2** 업그레이드: 2+세금 (관람비 2배)
- **Lv.3** 무적: 2+세금 (타 팀 가로채기/폐쇄 불가)

### 관람비 (상대 동물원 방문)
- 성공: 세금 + 2코인 (×Lv2 이상이면 2배)
- 실패: 세금 + 2 + 2코인 (×Lv2 이상이면 2배)
- 성공 시 관람비 2배를 내면 **인수 + 업그레이드**

## 🎵 오디오

### BGM (순서대로 반복)
1. `bgm-01.mp3` (Jazz of Maple)
2. `bgm-02.mp3`
3. `bgm-03.mp3`

### SFX
| 파일 | 용도 |
|------|------|
| `dice-roll.mp3` | 주사위 굴림 |
| `quiz-ambience.mp3` | 문제 풀이 동안 BGM |
| `timer-tick.mp3` | 마지막 3초 긴장감 |
| `correct.mp3` | 정답 |
| `wrong.mp3` | 오답 |
| `zoo-build.mp3` | 동물원 건설/업그레이드/인수 |
| `coin.mp3` | 코인 획득 |
| `jail.mp3` | 감옥 칸 |
| `golden-key.mp3` | 생물구조열쇠 |

### 볼륨 조절
- 게임 화면 우상단에 **BGM / 효과음 슬라이더 + 음소거 토글**
- localStorage에 자동 저장

## ⚙️ 관리자 페이지

- URL: `/admin.html`
- 비밀번호: `1q2w3e4r`
- 기능:
  - 문제 추가/수정/삭제
  - JSON 내보내기 / 가져오기
  - 기본 19문제로 초기화
- 데이터는 브라우저 `localStorage`에 저장 (단독 PC 사용 기준)

## 🚀 배포 — Cloudflare Pages (GitHub 연동)

### 1. Git 저장소 초기화
```bash
cd C:/Projects/bio_marble
git init
git add .
git commit -m "Initial commit: bio marble v2.0"
```

### 2. GitHub 레포 생성
- github.com에서 `bio-marble` 레포 생성 (Public 또는 Private)
```bash
git remote add origin https://github.com/<USERNAME>/bio-marble.git
git branch -M main
git push -u origin main
```

### 3. Cloudflare Pages 연결
1. dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. GitHub 계정 인증 → `bio-marble` 레포 선택
3. **Build settings**:
   - Framework preset: **None**
   - Build command: (비워둠)
   - Build output directory: `/`
4. **Save and Deploy**

### 4. 접속
- 게임: `https://bio-marble.pages.dev/`
- 관리자: `https://bio-marble.pages.dev/admin.html`

### 수정 반영
- 로컬에서 수정 → `git add . && git commit -m "..." && git push`
- Cloudflare가 자동 재배포 (1~2분)

## 🔧 로컬 테스트

브라우저에서 HTML을 직접 더블클릭하면 **`fetch()` 가 막힙니다**. 아래 중 하나로 실행:

### Python (가장 간단)
```bash
cd C:/Projects/bio_marble
python -m http.server 8080
# http://localhost:8080 접속
```

### Node
```bash
npx serve .
```

## 📝 변경 이력

### v2.0 (현재)
- **오디오**: BGM 3곡 순환 + 9종 SFX + 볼륨 조절 UI
- **문제 시스템**: 셔플 큐 기반 랜덤 출제 (사이클 내 중복 없음)
- **관리자 페이지**: `admin.html` 비번 잠금 + CRUD + JSON 입출력
- **UI**:
  - 풀스크린 퀴즈 모달 (가독성↑)
  - 3-2-1 카운트다운
  - 정답 수동 공개 ([정답 공개] 버튼)
  - 3D 주사위 tumble 애니메이션 (확대 + 회전)
  - 3D 동물원 건물 (지붕/본체/문 + 상승 애니메이션)
  - 큰 이모지 캐릭터 토큰 (🦊 🐯 🐼 🐰)
  - 모둠 현황 확대
  - 게임 로그 제거
  - 전체 글꼴 확대
- **규칙**:
  - 시작 코인 25 → **30**
  - 문제 제한시간 5초/10초 → **10초 고정**
  - 생물보호구역 무효 → **+5 코인**
- **구조**: 단일 HTML → 다중 파일 (HTML/CSS/JS/JSON/assets 분리)

### v1.0
- 최초 구현 (단일 HTML)

## 🎯 문제 추가하기

1. `admin.html` 접속 → 비번 `1q2w3e4r`
2. **문제 추가** 영역에 문제/정답 입력 → **추가**
3. 50문제까지 추가 가능 (현재 기본 19문제)
4. 필요 시 **JSON 내보내기**로 백업
# bio-marble
