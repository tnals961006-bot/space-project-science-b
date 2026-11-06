import React, {useEffect, useRef, useState} from 'react';
import {allFields, stages} from './course';
import {recordMap, Row} from './record-ui';
import {comparisonText, evidenceCards} from './teaching-content';
import './class-board.css';

type Team = {id: string; label: string; records: Row[]};
type Student = {number: number; team_id: string; records: Row[]};
type Data = {teams: Team[]; students: Student[]};
type Feedback = (teamId: string, value: string) => Promise<boolean>;
type Focus = {fields: string[]; question: string};
const focus = (fields: string, question: string): Focus => ({fields: fields.split(' '), question});
const activities: Record<string, Focus> = {
  'l2-draft': focus('destination selectionReason additionalFact question', '이 탐사지와 자료가 우리 질문과 어떻게 이어져?'),
  'l2-verify': focus('verifySource reason', '자료의 어떤 조건을 확인하고 이 판단을 내렸어?'),
  'l2-revise': focus('myVerdict', '어떤 사실을 근거로 계획을 유지하거나 고쳐야 한다고 판단했어?'),
  intro: focus('first', '우주 탐사로 무엇을 알아보고 싶어? 그 이유는 뭐야?'),
  apollo: focus('apolloReasonA apolloReasonB', '자료에 직접 나온 부분은 어디고, 우리가 의미를 붙인 부분은 어디야?'),
  data: focus('change gap', '어느 두 기록을 보고 이 차이를 설명했어? 그 자료로 아직 알 수 없는 점은 뭐야?'),
  ai1: focus('selectedClaim claim1', '우리가 고른 문장과 AI 문장이 같은 내용을 비교하고 있어?'),
  evidence: focus('meaning conclusion', '처음 생각에 어떤 자료의 사실을 더하고 싶어?'),
  previous: focus('gap selectionReason', '지난 질문을 알아보려면 무엇부터 조사할까?'),
  ai2: focus('prompt2 claim2', '이 주장 중 탐사 방법을 정하기 전에 확인해야 할 부분은 뭐야?'),
  summary2: focus('myEvidence myVerdict', '어떤 근거를 보고 그렇게 판단했어?'),
  environment3: focus('envInfo1 envSource1 envResponse1', '이 환경 조건 때문에 계획에서 무엇을 보완해야 할까?'),
  proposal: focus('question revision', '제안서에서 근거를 더 보태고 싶은 부분은 어디야?'),
  editProposal: focus('expectation limitation', '이 계획으로 알아낼 수 있는 것과 아직 어려운 것은 뭐야?'),
  ai3: focus('critique critiqueReason', '이 질문을 반영하거나 보류할 근거가 있어?'),
  present: focus('peerQuestion peerResponse', '짝 모둠의 질문을 듣고 어떤 부분을 다시 확인하고 싶어?'),
  gallery: focus('recommend recommendReason', '추천한 모둠의 어떤 근거가 설득력 있었어?'),
  reflection: focus('reflection judgmentMoment', '처음 생각을 바꾸거나 더 분명하게 해 준 자료가 뭐였어?'),
};
const labels: Record<string,string> = {selectedClaim:'우리 모둠이 고른 문장', claim1:'AI에서 가져온 말', gap:'더 알아볼 질문', change:'두 탐사에서 찾은 차이'};
const fieldDefs = new Map(allFields.map(f => [f.key, f]));
function label(key: string) {return labels[key] || fieldDefs.get(key)?.label || key;}
function display(key: string, values: Record<string,string>) {
  const value = (values[key] || '').trim();
  if (key === 'comparison') return comparisonText(value);
  if (key === 'evidenceRef') return evidenceCards.find(card => card.id === value)?.title || value;
  return value;
}
function initialActivity(data: Data, classId: string) {
  try {
    const saved = localStorage.getItem('space-board-activity:' + classId);
    if (stages.some(stage => stage.steps.some(s => s.id === saved))) return saved!;
  } catch {}
  const rows = [...data.teams, ...data.students].flatMap(item => item.records);
  const latest = rows.filter(r => r.value.trim() && fieldDefs.has(r.key)).sort((a,b) => (b.updated || '').localeCompare(a.updated || ''))[0];
  return stages.flatMap(s => s.steps).find(s => s.fields.some(f => f.key === latest?.key))?.id || stages[0].steps[0].id;
}
function shortTime(iso: string) {
  if (!iso || Number.isNaN(Date.parse(iso))) return '';
  return new Date(iso).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'});
}

export default function ClassBoard({data, classId, coaching, send, jump}: {data: Data; classId: string; coaching: {target:string; activity:string; prompt:string}[]; send: Feedback; jump: {activity:string; team:string; prompt:string}|null}) {
  const [activity, setActivity] = useState(() => jump?.activity || initialActivity(data, classId));
  const [opening, setOpening] = useState(jump);
  const stage = stages.find(s => s.steps.some(step => step.id === activity)) || stages[0];
  const step = stage.steps.find(s => s.id === activity) || stage.steps[0];
  const ai = step.resource === 'ai1';
  const view = activities[step.id] || activities[step.resource] || focus(step.fields.slice(0,2).map(f=>f.key).join(' '),step.prompt);
  const teams = [...data.teams].sort((a,b) => a.label.localeCompare(b.label,'ko',{numeric:true}));
  function select(id: string) {
    setOpening(null);
    setActivity(id);
    try {localStorage.setItem('space-board-activity:' + classId,id);} catch {}
  }
  const groups = teams.map(team => ({team, values:recordMap(team.records), members:data.students.filter(s => s.team_id === team.id)}));
  const total = groups.length;
  const containsPersonal = step.fields.some(f => f.personal);
  const personalKeys = step.fields.filter(f => f.personal && !f.optional).map(f => f.key);
  const studentCount = data.students.filter(s => s.records.some(r => personalKeys.includes(r.key) && r.value.trim())).length;
  const metrics = ai ? [
    ['AI 문장 입력',groups.filter(g => g.values.claim1?.trim()).length],
    ['원자료 확인 기록',groups.filter(g => g.values.check1?.trim()).length],
    ['최종 판단 입력',groups.filter(g => g.values.decision1?.trim()).length],
  ] as const : [];
  return <section className="class-board" aria-label="수업 중 모둠 보기">
    <div className="board-controls">
      <label>차시<select value={stage.number} onChange={e => select(stages[Number(e.target.value)-1].steps[0].id)}>{stages.map(s => <option key={s.number} value={s.number}>{s.number}차시 · {s.short}</option>)}</select></label>
      <label>지금 볼 활동<select value={activity} onChange={e => select(e.target.value)}>{stage.steps.map((s,i) => <option key={s.id} value={s.id}>{i+1}. {s.resource === 'ai1' ? '내 생각과 AI 생각 비교하기' : s.name}</option>)}</select></label>
    </div>
    <div className="board-metrics"><small className="board-sync">15초마다 갱신</small>{ai ? metrics.map(([name,n]) => <span key={name}>{name} <b>{n}/{total}조</b></span>) :
      <>{step.fields.some(f => !f.personal) && <span>모둠 입력 시작 <b>{groups.filter(g => step.fields.some(f => !f.personal && !f.hidden && display(f.key,g.values))).length}/{total}조</b></span>}
      {containsPersonal && <span>개인 입력 시작 <b>{studentCount}/{data.students.length}명</b></span>}
      {!step.fields.length && <span>앞 활동에서 이어 볼 기록</span>}</>}</div>
    <div className="board-list">{groups.map(group => <BoardRow key={classId + '/' + activity + '/' + group.team.id} {...group} activity={activity} classId={classId} view={view} ai={ai} specific={coaching.find(c=>c.target===group.team.label && c.activity===step.id)?.prompt} initialDraft={opening?.team===group.team.label && opening.activity===step.id ? opening.prompt : null} recordKeys={step.fields.filter(f=>!f.hidden).map(f=>f.key)} send={send}/>)}</div>
  </section>;
}

type RowProps = {team:Team; values:Record<string,string>; members:Student[]; activity:string; classId:string; view:Focus; ai:boolean; specific?:string; initialDraft:string|null; recordKeys:string[]; send:Feedback};
function BoardRow({team, values, members, activity, classId, view, ai, specific, initialDraft, recordKeys, send}: RowProps) {
  const markKey = ['space-teacher-oral-v1',classId,activity,team.id].join(':');
  const [oral,setOral] = useState(() => {try {return localStorage.getItem(markKey) === '1';} catch {return false;}});
  const revisitKey = markKey.replace('oral-v1','revisit-v1');
  const [revisit,setRevisit] = useState(() => {try {return localStorage.getItem(revisitKey) === '1';} catch {return false;}});
  const [expanded,setExpanded] = useState(false);
  const [draft,setDraft] = useState<string|null>(initialDraft);
  const [sending,setSending] = useState(false);
  const [fresh,setFresh] = useState(false);
  const studentValues = members.map(s => ({number:s.number,values:recordMap(s.records)}));
  function answer(key: string) {
    if (fieldDefs.get(key)?.personal) return studentValues.filter(s => s.values[key]?.trim()).map(s => s.number+'번  '+s.values[key].trim()).join('\n');
    return display(key,values);
  }
  const evidenceKeys = [...new Set([...view.fields,...recordKeys])];
  const trackingKeys = new Set([...evidenceKeys,...(ai ? ['change','gap'] : [])]);
  const tracked = [...team.records,...members.flatMap(s => s.records)].filter(r => trackingKeys.has(r.key));
  const signature = JSON.stringify(tracked.map(r => [r.actor,r.key,r.rev,r.updated,r.value]).sort());
  const previous = useRef(signature);
  useEffect(() => {
    if (signature === previous.current) return;
    previous.current = signature;
    setFresh(true);
    const timer = setTimeout(() => setFresh(false),12000);
    return () => clearTimeout(timer);
  },[signature]);
  const updated = tracked.map(r => r.updated || '').sort().at(-1) || '';
  const extra = evidenceKeys.filter(k => !view.fields.includes(k) && answer(k));
  const source = ai ? values.factRef : '';
  const sent = values.teacherFeedback || '';
  let prompt = ai ? view.question : specific || view.question;
  if (ai && !values.claim1?.trim()) prompt = '우리 문장과 같은 내용을 다룬 AI 문장 하나를 골라 볼까?';
  if (ai && values.check1?.trim()) prompt = '원자료에서 확인한 사실을 끝까지 적어 볼까? 그 근거를 보면 우리 문장을 그대로 둘까, 고칠까?';
  if (ai && values.decision1?.trim()) prompt = '우리 판단을 가장 잘 뒷받침하는 탐사 기록은 어느 부분이야?';
  function toggleMark(key:string, next:boolean, update:(v:boolean)=>void) {
    update(next);
    try {if(next) localStorage.setItem(key,'1'); else localStorage.removeItem(key);} catch {}
  }
  async function submit() {
    if (sending || !draft?.trim()) return;
    setSending(true);
    try {if (await send(team.id,draft.trim())) setDraft(null);} finally {setSending(false);}
  }
  return <article className={'board-row'+(fresh?' board-fresh':'')} aria-label={team.label}>
    <div className="board-row-head"><strong>{team.label}</strong>{fresh && <em>새 답</em>}{revisit && <span className="board-revisit">다시 볼 조</span>}{oral && <span className="board-oral">✓ 말로 피드백함</span>}{updated && <small>최근 기록 {shortTime(updated)}</small>}</div>
    <div className="board-answers">{view.fields.map(k => <div key={k}><small>{label(k)}</small><p className={(expanded?'':'board-clamp ')+(answer(k)?'':'board-empty')}>{answer(k)||'아직 입력 전'}</p></div>)}</div>
    {ai && values.check1?.trim() && <p className="board-check"><b>{values.decision1?.trim()?'원자료 확인 기록':'원자료 확인 작성 중'}</b> <span className={expanded?'':'board-clamp'}>{values.check1}</span></p>}
    {expanded && <div className="board-details"><div className="board-actions"><button type="button" aria-pressed={revisit} onClick={()=>toggleMark(revisitKey,!revisit,setRevisit)}>{revisit?'다시 보기 해제':'다시 볼 조로 표시'}</button></div>{source && <p><b>비교한 탐사</b>{source}</p>}{extra.filter(k=>!(ai && k==='check1')).map(k => <p key={k}><b>{label(k)}</b>{answer(k)}</p>)}{sent && <p><b>학생 화면에 표시 중인 피드백</b>{sent}</p>}</div>}
    <div className="board-coach"><p><b>추천 질문</b> {prompt}</p><div className="board-actions">
      <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'접기':'원문 펼치기'}</button>
      <button type="button" aria-pressed={oral} onClick={()=>toggleMark(markKey,!oral,setOral)}>{oral?'✓ 말로 피드백함':'말로 피드백함'}</button>
      <button type="button" className="board-send" aria-expanded={draft!==null} onClick={()=>setDraft(draft??prompt)}>질문 보내기</button>
    </div></div>
    {draft!==null && <form className="board-compose" onSubmit={e=>{e.preventDefault();void submit();}}>
      <label>{team.label} 학생 화면에 보낼 질문<textarea autoFocus rows={2} maxLength={3000} value={draft} disabled={sending} onChange={e=>setDraft(e.target.value)}/></label>
      {sent && <small>현재 표시 중인 피드백을 새 질문으로 바꿉니다.</small>}
      <div className="board-actions"><button type="button" disabled={sending} onClick={()=>setDraft(null)}>취소</button><button className="board-send" disabled={sending||!draft.trim()}>{sending?'보내는 중…':team.label+'에 보내기'}</button></div>
    </form>}
  </article>;
}
