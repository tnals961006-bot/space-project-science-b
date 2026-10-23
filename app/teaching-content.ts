import dataSource from './notebook-content/data.json';
import activitySource from './notebook-content/activities.json';
import readingSource from './notebook-content/readings.json';

/** Display punctuation only. Source JSON, identifiers, URLs and numeric values stay intact. */
export function cleanDisplayText(value: string): string {
  return value
    .replace(/[·ㆍ]/g, ', ')
    .replace(/[①-⑳]/g, (character) => String(character.charCodeAt(0) - 0x2460 + 1))
    .replace(/\s*[→⇒➜]\s*/g, ' 다음 ')
    .replace(/[↗↘↙↖←↔•●]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const referenceKeys = new Set(['id', 'recordId', 'url', 'sourceIds', 'bodySourceIds', 'additionalWebRefs']);
function displayContent<T>(value: T, key = ''): T {
  if (referenceKeys.has(key)) return value;
  if (typeof value === 'string') return cleanDisplayText(value) as T;
  if (Array.isArray(value)) return value.map((item) => displayContent(item, key)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, displayContent(item, name)])) as T;
  }
  return value;
}

export type MissionRecord = (typeof dataSource.missions)[number];
export type EvidenceCard = (typeof dataSource.evidence)[number];
export type TechnologyCard = (typeof dataSource.technologies)[number];
export type SourceRecord = (typeof dataSource.sources)[number];
export type ReadingCard = (typeof readingSource.cards)[number];
export type ReadingEnvironment = ReadingCard['environment'][number];
export type ReadingSource = (typeof readingSource.sources)[number];
export type ActivityLesson = (typeof activitySource.lessons)[number];
export type AiCard = (typeof activitySource.aiCards)[number];

export const contentVersion = dataSource.version;
export const missionRecords: MissionRecord[] = displayContent(dataSource.missions);
export const evidenceCards: EvidenceCard[] = displayContent(dataSource.evidence);
export const sourceRecords: SourceRecord[] = displayContent(dataSource.sources);
export const readingCards: ReadingCard[] = displayContent(readingSource.cards);
export const readingSources: ReadingSource[] = displayContent(readingSource.sources);

const technologyNotes: Record<number, string> = {
  1: '스푸트니크와는 인공위성이라는 분야로 연결됩니다. 두 기술 사이에 직접 기술이 이전되었다는 근거는 아닙니다.',
  2: '이 자료만으로 24개 탐사 중 어느 하나가 이 기술을 발명했다고 말할 수는 없습니다.',
  3: '24개 탐사 중 어느 하나가 이 기술을 만들었다는 근거는 아닙니다.',
  4: '우주망원경과는 관측 원리로 연결됩니다. 허블이나 제임스 웹이 귀 체온계를 직접 만들었다는 뜻은 아닙니다.',
  5: 'ISS의 물 정화 연구와 관련이 있습니다. ISS 이전의 유인 우주비행 연구도 이 기술 개발에 이어져 있습니다.',
  6: '유인 우주비행의 식량 연구와 관련이 있습니다. 어느 한 번의 비행에서 동결건조 식품을 발명했다고 말할 수는 없습니다.',
  7: '우주복과 소재 연구에 관련이 있지만, 어느 한 번의 비행에서 나온 기술이라고 단정하지 마세요.',
  8: '이 사례는 24개 탐사 자료에 없는 추가 사례입니다.',
};
export const technologyCards: TechnologyCard[] = displayContent(dataSource.technologies).map((item) => ({
  ...item,
  limitations: technologyNotes[item.id] ?? item.limitations,
}));

export const readingGuidance = [
  '선택한 탐사지의 카드 하나를 읽으세요. 새로 확인한 사실과 더 조사할 내용을 나누어 적으세요.',
  '이 자료에 없다는 말은 인류가 아직 모른다는 뜻이 아닙니다. 필요한 내용은 다른 자료에서 더 확인하세요.',
  '읽기 질문에는 여러 답이 가능합니다. 자료 번호와 근거를 들어 생각을 설명하세요.',
  '환경은 우리 계획에 중요한 두 항목부터 읽으세요. 세 번째는 필요할 때 고릅니다. 값이나 조건을 확인하지 못했다면 확인 필요로 남겨도 됩니다.',
  '카드의 문장을 그대로 미션 질문으로 옮기지 마세요. 우리 모둠이 조사할 대상과 알아낼 내용을 정하세요.',
];

export const inquiryFlow = [
  { key: 'fact', title: '탐사 자료에서 확인한 사실', referenceKey: 'factRef', hint: '탐사 번호와 자료에서 확인한 내용을 적으세요.' },
  { key: 'gap', title: '이 자료로 답하지 못한 질문', hint: '앞의 사실에서 궁금해진 점을 질문으로 쓰세요.' },
  { key: 'task', title: '추가 자료를 읽고 정한 탐구 과제', referenceKey: 'additionalRef', supportingKey: 'additionalFact', hint: '새로 확인한 사실과 더 조사할 내용을 나누어 쓰세요.' },
  { key: 'question', title: '우리 미션 질문', hint: '어디에서 무엇을 조사해 어떤 내용을 알아낼지 질문으로 쓰세요.' },
];

const activity = displayContent(activitySource);
const stepCopy: Record<string, { title?: string; instructions?: string[]; doneWhen?: string[] }> = {
  'l1-read': { instructions: ['발사연도와 목적지를 확인하세요. 계획한 방식과 실제로 한 일을 나누어 읽으세요.', '아폴로 13호의 자료를 찾아 두 문장을 사실 또는 해석으로 분류하고 이유를 적으세요.', '판단의 근거가 된 자료를 모둠원에게 설명하세요.'] },
  'l1-explore': { title: '자료를 비교하고 질문 만들기', instructions: ['서로 다른 시기의 탐사 사례를 비교하세요. 필요한 정렬이나 필터를 사용하세요.', '달라진 점 하나와 그 근거가 된 사례를 적으세요. 이어서 이 자료로 답하지 못한 질문 하나를 쓰세요.', 'AI나 동료의 의견과 비교할 우리 주장 하나를 고르세요.'], doneWhen: ['달라진 점과 근거가 된 탐사 번호를 썼다.', '확인한 사실에서 더 알아볼 질문을 만들었다.', '비교할 우리 주장 하나를 골랐다.'] },
  'l1-conclude': { instructions: ['더 알아볼 질문을 설명하고, 그 질문을 조사할 탐사지 후보와 고른 이유를 적으세요.', '의의와 영향 근거카드 하나를 읽고, 확인한 사실을 근거로 각자의 결론을 쓰세요.', '이미 확인된 영향과 앞으로 기대하는 효과를 나누고 오늘 기록을 보관하세요.'] },
  'l2-reopen': { instructions: ['지난 시간에 확인한 사실과 남겨 둔 질문을 다시 읽으세요. 탐사지 후보를 고른 이유도 확인하세요.', '질문 입력, 자료 확인, 기록을 나누어 맡고 판단은 함께 하세요.', 'AI에게는 이름과 학번을 빼고 탐사 내용만 보내세요.'] },
  'l2-draft': { title: '추가 자료를 읽고 우리 초안 쓰기', instructions: ['후보지의 추가 자료를 읽고 새로 확인한 사실을 적으세요. 더 조사할 내용 하나를 골라 우리 미션 질문을 쓰세요.', '그 질문에 답하려면 무엇을 관찰하거나 측정해야 할지 적으세요.', '목표와 예상 어려움, 필요한 기술을 짧게 쓰세요. 확신하기 어려운 내용은 확인 필요로 남기세요.'] },
  'l2-consult': { instructions: ['우리 초안이 들어 있는 질문을 확인하고 AI나 동료에게 보내세요.', '환경에 관한 사실과 기술 제안을 나누어 읽으세요.', '우리 탐사 방법을 정하는 데 중요한 주장 하나를 골라 확인하세요.'] },
  'l2-verify': { title: '주장 하나를 자료와 비교하기', instructions: ['고른 주장과 비교할 설명이나 수치를 탐사지 자료에서 찾으세요.', '내용과 단위, 장소, 시점을 비교하세요. 평균인지 범위인지도 확인하고 자료 번호를 적으세요.', '판정과 이유를 쓰세요. 자료로 판단하기 어렵다면 확인 불가를 고르고 무엇을 더 알아야 하는지 남기세요.'] },
  'l2-revise': { instructions: ['검증 결과에 따라 제안을 채택, 수정, 제외, 보류할지 정하고 이유를 쓰세요.', '제안서에서 해당하는 칸을 직접 고치세요. 어떤 판단을 반영했는지 남기세요.', '우리 탐사에 중요한 환경 두 항목을 적으세요. 확인한 정보에는 출처를, 모르는 정보에는 확인 필요를 붙이세요.'] },
  'l3-reopen': { instructions: ['처음 남긴 질문이 지금의 탐사 목표와 어떻게 이어졌는지 확인하세요. 자료를 확인한 뒤 달라진 계획도 찾아보세요.', '제안서를 살펴볼 세 가지 기준을 읽고 보완할 곳을 고르세요.', '지난 시간의 제안서와 환경표를 이어 쓰세요.'] },
  'l3-complete': { instructions: ['탐사가 왜 필요한지, 무엇을 어떻게 알아볼지, 어떤 도움을 기대하는지 다듬으세요.', '환경 정보와 출처를 보완하세요. 탐사지의 실제 환경과 기지 안에서 조절할 조건을 구분하세요.', '계획마다 근거를 붙이고 아직 확인되지 않은 기대 효과와 환경 조건을 표시하세요.'] },
  'l3-critique': { instructions: ['제안서와 환경표에 대해 AI나 동료에게 질문을 받고 중요한 질문 하나를 고르세요.', '그 질문이 우리 제안의 어느 부분을 짚는지 확인하세요. 반영할지, 반영하지 않을지, 더 확인할지 고르고 근거를 쓰세요.', '반영할 내용은 같은 제안서에서 고치세요.'] },
  'l3-recommend': { instructions: ['학급의 전체 제안서를 둘러보세요.', '탐사의 필요성, 근거, 환경에 대비하는 방법을 비교하세요.', '우리 모둠을 제외하고 미션 하나를 추천하세요. 실제 제안서의 내용과 추천 이유를 각자 적으세요.'] },
};
export const activityLessons: ActivityLesson[] = activity.lessons.map((lesson) => ({
  ...lesson,
  goal: lesson.number === 1 ? '탐사 자료에서 확인한 사실과 더 알아볼 질문을 찾고, 탐사의 의의와 영향을 근거로 설명할 수 있다.' : lesson.goal,
  steps: lesson.steps.map((step) => ({ ...step, ...stepCopy[step.id] })),
}));
export const apolloPractice = activity.apollo13Practice;
export const individualPrompts = activity.individualPrompts;
export const explorationQuestions = activity.explorationQuestions.map((item) => item.id !== 'gap' ? item : {
  ...item,
  title: '이 자료로는 무엇을 알 수 없을까?',
  mainQuestion: '자료에서 확인한 사실을 바탕으로 더 알아보고 싶은 질문을 적으세요.',
  supportQuestions: ['어떤 사례의 어떤 내용에서 질문이 생겼나요?', '이 자료에 없다는 이유로 실제 탐사도 없었다고 말할 수 있나요?'],
  recordPrompts: { claim: '이 자료로 답하지 못한 질문', evidence: '출발점이 된 사례와 확인한 사실', reasoning: '더 알아보고 싶은 이유' },
});

export const aiCards: AiCard[] = activity.aiCards.map((card) => card.id !== 'ai-1' ? card : {
  ...card,
  beforeYouAsk: ['우리가 찾은 변화와 그 근거, 더 알아볼 질문을 먼저 쓰세요.', '우리와 AI가 같은 탐사 사례를 읽는지 확인하세요.'],
  template: '다음은 수업을 위해 고른 탐사 사례이며 전체 우주 탐사 기록은 아니다.\n이 자료에서 보이는 변화 하나를 주장, 증거, 해석으로 설명해 줘.\n증거에는 사례번호와 탐사명, 비교한 항목과 값을 적어 줘.\n이 자료로 답할 수 없어 추가 자료가 필요한 질문 하나도 제시해 줘.\n자료에 적게 실렸다는 이유만으로 실제 탐사가 적거나 없었다고 단정하지 마.\n자료에 없는 사실이나 수치를 만들지 말고, 알 수 없는 내용은 구분해 줘.\n각 항목은 세 문장 이내로 답해 줘.\n\n[같은 탐사 자료]\n{{EXPLORATION_DATA}}',
});
export const criteria = {
  ...activity.judgmentCriteria,
  studentReview: activity.judgmentCriteria.studentReview.map((item) => ({
    ...item,
    title: item.id === 'value' ? '탐사가 필요한 이유와 가치' : item.id === 'evidence' ? '근거가 주장을 뒷받침하는가' : '환경에 맞는 방법과 어려움에 대한 대비',
  })),
};
export const presentation = {
  ...activity.presentation,
  outline: activity.presentation.outline.map((item, index) => index === 1 ? {
    ...item,
    title: '질문의 출발점과 근거',
    prompt: '어떤 사실에서 출발했고, 추가 자료를 읽은 뒤 무엇을 더 알아보기로 했나요?',
  } : item),
};
export const presentationRubric = criteria.studentReview;
export const peerFallback = activity.peerFallback;
export const storyTransition = activity.storyTransition;

const destinationAliases: Record<string, string> = {
  '달 남극': 'moon_south_pole', '달의 남극 지역': 'moon_south_pole',
  '화성': 'mars', '유로파': 'europa', '목성의 위성 유로파': 'europa',
};
export function getReadingCard(destination?: string): ReadingCard | undefined {
  if (!destination) return undefined;
  const value = destination.trim();
  const id = destinationAliases[value] ?? value;
  return readingCards.find((card) => card.id === id || card.recordId === id || card.title === value);
}
export type LinkedSource = { id: string; agency: string; title: string; url: string; date: string | null; checked: string; note: string; kind: 'dataset' | 'reading' };
export const linkedSources: LinkedSource[] = [
  ...sourceRecords.map((source) => ({ id: source.id, agency: source.agency, title: source.title, url: source.url, date: source.publishedOrUpdatedRaw, checked: source.checkedAt, note: source.readingGuide, kind: 'dataset' as const })),
  ...readingSources.map((source) => ({ id: source.id, agency: source.agency, title: source.title, url: source.url, date: source.updatedAt ?? source.publishedAt, checked: source.accessedAt, note: source.scopeNote, kind: 'reading' as const })),
];
export function getSource(id: string): LinkedSource | undefined {
  return linkedSources.find((source) => source.id === id);
}

export type GroupValues = Record<string, string | undefined>;
function recordText(values: GroupValues, fields: [string, string][]): string {
  return fields.map(([key, title]) => title + ': ' + (values[key]?.trim() || '[아직 작성하지 않음]')).join('\n');
}
function readingPack(values: GroupValues): string {
  const card = getReadingCard(values.destination);
  if (!card) return recordText(values, [['otherDestination', '선택한 탐사지'], ['additionalRef', '추가 자료 출처'], ['additionalFact', '확인한 사실']]);
  const relevantSources = card.sourceIds.map(getSource).filter((source): source is LinkedSource => Boolean(source));
  return JSON.stringify({ recordId: card.recordId, title: card.title, body: card.body, facts: card.facts, cannotAnswer: card.cannotAnswer, environment: card.environment, sources: relevantSources }, null, 2);
}
/** Explicit group fields only: individual reflections, names and student numbers are excluded. */
export function buildAiPrompt(lessonNumber: number, values: GroupValues = {}): string {
  const card = aiCards.find((item) => item.lessonId === 'lesson-' + lessonNumber);
  if (!card) return '';
  const proposalFields: [string, string][] = [
    ['destination', '탐사지'], ['otherDestination', '다른 탐사지와 근거'], ['selectionReason', '선정 이유'],
    ['factRef', '출발 자료 번호'], ['fact', '확인한 사실'], ['gap', '처음 질문'],
    ['additionalRef', '추가 자료 번호'], ['additionalFact', '새로 확인한 사실'], ['task', '더 조사할 과제'],
    ['question', '미션 질문'], ['goal', '탐사 목표'], ['target', '관측 대상'], ['data', '얻을 자료'],
    ['method', '방법과 이유'], ['difficulty', '예상 어려움'], ['technology', '필요한 기술'], ['response', '대비 방법'],
    ['evidenceRef', '의의와 영향 근거번호'], ['meaning', '확인한 사실과 의미'],
    ['expectation', '기대하는 지식과 도움'], ['limitation', '이 계획으로 확인할 수 없는 점'],
  ];
  const environmentFields: [string, string][] = [
    ['env1', '환경 1'], ['envInfo1', '환경 1 정보와 조건'], ['envSource1', '환경 1 출처와 상태'], ['envResponse1', '환경 1 어려움과 대응'], ['envReview1', '환경 1 보완'],
    ['env2', '환경 2'], ['envInfo2', '환경 2 정보와 조건'], ['envSource2', '환경 2 출처와 상태'], ['envResponse2', '환경 2 어려움과 대응'], ['envReview2', '환경 2 보완'],
  ];
  const verificationFields: [string, string][] = [
    ['claim2', '검증한 주장'], ['verifySource', '확인 자료'], ['verifyConditions', '자료의 조건'], ['verdict', '사실 판정'],
    ['reason', '판정 이유'], ['decision', '계획에 적용한 판단'], ['verifyNext', '더 확인할 점'], ['verifyLink', '연결한 계획'], ['revision', '바꾼 내용과 이유'],
  ];
  const table = ['번호\t탐사명\t발사연도\t주관국과 기관\t목적지\t수업용 영역\t계획한 방식\t대표 수행 결과\t주요 내용\t근거번호\t출처번호', ...missionRecords.map((mission) => [mission.id, mission.title, mission.year, mission.agency, mission.destination, mission.destinationCategory, mission.method, mission.result, mission.description, mission.evidenceIds.join(', '), mission.sourceIds.join(', ')].join('\t'))].join('\n');
  const replacements: Record<string, string> = {
    EXPLORATION_DATA: table,
    MISSION_DRAFT: recordText(values, proposalFields), SOURCE_PACK: readingPack(values),
    PROPOSAL: recordText(values, proposalFields), ENVIRONMENT_RECORD: recordText(values, environmentFields), EVIDENCE_RECORD: recordText(values, verificationFields),
  };
  return card.template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => replacements[key] ?? '[확인할 자료를 넣으세요]');
}

export const teachingContent = {
  version: contentVersion,
  missions: missionRecords, evidence: evidenceCards, technologies: technologyCards, sources: sourceRecords,
  readingCards, readingSources, readingGuidance, inquiryFlow,
  lessons: activityLessons, explorationQuestions, apolloPractice, individualPrompts, aiCards,
  criteria, presentation, presentationRubric, peerFallback, storyTransition,
};
