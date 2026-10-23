# SPACE 프로젝트

과학B 1~3차시의 학생 화면과 공개 수업 자료입니다. 서버 API, 데이터베이스, 실제 학생 기록, 교사 계정 정보는 포함하지 않습니다.

**공식 수업 주소(교수님과 학생 공통):** [SPACE 프로젝트 열기](https://tnals961006-bot.github.io/space-project-science-b/)

## 고정 주소

교수님께 이미 공유한 위 URL은 교수님과 학생이 함께 쓰는 공식 수업 진입 주소이며, 계속 유지합니다. 이후 수정도 같은 저장소 `tnals961006-bot/space-project-science-b`와 Pages 경로 `/space-project-science-b/`에 게시하며, `main`에 반영해 같은 주소의 내용을 갱신합니다.

학생과 교수님이 사용하는 `PUBLIC_STUDENT_URL`은 위 고정 주소로 유지합니다. 백엔드 주소는 `PUBLIC_BACKEND_URL`로 내부 설정에서 별도 관리하며, 서버를 연결하거나 변경해도 공유한 Pages 주소는 바꾸지 않습니다.

학생 입장, 개인 기록, 모둠 공동 저장도 이 주소 안에서 이용하도록 개발하며, 학생을 별도 학생용 사이트 주소로 보내지 않습니다. 개인 입장권을 사용해도 같은 기본 주소를 유지합니다.

현재 공개 버전은 서버에 연결하지 않은 로컬 체험용입니다. 차시별 활동과 자료를 검토할 수 있으며, 실제 학급 입장, 서버 저장, 공동편집, 교사 관리는 사용할 수 없습니다.

## 내용을 수정하는 곳

| 수정할 내용 | 파일 |
| --- | --- |
| 차시별 시간과 활동 안내 | `app/course.ts` |
| 학생 자료의 구성과 표시 | `app/teaching-content.ts` |
| 탐사 사례, 읽기 자료, 활동 원자료 | `app/notebook-content/*.json` |
| 첫 화면과 디자인 | `app/landing.tsx`, `app/globals.css` |

## 빌드

Node.js 22.13 이상에서 다음을 실행합니다.

```sh
npm install
npm run check
npm run build
```

결과는 `dist-pages/`에 생성됩니다. `SPACE_scienceB_1-3_review.html`은 JavaScript, CSS, 수업 자료를 내장한 체험용 파일입니다. 글꼴은 인터넷이 없으면 기기의 기본 글꼴로 표시됩니다.

## 수업 서버 연결

`pages/public/config.js`의 `PUBLIC_BACKEND_URL`을 승인된 수업 서버의 HTTPS 주소로 지정합니다. `PUBLIC_STUDENT_URL`은 학생에게 나눠 줄 Pages 주소입니다. 두 값은 공개 주소이며 비밀 키를 넣는 칸이 아닙니다.

백엔드 주소가 비어 있으면 차시별 미리보기와 체험만 실행합니다. 실제 학급 입장, 서버 저장, 공동편집, 교사 관리는 사용할 수 없습니다. 단일 HTML은 항상 이 체험 모드로 생성됩니다.

서버에서는 학생 Origin을 정확히 허용해야 합니다. 현재 예정 Origin은 `https://tnals961006-bot.github.io`입니다. 교사 로그인과 관리는 백엔드 사이트에서 진행합니다.

## GitHub Pages

저장소 Settings의 Pages에서 배포 소스를 GitHub Actions로 선택합니다. 수정 내용을 `main`에 커밋해 반영하면 워크플로가 검사와 빌드 후 위 주소에 자동 게시합니다. Actions에서 수동 실행할 수도 있습니다. 정적 파일 자체에는 개인 입장권이나 사용자 응답을 추가하지 마세요.

이 폴더는 명시한 프런트엔드 파일만 가져온 독립 소스입니다. Sites 내부 도구, 서버 인증 코드, DB, 배포 식별정보, 저장 자료는 복사하지 않습니다.
