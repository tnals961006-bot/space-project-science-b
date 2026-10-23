'use client';
import React,{useEffect,useRef,useState,useCallback} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,ChevronDown,Clock3,Copy,Download,FileText,GraduationCap,LayoutGrid,LogOut,Orbit,Presentation,RefreshCw,Save,Search,Type,UserRound,Users,WifiOff,X} from 'lucide-react';
import Landing from './landing';
import Teacher from './teacher';
import {api,getBackendUrl,hasStudentSession,clearStudentSession,isLocalReviewOnly} from '../lib/classroom-client';
import {allFields,stages,phaseNames,proposalKeys,FieldDef} from './course';
import {aiCards,buildAiPrompt,peerFallback,storyTransition} from './teaching-content';
import {ClassroomState,Row,Snapshot,Field,Proposal,RecordList,Readback,InquiryTrail,SaveField,recordMap,pendingDrafts,readDraft,finishDraft,download,clean} from './record-ui';
import {ApolloReading,CriteriaCards,DataExplorer,DestinationCards,EvidenceCards,FullMaterials,PresentationGuide,ReviewGuide,VerificationGuide} from './resource-ui';

type Mode='home'|'student'|'demo'|'teacher'|'review'|'materials';
const REVIEW_STORAGE='SPACE_CLASSROOM_REVIEW_V2';
const emptyReview=():ClassroomState=>({student:{id:'review',number:1,teamId:'review-team',classId:'review-class',className:'수업 내용 체험',teamLabel:'체험 모둠'},group:[],personal:[],snapshots:[],published:false});
const label=(key:string)=>clean(allFields.find(f=>f.key===key)?.label||key);
const requiredByLesson=[['factRef','fact','gap','destination','evidenceRef','conclusion'],['additionalRef','additionalFact','task','question','data','method','claim2','verifySource','verdict','reason','decision','revision','env1','envInfo1','envSource1','envResponse1','env2','envInfo2','envSource2','envResponse2','myVerdict'],['expectation','limitation','critiqueReason','recommendReason','reflection']];

function Brand(){return <div className="brand"><span className="brand-mark"><Orbit size={24}/></span><span>SPACE<span className="brand-sub">프로젝트</span></span></div>;}
function loadReview():ClassroomState {
  try{const s=JSON.parse(localStorage.getItem(REVIEW_STORAGE)||'null');if(!s||s.student?.id!=='review')return emptyReview();
    const validRows=(rows:unknown,personal:boolean)=>Array.isArray(rows)?rows.filter(r=>r&&typeof r.key==='string'&&typeof r.value==='string'&&r.value.length<=3000&&Number.isInteger(r.rev)&&allFields.some(f=>f.key===r.key&&!!f.personal===personal)):[];
    return {...emptyReview(),group:validRows(s.group,false),personal:validRows(s.personal,true),snapshots:Array.isArray(s.snapshots)?s.snapshots.filter((n:any)=>typeof n.id==='string'&&typeof n.body==='string').slice(0,20):[],published:!!s.published};
  }catch{return emptyReview();}
}

export default function App(){
  const [mode,setMode]=useState<Mode>('home'),[state,setState]=useState<ClassroomState|null>(null),[code,setCode]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[joinError,setJoinError]=useState('');
  const [stage,setStage]=useState(0),[step,setStep]=useState(0),[panel,setPanel]=useState('lesson'),[online,setOnline]=useState(true),[full,setFull]=useState(false),[large,setLarge]=useState(false),[welcome,setWelcome]=useState(''),[authError,setAuthError]=useState('');
  const [gallery,setGallery]=useState<any[]>([]),[snapView,setSnapView]=useState<Snapshot|null>(null),[prior,setPrior]=useState<Snapshot|null>(null),[pendingVersion,setPendingVersion]=useState(0),[lastSync,setLastSync]=useState('');
  const stateRef=useRef<ClassroomState|null>(null),modeRef=useRef<Mode>('home'),booted=useRef(false),contextGen=useRef(0),inflight=useRef(new Map<string,{value:string;promise:Promise<Row>}>());
  const notify=useCallback((s:string)=>setNotice(s),[]);
  function changeMode(next:Mode){if(modeRef.current!==next)contextGen.current++;modeRef.current=next;setMode(next);}
  function updateState(next:ClassroomState|null,persist=modeRef.current==='demo'){
    if(next&&persist)localStorage.setItem(REVIEW_STORAGE,JSON.stringify(next));
    stateRef.current=next;setState(next);
  }
  function acceptState(next:ClassroomState){const previous=stateRef.current;
    if(previous&&previous.student.id===next.student.id&&previous.student.teamId!==next.student.teamId){setPrior(null);setSnapView(null);notify('모둠이 바뀌었어요. 새 모둠 기록을 불러왔고, 이전 모둠의 저장 전 입력은 따로 보관했어요.');}
    if(previous?.student.id===next.student.id){
      const merge=(incoming:Row[],local:Row[])=>incoming.map(r=>{const p=local.find(x=>x.key===r.key);return p&&p.rev>r.rev?p:r;}).concat(local.filter(p=>!incoming.some(r=>r.key===p.key)));
      next={...next,personal:merge(next.personal,previous.personal),group:previous.student.teamId===next.student.teamId?merge(next.group,previous.group):next.group};
    }
    updateState(next,false);setLastSync(new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}));
  }
  function handleError(e:any){if(e.status===401&&modeRef.current==='student'){setAuthError('접속 시간이 끝났거나 입장권이 바뀌었어요. 입력은 이 기기에 남겨 두었어요. 개인 입장권으로 다시 들어오세요.');clearStudentSession();}
    if(e.code==='TEAM_CHANGED'&&modeRef.current==='student'){const ctx=contextGen.current;void api('state').then(s=>{if(ctx===contextGen.current&&modeRef.current==='student')acceptState(s);}).catch(()=>{});}if(e.code==='CLASS_CLOSED'&&modeRef.current==='student'){const s=stateRef.current;if(s)updateState({...s,student:{...s.student,closed:true}},false);}notify(e.message||'연결을 확인해 주세요.');}
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),8000);return()=>clearTimeout(t);},[notice]);
  useEffect(()=>{
    if(booted.current)return;booted.current=true;setOnline(navigator.onLine);
    try{setLarge(localStorage.getItem('SPACE_LARGE_TEXT')==='true');}catch{}
    const params=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.replace(/^#/,'')),ticket=hash.get('ticket');
    if(ticket){history.replaceState(null,'',location.pathname+location.search);setCode(ticket);void join(ticket);}
    else if(params.get('teacher')==='1')void openTeacher();
    else if(params.get('review')==='1')startReview(Math.min(2,Math.max(0,Number(params.get('lesson')||1)-1)));
    else if(!isLocalReviewOnly()&&hasStudentSession()){const ctx=contextGen.current;void api('state').then(s=>{if(ctx!==contextGen.current||modeRef.current!=='home')return;acceptState(s);setWelcome(`${s.student.className} ${s.student.number}번으로 이어 쓰기`);}).catch(()=>{});}
    const yes=()=>setOnline(true),no=()=>setOnline(false);
    const warn=(e:BeforeUnloadEvent)=>{const s=stateRef.current;if(s&&pendingDrafts(s.student.id).length){e.preventDefault();e.returnValue='';}};
    window.addEventListener('online',yes);window.addEventListener('offline',no);window.addEventListener('beforeunload',warn);
    return()=>{window.removeEventListener('online',yes);window.removeEventListener('offline',no);window.removeEventListener('beforeunload',warn);};
  },[]);
  useEffect(()=>{if(mode!=='student'||authError)return;let active=true;const studentId=stateRef.current?.student.id;const timer=setInterval(()=>{if(document.visibilityState!=='visible')return;void api('state').then(s=>{if(active&&stateRef.current?.student.id===studentId)acceptState(s);}).catch(e=>{if(active&&e.status===401)handleError(e);});},15000);return()=>{active=false;clearInterval(timer);};},[mode,authError,state?.student.id]);

  async function join(value=code){
    if(isLocalReviewOnly()){setJoinError('이 파일은 수업 내용 체험용이에요. 실제 입장권은 교사가 제공한 수업 사이트에서 사용하세요.');return;}
    setBusy(true);setJoinError('');const ctx=++contextGen.current;try{const s=await api('join',{code:value});if(ctx!==contextGen.current)return;acceptState(s);setAuthError('');changeMode('student');setCode('');setWelcome('');setPanel('lesson');notify('입장했어요. 모둠 기록과 나의 기록을 구분해서 작성하세요.');}
    catch(e:any){if(ctx===contextGen.current){setJoinError(e.message);notify(e.message);}}finally{if(ctx===contextGen.current||modeRef.current==='student')setBusy(false);}
  }
  function startReview(lesson=0){
    const review=loadReview();changeMode('demo');updateState(review,false);setStage(lesson);setStep(0);setPanel('lesson');setFull(false);setAuthError('');setPrior(null);setSnapView(null);setGallery([]);setWelcome('');window.scrollTo({top:0});
  }
  async function openTeacher(){
    if(isLocalReviewOnly()){notify('이 파일은 수업 내용 체험용이에요. 학급 관리는 저장 서버가 연결된 수업 사이트에서 열 수 있어요.');return;}
    const backend=getBackendUrl();if(backend&&backend!==location.origin){location.assign(backend+'/?teacher=1');return;}changeMode('teacher');
  }
  const save:SaveField=async(def,value,rev,expectedTeamId)=>{
    const s=stateRef.current;if(!s)throw new Error('기록을 먼저 열어 주세요.');
    const requestMode=modeRef.current,ctx=contextGen.current;const identity=s.student.id,scope=def.personal?'personal':expectedTeamId,key=identity+':'+scope+':'+def.key;
    const existing=inflight.current.get(key);if(existing){if(existing.value===value)return existing.promise;await existing.promise;throw new Error('앞의 입력을 저장했어요. 새 입력의 저장을 한 번 더 눌러 주세요.');}
    const promise=(async()=>{
      let row:Row;
      if(modeRef.current==='demo'){
        const current=stateRef.current!;const rows=def.personal?current.personal:current.group;const latest=rows.find(r=>r.key===def.key);
        if((latest?.rev||0)!==rev)throw Object.assign(new Error('다른 곳에서 먼저 수정했어요. 내용을 비교해 주세요.'),{status:409,conflict:true,current:latest||{key:def.key,value:'',rev:0}});
        row={key:def.key,value,rev:rev+1,updated:new Date().toISOString(),actor:'체험'};
      }else{try{row=await api('save',{key:def.key,value,rev,personal:!!def.personal,expectedTeamId});}catch(e:any){if(ctx===contextGen.current)handleError(e);throw e;}}
      const now=stateRef.current;if(ctx===contextGen.current&&modeRef.current===requestMode&&now?.student.id===identity&&(def.personal||now.student.teamId===expectedTeamId)){
        const kind=def.personal?'personal':'group';const local=now[kind].find(r=>r.key===def.key);if(!local||local.rev<=row.rev)updateState({...now,[kind]:[...now[kind].filter(r=>r.key!==def.key),row]});
      }
      finishDraft(identity,expectedTeamId,def,value,row);setPendingVersion(x=>x+1);return row;
    })();inflight.current.set(key,{value,promise});try{return await promise;}finally{inflight.current.delete(key);}
  };
  async function flush():Promise<boolean>{
    const ctx=contextGen.current;try{await Promise.all([...inflight.current.values()].map(x=>x.promise));if(ctx!==contextGen.current)return false;const s=stateRef.current;if(!s)return true;
      for(const {cacheKey} of pendingDrafts(s.student.id,s.student.teamId)){
        const live=readDraft(cacheKey);if(!live)continue;const def=allFields.find(f=>f.key===live.key&&!!f.personal===live.personal);if(!def)continue;
        const current=stateRef.current!,row=(def.personal?current.personal:current.group).find(r=>r.key===def.key);
        if(live.value===(row?.value||'')){sessionStorage.removeItem(cacheKey);continue;}
        await save(def,live.value,live.baseRev,live.teamId);if(ctx!==contextGen.current)return false;
      }
      setPendingVersion(x=>x+1);return pendingDrafts(s.student.id,s.student.teamId).length===0;
    }catch(e:any){if(ctx===contextGen.current){handleError(e);setPanel('drafts');setPendingVersion(x=>x+1);}return false;}
  }
  async function snapshot(name:string,quiet=false):Promise<boolean>{
    const ctx=contextGen.current;if(!await flush()||ctx!==contextGen.current)return false;const s=stateRef.current;if(!s)return false;
    try{if(modeRef.current==='demo'){const snap={id:(typeof crypto.randomUUID==='function'?crypto.randomUUID():'review-'+Date.now()+'-'+Math.random().toString(36).slice(2)),label:name,created:new Date().toISOString(),body:JSON.stringify(s.group)};updateState({...s,snapshots:[snap,...s.snapshots].slice(0,20)});}
      else{await api('snapshot',{label:name,expectedTeamId:s.student.teamId});const latest=await api('state');if(ctx!==contextGen.current)return false;acceptState(latest);}
      if(!quiet)notify(name+' 보관본을 남겼어요.');return true;
    }catch(e:any){if(ctx===contextGen.current)handleError(e);return false;}
  }
  async function publish(){
    const ctx=contextGen.current;if(!await flush()||ctx!==contextGen.current)return;const s=stateRef.current;if(!s)return;const values=recordMap(s.group);
    if(!s.published&&!['fact','gap','question','data','method'].every(k=>values[k]?.trim())){notify('확인한 사실, 질문, 얻을 자료, 방법을 먼저 작성해 주세요.');return;}
    try{if(modeRef.current==='demo')updateState({...s,published:!s.published});else{await api('publish',{published:!s.published,expectedTeamId:s.student.teamId});const latest=await api('state');if(ctx!==contextGen.current)return;acceptState(latest);}notify(s.published?'게시를 취소했어요.':'제안서를 학급 갤러리에 게시했어요.');}catch(e:any){if(ctx===contextGen.current)handleError(e);}
  }
  async function getGallery(){const ctx=contextGen.current;try{if(modeRef.current==='demo'){const s=stateRef.current;setGallery(s?.published?[{id:s.student.teamId,label:'체험 모둠',records:s.group.filter(r=>proposalKeys.includes(r.key))}]:[]);}else {const result=await api('gallery');if(ctx===contextGen.current)setGallery(result.teams);}}catch(e:any){if(ctx===contextGen.current)handleError(e);}}
  useEffect(()=>{if(!state||!['student','demo'].includes(mode))return;if(panel==='gallery'||(panel==='lesson'&&stages[stage].steps[step].resource==='gallery'))void getGallery();},[panel,stage,step,state?.published,mode]);
  async function readSnapshot(s:Snapshot){const ctx=contextGen.current,teamId=stateRef.current?.student.teamId;try{const complete=s.body?s:await api('action=snapshot&id='+encodeURIComponent(s.id));if(ctx===contextGen.current&&teamId===stateRef.current?.student.teamId)setSnapView(complete);}catch(e:any){if(ctx===contextGen.current)handleError(e);}}
  useEffect(()=>{setPrior(null);if(stage!==2||!state)return;const s=state.snapshots.find(n=>n.label==='2차시 AI 사용 전')||state.snapshots.find(n=>n.label==='2차시 끝');if(!s)return;let active=true;(s.body?Promise.resolve(s):api('action=snapshot&id='+encodeURIComponent(s.id))).then(n=>{if(active)setPrior(n);}).catch(()=>{});return()=>{active=false;};},[stage,mode,state?.student.teamId,state?.snapshots.length]);
  const canReadWithoutSave=()=>!!stateRef.current?.student.closed||!!authError||(!online&&modeRef.current==='student');
  async function navigate(lesson:number,activity=0){if(!await flush()&&!canReadWithoutSave())return;setStage(lesson);setStep(activity);setPanel('lesson');window.scrollTo({top:0,behavior:'smooth'});}
  async function openPanel(next:string){if(!await flush()&&!canReadWithoutSave())return;setPanel(next);window.scrollTo({top:0,behavior:'smooth'});}
  async function goHome(){if(!await flush()&&!canReadWithoutSave())return;changeMode('home');setFull(false);if(mode==='student'&&state)setWelcome(`${state.student.className} ${state.student.number}번으로 이어 쓰기`);}
  async function leave(){if(!await flush()&&!confirm('저장 전 입력을 이 기기에 보관하고 나갈까요? 같은 입장권으로 다시 들어오면 확인할 수 있어요.'))return;if(modeRef.current==='student')await api('logout',{}).catch(()=>{});changeMode('home');updateState(null,false);setWelcome('');setAuthError('');setFull(false);}
  async function beginPresentation(){if(await flush())setFull(true);}
  async function copy(text:string){try{await navigator.clipboard.writeText(text);notify('복사했어요. 선생님이 안내한 곳에 붙여 넣으세요.');}catch{download('SPACE_질문.txt',text,'text/plain');notify('질문 파일을 내려받았어요.');}}
  async function copyAi(level:number){const name=level===1?'1차시 검토 전':level===2?'2차시 AI 사용 전':null;if(name?!await snapshot(name,true):!await flush())return;await copy(buildAiPrompt(level,recordMap(stateRef.current!.group)));}
  function fields(definitions:FieldDef[]){if(!state)return null;const visible=definitions.filter(d=>d.key!=='otherDestination'||recordMap(state.group).destination==='다른 탐사지');return visible.map(d=><React.Fragment key={state.student.id+':'+(d.personal?'personal':state.student.teamId)+':'+d.key}>{d.section&&<h3 className="field-section">{d.section}</h3>}<Field def={d} row={(d.personal?state.personal:state.group).find(r=>r.key===d.key)} student={state.student} save={save} disabled={!!state.student.closed||!!authError}/></React.Fragment>);}
  const fieldsByKeys=(keys:string[])=>fields(keys.map(k=>allFields.find(f=>f.key===k)).filter((f):f is FieldDef=>!!f));
  const values=recordMap(state?.group),personal=recordMap(state?.personal),current=stages[stage].steps[step];
  const drafts=state?pendingDrafts(state.student.id):[];

  function planEditor(includeEnvironment=false) {return <section className="plan-editor"><h3>기존 제안서에서 직접 고치세요.</h3><p className="hint">검증한 내용과 연결되는 항목만 열어 고치세요. 바꾸지 않았다면 그 이유를 남기세요.</p><details className="reading-card"><summary>질문과 탐사 방법</summary>{fieldsByKeys(['destination','otherDestination','selectionReason','question','goal','target','data','method','difficulty','technology','response'])}</details>{includeEnvironment&&<details className="reading-card"><summary>2차시에 시작한 환경 조사표</summary><p className="hint">탐사지를 바꿨다면 환경의 값과 조건, 출처가 새 탐사지에도 맞는지 확인하세요.</p>{fieldsByKeys(['env1','envInfo1','envSource1','envResponse1','env2','envInfo2','envSource2','envResponse2'])}</details>}</section>;}
  function aiBox(level:number){
    const card=aiCards[level-1],peer=peerFallback.entries[level-1],ready=level===1?['change','fact','gap','selectedClaim'].every(k=>values[k]?.trim()):['question','data','method'].every(k=>values[k]?.trim());
    return <div className="ai-box"><span className="eyebrow">AI 또는 동료 검토</span><h2>{card.title}</h2><p>우리 생각을 먼저 쓰고 검토를 받으세요. 답변에서 중요한 주장이나 질문 하나를 골라 자료와 비교해요.</p><div className="prompt-card"><b>질문에 포함할 내용</b><p>{level===1?'우리와 같은 탐사 사례 24개':level===2?'우리 모둠의 초안과 선택한 탐사지의 확인 자료':'현재 제안서, 환경 조사표, 검증 기록'}</p><p className="hint">개인의 첫 생각과 성찰은 복사하지 않아요. 직접 쓴 탐사 기록에도 이름과 학번을 넣지 마세요.</p><button className="primary" disabled={!ready||busy||!!authError||!!state?.student.closed} onClick={()=>void copyAi(level)}><Copy size={16}/>{level<3?'보관하고 질문 복사':'질문 복사'}</button>{!ready&&<p className="hint">먼저 {level===1?'우리 주장과 근거, 더 알아볼 질문':'미션 질문과 얻을 자료, 방법'}을 저장하세요.</p>}<details><summary>보낼 질문 전체 확인</summary><pre className="prompt-preview">{buildAiPrompt(level,values)}</pre></details></div>{level<3&&<button className="secondary wide" disabled={!ready||!!authError||!!state?.student.closed} onClick={()=>void snapshot(level===1?'1차시 검토 전':'2차시 AI 사용 전')}><Save size={16}/> 동료와 검토하기 전에도 초안 보관</button>}<p className="notice">이곳에서 AI 답변을 자동 생성하지 않아요. 학교에서 허용한 AI를 사용하고 실제로 받은 내용을 기록하세요.</p><details className="reading-card" open><summary>AI 접속이 어려우면 동료와 검토하세요.</summary><ol>{peer.instructions.map(t=><li key={t}>{t}</li>)}</ol>{peer.questions.map(q=><blockquote key={q}>{q}</blockquote>)}</details>{level===3&&<><CriteriaCards/>{planEditor(true)}</>}</div>;
  }
  function galleryUI(){return <div><div className="section-heading"><h2>우리 반 탐사 제안서</h2><button className="secondary" onClick={()=>void getGallery()}><RefreshCw size={16}/> 새로고침</button></div><p className="muted">같은 학급에 게시한 제안서만 보여요. 개인 기록은 보이지 않아요.</p>{mode==='demo'&&<p className="notice">체험에서는 내가 게시한 체험 제안서만 보여요. 실제 학급에 입장하면 다른 모둠의 게시물도 읽을 수 있어요.</p>}{gallery.length?gallery.map(t=><details className="gallery-item" key={t.id}><summary><b>{t.label} / {recordMap(t.records).missionName||'탐사 미션'}</b><ChevronDown size={16}/></summary><Proposal rows={t.records} label={t.label}/></details>):<p className="empty">아직 게시한 제안서가 없어요. 발표할 때 모둠 제안서를 게시하세요.</p>}<CriteriaCards/></div>;}
  function resource(){
    if(current.resource==='data')return <DataExplorer notify={notify}/>;
    if(current.resource==='evidence')return <EvidenceCards/>;
    if(current.resource==='apollo')return <ApolloReading/>;
    if(current.resource.startsWith('ai'))return aiBox(Number(current.resource.slice(-1)));
    if(stage===1&&step===1)return <><InquiryTrail rows={state!.group}/><DestinationCards selected={values.destination}/></>;
    if(stage===1&&step===3)return <><Readback title="검증할 주장" value={values.claim2}/><VerificationGuide/><DestinationCards selected={values.destination} environmentOnly/></>;
    if(stage===1&&step===4)return <><Readback title="검증한 주장과 판정" value={[values.claim2,values.verdict,values.reason].filter(Boolean).join('\n')}/>{planEditor()}<DestinationCards selected={values.destination} environmentOnly/></>;
    if(current.resource==='previous')return <><InquiryTrail rows={state!.group}/><Readback title="1차시에서 고른 탐사지와 이유" value={[values.destination==='다른 탐사지'?values.otherDestination:values.destination,values.selectionReason].filter(Boolean).join('\n')}/><p className="notice">오늘은 질문 입력, 자료 확인, 기록 역할을 나누세요. 판단은 함께 해요.</p></>;
    if(current.resource==='summary2')return <><h2>내가 한 판단을 남기세요.</h2><p>모둠 답을 전부 옮겨 쓰지 않아도 돼요. 내가 확인한 근거와 판단, 계획에 보탠 의견을 짧게 쓰세요.</p><Readback title="모둠이 검증한 주장" value={values.claim2}/><Readback title="판정과 근거" value={[values.verifySource,values.verdict,values.reason].filter(Boolean).join('\n')}/><Readback title="계획에 반영한 점" value={values.revision}/></>;
    if(current.resource==='proposal')return <><CriteriaCards/>{prior?<details className="reading-card" open><summary>{prior.label}에서 남긴 초안</summary><div className="compare-grid"><div><h3>처음 초안</h3>{['question','data','method','difficulty','technology'].map(k=><Readback key={k} title={label(k)} value={recordMap(JSON.parse(prior.body||'[]'))[k]}/>)}</div><div><h3>검증 후 현재 계획</h3>{['claim2','verifySource','verdict','reason','revision'].map(k=><Readback key={k} title={label(k)} value={values[k]}/>)}</div></div></details>:<p className="notice">2차시 보관본이 아직 없어요. 현재 제안서와 검증 기록을 함께 읽으세요.</p>}<Proposal rows={state!.group}/></>;
    if(current.resource==='editProposal')return <><CriteriaCards/>{planEditor(true)}<details className="reading-card"><summary>탐사지 자료 다시 보기</summary><DestinationCards selected={values.destination}/></details></>;
    if(current.resource==='present')return <><PresentationGuide/><div className="button-row"><button className="primary" onClick={()=>void beginPresentation()}><Presentation size={16}/> 제안서로 발표</button><button className="secondary" onClick={()=>void publish()}>{state?.published?'갤러리 게시 취소':'학급 갤러리에 게시'}</button></div><Proposal rows={state!.group}/><details className="reading-card"><summary>발표 후 제안서 수정</summary>{fieldsByKeys(proposalKeys.filter(k=>!['envReview1','envReview2'].includes(k)))}</details></>;
    if(current.resource==='gallery')return galleryUI();
    if(current.resource==='reflection')return <><Readback title="자료를 읽기 전 나의 첫 생각" value={personal.first}/><Readback title="1차시 자료를 읽고 내린 결론" value={personal.conclusion}/><details className="next-story"><summary>마지막 1분, 다음 탐사 열기</summary><small>{storyTransition.badge}</small><h2>{storyTransition.title}</h2><p>{storyTransition.introduction}</p>{storyTransition.scenes.map(s=><p key={s.title}><b>{s.title}</b><br/>{s.text}</p>)}<blockquote>{storyTransition.openingQuestion}</blockquote><p className="notice">{storyTransition.environmentBoundary}</p><p>{storyTransition.nextLesson}</p></details></>;
    return <div className="intro-resource"><span className="eyebrow">세 차시의 탐사 여정</span><h2>기록에서 질문을,<br/>질문에서 탐사를.</h2><p>과거의 탐사 자료를 읽고, 우리 모둠이 더 알아볼 질문을 정해요. 그 질문에 답할 탐사 방법을 설계하고 근거를 확인해요.</p><ol className="intro-journey">{stages.map((s,i)=><li key={i}><b>{i+1}차시 / {s.short}</b><p>{s.subtitle}</p></li>)}</ol><div className="notice"><b>함께 기록하는 방법</b><p>모둠 기록은 같은 모둠이 함께 써요. 같은 칸을 한꺼번에 고치기보다 읽기, 자료 확인, 기록 역할을 나누세요. 나의 기록은 각자 작성해요.</p></div></div>;
  }
  function readiness(){const merged={...values,...personal};return <section className="learning-summary"><h3>{stage+1}차시 기록 확인</h3><p className="hint">아래는 작성 여부예요. 내용이 맞는지는 근거와 함께 확인하세요.</p><ul>{requiredByLesson[stage].map(k=><li key={k} className={merged[k]?.trim()?'recorded':'missing'}><span>{merged[k]?.trim()?'기록 있음':'미작성'}</span>{label(k)}</li>)}</ul></section>;}
  function draftsUI(){const local=drafts.filter(d=>d.draft.personal||d.draft.teamId===state!.student.teamId),old=drafts.filter(d=>!d.draft.personal&&d.draft.teamId!==state!.student.teamId);return <><h2>저장 전 입력을 확인하세요.</h2><p>먼저 저장된 내용과 다르면 두 답을 비교하세요. 이전 모둠의 입력은 새 모둠에 자동으로 옮기지 않아요.</p>{local.length?fields(local.map(d=>allFields.find(f=>f.key===d.draft.key)).filter((f):f is FieldDef=>!!f)):<p className="empty">현재 모둠과 나의 기록은 모두 저장했어요.</p>}{old.length>0&&<details className="reading-card" open><summary>이전 모둠에서 남긴 입력 {old.length}개</summary>{old.map(d=><Readback key={d.cacheKey} title={label(d.draft.key)} value={d.draft.value}/>)}<button className="secondary" onClick={()=>download('SPACE_이전모둠_저장전입력.json',JSON.stringify(old.map(x=>x.draft),null,2))}><Download size={15}/> 이전 입력 내려받기</button></details>}<div className="button-row"><button className="primary" disabled={!!state?.student.closed||!!authError} onClick={()=>void flush()}>저장 다시 시도</button><button className="secondary" onClick={()=>download('SPACE_저장전입력.json',JSON.stringify(drafts.map(x=>x.draft),null,2))}><Download size={15}/> 저장 전 입력 내려받기</button><button className="secondary" onClick={()=>void goHome()}>처음 화면</button></div></>;}

  if(full&&state)return <div className={'presentation-mode '+(large?'large-text':'')}><div className="presentation-toolbar"><Brand/><span>{state.student.teamLabel}</span><button className="secondary" onClick={()=>window.print()}>PDF로 저장</button><button className="secondary" onClick={()=>setFull(false)}><X size={16}/> 닫기</button></div><Proposal rows={state.group} label={state.student.teamLabel}/></div>;
  return <div className={'space-app '+(mode==='home'?'home-mode ':'')+(large?'large-text':'')}><header className={'topbar '+(mode==='home'?'space-topbar':'')}><button className="brand-button" aria-label="처음 화면" onClick={()=>void goHome()}><Brand/></button><span className="course-label">과학B</span>{mode!=='home'&&<nav><button className="text-btn" aria-pressed={large} onClick={()=>{setLarge(!large);try{localStorage.setItem('SPACE_LARGE_TEXT',String(!large));}catch{}}}><Type size={17}/><span>글자 {large?'기본':'크게'}</span></button>{['student','demo'].includes(mode)&&<button className="text-btn" onClick={()=>void leave()}><LogOut size={16}/><span>{mode==='demo'?'체험 나가기':'로그아웃'}</span></button>}{['review','materials','teacher'].includes(mode)&&<button className="text-btn" onClick={()=>changeMode('home')}>처음으로</button>}</nav>}</header>
    {notice&&<div className="toast" role="status"><span>{notice}</span><button aria-label="알림 닫기" onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {!online&&<div className="offline-banner"><WifiOff size={16}/>인터넷 연결이 끊겼어요. 입력을 유지하고 연결 후 저장하세요.</div>}
    {mode==='home'&&<Landing reviewOnly={typeof window!=='undefined'&&isLocalReviewOnly()} code={code} onCodeChange={setCode} onJoin={()=>void join()} busy={busy} welcome={welcome} onResume={()=>{const ctx=contextGen.current;setBusy(true);void api('state').then(s=>{if(ctx!==contextGen.current)return;acceptState(s);changeMode('student');setAuthError('');setGallery([]);setSnapView(null);}).catch(e=>{setWelcome('');setJoinError(e.message);}).finally(()=>setBusy(false));}} onReview={()=>changeMode('review')} onTeacher={()=>void openTeacher()} onStartReview={startReview} joinError={joinError}/>}
    {mode==='review'&&<ReviewGuide onStart={startReview} onMaterials={()=>changeMode('materials')}/>}
    {mode==='materials'&&<main className="materials-page"><h1>과학B 전체 수업 자료</h1><button className="secondary" onClick={()=>changeMode('review')}>검토 안내로 돌아가기</button><FullMaterials notify={notify}/></main>}
    {mode==='teacher'&&<Teacher notify={notify}/>}
    {(mode==='student'||mode==='demo')&&state&&<>
      <div className={mode==='demo'?'demo-banner':'student-banner'}>{mode==='demo'?<><BookOpen size={17}/><span>수업 내용 체험 / 입력은 이 기기에 저장돼요.</span></>:<><Users size={17}/><span>{state.student.className} / {state.student.number}번 / {state.student.teamLabel}</span></>}<button className="text-btn" onClick={()=>void openPanel('history')}>기록 보관</button></div>
      {authError&&<div className="auth-banner" role="alert"><p>{authError}</p><button className="secondary" onClick={()=>{changeMode('home');setWelcome('');}}>입장권으로 다시 접속</button><button className="secondary" onClick={()=>download('SPACE_저장전입력.json',JSON.stringify(drafts.map(x=>x.draft),null,2))}>입력 내려받기</button></div>}
      {state.student.closed&&<div className="notice">선생님이 작성을 마감했어요. 지금까지의 기록은 읽고 내려받을 수 있어요.</div>}
      <div className="course-tabs">{stages.map((s,i)=><button key={i} className={stage===i?'active':''} onClick={()=>void navigate(i)}><span>{i+1}차시</span><b>{s.short}</b><small>45분</small></button>)}</div>
      <div className="workspace"><aside className="sidebar"><p className="eyebrow">{stage+1}차시 활동</p><ol className="step-list">{stages[stage].steps.map((s,i)=><li key={s.id}><button className={panel==='lesson'&&step===i?'active':''} onClick={()=>void navigate(stage,i)}><span className="step-index">{i+1}</span><span>{s.name}<small>{s.minutes}분</small></span></button></li>)}</ol><div className="sidebar-divider"/>{[['data','탐사 자료실',Search],['record','모둠 제안서',FileText],['personal','나의 기록',UserRound],['gallery','학급 갤러리',LayoutGrid],['history','보관본과 내려받기',Clock3]].map(([id,title,Icon]:any)=><button key={id} className={'nav-item '+(panel===id?'active':'')} onClick={()=>void openPanel(id)}><Icon size={17}/>{title}</button>)}{drafts.length>0&&<button className="nav-item" onClick={()=>setPanel('drafts')}><Save size={17}/>저장 전 입력 {drafts.length}개</button>}<div className="save-explainer"><CheckCircle2 size={16}/><p>입력칸을 나가면 저장<small>{mode==='demo'?'이 기기에서 이어 쓰기':`모둠 기록은 15초마다 확인${lastSync?' / '+lastSync:''}`}</small></p></div></aside>
      <main className="lesson-main"><div className="lesson-heading"><p className="eyebrow">{panel==='lesson'?`${stage+1}차시 / 활동 ${step+1} / ${current.minutes}분`:'이어 쓰는 탐구 기록'}</p><h1>{panel==='lesson'?current.name:({data:'탐사 자료실',record:'우리 모둠 제안서',personal:'나의 탐구 기록',gallery:'학급 갤러리',history:'보관본과 내려받기',drafts:'저장 전 입력'} as Record<string,string>)[panel]}</h1>{panel==='lesson'&&<p>{current.prompt}</p>}</div>{values.teacherFeedback&&<div className="teacher-note"><GraduationCap size={18}/><div><b>선생님 피드백</b><p>{values.teacherFeedback}</p></div></div>}
      {panel==='lesson'&&<><details className="activity-directions"><summary>활동 순서와 마칠 때 확인할 것</summary><ol>{current.instructions.map(t=><li key={t}>{clean(t)}</li>)}</ol><h3>마칠 때 확인</h3><ul>{current.doneWhen.map(t=><li key={t}>{clean(t)}</li>)}</ul></details><div className={'learning-grid '+(!current.fields.length?'single':'')}><section className="resource-pane" key={stage+'-'+step}>{resource()}</section>{current.fields.length>0&&<section className="writing-pane"><div className="section-heading"><h2>우리 기록</h2><span className="hint">한두 문장으로 짧게</span></div>{fields(current.fields)}</section>}</div>{step===stages[stage].steps.length-1&&readiness()}<div className="lesson-footer"><button className="secondary" disabled={stage===0&&step===0} onClick={()=>void(step?navigate(stage,step-1):navigate(stage-1,stages[stage-1].steps.length-1))}><ArrowLeft size={16}/> 이전</button><span>{step+1} / {stages[stage].steps.length}</span>{step<stages[stage].steps.length-1?<button className="primary" onClick={()=>void navigate(stage,step+1)}>다음 활동 <ArrowRight size={16}/></button>:<div className="button-row"><button className="secondary" onClick={()=>void snapshot(stage===0?'1차시 끝':stage===1?'2차시 끝':'3차시 최종')}><Save size={16}/>{stage+1}차시 보관</button>{stage<2&&<button className="primary" onClick={()=>void navigate(stage+1)}>다음 차시 <ArrowRight size={16}/></button>}</div>}</div></>}
      {panel==='data'&&<FullMaterials selected={values.destination} notify={notify}/>}
      {panel==='record'&&<><Proposal rows={state.group}/><div className="button-row"><button className="primary" onClick={()=>void beginPresentation()}><Presentation size={16}/>제안서로 발표</button><button className="secondary" onClick={()=>void publish()}>{state.published?'갤러리 게시 취소':'학급 갤러리에 게시'}</button></div><details className="process-details"><summary>제안서 수정</summary>{fieldsByKeys(proposalKeys)}</details><details className="process-details"><summary>탐구 과정 기록 수정</summary>{fields(allFields.filter(f=>!f.personal&&!proposalKeys.includes(f.key)))}</details></>}
      {panel==='personal'&&<div className="personal-page"><p className="notice">{mode==='demo'?'체험 기록은 이 기기에만 남아요.':'이 기록은 나와 우리 학급을 만든 선생님만 확인해요.'}</p>{stages.map((s,i)=><section key={i}><h2>{i+1}차시 / {s.short}</h2>{fields(s.steps.flatMap(x=>x.fields).filter(f=>f.personal))}</section>)}</div>}
      {panel==='gallery'&&galleryUI()}
      {panel==='drafts'&&draftsUI()}
      {panel==='history'&&<><p>차시가 끝날 때 보관본을 남기세요. 보관본을 열면 그때의 모둠 기록을 읽을 수 있어요. 개인 기록은 아래 기록 파일에 함께 내려받을 수 있어요.</p><div className="button-row">{phaseNames.map(n=><button className="secondary" key={n} onClick={()=>void snapshot(n)}><Save size={15}/>{n}</button>)}</div><div className="history-list">{state.snapshots.map(s=><button key={s.id} onClick={()=>void readSnapshot(s)}><Clock3 size={17}/><b>{s.label}</b><span>{new Date(s.created).toLocaleString('ko-KR')}</span></button>)}{!state.snapshots.length&&<p className="empty">아직 보관본이 없어요.</p>}</div>{snapView&&<section className="snapshot-view"><div className="section-heading"><h2>{snapView.label}</h2><button className="icon-btn" aria-label="보관본 닫기" onClick={()=>setSnapView(null)}><X size={18}/></button></div><p className="hint">읽기 전용 보관본입니다.</p><Proposal rows={JSON.parse(snapView.body||'[]')}/><details><summary>당시 과정 기록 전체</summary><RecordList rows={JSON.parse(snapView.body||'[]')}/></details></section>}<button className="primary" onClick={async()=>{const saved=await flush();const current=stateRef.current!;download('SPACE_'+current.student.className+'_'+current.student.number+'번_기록.json',JSON.stringify({version:2,exported:new Date().toISOString(),mode,...current,pending:saved?[]:pendingDrafts(current.student.id).map(x=>x.draft)},null,2));}}><Download size={16}/>나의 기록과 모둠 기록 내려받기</button><p className="hint">JSON은 기록 보관용이에요. 읽기 좋은 파일이 필요하면 제안서를 발표 화면으로 열고 PDF로 저장하세요.</p>{mode==='demo'&&<details className="reading-card"><summary>체험 기록 관리</summary><p>기록을 지우면 이 기기의 체험 기록이 사라져요. 필요한 기록은 먼저 내려받으세요.</p><button className="secondary" onClick={()=>{if(confirm('이 기기의 체험 기록을 모두 지울까요?')){pendingDrafts('review').forEach(x=>sessionStorage.removeItem(x.cacheKey));localStorage.removeItem(REVIEW_STORAGE);updateState(emptyReview(),false);setSnapView(null);setPrior(null);notify('체험 기록을 지웠어요.');}}}>체험 기록 지우기</button></details>}</>}
      </main></div>
    </>}
  </div>;
}
