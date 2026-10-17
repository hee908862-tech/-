# 초능력 윷놀이 — GitHub + Render 온라인 플레이 체험판

기존 초능력 윷놀이 v9의 게임 화면·규칙을 바탕으로, 친구가 다른 기기에서 같은 방에 접속해 플레이할 수 있도록 구성한 **시험용 온라인 패키지**입니다.

## 구성

- `public/index.html`: 기존 게임 화면과 게임 로직
- `public/online.js`: 온라인 방 생성/참가, 화면 동기화, 원격 조작 연결
- `server.py`: Python `aiohttp` HTTP/WebSocket 서버
- `requirements.txt`: 서버 실행에 필요한 라이브러리
- `render.yaml`: Render Blueprint 배포 설정 (무료 Web Service)
- `tests/test_server.py`: 서버/WebSocket 검증
- `tests/test_ui.py`: 설치된 Chromium/Playwright 환경에서 클라이언트 조작 로직 검증

## A. GitHub에 올리는 방법

1. GitHub에 로그인해 **New repository** 를 누릅니다.
2. 예: `superpower-yutnori` 라는 새 저장소를 생성합니다.
3. **Add file → Upload files** 로 이 ZIP을 압축 해제한 폴더 **안의 파일들**을 업로드합니다. `server.py`, `requirements.txt`, `render.yaml`이 저장소 맨 위에 있어야 합니다. `public/` 폴더도 함께 올립니다.
4. Commit changes를 누릅니다.

## B. Render에 올리는 방법 — 간단한 설정

1. <https://dashboard.render.com/>에 로그인합니다.
2. **New → Web Service** 를 누릅니다.
3. 방금 만든 GitHub 저장소를 연결합니다.
4. 아래 설정으로 배포합니다.

| 항목 | 값 |
|---|---|
| Language / Runtime | Python |
| Branch | main (GitHub 기본 브랜치) |
| Root Directory | 비우기 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `python server.py` |
| Instance Type | Free (선택 가능할 때) |
| Health Check Path | `/health` |

**참고:** `render.yaml`을 이용해 **New → Blueprint**로 저장소를 연결하면 일부 설정이 자동 적용될 수 있습니다. Render UI와 요금제는 변할 수 있습니다.

5. 배포가 끝나면 `https://...onrender.com` 형태의 주소가 표시됩니다.
6. 그 주소에 접속해 **🌐 온라인 대전 → 새 방 만들기**를 누릅니다.

## C. 친구와 플레이하기

1. 방장은 온라인 대전 화면에서 이름과 방 인원(2~4)을 선택해 방을 생성합니다.
2. 화면에 생성된 **6자리 방 코드** 또는 **초대 링크**를 친구에게 보냅니다.
3. 친구는 자신의 PC/휴대폰 브라우저에서 링크를 엽니다. 온라인 대전 화면에서 이름을 적고 참가합니다.
4. 방장이 **온라인 게임 시작**을 누릅니다. 2명 이상 입장해야 시작할 수 있습니다.
5. 모든 플레이어는 자기 화면에서 자신의 차례를 조작하고, 다른 사람의 차례에는 진행을 관전합니다. 빈자리는 AI가 채웁니다.

별도 프로그램 설치가 필요한 사람은 서버를 직접 실행하는 관리자뿐이며, Render 배포 시 누구도 설치할 필요가 없습니다.

## D. 로컬에서 시험

Python 3.10+ 설치 후 터미널에서:

```bash
pip install -r requirements.txt
python server.py
```

브라우저에서 `http://localhost:8080` 접속. 같은 PC의 다른 브라우저/프로필로 함께 들어가서 테스트할 수 있습니다. `PORT` 환경변수를 설정하면 다른 포트 사용 가능.

## E. 범위와 제약 (중요)

- **온라인 플레이어 2~4명, 인원 부족 시 AI 자동 충원**.
- **기존의 싱글/한 기기 로컬 멀티는 유지**.
- **방장 브라우저가 게임 상태를 계산·중계하는 호스트 권한 모델**입니다. Render 서버는 방 연결과 화면/행동 전달을 맡으며, 전체 윷놀이 규칙을 별도로 재검증하는 서버 권위형 엔진은 아닙니다.
- 방장이 탭을 닫거나 접속이 끊기면 **진행 중 게임이 중단**됩니다. 게임 중 재접속·중간 저장·관전자 전용 자리는 아직 지원하지 않습니다.
- 초능력은 각자에게 별도 화면으로 전달되지만 호스트에 게임 상태가 있으며, 악의적인 참가자에 대한 강력한 치트 방지 보장을 제공하지 않습니다.
- 동시에 사용자가 많거나 네트워크가 불안정하면 화면 반영이 지연될 수 있습니다.
- Render 무료 인스턴스는 유휴 시간 이후 잠들 수 있고, 새 접속 시 깨어나는 데 시간이 걸릴 수 있습니다. 무료 정책/한도는 Render에서 확인하세요.
- **외부 인터넷 상의 두 실제 기기에서 4인 전체 게임 완료까지 검증된 상용판은 아닙니다.** 배포 후 2명이 실제 한 판을 테스트해야 합니다.

## F. 빠른 문제 해결

- 사이트 접속이 안 되면 Render의 Logs와 `/health`를 확인하세요.
- 방 참가가 안 되면 두 기기가 동일한 `onrender.com` 주소에 접속했는지 확인하세요. 서버가 재시작되면 예전 방은 사라집니다.
- 무료 서버의 첫 접속이 오래 걸린다면 1~2분 정도 기다려 보세요.
- 원격 조작이 반영되지 않는다면 방장을 포함해 모두 사이트를 새로고침한 뒤 새 방에서 다시 시작하세요.
- `index.html`을 더블클릭하면 온라인 방 연결이 안 됩니다. 반드시 Render 링크나 로컬 서버 주소에서 접속하세요.

## 테스트

- 서버: HTTP `/`, `/online.js`, `/health`, 방 생성/참가, WebSocket snapshot/command, 동작 종류 필터, 접속 종료
- UI: Chromium에서 로컬 HTML 렌더, 2인 시작, 원격 플레이어 화면에 비공개 능력 전송, 원격 윷 던지기 명령 처리, JS 오류 확인

개인 플레이를 위한 프로토타입입니다. 공개 서비스 운영 전 서버 권위형 규칙 검증과 재접속 기능을 추가할 것을 권장합니다.
