'use client';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Download,ExternalLink,LogOut,RefreshCw,Users,UserRound,ChevronDown} from 'lucide-react';
import ClassBoard from './class-board';
import {api,hasTeacherSession} from '../lib/classroom-client';
import {proposalKeys} from './course';
import {comparisonText,evidenceCards} from './teaching-content';
import {Row,Proposal,RecordList,recordMap,download} from './record-ui';

type Props={notify:(message:string)=>void; onStudentPreview:()=>void};

const coachFields:Record<string,[string,string]> = {
  '근거 확인':['l1-explore','comparison'], '비교 설명':['l1-explore','fact'],
  '근거 연결':['l1-explore','change'], '질문 만들기':['l1-explore','gapStatement'],
  '과도한 일반화':['l1-explore','change'], '자료 범위':['l1-explore','gapStatement'],
  'AI 문장 확인':['l1-compare','claim1'], 'AI 비교 마무리':['l1-compare','check1'],
  '탐사지 선택':['l1-conclude','destination'], '의의 해석':['l1-conclude','evidenceRef'],
  '개인 결론':['l1-conclude','first'], '개인 결론 보완':['l1-conclude','conclusion'],
  '미션 초안':['l2-draft','question'], 'AI 확인 문장':['l2-consult','claim2'],
  '2차시 자료 검증':['l2-verify','verifySource'], '2차시 계획 반영':['l2-verify','revision'],
  '환경 출처':['l2-revise','envSource1'],
};
export default function Teacher({notify,onStudentPreview}:Props){
  const [loggedIn,setLoggedIn]=useState(()=>typeof window!=='undefined'&&hasTeacherSession());
  const [teacherCode,setTeacherCode]=useState('');
  const [loginError,setLoginError]=useState('');
  const [classes,setClasses]=useState<any[]>([]);
  const [selected,setSelected]=useState(()=>{try{return localStorage.getItem('space-board-class') || 'class-4';}catch{return 'class-4';}});
  const [data,setData]=useState<any>(null);
  const [tab,setTab]=useState<'live'|'coaching'|'teams'|'students'>('live');
  const [jump,setJump]=useState<{activity:string;team:string;prompt:string}|null>(null);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState<Record<string,string>>({});
  const activeClass=useRef(selected);
  const latestLoad=useRef(0);
  function chooseClass(id:string) {
    if(activeClass.current===id)return;
    activeClass.current=id;
    setData(null);
    setJump(null);
    setSelected(id);
    try{localStorage.setItem('space-board-class',id);}catch{}
  }
  const current=classes.find(c=>c.id===selected);
  const evidenceName=(id:string)=>{const card=evidenceCards.find(c=>c.id===id);const n=id.replace(/^E0?/,'');return card?`영향 카드 ${n} · ${card.title}`:`영향 카드 ${n}`;};

  async function login(e:React.FormEvent){
    e.preventDefault();setBusy(true);setLoginError('');
    try{
      await api('teacher_login',{code:teacherCode});
      setLoggedIn(true);setTeacherCode('');
    }catch(e:any){setLoginError(e.message||'교사용 코드를 확인해 주세요.');}
    finally{setBusy(false);}
  }

  async function loadClasses(){
    try{
      const r=await api('teacher');
      setClasses(r.classes||[]);
      if(!(r.classes||[]).some((c:any)=>c.id===selected)&&r.classes?.[0])chooseClass(r.classes[0].id);
    }catch(e:any){
      if(e.status===401){setLoggedIn(false);setData(null);}
      else notify(e.message||'학급 목록을 불러오지 못했어요.');
    }
  }

  async function loadClass(id=selected,quiet=false){
    if(!id || id!==activeClass.current)return;
    const request=++latestLoad.current;
    if(!quiet)setBusy(true);
    try{
      const r=await api('action=class&id='+encodeURIComponent(id));
      if(request===latestLoad.current && id===activeClass.current)setData(r);
    }catch(e:any){
      if(e.status===401){setLoggedIn(false);setData(null);}
      else if(request===latestLoad.current && id===activeClass.current)notify(e.message||'학급 기록을 불러오지 못했어요.');
    }finally{if(!quiet && id===activeClass.current)setBusy(false);}
  }

  useEffect(()=>{if(loggedIn)void loadClasses();},[loggedIn]);
  useEffect(()=>{if(loggedIn&&selected)void loadClass(selected);},[loggedIn,selected]);
  useEffect(()=>{
    if(!loggedIn||!selected)return;
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void loadClass(selected,true);},15000);
    return()=>clearInterval(timer);
  },[loggedIn,selected]);

  async function logout(){
    await api('teacher_logout',{}).catch(()=>{});
    setLoggedIn(false);setData(null);setClasses([]);notify('교사 공간에서 나왔어요.');
  }

  async function saveFeedback(teamId:string, message?:string){
    if(selected!==activeClass.current)return false;
    setBusy(true);
    try{
      const value=message??feedback[teamId]??recordMap(data.teams.find((t:any)=>t.id===teamId)?.records||[]).teacherFeedback??'';
      await api('feedback',{classId:selected,teamId,value});
      setFeedback(currentDrafts=>{const next={...currentDrafts};delete next[teamId];return next;});
      await loadClass(selected,true);
      notify('모둠 피드백을 저장했어요.');
      return true;
    }catch(e:any){notify(e.message||'피드백을 저장하지 못했어요.');return false;}
    finally{setBusy(false);}
  }

  const coaching=useMemo(()=>{
    if(!data)return [];
    const items:any[]=[];
    function add(item:any,values:Record<string,string>){
      const [activity,key]=coachFields[item.kind];
      let quote=values[key]||'';
      if(key==='comparison')quote=comparisonText(quote);
      if(key==='evidenceRef')quote=evidenceName(quote);
      items.push({...item,activity,quote});
    }
    for(const t of data.teams||[]){
      const v=recordMap(t.records||[]);
      const target=t.label;
      const hasWork=(t.records||[]).some((r:Row)=>r.key!=='teacherFeedback'&&r.value.trim());
      if(!hasWork)continue;

      if(v.comparison&&!v.fact) add({priority:1,target,kind:'근거 확인',issue:'비교할 탐사는 골랐지만 자료 근거가 아직 없어요.',prompt:'두 탐사의 같은 항목에서 어떤 문장을 근거로 가져왔어?',resource:'선택한 두 탐사 카드의 계획한 방식, 실제 결과, 주요 활동'},v);
      if(v.fact&&!v.change) add({priority:1,target,kind:'비교 설명',issue:'자료 근거는 찾았지만 변화 설명이 아직 없어요.',prompt:'두 근거를 나란히 놓으면 무엇이 달라 보여?',resource:'두 탐사 비교 화면'},v);
      if(v.change&&!v.claimReason) add({priority:1,target,kind:'근거 연결',issue:'변화는 설명했지만 왜 그렇게 판단했는지가 비어 있어요.',prompt:'앞에서 찾은 어떤 근거가 방금 말한 변화를 보여 줘?',resource:'두 탐사의 근거 기록'},v);
      if(v.gapStatement&&!v.gap) add({priority:2,target,kind:'질문 만들기',issue:'자료의 한계는 찾았지만 추가 질문으로 이어지지 않았어요.',prompt:'그 자료에 없는 내용을 알아보려면 무엇을 질문해야 할까?',resource:'자료의 한계와 추가 질문 칸'},v);
      if(v.claim1&&!v.check1) add({priority:0,target,kind:'AI 문장 확인',issue:'AI 문장은 옮겼지만 처음 탐사 자료에서 확인한 기록이 없어요.',prompt:'AI 문장과 우리 문장을 처음 탐사 자료의 어느 부분에서 확인할 수 있어?',resource:'처음 비교한 두 탐사 자료'},v);
      if(v.check1&&!v.decision1) add({priority:0,target,kind:'AI 비교 마무리',issue:'원자료 확인 칸에 작성한 내용이 있어요. 어디까지 썼는지 확인해 주세요.',prompt:'처음 탐사 자료를 확인하고 나니 우리 문장은 그대로 둘까, 고칠까? 왜?',resource:'우리 문장, AI 문장, 처음 탐사 자료'},v);
      if(v.destination&&!v.selectionReason) add({priority:1,target,kind:'탐사지 선택',issue:'탐사지는 골랐지만 앞에서 만든 질문과 선택 이유가 연결되지 않았어요.',prompt:'우리가 만든 추가 질문을 알아보는 데 왜 이 탐사지가 적절할까?',resource:'추가 질문과 탐사지 후보'},v);
      if(v.evidenceRef&&!v.meaning) add({priority:1,target,kind:'의의 해석',issue:'의의와 영향 카드는 골랐지만 사실의 의미가 아직 설명되지 않았어요.',prompt:'이 카드의 사실이 왜 우주 탐사의 가치나 영향이라고 볼 수 있을까?',resource:evidenceName(v.evidenceRef)},v);
      if(v.change&&/(항상|모두|전부|무조건|전체 우주|우주 탐사는 점점|갈수록)/.test(v.change)) add({priority:0,target,kind:'과도한 일반화',issue:'두 사례를 넘어 전체 우주 탐사로 넓혀 말했을 가능성이 있어요.',prompt:'우리가 본 두 사례만으로 어디까지 말할 수 있을까?',resource:'두 탐사 사례의 범위'},v);
      if(v.gapStatement&&/(인류.*모른|아무도.*모른|아직.*알려지지)/.test(v.gapStatement)) add({priority:0,target,kind:'자료 범위',issue:'자료에 없는 내용을 인류가 모르는 사실로 단정했을 가능성이 있어요.',prompt:'이 자료에 없다는 것과 인류가 아직 모른다는 것은 같은 뜻일까?',resource:'수업용 자료의 범위 안내'},v);
      if(v.question&&(!v.data||!v.method)) add({priority:1,target,kind:'미션 초안',issue:'미션 질문은 정했지만 얻을 자료나 방법이 아직 비어 있어요.',prompt:'이 질문에 답하려면 무엇을 직접 관찰하거나 측정해야 할까?',resource:'미션 질문, 얻을 자료, 자료를 얻는 방법'},v);
      if(v.claim2&&!v.verifySource) add({priority:0,target,kind:'AI 확인 문장',issue:'AI에서 확인할 문장은 골랐지만 자료와 비교한 기록이 아직 없어요.',prompt:'이 AI 문장을 우리가 읽은 자료의 어느 부분과 직접 비교할 수 있을까?',resource:'추가 자료와 AI에서 고른 문장'},v);
      if(v.verdict&&!v.revision) add({priority:1,target,kind:'2차시 계획 반영',issue:'자료와 비교한 판정은 있지만 계획에 무엇을 반영했는지가 비어 있어요.',prompt:'이 판정 때문에 우리 방법을 그대로 둘까, 무엇을 고칠까?',resource:'판정과 미션 초안'},v);
      if(v.env1&&v.envInfo1&&!v.envSource1) add({priority:1,target,kind:'환경 출처',issue:'환경 정보는 적었지만 어디에서 확인했는지가 비어 있어요.',prompt:'이 환경 정보는 어느 기관이나 자료에서 확인했어?',resource:'환경 조건 1과 확인한 자료'},v);
    }

    const classHasConcluding=(data.teams||[]).some((t:any)=>{const v=recordMap(t.records||[]);return !!(v.destination||v.evidenceRef||v.meaning);});
    if(classHasConcluding){
      for(const st of data.students||[]){
        const v=recordMap(st.records||[]);
        if(v.first&&!v.conclusion) add({priority:2,target:st.number+'번',kind:'개인 결론',issue:'첫 생각은 남겼지만 1차시 개인 결론이 아직 없어요.',prompt:'처음 생각과 비교해서, 지금은 어떤 자료 때문에 생각이 달라졌거나 더 분명해졌어?',resource:'의의와 영향 카드, 처음 생각'},v);
        if(v.conclusion&&v.conclusion.trim().length<18) add({priority:2,target:st.number+'번',kind:'개인 결론 보완',issue:'개인 결론이 매우 짧아 근거가 드러나지 않을 수 있어요.',prompt:'어느 자료의 어떤 사실이 네 결론을 뒷받침해?',resource:'선택한 의의와 영향 카드'},v);
      }
    }
    return items.sort((a,b)=>a.priority-b.priority||String(a.target).localeCompare(String(b.target),'ko'));
  },[data]);

  const summary=useMemo(()=>{
    if(!data)return {students:0,studentsStarted:0,teamsStarted:0,personal:0,group:0};
    const studentsStarted=data.students.filter((s:any)=>s.records?.some((r:Row)=>r.value.trim())).length;
    const teamsStarted=data.teams.filter((t:any)=>t.records?.some((r:Row)=>r.key!=='teacherFeedback'&&r.value.trim())).length;
    return {
      students:data.students.length,
      studentsStarted,
      teamsStarted,
      personal:data.students.reduce((n:number,s:any)=>n+(s.records?.filter((r:Row)=>r.value.trim()).length||0),0),
      group:data.teams.reduce((n:number,t:any)=>n+(t.records?.filter((r:Row)=>r.key!=='teacherFeedback'&&r.value.trim()).length||0),0)
    };
  },[data]);

  if(!loggedIn)return <main className="teacher-page teacher-login-page">
    <div className="teacher-login-card">
      <p className="eyebrow">교사 전용</p>
      <h1>SPACE 수업 기록 대시보드</h1>
      <p className="muted">연구 대상 4·6반과 일반 수업 5·7·8·9·10반의 기록을 확인합니다.</p>
      <form onSubmit={login}>
        <label>교사용 코드
          <input value={teacherCode} onChange={e=>setTeacherCode(e.target.value.toUpperCase())} maxLength={8} autoComplete="off" spellCheck={false} placeholder="8자리 코드"/>
        </label>
        <button className="primary wide" disabled={busy||teacherCode.length!==8}>{busy?'확인 중':'교사 공간 들어가기'}</button>
      </form>
      {loginError&&<p className="space-join-error" role="alert">{loginError}</p>}
      <p className="hint">학생에게 교사용 코드를 공유하지 마세요.</p>
    </div>
  </main>;

  return <main className="teacher-page board-page">
    <div className="section-heading">
      <div><p className="eyebrow">교사 전용</p><h1>수업 중 모둠 보기</h1></div>
      <div className="button-row">
        <button className="secondary" onClick={onStudentPreview}><ExternalLink size={16}/> 학생 화면 그대로 보기</button>
        <button className="secondary" disabled={busy} onClick={()=>void loadClass()}><RefreshCw size={16}/> 지금 갱신</button>
        <button className="secondary" onClick={()=>void logout()}><LogOut size={16}/> 나가기</button>
      </div>
    </div>

    <div className="board-navigation"><div className="teacher-class-tabs">
      {classes.map(c=><button key={c.id} className={selected===c.id?'active':''} aria-pressed={selected===c.id} onClick={()=>chooseClass(c.id)}>{c.name}</button>)}
    </div>

      <div className="pill-tabs">
        <button className={tab==='live'?'active':''} onClick={()=>{setJump(null);setTab('live');}}>수업 중 보기</button>
        <button className={tab==='coaching'?'active':''} onClick={()=>setTab('coaching')}>교사용 코칭 {coaching.length?coaching.length:''}</button>
        <button className={tab==='teams'?'active':''} onClick={()=>setTab('teams')}><Users size={16}/> 모둠 기록</button>
        <button className={tab==='students'?'active':''} onClick={()=>setTab('students')}><UserRound size={16}/> 개인 기록</button>
      </div>

    </div>
    {!data&&<p role="status">학급 기록을 불러오는 중입니다.</p>}
    {data&&<>
      {tab==='live'&&<ClassBoard key={selected} data={data} classId={selected} coaching={coaching} send={saveFeedback} jump={jump}/>}
      {tab==='coaching'&&<section className="teacher-coaching">
        <div className="teacher-coaching-head">
          <div><h2>지금 피드백하면 좋은 기록</h2><p className="muted">학생 답을 자동 채점하지 않고, 현재 기록에서 교사가 확인하면 좋은 지점만 모아 보여 줍니다.</p></div>
          <span>{coaching.length}건</span>
        </div>
        {coaching.length?<div className="coaching-list">{coaching.map((item:any,index:number)=><article className={'coaching-card priority-'+item.priority} key={item.target+'-'+item.kind+'-'+index}>
          <div className="coaching-card-top"><b>{item.target}</b><span>{item.kind}</span></div>
          {item.quote&&<blockquote className="coaching-quote">{item.quote}</blockquote>}
          <p className="coaching-issue">{item.issue}</p>
          <dl><dt>추천 발문</dt><dd>{item.prompt}</dd><dt>볼 자료</dt><dd>{item.resource}</dd></dl>
          {data.teams.some((t:any)=>t.label===item.target)&&<div className="board-actions"><button className="board-send" onClick={()=>{setJump({activity:item.activity,team:item.target,prompt:item.prompt});setTab('live');}}>질문 편집해서 보내기</button></div>}
        </article>)}</div>:<div className="notice">현재 기록에서 바로 개입이 필요한 항목을 찾지 못했어요. 모둠 기록과 개인 기록 탭에서 학생 답을 직접 확인할 수 있어요.</div>}
      </section>}

      {tab==='teams'&&<section className="teacher-record-list">
        {data.teams.map((t:any)=>{
          const values=recordMap(t.records);
          const written=t.records.filter((r:Row)=>r.key!=='teacherFeedback'&&r.value.trim()).length;
          return <details className="teacher-team" key={t.id}>
            <summary>
              <Users size={18}/>
              <b>{t.label}</b>
              <span>학생 {t.members.join(', ')}번 / 기록 {written}개</span>
              <ChevronDown size={16}/>
            </summary>
            <div className="teacher-team-body">
              <Proposal rows={t.records} label={(current?.name||'')+' '+t.label}/>
              <details className="reading-card">
                <summary>탐구 과정 기록 전체 보기<ChevronDown size={16}/></summary>
                <div><RecordList rows={t.records.filter((r:Row)=>!proposalKeys.includes(r.key)&&r.key!=='teacherFeedback')} contextRows={t.records}/></div>
              </details>
              <label className="feedback-label">선생님 피드백
                <textarea rows={3} maxLength={3000} value={feedback[t.id]??values.teacherFeedback??''} onChange={e=>setFeedback({...feedback,[t.id]:e.target.value})} placeholder="학생 화면 상단에 보여 줄 피드백을 적으세요."/>
              </label>
              <button className="secondary" disabled={busy} onClick={()=>void saveFeedback(t.id)}>피드백 저장</button>
            </div>
          </details>;
        })}
      </section>}

      {tab==='students'&&<section className="teacher-record-list">
        {data.students.map((s:any)=>{
          const team=data.teams.find((t:any)=>t.id===s.team_id);
          const written=s.records.filter((r:Row)=>r.value.trim()).length;
          return <details className="teacher-team" key={s.id}>
            <summary>
              <UserRound size={18}/>
              <b>{s.number}번</b>
              <span>{team?.label||''} / 개인 기록 {written}개</span>
              <ChevronDown size={16}/>
            </summary>
            <div className="teacher-team-body">
              {written?<RecordList rows={s.records}/>:<p className="empty">아직 개인 기록을 작성하지 않았어요.</p>}
            </div>
          </details>;
        })}
      </section>}
      <details className="board-tools"><summary>학급 통계와 전체 기록 내려받기</summary>
      <section className="teacher-summary-grid">
        <div><small>학생</small><strong>{summary.students}명</strong></div>
        <div><small>개인 기록 시작</small><strong>{summary.studentsStarted}명</strong></div>
        <div><small>모둠 기록 시작</small><strong>{summary.teamsStarted}개 조</strong></div>
        <div><small>저장된 기록</small><strong>{summary.personal+summary.group}개</strong></div>
      </section>

      <div className="button-row teacher-data-actions">
        <button className="secondary" onClick={()=>download('SPACE_'+(current?.name||selected)+'_전체기록.json',JSON.stringify({exported:new Date().toISOString(),classroom:current,teams:data.teams,students:data.students},null,2))}><Download size={15}/> 전체 기록 내려받기</button>
        <span className="hint">화면이 열려 있으면 약 15초마다 새 기록을 다시 확인해요.</span>
      </div>

      </details>
    </>}
  </main>;
}
