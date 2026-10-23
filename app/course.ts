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
const routes = ['직접 AI 대화', '교사가 제공한 AI 응답', '동료와 검토'];
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
    subtitle: '탐사 자료에서 확인한 사실을 바탕으로 더 알아볼 질문을 만듭니다.',
    goal: activityLessons[0].goal, totalMinutes: 45,
    steps: [
      step(1, 0, {
        name: '첫 생각', resource: 'intro',
        prompt: '우리는 왜 우주를 탐사할까요? 자료를 읽기 전 내 생각을 한 문장으로 남기세요.',
        fields: [p('first', '우주를 탐사하는 이유', '지금 떠오르는 생각을 써 보세요.', undefined, oneLine)],
      }),
      step(1, 1, {
        name: '사실과 해석', resource: 'apollo',
        prompt: '아폴로 13호가 계획한 일과 실제로 한 일을 읽으세요. 두 문장을 분류하고 각각의 이유를 한 줄로 쓰세요.',
        fields: [
          f('apolloA', '첫 문장의 종류', '', apolloOptions),
          f('apolloReasonA', '첫 문장을 그렇게 고른 이유', '판단에 사용한 자료 내용을 한 줄로 쓰세요.', undefined, oneLine),
          f('apolloB', '둘째 문장의 종류', '', apolloOptions),
          f('apolloReasonB', '둘째 문장을 그렇게 고른 이유', '자료에 적힌 내용과 문장 속 판단을 비교하세요.', undefined, oneLine),
        ],
      }),
      step(1, 2, {
        name: '두 탐사 비교', resource: 'data',
        prompt: '서로 다른 시기의 두 탐사를 비교하세요. 달라진 점 하나와 근거를 적고, 이 자료로 답하지 못한 질문을 만드세요.',
        fields: [
          f('comparison', '비교한 탐사 번호 두 개', '자료에서 직접 고른 두 사례의 번호를 적으세요.', undefined, oneLine),
          f('change', '우리가 찾은 변화', '이 두 사례에서 어떤 점이 달라졌나요?', undefined, oneLine),
          f('factRef', '출발 근거의 탐사 번호', '', undefined, oneLine),
          f('fact', '자료에서 직접 확인한 사실', '계획한 일과 실제로 한 일을 구분하세요.', undefined, oneLine),
          f('claimReason', '이 사실이 변화를 뒷받침하는 이유', '자료 전체의 경향으로 단정하지 말고 비교한 내용을 설명하세요.', undefined, oneLine),
          f('gap', '이 자료로 답하지 못한 질문', '자료에 없다는 말이 인류가 아직 모른다는 뜻은 아닙니다.', undefined, oneLine),
          f('selectedClaim', 'AI나 동료와 비교할 우리 주장', '방금 쓴 우리 주장 중 하나를 골라 적으세요.', undefined, oneLine),
        ],
      }),
      step(1, 3, {
        name: 'AI 주장 비교', resource: 'ai1',
        prompt: '우리 주장을 먼저 남기세요. 같은 자료를 읽은 AI나 동료의 주장 하나와 비교하고 원자료로 근거를 확인하세요.',
        fields: [
          f('route1', '검토 방법', '실제로 사용한 방법을 고르세요.', routes),
          f('claim1', '검토한 AI나 동료의 주장', '실제로 받은 주장 한 문장을 적으세요.', undefined, oneLine),
          f('check1', '원자료에서 확인한 내용', '탐사 번호와 확인한 사실을 짧게 쓰세요.'),
          f('compare1', '우리 주장과 같은 점 또는 다른 점', '두 의견이 어디에서 같거나 다른지 적으세요.', undefined, oneLine),
          f('decision1', '우리 주장을 유지하거나 바꾼 이유', '원자료의 근거와 연결해 한두 문장으로 쓰세요.'),
        ],
      }),
      step(1, 4, {
        name: '근거와 결론', resource: 'evidence',
        prompt: '더 알아볼 질문을 조사할 탐사지 후보를 고르세요. 근거카드 하나를 읽고 우주 탐사가 인류에게 갖는 의미를 각자 설명하세요.',
        fields: [
          f('destination', '우리 모둠 탐사지 후보', '다른 탐사지를 고르면 직접 확인할 자료도 준비하세요.', ['달 남극', '화성', '유로파', '다른 탐사지']),
          f('otherDestination', '다른 탐사지를 골랐다면 이름과 근거', '', undefined, optionalLine),
          f('selectionReason', '이 후보지를 고른 이유', '더 알아볼 질문과 연결해 쓰세요.', undefined, oneLine),
          f('evidenceRef', '선택한 의의와 영향 근거번호', '관련 E카드 하나를 고르세요. B01은 공통 배경자료입니다.', undefined, oneLine),
          f('meaning', '확인한 사실과 그 의미', '이미 확인된 영향과 앞으로 기대하는 효과를 나누세요.'),
          p('conclusion', '자료를 읽고 내린 나의 결론', '어느 자료의 어떤 사실이 내 생각을 뒷받침하나요?'),
          p('contribution1', '내가 보탠 질문이나 해석', '관련 자료 번호도 남길 수 있습니다.', undefined, optionalLine),
        ],
      }),
    ],
  },
  {
    number: 2, title: '근거로 우리 미션 설계하기', short: '미션 설계',
    subtitle: '추가 자료를 읽고 탐구 과제와 미션 질문을 정합니다.',
    goal: activityLessons[1].goal, totalMinutes: 45,
    steps: [
      step(2, 0, {
        name: '지난 질문 확인', resource: 'previous',
        prompt: '지난 시간에 확인한 사실과 질문을 다시 읽으세요. 탐사지 후보를 고른 이유도 함께 확인하세요.', fields: [],
      }),
      step(2, 1, {
        name: '추가 읽기와 초안', resource: 'destinations',
        prompt: '추가 자료에서 새로 확인한 사실과 더 조사할 과제를 나누세요. 우리 미션 질문과 계획을 짧은 말로 쓰세요.',
        fields: [
          f('additionalRef', '추가 자료번호', '', undefined, { ...oneLine, section: '질문 이어 쓰기' }),
          f('additionalFact', '추가 자료에서 새로 확인한 사실', '', undefined, oneLine),
          f('task', '자료를 읽고 정한 탐구 과제', '더 알아볼 내용 하나를 고르세요.', undefined, oneLine),
          f('question', '우리 미션 질문', '어디에서 무엇을 조사해 어떤 내용을 알아낼지 질문으로 쓰세요.', undefined, oneLine),
          f('missionName', '우리 미션 이름', '이름은 나중에 정해도 됩니다.', undefined, optionalLine),
          f('goal', '탐사 목표', '이 미션으로 무엇을 알아내고 싶나요?', undefined, { ...oneLine, section: '탐사 계획' }),
          f('target', '관측할 대상', '', undefined, oneLine),
          f('data', '얻을 자료 한두 개', '', undefined, oneLine),
          f('method', '자료를 얻는 방법과 이유', '아직 관측하지 않은 결과를 만들어 쓰지 마세요.'),
          f('difficulty', '예상되는 어려움', '우리 질문과 방법에 중요한 어려움 하나를 쓰세요.', undefined, { ...oneLine, section: '어려움과 대비' }),
          f('technology', '필요할 것 같은 기술', '아직 쓸 수 있는지 모른다면 확인 필요라고 쓰세요.', undefined, oneLine),
          f('response', '어려움에 대비할 방법', '초안을 쓰며 떠오른 생각이 있으면 남기세요. 자료를 확인한 뒤 보완합니다.', undefined, optionalLine),
        ],
      }),
      step(2, 2, {
        name: 'AI 자문', resource: 'ai2',
        prompt: '우리 초안을 보관한 뒤 AI나 동료에게 질문하세요. 탐사 방법을 정하는 데 중요한 주장 하나를 골라 확인하세요.',
        fields: [
          f('route2', '검토 방법', '', routes),
          f('prompt2', '실제로 사용한 질문', '동료와 검토했다면 동료에게 한 질문을 남기세요.'),
          f('claim2', '검증할 핵심 주장 한 문장', '우리 초안이나 실제 답변에서 고르세요.', undefined, oneLine),
        ],
      }),
      step(2, 3, {
        name: '근거로 검증', resource: 'destinations',
        prompt: '주장과 자료의 내용, 장소, 시점, 단위를 비교하세요. 판단하기 어렵다면 확인 불가를 고르고 더 필요한 자료를 쓰세요.',
        fields: [
          f('verifySource', '직접 확인한 자료번호와 내용', '주장과 비교한 문장이나 수치를 쓰세요.'),
          f('verifyConditions', '비교한 자료의 조건', '장소, 시점, 단위 중 중요한 조건을 한 줄로 적으세요.', undefined, oneLine),
          f('verdict', '자료에 따른 사실 판정', '확인하지 못했다는 이유만으로 틀렸다고 판단하지 마세요.', ['맞음', '일부 맞음', '수정 필요', '확인 불가']),
          f('reason', '판정한 이유', '주장과 자료의 같은 점 또는 다른 점을 근거로 쓰세요.'),
          f('decision', '계획에 적용할 판단', '사실이 맞더라도 기술을 바로 쓸 수 있는지는 따로 판단하세요.', ['채택', '수정', '제외', '보류']),
          f('verifyNext', '고치거나 더 확인할 내용', '추가 확인이 필요한 경우에 쓰세요.', undefined, optionalLine),
          f('verifyLink', '이 판단과 연결되는 계획', '탐사 목표, 방법, 환경 대응 중 어떤 칸에 반영하나요?', undefined, oneLine),
        ],
      }),
      step(2, 4, {
        name: '계획 수정과 환경 조사', resource: 'destinations',
        prompt: '검증 결과를 같은 제안서에 반영하세요. 우리 탐사에 중요한 환경 두 항목을 조사하고 모르는 값은 확인 필요로 남기세요.',
        fields: [
          f('revision', '유지하거나 고친 계획과 이유', '앞에서 검증한 주장과 연결해 쓰세요.'),
          f('env1', '환경 1 항목과 중요한 이유', '중력, 온도, 대기, 방사선, 물, 햇빛 중 고르세요.', undefined, { section: '환경 1' }),
          f('envInfo1', '환경 1 정보와 적용 조건', '단위, 장소, 시점 중 자료에 있는 조건도 남기세요.'),
          f('envSource1', '환경 1 자료번호와 확인 상태', '확인한 정보와 확인 필요를 구분하세요.', undefined, oneLine),
          f('envResponse1', '환경 1 예상 어려움과 대비 방법'),
          f('env2', '환경 2 항목과 중요한 이유', '', undefined, { section: '환경 2' }),
          f('envInfo2', '환경 2 정보와 적용 조건', '단위, 장소, 시점 중 자료에 있는 조건도 남기세요.'),
          f('envSource2', '환경 2 자료번호와 확인 상태', '확인한 정보와 확인 필요를 구분하세요.', undefined, oneLine),
          f('envResponse2', '환경 2 예상 어려움과 대비 방법'),
        ],
      }),
      step(2, 5, {
        name: '내 판단과 기록 보관', resource: 'summary2',
        prompt: '내가 근거로 판단한 일을 짧게 남기세요. 다음 시간에 이어 쓸 모둠 기록을 보관하세요.',
        fields: [
          p('myEvidence', '내가 검토한 주장과 확인한 근거', '', undefined, oneLine),
          p('myVerdict', '내 판단과 이유', '자료에서 확인한 내용이나 조건과 연결하세요.', undefined, oneLine),
          p('myApplication', '내 의견이 모둠 계획에 반영된 부분', '직접 한 일과 그 결과를 한 줄로 쓰세요.', undefined, oneLine),
          p('myRoute', '나의 검토 방법', '', routes, optional),
        ],
      }),
    ],
  },
  {
    number: 3, title: '제안서 보완하고 발표하기', short: '보완과 공유',
    subtitle: '같은 제안서를 보완하고 근거를 들어 판단한 이유를 설명합니다.',
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
  'missionName', 'destination', 'otherDestination', 'selectionReason', 'factRef', 'fact', 'gap',
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
