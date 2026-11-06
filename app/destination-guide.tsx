import React from 'react';
import {ArrowLeft, ExternalLink} from 'lucide-react';
import './destination-guide.css';

type Candidate = {
  id: string; name: string; kind: string; theme: string; fact: string;
  question: string; observe: string; environment: string; caution: string;
  keywords: string; sources: {title: string; url: string; lookFor: string}[];
};

const candidates: Candidate[] = [
  {
    id: 'moon', name: '달 남극 (Lunar South Pole)', kind: '지구의 위성', theme: '물 · 햇빛 · 자원',
    fact: '달 극지의 햇빛이 닿지 않는 일부 지역에서 물 얼음의 증거가 확인되었습니다.',
    question: '얼음이 있는 곳과 햇빛을 받는 곳은 얼마나 떨어져 있을까?',
    observe: '얼음 분포 지도와 햇빛 지도를 비교하고, 후보 지점의 온도와 지형을 조사해 볼 수 있어요.',
    environment: '물의 위치, 햇빛을 받는 시간, 온도',
    caution: '남극 전체에 얼음이 고르게 있는 것은 아니에요. 얼음이 있다는 사실만으로 바로 사용할 수 있다고 단정하지 마세요.',
    keywords: '달 남극 물 얼음 영구음영 / NASA Moon south pole water ice',
    sources: [{title: 'NASA · 달의 물과 얼음', url: 'https://science.nasa.gov/moon/moon-water-and-ices/', lookFor: 'LCROSS 관측 결과와 남극의 얼음 분포 그림을 보세요. 물의 존재와 실제 이용 가능성은 구분하세요.'}],
  },
  {
    id: 'mars', name: '화성 예제로 충돌구 (Jezero Crater, Mars)', kind: '행성의 특정 지역', theme: '과거의 물 · 암석',
    fact: '예제로 충돌구에는 오래전 강이 호수로 흘러들며 퇴적물을 쌓은 삼각주의 흔적이 남아 있습니다.',
    question: '삼각주의 서로 다른 층에는 어떤 크기의 알갱이와 광물이 있을까?',
    observe: '암석층을 촬영하고 알갱이 크기와 광물 성분을 비교해, 물이 흘렀던 환경을 추론할 수 있어요.',
    environment: '온도, 얇은 대기, 먼지',
    caution: '과거 물의 흔적이 있다는 것과 지금 액체 물이나 생명체가 있다는 것은 다른 주장이에요.',
    keywords: '화성 예제로 삼각주 퍼서비어런스 / NASA Jezero delta',
    sources: [
      {title: 'NASA · 예제로 삼각주 사진', url: 'https://science.nasa.gov/resource/spanning-the-delta-of-mars-jezero-crater/', lookFor: '사진과 설명에서 삼각주가 만들어진 과정, 암석층의 모습을 확인하세요.'},
      {title: 'NASA · 화성의 환경', url: 'https://science.nasa.gov/mars/facts/', lookFor: 'Water on Mars(물), Atmosphere(대기)를 찾아 현재 환경을 확인하세요.'},
    ],
  },
  {
    id: 'europa', name: '유로파 (Europa)', kind: '목성의 위성', theme: '얼음 아래 바다',
    fact: '표면은 주로 물 얼음이며, 얼음층 아래에 액체 상태의 바다가 있다는 강한 증거가 있습니다.',
    question: '표면의 균열 주변과 다른 곳은 물질의 성분이 어떻게 다를까?',
    observe: '균열을 촬영하고 표면 성분을 비교하거나, 레이더로 얼음층 구조를 조사해 볼 수 있어요.',
    environment: '두꺼운 얼음, 추위, 강한 방사선',
    caution: '바다의 증거가 곧 생명체 발견은 아니에요. 표면에 산소가 언급되어도 사람이 숨 쉴 대기가 있다는 뜻은 아닙니다.',
    keywords: '유로파 얼음 바다 균열 / NASA Europa ice ocean',
    sources: [{title: 'NASA · 유로파의 특징', url: 'https://science.nasa.gov/jupiter/jupiter-moons/europa/europa-facts/', lookFor: 'Structure(구조), Surface(표면), Potential for Life(생명 가능성)에서 증거와 추정을 구분하세요.'}],
  },
  {
    id: 'enceladus', name: '엔셀라두스 (Enceladus)', kind: '토성의 위성', theme: '물기둥 · 생명 조건',
    fact: '남극 부근에서 수증기와 얼음 입자가 우주로 뿜어져 나옵니다. 카시니는 이 분출 물질을 분석했습니다.',
    question: '분출하는 물질의 성분은 위치나 관측 시기에 따라 다를까?',
    observe: '분출 물질의 성분과 입자량을 여러 위치·시기에 측정해 비교할 수 있어요.',
    environment: '추위, 물의 상태, 에너지원',
    caution: '생명에 필요한 물질을 찾았다는 것은 생명체를 찾았다는 뜻이 아니에요.',
    keywords: '엔셀라두스 카시니 분출 / NASA Enceladus plume',
    sources: [{title: 'NASA · 엔셀라두스', url: 'https://science.nasa.gov/saturn/moons/enceladus/', lookFor: 'Overview(개요)에서 분출 물질로 알아낸 것과 내부 바다를 추론한 근거를 읽으세요.'}],
  },
  {
    id: 'titan', name: '타이탄 (Titan)', kind: '토성의 위성', theme: '대기 · 호수 · 날씨',
    fact: '두꺼운 대기가 있고, 표면에는 액체 메테인과 에테인으로 이루어진 강과 호수가 있습니다.',
    question: '호수 주변의 구름과 강수는 시간에 따라 어떻게 달라질까?',
    observe: '구름·호수를 반복 촬영하고, 대기의 온도와 성분을 측정해 비교할 수 있어요.',
    environment: '대기 성분, 낮은 온도, 빛',
    caution: '타이탄의 호수를 지구처럼 물로 된 호수라고 쓰지 마세요. 대기가 있어도 바로 호흡할 수는 없어요.',
    keywords: '타이탄 메테인 호수 대기 / NASA Titan methane lakes',
    sources: [{title: 'NASA · 타이탄의 특징', url: 'https://science.nasa.gov/saturn/moons/titan/facts/', lookFor: 'Surface(표면), Atmosphere(대기)에서 호수의 성분과 대기의 특징을 찾으세요.'}],
  },
  {
    id: 'venus', name: '금성의 대기 (Venus Atmosphere)', kind: '행성의 대기', theme: '온도 · 기압 · 온실효과',
    fact: '금성은 두꺼운 대기로 인해 강한 온실효과가 나타나며, 표면은 매우 뜨겁고 기압이 높습니다.',
    question: '높이에 따라 대기의 온도와 기압은 어떻게 달라질까?',
    observe: '대기 탐사 장치로 높이별 온도·기압·성분을 측정하는 방법을 생각해 볼 수 있어요.',
    environment: '높이에 따른 온도와 기압, 대기 성분',
    caution: '표면의 값과 높은 대기의 값을 섞어 쓰지 마세요. 특정 높이가 덜 뜨겁다고 안전한 거주지인 것은 아니에요.',
    keywords: '금성 대기 고도 온도 기압 / NASA Venus atmosphere altitude',
    sources: [{title: 'NASA · 금성의 특징', url: 'https://science.nasa.gov/venus/venus-facts/', lookFor: 'Atmosphere(대기)에서 온실효과와 표면 환경을 먼저 확인하고, 높이별 값은 추가 자료를 찾으세요.'}],
  },
  {
    id: 'bennu', name: '소행성 베누 (Asteroid Bennu)', kind: '소행성', theme: '태양계의 재료 · 시료',
    fact: '베누는 탄소가 풍부한 소행성입니다. 지구로 가져온 시료에서 유기물과 물과의 반응을 보여 주는 광물 등이 확인되었습니다.',
    question: '베누의 서로 다른 위치에서 얻은 시료는 성분이 같을까?',
    observe: '여러 지점의 표면 성분을 비교하고, 시료를 가져와 분석하는 탐사를 구상할 수 있어요.',
    environment: '표면 지형, 중력, 온도',
    caution: '유기물은 생명체가 없어도 만들어질 수 있어요. 시료의 물 관련 흔적을 현재 표면의 액체 물로 해석하지 마세요.',
    keywords: '베누 시료 유기물 오시리스 렉스 / NASA Bennu sample',
    sources: [{title: 'NASA · 베누의 특징과 시료', url: 'https://science.nasa.gov/solar-system/asteroids/101955-bennu/facts/', lookFor: 'Structure(구조)의 시료 분석 결과를 읽고, 관측으로 확인한 것과 형성 과정의 추정을 나누세요.'}],
  },
];

export default function DestinationGuide({question, destination, onReturn}: {question?: string; destination?: string; onReturn: () => void}) {
  const renderCandidate = (c: Candidate) => <details className={'candidate-card candidate-' + c.id} key={c.id}>
    <summary><span className="candidate-orb" aria-hidden="true"/><span className="candidate-title"><small>{c.kind}</small><strong>{c.name}</strong><span>{c.theme}</span></span><span className="candidate-expand">펼치기 +</span></summary>
    <div className="candidate-body">
      <p className="candidate-fact"><b>자료로 확인한 사실</b>{c.fact}</p>
      <div className="candidate-question"><b>질문 예시</b><p>{c.question}</p><small>그대로 정답으로 쓰지 말고, 우리 모둠이 궁금한 점에 맞게 바꿔 보세요.</small></div>
      <dl><dt>무엇을 관찰할까?</dt><dd>{c.observe}</dd><dt>살펴볼 환경 조건</dt><dd>{c.environment}</dd></dl>
      <p className="candidate-caution"><b>구분해서 생각하기</b>{c.caution}</p>
      <div className="candidate-sources"><h3>출처에서 이 부분을 찾아보세요</h3>{c.sources.map(source=><div key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <ExternalLink size={15}/><span className="sr-only"> (새 탭)</span></a><p>{source.lookFor}</p></div>)}</div>
      <p className="candidate-keywords"><b>더 찾아볼 검색어</b>{c.keywords}</p>
    </div>
  </details>;
  return <div className="destination-guide">
    <section className="destination-guide-intro">
      <span className="eyebrow">선택을 돕는 참고 자료</span>
      <h2>어디에서 무엇을 알아볼까?</h2>
      <p>관심 있는 곳 <strong>두 곳만</strong> 펼쳐 비교해 보세요. 아래 예시는 출발점입니다. <strong>직접 조사한 다른 탐사지도 고를 수 있어요.</strong></p>
      <ol><li><b>읽기</b> 확인된 사실과 출처를 읽어요.</li><li><b>비교하기</b> 우리 질문을 알아보기에 어느 곳이 더 적절한지 이야기해요.</li><li><b>정하기</b> 활동 5로 돌아가 탐사지와 고른 이유를 써요.</li></ol>
      <p className="guide-optional">참고용 · 별도 제출 없음 · 원문 링크는 새 탭에서 열립니다.</p>
    </section>
    {(question?.trim()||destination?.trim())&&<section className="guide-readback" aria-label="우리 모둠의 현재 기록">{question?.trim()&&<p><b>우리 모둠 질문</b>{question}</p>}{destination?.trim()&&<p><b>현재 탐사지</b>{destination}</p>}</section>}
    <section aria-labelledby="starter-candidates"><div className="guide-section-title"><h2 id="starter-candidates">먼저 살펴볼 세 곳</h2><p>2차시에도 이어 읽을 수 있는 자료가 준비되어 있어요.</p></div><div className="candidate-grid">{candidates.slice(0,3).map(renderCandidate)}</div></section>
    <section aria-labelledby="more-candidates"><div className="guide-section-title"><h2 id="more-candidates">관심을 넓혀 볼 네 곳</h2><p>물·대기·태양계의 재료가 궁금하다면 살펴보세요.</p></div><div className="candidate-grid">{candidates.slice(3).map(renderCandidate)}</div></section>
    <section className="guide-research" aria-labelledby="research-help"><h2 id="research-help">다른 곳을 조사해도 좋아요</h2><p>장소 이름만 정하기 어렵다면 <strong>‘물 · 빛 · 온도 · 대기 · 암석’ 중 궁금한 것 하나</strong>부터 골라 보세요.</p>
      <ol><li><b>검색어 좁히기</b><p>‘화성’보다 ‘화성 지하 얼음 NASA’처럼 <strong>장소 + 알아볼 내용 + 기관</strong>으로 찾아요.</p></li><li><b>원문 확인하기</b><p>검색 요약이나 AI 답에서 끝내지 말고, 기관의 원문을 열어 확인해요. 영어는 브라우저의 한국어 번역을 써도 좋아요.</p></li><li><b>출처와 조건 남기기</b><p><strong>기관명 · 자료 제목 · 링크 · 확인한 사실</strong>을 적어요. 수치에는 단위와 측정 장소·시점을 함께 확인하고, 추정은 추정이라고 표시해요.</p></li></ol>
      <a href="https://astro.kasi.re.kr/kor/post/solarSystemOverview/71368" target="_blank" rel="noopener noreferrer">한국어로 시작하기 · 한국천문연구원 태양계 안내 <ExternalLink size={15}/><span className="sr-only"> (새 탭)</span></a>
      <p className="hint">태양계의 구성과 천체 종류를 먼저 읽고, 사이트의 태양계 메뉴에서 관심 있는 천체를 찾아보세요. 세부 탐사 결과는 위 NASA 자료와 비교할 수 있어요.</p>
    </section>
    <section className="guide-check"><h2>고르기 전에 세 가지만 확인!</h2><ul><li>우리 모둠이 알아보고 싶은 점이 있나요?</li><li>그곳을 고른 이유를 자료 속 사실로 설명할 수 있나요?</li><li>무엇을 관찰하거나 측정할지 한 가지 떠오르나요?</li></ul><p>자료를 보고 질문을 더 구체적으로 바꿔도 됩니다. 지금 고른 곳은 2차시 추가 조사 후 근거를 들어 바꿀 수 있어요.</p><button className="primary" onClick={onReturn}><ArrowLeft size={17}/>활동 5로 돌아가 탐사지 쓰기</button></section>
    <p className="guide-source-note">한국어 설명은 연결된 기관 자료를 요약했습니다. 질문과 관찰 방법은 수업용 제안이며, 실제 탐사 결과와 구분해 읽으세요. 출처 확인: 2026. 11. 6.</p>
  </div>;
}
