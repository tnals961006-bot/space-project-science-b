import {
  activityLessons, cleanDisplayText, evidenceCards, missionRecords,
  readingCards, readingSources, sourceRecords, technologyCards,
} from './teaching-content';

// Legacy exports retain their existing shapes while using the authoritative notebook data.
export const missions = missionRecords.map((item) => ({
  id: String(item.id), name: item.title, year: String(item.year), agency: item.agency,
  destination: item.destination, category: item.destinationCategory, method: item.method,
  result: item.result, fact: item.description, evidence: item.evidenceIds.join(', '), sources: item.sourceIds.join(', '),
}));
export const evidence = evidenceCards.map((item) => ({
  id: item.id, mission: item.title, fact: item.fact, question: item.question,
  sources: item.sourceIds.join(', '), type: item.materialType,
}));
export const technologies = technologyCards.map((item) => [
  String(item.id), item.title, item.background, item.application, item.connectionType,
  item.limitations, item.sourceIds.join(', '),
]);
export const sources = sourceRecords.map((item) => ({
  id: item.id, agency: item.agency, title: item.title, date: item.publishedOrUpdatedRaw,
  url: item.url, checked: item.checkedAt, note: item.readingGuide,
}));

/** Compatibility only. New reading interfaces should consume readingCards directly. */
export const destinationParts: { text: string; url?: string }[] = readingCards.flatMap((card) => {
  const legacyTitles: Record<string, string> = {
    moon_south_pole: '달 남극 추가 탐사 자료', mars: '화성 추가 탐사 자료', europa: '목성의 위성 유로파 추가 탐사 자료',
  };
  return [
    { text: legacyTitles[card.id] || card.title }, { text: card.recordId },
    { text: '이미 알려진 점' }, { text: card.body },
    ...card.facts.map((fact) => ({ text: fact.text })),
    { text: '이 자료로 단정할 수 없는 점' }, ...card.cannotAnswer.map((text) => ({ text })),
    { text: '환경 조사에 사용할 정보' },
    ...['항목', '확인한 정보', '자료번호', '적용할 때의 조건'].map((text) => ({ text })),
    ...card.environment.flatMap((item) => [
      { text: item.category }, { text: item.condition }, { text: item.recordId },
      { text: [item.location, item.timeScope, item.uncertainty].join(' ') },
    ]),
    { text: '우리 질문으로 좁히기' }, ...card.questions.map((question) => ({ text: question.text })),
    ...readingSources.filter((source) => card.sourceIds.includes(source.id)).map((source) => ({ text: source.id + ' / ' + source.agency + ', ' + source.title, url: source.url })),
  ];
});

export type FieldDef = {
  key: string; label: string; hint?: string; options?: string[]; personal?: boolean;
  optional?: boolean; compact?: boolean; section?: string; dependsOn?: string[];
  input?: 'mission-pair' | 'mission-evidence' | 'inquiry-gap' | 'explanation-choice' | 'destination-free'; placeholder?: string; scaffold?: string; hidden?: boolean;
  example?: { source: string; answer: string; note: string };
};
export type StepDef = {
  id: string; name: string; minutes: number; resource: string; prompt: string;
  fields: FieldDef[]; instructions: string[]; doneWhen: string[]; recordTargets: string[];
  notebookRecordTargets: string[];
};
export type StageDef = {
  number: number; title: string; short: string; subtitle: string; goal: string;
  totalMinutes: number; steps: StepDef[];
};
const f = (key: string, label: string, hint = '', options?: string[], meta: Partial<FieldDef> = {}): FieldDef => ({
  key, label: cleanDisplayText(label), hint: cleanDisplayText(hint),
  options: options?.map(cleanDisplayText), ...meta,
});
const p = (key: string, label: string, hint = '', options?: string[], meta: Partial<FieldDef> = {}): FieldDef => f(key, label, hint, options, { ...meta, personal: true });
const routes = ['직접 AI 대화', '동료와 검토'];
const aiRoutes = ['직접 AI 대화'];
const oneLine = { compact: true };
const optional = { optional: true };
const optionalLine = { optional: true, compact: true };
const apolloOptions = ['자료에서 직접 확인되는 사실', '자료를 바탕으로 내린 해석'];

function step(lesson: number, index: number, value: Pick<StepDef, 'name' | 'resource' | 'prompt' | 'fields'>): StepDef {
  const original = activityLessons[lesson - 1].steps[index];
  return {
    id: original.id, minutes: original.minutes,
    instructions: original.instructions, doneWhen: original.doneWhen,
    recordTargets: value.fields.map((field) => field.key), notebookRecordTargets: original.recordTargets,
    ...value,
  };
}

export const stages: StageDef[] = [
  {
    number: 1, title: '탐사 자료에서 질문 찾기', short: '질문 발견',
    subtitle: '탐사 자료를 비교해 질문을 만들고, 조사할 곳을 정해요.',
    goal: activityLessons[0].goal, totalMinutes: 45,
    steps: [
      step(1, 0, {
        name: '내 생각 쓰기', resource: 'intro',
        prompt: '자료를 보기 전, 왜 우주를 탐사한다고 생각하는지 한 문장으로 쓰세요.',
        fields: [p('first', '우주를 탐사하는 이유', '', undefined, { ...oneLine, scaffold: '나는 우주를 탐사하는 이유가 ______이라고 생각한다.', placeholder: '빈칸에 들어갈 내 생각을 직접 써 보세요.' })],
      }),
      step(1, 1, {
        name: '사실인지 해석인지 고르기', resource: 'apollo',
        prompt: '아폴로 13호 자료를 읽고 두 문장을 사실 또는 해석으로 분류하세요.',
        fields: [
          f('apolloA', '첫 문장의 종류', '', apolloOptions),
          f('apolloReasonA', '첫 문장을 그렇게 고른 이유', '', undefined, { ...oneLine, scaffold: '자료의 ______ 부분과 비교하면, 이 문장은 ______이기 때문이다.', placeholder: '자료와 문장을 비교해 이유를 쓰세요.' }),
          f('apolloB', '둘째 문장의 종류', '', apolloOptions),
          f('apolloReasonB', '둘째 문장을 그렇게 고른 이유', '', undefined, { ...oneLine, scaffold: '자료의 ______ 부분과 비교하면, 이 문장은 ______이기 때문이다.', placeholder: '자료와 문장을 비교해 이유를 쓰세요.' }),
        ],
      }),
      step(1, 2, {
        name: '탐사 두 개 비교하기', resource: 'data',
        prompt: '탐사 두 개를 골라 같은 항목을 비교하고, 차이와 질문을 기록하세요.',
        fields: [
          f('comparison', '비교할 탐사 두 개', '서로 다른 탐사 두 개를 고르세요.', undefined, { input: 'mission-pair', section: '1 탐사 고르기', scaffold: '① 첫 번째 탐사 선택 → ② 두 번째 탐사 선택 → ③ 두 탐사의 같은 항목을 비교합니다.' }),
          f('factRef', '출발 근거의 탐사 번호', '', undefined, { ...oneLine, hidden: true }),
          f('fact', '자료에서 찾은 근거', '두 탐사에서 같은 항목을 고르세요.', undefined, { input: 'mission-evidence', section: '2 근거 가져오기', scaffold: '두 탐사에서 같은 항목 하나를 골라 가져오세요: 계획한 방식 / 실제 결과 / 주요 활동' }),
          f('change', '두 탐사에서 찾은 차이', '', undefined, { ...oneLine, section: '3 차이 쓰기', scaffold: '두 탐사를 비교하면 ______에서 ______한 차이가 보인다.', placeholder: '두 탐사에서 직접 확인한 차이를 쓰세요.' }),
          f('claimReason', '그 차이를 찾은 근거', '', undefined, { ...oneLine, scaffold: '첫 번째 탐사는 ______했지만, 두 번째 탐사는 ______했기 때문이다.', placeholder: '바로 위에 가져온 두 탐사 기록을 연결해 쓰세요.' }),
          f('gap', '이 자료만으로 알기 어려운 점', '자료에 없다는 것과 인류가 모른다는 것은 다릅니다.', undefined, { input: 'inquiry-gap', section: '4 한계와 질문', scaffold: '자료에는 ______이 없어 ______은 판단하기 어렵다. → 그래서 ______이 궁금하다.' }),
          f('selectedClaim', 'AI와 비교할 우리 문장', '화면에 보이는 두 문장 중 하나를 고르세요.', undefined, { input: 'explanation-choice', section: '5 AI와 비교할 문장 고르기', scaffold: '화면에 보이는 두 문장 중 하나를 고릅니다. 다음 활동에서 AI가 같은 내용을 어떻게 말했는지 비교합니다.' }),
        ],
      }),
      step(1, 3, {
        name: 'AI와 비교하기', resource: 'ai1',
        prompt: '우리가 고른 문장과 같은 내용을 말한 AI 문장 1개를 찾아 비교하세요.',
        fields: [
          f('route1', 'AI 답을 확인한 방법', '', aiRoutes, { hidden: true }),
          f('claim1', 'AI 답에서 찾은 비슷한 내용의 문장', '', undefined, { ...oneLine, scaffold: '위의 우리 문장과 같은 내용을 말한 AI 문장 1개만 찾아 그대로 옮깁니다.', placeholder: '우리 문장과 비슷한 내용을 말한 AI 문장 1개를 옮겨 쓰세요.' }),
          f('check1', '활동 3의 두 탐사 자료에서 확인한 내용', '우리 문장과 AI 문장이 자료와 맞는지 확인하세요. 두 탐사의 기록 중 판단에 필요한 내용을 탐사 이름과 함께 쓰세요.', undefined, { example: { source: 'A 탐사선: 표면 사진을 찍었다. / B 탐사선: 토양을 채취했다.', answer: 'A 탐사선은 표면 사진을 찍었고, B 탐사선은 토양을 채취했다는 내용을 자료에서 확인했다.', note: '작성 방법을 보여 주는 가상 자료입니다. 아래에는 우리 모둠이 활동 3에서 고른 실제 탐사 자료를 보고 쓰세요. 필요한 내용이 자료에 없다면 무엇이 없는지 써도 됩니다.' }, placeholder: '우리 문장과 AI 문장을 확인하는 데 필요한 자료 내용을 쓰세요.' }),
          f('compare1', '우리 문장과 AI 문장 비교', '', undefined, { ...oneLine, scaffold: '우리 문장과 AI 문장은 ______은 같고, ______은 다르다.', placeholder: '같은 점 또는 다른 점을 직접 찾아 쓰세요.' }),
          f('decision1', '우리 문장을 그대로 둘지 고칠지', '', undefined, { scaffold: '활동 3의 두 탐사 자료에서 ______을 확인했다. 그래서 우리 문장을 그대로 둔다 / ______로 고친다.', placeholder: '그대로 둘지 고칠지와 이유를 쓰세요.' }),
        ],
      }),
      step(1, 4, {
        name: '오늘의 결론 쓰기', resource: 'evidence',
        prompt: '우리 질문을 조사할 곳을 정한 뒤, 영향카드의 사실을 근거로 우주를 탐사하는 이유를 쓰세요.',
        fields: [
          f('destination', '우리 질문을 알아볼 곳', '우리 모둠이 조사해 보고 싶은 장소를 직접 정하세요.', undefined, { input: 'destination-free', scaffold: '위에 보이는 우리 모둠 질문을 더 알아보기 좋은 장소를 직접 정합니다.' }),
          f('otherDestination', '다른 탐사지를 골랐다면 이름과 근거', '', undefined, { ...optionalLine, scaffold: '다른 탐사지: ______ / 고른 근거: ______' }),
          f('selectionReason', '이곳을 고른 이유', '위에 보이는 우리 모둠 질문과 연결해 쓰세요.', undefined, { ...oneLine, scaffold: '우리 모둠 질문 “______”을 더 알아보기 위해 ______을 골랐다.', placeholder: '화면 위에 다시 보이는 우리 모둠 질문과 연결해 쓰세요.' }),
          f('evidenceRef', '읽은 영향카드', '우주를 탐사하는 이유를 설명할 때 예로 들 카드 1개를 고르세요.', evidenceCards.map(card => card.id)),
          f('meaning', '카드에서 알게 된 사실', '읽은 카드에 적힌 사실을 한 문장으로 쓰세요.', undefined, { scaffold: '______ 카드에서 ______을 알게 되었다.', placeholder: '카드 이름과 카드에서 확인한 사실을 쓰세요.' }),
          p('conclusion', '우리는 왜 우주를 탐사할까?', '위에 쓴 사실을 근거로 각자의 생각을 쓰세요. 처음 생각과 같아도 괜찮아요.', undefined, { scaffold: '카드에서 ______을 알게 되었다. 이를 근거로, 나는 ______을 위해 우주를 탐사한다고 생각한다.', placeholder: '카드의 사실을 예로 들어 우주를 탐사하는 이유를 쓰세요.' }),
          p('contribution1', '내가 새로 낸 질문이나 생각', '', undefined, { ...optionalLine, hidden: true }),
        ],
      }),
    ],
  },
  {
    number: 2, title: '탐사계획서 초안 쓰기', short: '계획서 작성',
    subtitle: '탐사계획서 초안을 쓰고, AI의 제안을 자료로 확인해 계획을 고쳐요.',
    goal: activityLessons[1].goal, totalMinutes: 45,
    steps: [
      step(2, 0, {
        name: '탐사계획서 초안 쓰기', resource: 'destinations',
        prompt: '자료를 근거로 탐사 질문·관찰할 대상·조사 방법을 정해 탐사계획서 초안을 쓰세요.',
        fields: [
          f('additionalRef', '읽은 자료의 이름·출처', '펼쳐 읽은 자료의 제목 또는 기관명·링크를 적으세요.', undefined, { ...oneLine, section: '1. 자료에서 근거 찾기', scaffold: '확인한 자료: ______' }),
          f('additionalFact', '우리 질문에 도움이 되는 사실 1개', '자료에서 실제로 확인한 내용 한 가지만 쓰세요.', undefined, { ...oneLine, scaffold: '자료에서 ______을 확인했다.' }),
          f('task', '더 조사할 내용', '', undefined, { ...optionalLine }),
          f('question', '탐사 질문 · 무엇을 알아볼까?', '1차시 질문을 우리 탐사지에서 조사할 수 있는 질문으로 좁혀 쓰세요.', undefined, { ...oneLine, section: '2. 탐사계획서 초안 쓰기', scaffold: '우리는 ______에서 ______을 조사해 ______을 알아볼까?' }),
          f('missionName', '우리 미션 이름', '이름은 나중에 정해도 됩니다.', undefined, optionalLine),
          f('goal', '탐사 목표', '', undefined, optionalLine),
          f('target', '관측할 대상', '', undefined, optionalLine),
          f('data', '관찰·측정할 대상 · 무엇을 확인할까?', '질문에 답하려면 어떤 모습이나 값을 알아야 하는지 쓰세요.', undefined, { ...oneLine, scaffold: '질문에 답하기 위해 ______의 모습 / ______의 값을 확인한다.' }),
          f('method', '조사 방법 · 어떻게 확인할까?', '촬영·측정·시료 채취 등으로 어떻게 자료를 얻을지 쓰세요.', undefined, { scaffold: '______을 사용해 ______을 관찰 / 측정 / 채취한다.' }),
          f('difficulty', '예상되는 어려움', '', undefined, optionalLine),
          f('technology', '필요할 것 같은 기술', '', undefined, optionalLine),
          f('response', '어려움에 대비할 방법', '', undefined, optionalLine),
        ],
      }),
      step(2, 1, {
        name: 'AI에게 묻고 문장 고르기', resource: 'ai2',
        prompt: '탐사계획서 초안을 AI에 보내고, 자료로 확인할 문장 하나만 고르세요.',
        fields: [
          f('route2', '검토 방법', '', ['직접 AI 대화'], { hidden: true }),
          f('prompt2', '실제로 사용한 질문', '', undefined, { hidden: true }),
          f('claim2', 'AI 답에서 확인할 문장 1개', '맞는지 확인하면 우리 계획이 달라질 수 있는 문장을 고르세요.', undefined, { ...oneLine, scaffold: 'AI 답에서 자료로 확인해 볼 문장 하나를 그대로 옮깁니다.' }),
        ],
      }),
      step(2, 2, {
        name: '자료로 확인하고 계획 고치기', resource: 'verify2',
        prompt: 'AI 문장 하나를 우리가 읽은 자료와 비교하고, 그 판단을 계획에 반영하세요.',
        fields: [
          f('verifySource', '자료에서 확인한 내용', 'AI 문장과 직접 비교한 자료 내용을 쓰세요.', undefined, { section: '1 자료와 비교하기', scaffold: '자료에서는 ______이라고 확인했다.' }),
          f('verifyConditions', '비교한 자료의 조건', '', undefined, optionalLine),
          f('verdict', '자료와 비교한 결과', '', ['맞음', '일부 맞음', '수정 필요', '확인 불가']),
          f('reason', '그렇게 판단한 이유', '', undefined, { ...oneLine, scaffold: 'AI 문장과 자료는 ______이 같고 / 다르기 때문이다.' }),
          f('decision', '우리 계획에서는 어떻게 할까?', '', ['채택', '수정', '제외', '보류'], { section: '2 계획에 반영하기' }),
          f('verifyNext', '더 확인할 내용', '', undefined, optionalLine),
          f('verifyLink', '이 판단과 연결되는 계획', '', undefined, optionalLine),
          f('revision', '그래서 유지하거나 고친 계획', '', undefined, { scaffold: '자료를 확인한 결과, 우리 계획의 ______을 그대로 둔다 / ______로 고친다.' }),
        ],
      }),
      step(2, 3, {
        name: '환경 조사 시작하고 내 판단 남기기', resource: 'environment2',
        prompt: '우리 미션에 중요한 환경 조건 하나만 조사하고, 각자 오늘의 판단을 남기세요.',
        fields: [
          f('env1', '우리 미션에 중요한 환경 조건 1개', '중력, 온도, 대기, 방사선, 물, 햇빛 등을 생각해 보세요.', undefined, { section: '1 환경 조건 하나 조사하기', ...oneLine }),
          f('envInfo1', '확인한 환경 정보', '수치가 있다면 단위와 장소도 함께 적으세요.'),
          f('envSource1', '환경 정보의 출처', '기관명·자료명 또는 링크를 남기세요.', undefined, oneLine),
          f('envResponse1', '예상되는 어려움과 대비', '', undefined, { ...oneLine, scaffold: '이 조건 때문에 ______이 어려울 수 있어 ______로 대비한다.' }),
          f('env2', '환경 2 항목과 중요한 이유', '', undefined, { section: '환경 2', ...optionalLine }),
          f('envInfo2', '환경 2 정보와 적용 조건', '', undefined, optionalLine),
          f('envSource2', '환경 2 자료번호와 확인 상태', '', undefined, optionalLine),
          f('envResponse2', '환경 2 예상 어려움과 대비 방법', '', undefined, optionalLine),
          p('myEvidence', '내가 확인한 근거', '', undefined, optionalLine),
          p('myVerdict', '오늘 내가 내린 판단', '', undefined, { section: '2 나의 판단 한 문장', ...oneLine, scaffold: '나는 ______ 자료를 확인했고, 그래서 우리 계획을 ______해야 한다고 판단했다.' }),
          p('myApplication', '내 의견이 반영된 부분', '', undefined, optionalLine),
          p('myRoute', '나의 검토 방법', '', ['직접 AI 대화'], optional),
        ],
      }),
    ],
  },
  {
    number: 3, title: '탐사계획서 보완하고 발표하기', short: '보완과 공유',
    subtitle: '환경 조사와 검토 결과를 반영해 탐사계획서를 완성하고 발표해요.',
    goal: activityLessons[2].goal, totalMinutes: 45,
    steps: [
      step(3, 0, {
        name: '보완점 찾기', resource: 'proposal',
        prompt: '처음 질문과 추가 자료, 검증한 내용을 함께 읽으세요. 세 가지 기준으로 제안서에서 먼저 보완할 곳을 고르세요.', fields: [],
      }),
      step(3, 1, {
        name: '제안서 보완', resource: 'editProposal',
        prompt: '앞 차시의 제안서와 환경표를 직접 고치세요. 탐사지의 실제 환경과 장비나 기지 안에서 조절할 조건을 구분하세요.',
        fields: [
          f('expectation', '새로 얻고 싶은 지식과 기대하는 도움', '아직 기대하는 효과를 이미 얻은 성과처럼 쓰지 마세요.'),
          f('limitation', '이 계획으로 확인할 수 없는 점', '더 필요한 자료나 남은 조건을 적으세요.'),
          f('envReview1', '환경 1에서 보완한 내용과 이유', '정보나 출처를 고쳤다면 이유를 남기세요.', undefined, optionalLine),
          f('envReview2', '환경 2에서 보완한 내용과 이유', '정보나 출처를 고쳤다면 이유를 남기세요.', undefined, optionalLine),
        ],
      }),
      step(3, 2, {
        name: '비판 질문 검토', resource: 'ai3',
        prompt: 'AI나 동료에게 받은 질문 하나를 검토하세요. 근거를 보고 반영할지, 반영하지 않을지, 더 확인할지 결정하세요.',
        fields: [
          f('route3', '질문을 받은 방법', '', routes),
          f('critique', '검토한 질문 하나', '', undefined, oneLine),
          f('critiqueDecision', '우리 판단', '수용은 반영, 기각은 반영하지 않음, 보류는 추가 확인입니다.', ['수용', '기각', '보류']),
          f('critiqueReason', '확인한 근거와 판단 이유'),
          f('critiqueRevision', '유지하거나 고친 제안서 내용', '실제 제안서의 해당 칸도 함께 고치세요.'),
        ],
      }),
      step(3, 3, {
        name: '짝 모둠 발표', resource: 'present',
        prompt: '모둠마다 3분 동안 제안서와 환경표를 보여 주며 발표하세요. 서로 질문을 주고받고 받은 의견을 검토하세요. 전체 모둠이 읽을 수 있게 제안서를 게시하세요.',
        fields: [
          f('peerStrength', '짝 모둠이 설득력 있다고 본 근거', '받은 의견을 한 줄로 남기세요.', undefined, oneLine),
          f('peerQuestion', '짝 모둠이 더 확인하고 싶어 한 점', '', undefined, oneLine),
          f('peerResponse', '피드백을 반영한 내용 또는 보류한 이유', '고칠 내용이 있다면 같은 제안서에서 수정하세요.', undefined, optionalLine),
        ],
      }),
      step(3, 4, {
        name: '전체 제안서 읽고 추천', resource: 'gallery',
        prompt: '학급의 전체 제안서를 둘러보세요. 우리 모둠을 제외한 미션 하나를 골라 실제 근거와 함께 추천하세요.',
        fields: [
          p('recommend', '추천하는 모둠과 탐사지', '', undefined, oneLine),
          p('recommendReason', '추천 이유', '필요성, 근거, 환경에 대비하는 방법 중 어떤 내용이 설득력 있었나요?'),
        ],
      }),
      step(3, 5, {
        name: '생각 돌아보기와 다음 탐사', resource: 'reflection',
        prompt: '첫 생각과 지금 생각을 비교하고 근거를 남기세요. 기록을 보관한 뒤 마지막 1분에 미래 탐사의 새로운 상황을 읽으세요.',
        fields: [
          p('reflection', '내 생각이 달라지거나 구체화된 점', '1차시 첫 생각을 읽고 근거가 된 자료 번호와 함께 쓰세요.'),
          p('judgmentMoment', 'AI나 동료의 의견을 판단한 장면', '무엇을 근거로 내 판단을 정했는지 한 줄로 쓰세요.', undefined, oneLine),
          p('contribution3', '내가 기여한 일과 기록에 남은 결과', '앞에서 쓴 내용에 보탤 점이 있을 때 남기세요.', undefined, optionalLine),
        ],
      }),
    ],
  },
];

export const allFields = stages.flatMap((stage) => stage.steps.flatMap((item) => item.fields));
export const groupKeys = allFields.filter((field) => !field.personal).map((field) => field.key);
export const personalKeys = allFields.filter((field) => field.personal).map((field) => field.key);
export const proposalKeys = [
  'missionName', 'destination', 'otherDestination', 'selectionReason', 'comparison', 'factRef', 'fact', 'gap',
  'additionalRef', 'additionalFact', 'task', 'question', 'goal', 'target', 'data', 'method',
  'difficulty', 'technology', 'response',
  'env1', 'envInfo1', 'envSource1', 'envResponse1', 'envReview1',
  'env2', 'envInfo2', 'envSource2', 'envResponse2', 'envReview2',
  'evidenceRef', 'meaning', 'expectation', 'limitation', 'revision',
];
export const phaseNames = ['1차시 검토 전', '1차시 끝', '2차시 AI 사용 전', '2차시 끝', '3차시 최종'];

// Kept for old consumers. These are peer review questions, not sample answers or AI responses.
export const sampleClaims = [
  ['검토 1-A', '그 주장은 어떤 두 사례의 어떤 내용에서 나왔나요?'],
  ['검토 1-B', '이 자료에 없다는 이유로 실제 탐사도 없었다고 말할 수 있나요?'],
  ['2-달', '우리 후보지에 필요한 정보를 어디에서 확인했고, 적용 조건도 맞나요?'],
  ['2-화성', '과거 환경의 증거와 지금의 환경 정보를 구분해 사용했나요?'],
  ['2-유로파', '관측한 사실과 그 해석, 앞으로 관측할 계획을 구분했나요?'],
  ['3-A', '그 관측 자료로 우리 질문의 어떤 부분에 답할 수 있나요?'],
  ['3-B', '환경 정보가 우리 후보지와 시점에도 적용되나요?'],
  ['3-C', '기대 효과를 이미 일어난 성과처럼 쓴 부분이 있나요?'],
];
export const peerReviewQuestions = sampleClaims;
