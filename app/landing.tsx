'use client';

import { ArrowRight, ArrowUpRight, BookOpen, GraduationCap, Ticket } from 'lucide-react';

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
};

const journey = [
  {
    title: '자료에서 질문 찾기',
    description: '확인한 사실과 더 알아볼 질문을 구분해요.',
  },
  {
    title: '우리 미션 설계하기',
    description: '앞서 찾은 근거로 초안을 만들고 검증해요.',
  },
  {
    title: '제안서 다듬고 나누기',
    description: '같은 제안서를 보완해 우리의 탐사를 소개해요.',
  },
];

function SpacePlanet() {
  return (
    <div className="space-hero-art" aria-hidden="true">
      <div className="space-starfield" />
      <div className="space-planet-glow" />
      <div className="space-orbit space-orbit-wide" />
      <div className="space-orbit" />
      <div className="space-planet" />
      <div className="space-satellite" />
      <div className="space-orbit-dot" />
    </div>
  );
}

export default function Landing({
  code,
  onCodeChange,
  onJoin,
  busy,
  welcome,
  onResume,
  onReview,
  onTeacher,
  onStartReview,
  joinError,
  reviewOnly = false,
}: LandingProps) {
  const welcomeLabel = welcome.replace(/[\u00b7\u318d]/g, ' ');

  return (
    <main className="space-landing" id="space-landing-main">
      <section className="space-arrival" aria-labelledby="space-arrival-title">
        <div className="space-landing-inner">
          <div className="space-hero-grid">
            <div className="space-hero-copy">
              <p className="space-eyebrow">우리의 우주 탐사 미션</p>
              <h1 id="space-arrival-title">
                기록에서 질문을,
                <br />
                <span>질문에서 탐사를.</span>
              </h1>
              <p className="space-intro">
                탐사 기록에서 질문을 찾고,
                <br className="space-intro-break" />
                근거를 확인하며 우리 미션을 설계해요.
              </p>
            </div>
            <SpacePlanet />
          </div>

          <section className="space-entry-ticket" aria-labelledby="space-entry-title">
            <div className="space-ticket-stub" aria-hidden="true">
              <Ticket size={30} strokeWidth={1.5} />
              <span>{reviewOnly ? '수업' : '나의'}<br />{reviewOnly ? '체험' : '입장권'}</span>
            </div>
            <div className="space-entry-content">
              <div className="space-entry-heading">
                <h2 id="space-entry-title">{reviewOnly ? '수업 내용 검토' : '나의 탐사실 입장'}</h2>
                <p>{reviewOnly ? '1~3차시 자료와 활동을 열고 직접 작성해 볼 수 있어요.' : '선생님에게 받은 개인 접속 코드를 입력하세요.'}</p>
              </div>
              {reviewOnly ? (
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
                  if (!busy && code.trim()) onJoin();
                }}
              >
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
                <button className="space-enter-button" type="submit" disabled={busy || !code.trim()}>
                  <span>{busy ? '입장하는 중' : '탐사실 입장하기'}</span>
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
              </form>
              {joinError && <p className="space-join-error" id="space-join-error" role="alert">{joinError}</p>}
              <p className="space-code-help" id="space-code-help">개인 코드는 나만 사용해요.</p>
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

      <section className="space-journey" aria-labelledby="space-journey-title">
        <div className="space-landing-inner">
          <div className="space-journey-heading">
            <h2 id="space-journey-title">우리의 탐사 여정</h2>
            <p>세 번의 수업, 차시마다 45분</p>
          </div>
          <div className="space-journey-grid">
            {journey.map((lesson, index) => (
              <button
                className="space-journey-card"
                type="button"
                key={lesson.title}
                onClick={() => onStartReview(index)}
                disabled={busy}
                aria-label={`${index + 1}차시 ${lesson.title} 활동 미리 보기`}
              >
                <span className="space-journey-top">
                  <span>{index + 1}차시</span>
                  <span className="space-journey-number">0{index + 1}</span>
                </span>
                <strong>{lesson.title}</strong>
                <span className="space-journey-description">{lesson.description}</span>
                <span className="space-preview-label">
                  활동 미리 보기
                  <ArrowUpRight size={18} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
          <p className="space-journey-note">미리 보기에서는 실제 학급에 기록이 남지 않아요.</p>
        </div>
      </section>

      <footer className="space-landing-footer">
        <div className="space-landing-inner">
          <p>함께 탐구하고, 각자의 생각을 남깁니다.</p>
          <div className="space-footer-links">
            <button type="button" onClick={onReview} disabled={busy}>
              <BookOpen size={16} aria-hidden="true" />검토 안내
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
