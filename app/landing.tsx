'use client';

import { useState } from 'react';
import { ArrowRight, BookOpen, GraduationCap, Pause, Play } from 'lucide-react';

export type LandingProps = {
  code: string;
  onCodeChange: (value: string) => void;
  onJoin: () => void;
  busy: boolean;
  welcome: string;
  onResume: () => void;
  onReview: () => void;
  onTeacher: () => void;
  onStartReview: (stage?: number) => void;
  joinError?: string;
  reviewOnly?: boolean;
  simpleEntryPreview?: boolean;
  entryClasses?: number[];
  entryLabel?: string;
};

const journey = [
  { title: '질문 찾기', description: '탐사 자료와 AI의 설명을 비교하고, 우주를 탐사하는 이유를 생각해요.' },
  { title: '탐사계획서 쓰기', description: '탐사지를 정하고 계획서를 쓴 뒤, 자료를 확인해 계획을 고쳐요.' },
  { title: '보완하고 발표하기', description: '탐사지의 환경을 조사해 계획서를 보완하고 발표해요.' },
];

function SpaceScene() {
  return <div className="space-scene" aria-hidden="true">
    <div className="space-scene-image" />
    <div className="space-scene-light" />
    <div className="space-probe-track">
      <svg className="space-probe" viewBox="0 0 100 70" fill="none">
        <defs>
          <linearGradient id="probe-panel" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#91b4c5"/><stop offset="1" stopColor="#20384d"/></linearGradient>
          <linearGradient id="probe-body" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff4d4"/><stop offset="1" stopColor="#a99679"/></linearGradient>
        </defs>
        <path d="M14 38H85" stroke="#e4dccb" strokeWidth="2"/>
        <path d="M6 24H36V48H6zM64 24H94V48H64z" fill="url(#probe-panel)" stroke="#a7bcc9"/>
        <path d="M16 24V48M26 24V48M74 24V48M84 24V48M6 32H36M6 40H36M64 32H94M64 40H94" stroke="#d0e2e9" strokeWidth=".65" opacity=".7"/>
        <path d="M42 28L53 24L60 32V45L49 50L42 43z" fill="url(#probe-body)" stroke="#f3e6cb"/>
        <path d="M49 28V18M49 46V60" stroke="#ddd9cf" strokeWidth="1.5"/>
        <path d="M38 14Q49 29 61 14z" fill="#eee5d4" stroke="#fff6e5"/>
        <path d="M49 14L53 6" stroke="#f1e8d6"/>
      </svg>
    </div>
  </div>;
}

export default function Landing({
  code,
  onCodeChange,
  onJoin,
  busy,
  welcome,
  onResume,
  onTeacher,
  onStartReview,
  joinError,
  reviewOnly = false,
  simpleEntryPreview = false,
  entryClasses = [4, 6],
}: LandingProps) {
  const [motionPaused, setMotionPaused] = useState(false);
  const welcomeLabel = welcome.replace(/[\u00b7\u318d]/g, ' ').replace(/(?:으로 )?이어 쓰기$/, '').trim();
  const effectiveReviewOnly = reviewOnly && !simpleEntryPreview;
  const defaultEntryClass = String(entryClasses[0] ?? 4);
  const [entryClass = defaultEntryClass, entryNumber = ''] = code.includes('-') ? code.split('-', 2) : [defaultEntryClass, ''];
  const simpleEntryValid = entryClasses.includes(Number(entryClass)) && /^(?:[1-9]|[12][0-9]|3[0-9]|40)$/.test(entryNumber);
  const setEntryPart = (classNo: string, number: string) => onCodeChange(`${classNo}-${number.replace(/\D/g, '').slice(0, 2)}`);

  return (
    <main className="space-landing space-cinematic" id="space-landing-main" data-motion={motionPaused ? 'paused' : 'playing'}>
      <SpaceScene />
      <section className="space-arrival" aria-labelledby="space-arrival-title">
        <div className="space-landing-inner">
          <div className="space-hero-grid">
            <div className="space-hero-copy">
              <h1 id="space-arrival-title">
                우리는 어디를
                <br />
                <span>어떻게 탐사할까?</span>
              </h1>
              <p className="space-intro">
                탐사 자료를 읽고, 근거를 확인해
                <br className="space-intro-break" />
                우리 모둠의 탐사계획서를 만듭니다.
              </p>
            </div>
          </div>

          <section className="space-entry-ticket" aria-labelledby="space-entry-title">
            <div className="space-entry-content">
              <div className="space-entry-heading">
                <h2 id="space-entry-title">{effectiveReviewOnly ? '수업 내용 검토' : simpleEntryPreview ? '반과 번호를 입력하세요' : '나의 탐사실 입장'}</h2>
                <p id={simpleEntryPreview ? 'space-code-help' : undefined}>{effectiveReviewOnly ? '1~3차시 자료와 활동을 열고 직접 작성해 볼 수 있어요.' : simpleEntryPreview ? '같은 반·번호로 들어오면 지난 기록을 이어 쓸 수 있어요.' : '선생님에게 받은 개인 접속 코드를 입력하세요.'}</p>
              </div>
              {effectiveReviewOnly ? (
                <div className="space-review-entry">
                  <button className="space-enter-button" type="button" onClick={() => onStartReview(0)} disabled={busy}>
                    <span>1차시부터 살펴보기</span>
                    <ArrowRight size={20} aria-hidden="true" />
                  </button>
                  <p className="space-code-help">체험 기록은 이 기기에 저장됩니다.</p>
                </div>
              ) : <><form
                className="space-entry-form"
                aria-busy={busy}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!busy && (simpleEntryPreview ? simpleEntryValid : Boolean(code.trim()))) onJoin();
                }}
              >
                {simpleEntryPreview ? (
                  <div className="space-simple-entry-grid">
                    <div className="space-code-field">
                      <label htmlFor="space-class-number">반</label>
                      <select
                        id="space-class-number"
                        value={entryClass}
                        onChange={(event) => setEntryPart(event.currentTarget.value, entryNumber)}
                        disabled={busy}
                      >
                        {entryClasses.map(classNo=><option key={classNo} value={String(classNo)}>{classNo}반</option>)}
                      </select>
                    </div>
                    <div className="space-code-field">
                      <label htmlFor="space-student-number">번호</label>
                      <input
                        id="space-student-number"
                        name="student-number"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={entryNumber}
                        onChange={(event) => setEntryPart(entryClass, event.currentTarget.value)}
                        maxLength={2}
                        placeholder="예: 12"
                        aria-describedby={joinError ? 'space-code-help space-join-error' : 'space-code-help'}
                        aria-invalid={Boolean(joinError)}
                        readOnly={busy}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-code-field">
                    <label htmlFor="space-access-code">개인 접속 코드</label>
                    <input
                      id="space-access-code"
                      name="access-code"
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      value={code}
                      onChange={(event) => onCodeChange(event.currentTarget.value)}
                      maxLength={32}
                      placeholder="받은 코드를 입력하세요"
                      aria-describedby={joinError ? 'space-code-help space-join-error' : 'space-code-help'}
                      aria-invalid={Boolean(joinError)}
                      readOnly={busy}
                      required
                    />
                  </div>
                )}
                <button className="space-enter-button" type="submit" disabled={busy || (simpleEntryPreview ? !simpleEntryValid : !code.trim())}>
                  <span>{busy ? '입장하는 중' : '수업 시작하기'}</span>
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
              </form>
              {joinError && <p className="space-join-error" id="space-join-error" role="alert">{joinError}</p>}
              {!simpleEntryPreview && <p className="space-code-help" id="space-code-help">개인 코드는 나만 사용해요.</p>}
              {welcome && (
                <button className="space-resume-button" type="button" onClick={onResume} disabled={busy}>
                  <span>{welcomeLabel} 이어 쓰기</span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              )}</>}
            </div>
          </section>
        </div>
      </section>

      <section className="space-journey" aria-label="차시별 활동">
        <div className="space-landing-inner">
          <div className="space-journey-grid">
            {journey.map((lesson, index) => (
              <div
                className="space-journey-card"
                key={lesson.title}
              >
                <span className="space-journey-top">
                  <span>{index + 1}차시</span>
                </span>
                <strong>{lesson.title}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="space-landing-footer">
        <div className="space-landing-inner">
          <button type="button" className="space-motion-toggle" aria-pressed={motionPaused} onClick={() => setMotionPaused(!motionPaused)}>
            {motionPaused ? <Play size={14} aria-hidden="true"/> : <Pause size={14} aria-hidden="true"/>}
            <span>배경 움직임 {motionPaused ? '켜기' : '멈추기'}</span>
          </button>
          <div className="space-footer-links">
            <button type="button" onClick={() => onStartReview(0)} disabled={busy}>
              <BookOpen size={16} aria-hidden="true" />수업 자료 미리 보기
            </button>
            <button type="button" onClick={onTeacher} disabled={busy}>
              <GraduationCap size={17} aria-hidden="true" />교사 공간
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
