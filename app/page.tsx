'use client';
import React,{useEffect,useRef,useState,useCallback} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,ChevronDown,Clock3,Copy,Download,FileText,GraduationCap,LayoutGrid,LogOut,Orbit,Presentation,RefreshCw,Save,Search,Type,UserRound,Users,WifiOff,X} from 'lucide-react';
import Landing from './landing';
import Teacher from './teacher';
import DestinationGuide from './destination-guide';
import {api,hasStudentSession,clearStudentSession,isLocalReviewOnly,setClassroomSessionScope} from '../lib/classroom-client';
import {allFields,stages,lesson2Required,firstMissingLesson2,phaseNames,proposalKeys,FieldDef} from './course';
import {aiCards,buildAiPrompt,peerFallback,storyTransition,comparisonComplete,comparisonSource,comparisonText,readComparison,writeComparison,ComparisonIds,comparisonMissingItems,recordValueText,readMissionEvidence,getReadingCard} from './teaching-content';
import {ClassroomState,Row,Snapshot,Field,Proposal,PresentationBrief,RecordList,Readback,InquiryTrail,SaveField,recordMap,pendingDrafts,readDraft,finishDraft,download,clean,useFieldRecord} from './record-ui';
import {ApolloReading,CriteriaCards,DataExplorer,DestinationCards,EvidenceCards,FullMaterials,PresentationGuide,ReviewGuide,VerificationGuide} from './resource-ui';

type Mode='home'|'student'|'demo'|'teacher'|'review'|'materials';
const REVIEW_STORAGE='SPACE_CLASSROOM_REVIEW_V2';
const emptyReview=():ClassroomState=>({student:{id:'review',number:1,teamId:'review-team',classId:'review-class',className:'수업 내용 체험',teamLabel:'체험 모둠'},group:[],personal:[],snapshots:[],published:false});
const label=(key:string)=>clean(allFields.find(f=>f.key===key)?.label||key);
const requiredByLesson = [
  ['comparison','fact','gap','evidenceRef','meaning','conclusion'],
  lesson2Required.map(field => field.key),
  stages[2].steps.flatMap(activity => activity.fields.map(field => field.key)),
];

function Brand({cover=false}:{cover?:boolean}){if(cover)return <div className="brand brand-editorial"><span className="brand-wordmark">SPACE</span><span className="brand-caption">프로젝트</span></div>;return <div className="brand"><span className="brand-mark"><Orbit size={24}/></span><span>SPACE<span className="brand-sub">프로젝트</span></span></div>;}
function loadReview():ClassroomState {
  try{const s=JSON.parse(localStorage.getItem(REVIEW_STORAGE)||'null');if(!s||s.student?.id!=='review')return emptyReview();
    const validRows=(rows:unknown,personal:boolean)=>Array.isArray(rows)?rows.filter(r=>r&&typeof r.key==='string'&&typeof r.value==='string'&&r.value.length<=3000&&Number.isInteger(r.rev)&&allFields.some(f=>f.key===r.key&&!!f.personal===personal)):[];
    return {...emptyReview(),group:validRows(s.group,false),personal:validRows(s.personal,true),snapshots:Array.isArray(s.snapshots)?s.snapshots.filter((n:any)=>typeof n.id==='string'&&typeof n.body==='string').slice(0,20):[],published:!!s.published};
  }catch{return emptyReview();}
}

export default function App(){
  const [mode,setMode]=useState<Mode>('home'),[state,setState]=useState<ClassroomState|null>(null),[code,setCode]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[joinError,setJoinError]=useState(''),[studentPreview,setStudentPreview]=useState(false),[generalEntry,setGeneralEntry]=useState(false);
  const [stage,setStage]=useState(0),[step,setStep]=useState(0),[panel,setPanel]=useState('lesson'),[online,setOnline]=useState(true),[full,setFull]=useState(false),[large,setLarge]=useState(false),[welcome,setWelcome]=useState(''),[authError,setAuthError]=useState('');
  const [gallery,setGallery]=useState<any[]>([]),[snapView,setSnapView]=useState<Snapshot|null>(null),[pendingVersion,setPendingVersion]=useState(0),[,setLastSync]=useState('');
  const stateRef=useRef<ClassroomState|null>(null),modeRef=useRef<Mode>('home'),booted=useRef(false),contextGen=useRef(0),inflight=useRef(new Map<string,{value:string;promise:Promise<Row>}>());
  const notify=useCallback((s:string)=>setNotice(s),[]);
  function changeMode(next:Mode){if(modeRef.current!==next)contextGen.current++;modeRef.current=next;setMode(next);}
  function updateState(next:ClassroomState|null,persist=modeRef.current==='demo'){
    if(next&&persist)localStorage.setItem(REVIEW_STORAGE,JSON.stringify(next));
    stateRef.current=next;setState(next);
  }
  function acceptState(next:ClassroomState){const previous=stateRef.current;
    if(previous&&previous.student.id===next.student.id&&previous.student.teamId!==next.student.teamId){setSnapView(null);notify('모둠이 바뀌었어요. 새 모둠 기록을 불러왔고, 이전 모둠의 저장 전 입력은 따로 보관했어요.');}
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
    const isGeneral=params.get('general')==='1';
    setGeneralEntry(isGeneral);
    setClassroomSessionScope(isGeneral?'general':'research');
    if(ticket){history.replaceState(null,'',location.pathname+location.search);setCode(ticket);void join(ticket);}
    else if(params.get('teacher')==='1')void openTeacher();
    else if(params.get('studentview')==='1'){setStudentPreview(true);startReview(Math.min(2,Math.max(0,Number(params.get('lesson')||1)-1)));}
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
    setBusy(true);setJoinError('');const ctx=++contextGen.current;try{const s=await api('join',{code:value});if(ctx!==contextGen.current)return;acceptState(s);setAuthError('');changeMode('student');setCode('');setWelcome('');setStage(0);setStep(0);setPanel('lesson');notify('입장했어요. 모둠 기록과 나의 기록을 구분해서 작성하세요.');}
    catch(e:any){if(ctx===contextGen.current){setJoinError(e.message);notify(e.message);}}finally{if(ctx===contextGen.current||modeRef.current==='student')setBusy(false);}
  }
  function startReview(lesson=0){
    const review=loadReview();changeMode('demo');updateState(review,false);setStage(lesson);setStep(0);setPanel('lesson');setFull(false);setAuthError('');setSnapView(null);setGallery([]);setWelcome('');window.scrollTo({top:0});
  }
  async function openTeacher(){
    if(isLocalReviewOnly()){notify('이 파일은 수업 내용 체험용이에요. 저장 서버가 연결된 수업 사이트에서 교사 공간을 열어 주세요.');return;}
    changeMode('teacher');
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
  const comparisonRecord=useFieldRecord({def:allFields.find(f=>f.key==='comparison')!,row:state?.group.find(r=>r.key==='comparison'),student:state?.student,save,disabled:!!state?.student.closed||!!authError});
  async function flush():Promise<boolean>{
    const ctx=contextGen.current;try{await Promise.all([...inflight.current.values()].map(x=>x.promise));if(ctx!==contextGen.current)return false;const s=stateRef.current;if(!s)return true;
      if(!await comparisonRecord.persist()){setPanel('drafts');return false;}
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
    if((name==='2차시 끝'||name==='3차시 최종') && (modeRef.current==='student' || studentPreview) && !checkLesson2(s)) return false;
    try{if(modeRef.current==='demo'){const snap={id:(typeof crypto.randomUUID==='function'?crypto.randomUUID():'review-'+Date.now()+'-'+Math.random().toString(36).slice(2)),label:name,created:new Date().toISOString(),body:JSON.stringify(s.group)};updateState({...s,snapshots:[snap,...s.snapshots].slice(0,20)});}
      else{await api('snapshot',{label:name,expectedTeamId:s.student.teamId});const latest=await api('state');if(ctx!==contextGen.current)return false;acceptState(latest);}
      if(!quiet)notify(name+' 보관본을 남겼어요.');return true;
    }catch(e:any){if(ctx===contextGen.current)handleError(e);return false;}
  }
  async function publish(){
    const ctx=contextGen.current;if(!await flush()||ctx!==contextGen.current)return;const s=stateRef.current;if(!s)return;const values=recordMap(s.group);
    if(!s.published&&!['fact','gap','question','data','method'].every(k=>values[k]?.trim())){notify('확인한 사실, 질문, 얻을 자료, 방법을 먼저 작성해 주세요.');return;}
    try{if(modeRef.current==='demo')updateState({...s,published:!s.published});else{await api('publish',{published:!s.published,expectedTeamId:s.student.teamId});const latest=await api('state');if(ctx!==contextGen.current)return;acceptState(latest);}notify(s.published?'게시를 취소했어요.':'탐사계획서를 학급 갤러리에 게시했어요.');}catch(e:any){if(ctx===contextGen.current)handleError(e);}
  }
  async function getGallery(){const ctx=contextGen.current;try{if(modeRef.current==='demo'){const s=stateRef.current;setGallery(s?.published?[{id:s.student.teamId,label:'체험 모둠',records:s.group.filter(r=>proposalKeys.includes(r.key))}]:[]);}else {const result=await api('gallery');if(ctx===contextGen.current)setGallery(result.teams);}}catch(e:any){if(ctx===contextGen.current)handleError(e);}}
  useEffect(()=>{if(!state||!['student','demo'].includes(mode))return;if(panel==='gallery'||(panel==='lesson'&&stages[stage].steps[step].resource==='gallery'))void getGallery();},[panel,stage,step,state?.published,mode]);
  async function readSnapshot(s:Snapshot){const ctx=contextGen.current,teamId=stateRef.current?.student.teamId;try{const complete=s.body?s:await api('action=snapshot&id='+encodeURIComponent(s.id));if(ctx===contextGen.current&&teamId===stateRef.current?.student.teamId)setSnapView(complete);}catch(e:any){if(ctx===contextGen.current)handleError(e);}}
  const canReadWithoutSave=()=>!!stateRef.current?.student.closed||!!authError||(!online&&modeRef.current==='student');
  function checkLesson2(s: ClassroomState) {
    const missing = firstMissingLesson2(recordMap(s.group), recordMap(s.personal));
    if (!missing) return true;
    const index = stages[1].steps.findIndex(activity => activity.fields.includes(missing));
    setStage(1);
    setStep(index);
    setPanel('lesson');
    notify('2차시를 먼저 마쳐요. '+missing.label+' 항목을 확인하세요.');
    window.scrollTo({top:0});
    return false;
  }
  async function navigate(lesson:number, activity=0) {
    const ctx=contextGen.current;
    const saved=await flush();
    if(ctx!==contextGen.current || (!saved && !canReadWithoutSave())) return;
    const s=stateRef.current;
    if(lesson===2 && stage!==2 && s && !s.student.closed && (modeRef.current==='student' || studentPreview)) {
      if(!saved || !checkLesson2(s)) return;
      if(!s.snapshots.some(item=>item.label==='2차시 끝') && !await snapshot('2차시 끝',true)) return;
      if(ctx!==contextGen.current || stateRef.current?.student.teamId!==s.student.teamId) return;
    }
    setStage(lesson);setStep(activity);setPanel('lesson');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  async function openPanel(next:string){if(!await flush()&&!canReadWithoutSave())return;setPanel(next);window.scrollTo({top:0,behavior:'smooth'});}
  async function goHome(){if(!await flush()&&!canReadWithoutSave())return;changeMode('home');setFull(false);if(mode==='student'&&state)setWelcome(`${state.student.className} ${state.student.number}번으로 이어 쓰기`);if(mode==='demo')setStudentPreview(false);}
  async function leave(){if(!await flush()&&!confirm('저장 전 입력을 이 기기에 보관하고 나갈까요? 같은 입장권으로 다시 들어오면 확인할 수 있어요.'))return;if(modeRef.current==='student')await api('logout',{}).catch(()=>{});changeMode('home');updateState(null,false);setWelcome('');setAuthError('');setFull(false);}
  async function beginPresentation(){if(await flush())setFull(true);}
  async function copy(text:string){try{await navigator.clipboard.writeText(text);notify('복사했어요. 선생님이 안내한 곳에 붙여 넣으세요.');}catch{download('SPACE_질문.txt',text,'text/plain');notify('질문 파일을 내려받았어요.');}}
  async function copyAi(level:number){
    const ctx=contextGen.current,studentId=stateRef.current?.student.id,teamId=stateRef.current?.student.teamId;
    const name=level===1?'1차시 AI 사용 전':level===2?'2차시 AI 사용 전':null;
    if(name?!await snapshot(name,true):!await flush())return;
    const latest=stateRef.current;
    if(ctx!==contextGen.current||!latest||latest.student.id!==studentId||latest.student.teamId!==teamId||latest.student.closed)return;
    const current=recordMap(latest.group),missing=level===1?comparisonMissingItems(current):[];
    if(missing.length){notify('먼저 확인할 기록: '+missing.join(', '));return;}
    await copy(buildAiPrompt(level,current));
  }
  function fields(definitions:FieldDef[],recoverHidden=false){if(!state)return null;
    const lesson2Keys:Record<string,Set<string>>={
      destinations:new Set(['destination','otherDestination','selectionReason','additionalRef','additionalFact','question','data','method']),
      ai2:new Set(['claim2']),
      verify2:new Set(['verifySource','verdict','reason','decision','revision']),
      summary2:new Set(['myVerdict']),
    };
    const visible=definitions.filter(d=>(!d.hidden||recoverHidden)&&(d.key!=='otherDestination'||recordMap(state.group).destination==='다른 탐사지')&&(stage!==1||panel!=='lesson'||recoverHidden||lesson2Keys[current.resource]?.has(d.key)));
    const focus=panel==='lesson'?(lessonFlow?.focus||''):'';
    return visible.map(d=><div className={'field-flow-wrap '+(focus===d.key?'is-current':'')} key={state.student.id+':'+(d.personal?'personal':state.student.teamId)+':'+d.key}>{d.section&&<h3 className="field-section">{d.section}</h3>}<Field def={d} row={(d.personal?state.personal:state.group).find(r=>r.key===d.key)} student={state.student} save={save} disabled={!!state.student.closed||!!authError} record={d.key==='comparison'?comparisonRecord:undefined} comparisonValue={comparisonRecord.value} legacyReference={d.key==='comparison'?state.group.find(r=>r.key==='factRef')?.value:undefined} groupValues={recordMap(state.group)} readOnly={!!d.hidden}/></div>);
  }
  const fieldsByKeys=(keys:string[])=>fields(keys.map(k=>allFields.find(f=>f.key===k)).filter((f):f is FieldDef=>!!f));
  const values=recordMap(state?.group),personal=recordMap(state?.personal),current=stages[stage].steps[step];
  const drafts=state?pendingDrafts(state.student.id):[];

  function lesson1Flow(){
    const rawComparison=comparisonRecord.value||values.comparison||'';
    const ids=readComparison(rawComparison).ids;
    const evidence=readMissionEvidence(values.__rawFact??values.fact??'');
    const evidenceDone=comparisonComplete(rawComparison)&&ids.every(id=>id!==null&&!!evidence.entries[id]?.trim());
    const gapDone=!!values.gapStatement?.trim()&&!!values.gap?.trim();
    const item=(focus:string,title:string,detail:string)=>({focus,title,detail});
    let current=item('','다음 활동으로 이동하세요.','');
    let parts:{label:string;done:boolean}[]=[];
    if(step===0){
      current=!personal.first?.trim()?item('first','내 생각을 한 문장으로 쓰세요.','문장틀의 빈칸에 지금 생각을 넣으면 됩니다.'):item('','작성 완료','다음 활동으로 넘어가세요.');
      parts=[{label:'내 생각 쓰기',done:!!personal.first?.trim()}];
    }else if(step===1){
      const order=[
        ['apolloA','첫 번째 문장이 사실인지 해석인지 고르세요.','먼저 종류를 고릅니다.'],
        ['apolloReasonA','첫 번째 문장을 그렇게 고른 이유를 쓰세요.','아폴로 13호 자료와 비교해 이유를 씁니다.'],
        ['apolloB','두 번째 문장이 사실인지 해석인지 고르세요.','종류를 고릅니다.'],
        ['apolloReasonB','두 번째 문장을 그렇게 고른 이유를 쓰세요.','자료와 비교해 이유를 씁니다.'],
      ];
      const missing=order.find(([key])=>!values[key]?.trim());
      current=missing?item(missing[0],missing[1],missing[2]):item('','작성 완료','다음 활동으로 넘어가세요.');
      parts=[
        {label:'문장 1 고르기',done:!!values.apolloA?.trim()},{label:'이유 쓰기',done:!!values.apolloReasonA?.trim()},
        {label:'문장 2 고르기',done:!!values.apolloB?.trim()},{label:'이유 쓰기',done:!!values.apolloReasonB?.trim()},
      ];
    }else if(step===2){
      if(!comparisonComplete(rawComparison)) current=item('comparison','탐사 두 개를 고르세요.','추천 조합을 눌러도 되고 직접 골라도 됩니다.');
      else if(!evidenceDone) current=item('fact','두 탐사에서 같은 항목의 근거를 가져오세요.','계획한 방식, 실제 결과, 주요 활동 중 같은 항목을 고릅니다.');
      else if(!values.change?.trim()) current=item('change','두 탐사에서 보이는 차이를 한 문장으로 쓰세요.','바로 위에 가져온 두 탐사 기록만 보고 씁니다.');
      else if(!values.claimReason?.trim()) current=item('claimReason','왜 그렇게 보이는지 근거를 쓰세요.','첫 번째 탐사와 두 번째 탐사의 기록을 연결합니다.');
      else if(!gapDone) current=item('gap','이 자료만으로 알기 어려운 점과 질문을 쓰세요.','자료에 없는 점을 찾고, 더 알아볼 질문으로 바꿉니다.');
      else if(!values.selectedClaimKind?.trim()) current=item('selectedClaim','AI와 비교할 우리 문장 하나를 고르세요.','이 활동에서 방금 쓴 ‘두 탐사의 차이’ 또는 ‘이 자료만으로 알기 어려운 점’ 중 하나를 고릅니다.');
      else current=item('','비교 준비 완료','다음 활동에서 AI와 직접 비교합니다.');
      parts=[
        {label:'탐사 고르기',done:comparisonComplete(rawComparison)},
        {label:'근거 가져오기',done:evidenceDone},
        {label:'차이 쓰기',done:!!values.change?.trim()&&!!values.claimReason?.trim()},
        {label:'한계와 질문',done:gapDone},
        {label:'우리 문장 고르기',done:!!values.selectedClaimKind?.trim()},
      ];
    }else if(step===3){
      if(!values.claim1?.trim()) current=item('claim1','AI 답에서 우리 말과 비슷한 문장 하나를 옮기세요.','AI 답 전체가 아니라 문장 하나만 찾으면 됩니다.');
      else if(!values.check1?.trim()) current=item('check1','활동 3에서 비교한 두 탐사 자료를 다시 보세요.','우리 문장과 AI 문장이 그 자료와 맞는지 확인합니다.');
      else if(!values.compare1?.trim()) current=item('compare1','우리 문장과 AI 문장을 비교하세요.','같은 점 또는 다른 점을 짧게 씁니다.');
      else if(!values.decision1?.trim()) current=item('decision1','우리 문장을 그대로 둘지 고칠지 정하세요.','활동 3에서 비교한 두 탐사 자료를 근거로 결정합니다.');
      else current=item('','AI 비교 완료','다음 활동으로 넘어가세요.');
      parts=[
        {label:'AI 문장 찾기',done:!!values.claim1?.trim()},
        {label:'자료 확인',done:!!values.check1?.trim()},
        {label:'두 문장 비교',done:!!values.compare1?.trim()},
        {label:'우리 문장 결정',done:!!values.decision1?.trim()},
      ];
    }else{
      if(!values.evidenceRef?.trim()) current=item('evidenceRef','영향카드 하나를 펼쳐 읽고, 읽은 카드를 고르세요.','카드의 사실을 예로 들어 “우리는 왜 우주를 탐사할까?”에 답합니다.');
      else if(!values.meaning?.trim()) current=item('meaning','카드에서 알게 된 사실을 쓰세요.','읽은 카드 이름과 확인한 사실을 한 문장으로 씁니다.');
      else if(!personal.conclusion?.trim()) current=item('conclusion','우리는 왜 우주를 탐사할까요?','위에 쓴 사실을 근거로 각자의 생각을 씁니다.');
      else current=item('','1차시 기록 완료','1차시 보관을 누르면 됩니다.');
      parts=[
        {label:'카드의 사실',done:!!values.evidenceRef?.trim()&&!!values.meaning?.trim()},
        {label:'탐사하는 이유',done:!!personal.conclusion?.trim()},
      ];
    }
    return {...current,parts};
  }
  function lesson2Flow(){
    const currentStep=stages[stage].steps[step].resource;
    const item=(focus:string,title:string,detail:string)=>({focus,title,detail});
    let current=item('','다음 활동으로 이동하세요.','');
    let parts:{label:string;done:boolean}[]=[];
    if(currentStep==='destinations'){
      const order=[
        ['destination','1차시 질문을 읽고, 조사할 탐사지를 고르세요.','왼쪽 참고 자료를 살펴보거나 직접 조사한 곳을 골라도 됩니다.'],
        ['selectionReason','이곳을 고른 이유를 우리 질문과 연결해 쓰세요.',values.gap?.trim()?`우리 질문: ${values.gap}`:'이곳에서 무엇을 알아볼 수 있을지 생각해 보세요.'],
        ['additionalRef','우리 탐사지의 자료 하나를 읽으세요.','아래 자료를 펼쳐 읽고, 읽은 자료의 이름·출처를 기록합니다.'],
        ['additionalFact','우리 질문에 도움이 되는 사실 하나를 쓰세요.','읽은 자료에서 실제로 확인한 사실을 한 문장으로 적습니다.'],
        ['question','탐사에서 알아볼 질문을 정하세요.','1차시 질문을 우리 탐사지에서 조사할 수 있는 질문으로 좁힙니다.'],
        ['data','질문에 답하려면 무엇을 관찰·측정해야 할까요?','확인할 대상의 모습이나 측정할 값을 한두 개 정합니다.'],
        ['method','그 대상을 어떻게 조사할지 쓰세요.','사용할 도구와 촬영·측정·채취 등의 방법을 연결해 씁니다.'],
      ];
      const missing=order.find(([key])=>!values[key]?.trim());
      current=missing?item(missing[0],missing[1],missing[2]):item('','다 썼다면 모둠원과 함께 점검하세요.','질문·관찰 대상·조사 방법을 소리 내어 읽고, 이 방법으로 질문에 답할 수 있는지 확인해 고칩니다. 그다음 AI 활동으로 넘어가세요.');
      parts=[
        {label:'탐사지 선택',done:!!values.destination?.trim()&&!!values.selectionReason?.trim()},
        {label:'자료 확인',done:!!values.additionalRef?.trim()&&!!values.additionalFact?.trim()},
        {label:'탐사 질문',done:!!values.question?.trim()},
        {label:'관찰·측정 대상',done:!!values.data?.trim()},
        {label:'방법',done:!!values.method?.trim()},
      ];
    }else if(currentStep==='ai2'){
      current=!values.claim2?.trim()?item('claim2','AI 답에서 확인할 문장 하나만 고르세요.','AI 답 전체를 분석하지 않습니다. 맞는지 확인하면 우리 계획이 달라질 수 있는 문장 하나만 옮깁니다.'):item('','AI 문장 선택 완료','다음 활동에서 우리가 읽은 자료와 비교합니다.');
      parts=[{label:'AI에 질문',done:!!values.question?.trim()&&!!values.data?.trim()&&!!values.method?.trim()},{label:'문장 1개',done:!!values.claim2?.trim()}];
    }else if(currentStep==='verify2'){
      const order=[
        ['verifySource','AI 문장과 비교할 자료 내용을 쓰세요.','우리가 실제로 읽은 자료에서 확인한 내용만 씁니다.'],
        ['verdict','자료와 비교한 결과를 고르세요.','맞음·일부 맞음·수정 필요·확인 불가 중 하나를 고릅니다.'],
        ['reason','왜 그렇게 판단했는지 쓰세요.','AI 문장과 자료의 같은 점 또는 다른 점을 씁니다.'],
        ['decision','우리 계획에서 어떻게 할지 고르세요.','채택·수정·제외·보류 중 하나를 고릅니다.'],
        ['revision','그래서 계획을 어떻게 유지하거나 고쳤는지 쓰세요.','실제로 바뀐 내용을 한 문장으로 남깁니다.'],
      ];
      const missing=order.find(([key])=>!values[key]?.trim());
      current=missing?item(missing[0],missing[1],missing[2]):item('','검증과 수정 완료','마지막 활동에서 각자 근거를 들어 나의 판단을 씁니다.');
      parts=[
        {label:'자료 확인',done:!!values.verifySource?.trim()},
        {label:'판정',done:!!values.verdict?.trim()&&!!values.reason?.trim()},
        {label:'계획 반영',done:!!values.decision?.trim()&&!!values.revision?.trim()},
      ];
    }else{
      current=!personal.myVerdict?.trim()?item('myVerdict','확인한 근거를 들어 나의 판단을 쓰세요.','자료에서 확인한 사실과 계획을 유지·수정·보류해야 한다고 생각한 이유를 연결합니다. 모둠과 생각이 같아도 괜찮아요.'):item('','나의 판단 작성 완료','모둠 기록과 나의 판단을 확인한 뒤 선생님의 안내에 따라 3차시로 이동하세요.');
      parts=[{label:'나의 근거와 판단',done:!!personal.myVerdict?.trim()}];
    }
    return {...current,parts};
  }
  function lesson3Flow(){
    const item=(focus:string,title:string,detail:string)=>({focus,title,detail});
    let next=item('','다음 활동으로 이동하세요.','');
    let parts:{label:string;done:boolean}[]=[];
    if(current.resource==='environment3'){
      const order=[
        ['env1','계획에 반영할 환경 조건 하나를 고르세요.','2차시에 정한 탐사지에서 중력·온도·대기·방사선·물·햇빛 등을 살펴봅니다.'],
        ['envInfo1','자료에서 확인한 환경 사실을 쓰세요.','수치가 있다면 단위와 적용 장소를 함께 씁니다. 모르는 값은 ‘확인 필요’로 표시하세요.'],
        ['envSource1','그 사실을 확인한 자료를 남기세요.','기관명·자료명 또는 링크를 적습니다.'],
        ['envResponse1','탐사 중 생길 어려움과 대비를 쓰세요.','식물 재배 조건이 아니라 탐사선·장비·대원 운영에 미치는 영향을 계획서에 넣습니다.'],
      ];
      const missing=order.find(([key])=>!values[key]?.trim());
      next=missing?item(missing[0],missing[1],missing[2]):item('','환경 근거 반영 완료','환경 사실과 대비가 계획서에 담겼어요. 다음 활동에서 질문 하나로 계획을 최종 점검하세요.');
      parts=[
        {label:'환경 조건',done:!!values.env1?.trim()},
        {label:'사실·출처',done:!!values.envInfo1?.trim()&&!!values.envSource1?.trim()},
        {label:'어려움·대비',done:!!values.envResponse1?.trim()},
      ];
    }else if(current.resource==='ai3'){
      const order=[
        ['route3','질문을 받을 방법을 고르세요.','AI에게 계획을 보여 주거나 짝 모둠과 바꾸어 읽습니다.'],
        ['critique','우리 계획에서 확인할 질문 하나를 적으세요.','받은 질문 중 계획을 유지하거나 고치는 데 도움이 되는 하나만 고릅니다.'],
        ['critiqueDecision','자료와 비교해 판단하세요.','수용·기각·보류 중 하나를 고릅니다.'],
        ['critiqueReason','판단 근거와 계획에 반영할 점을 쓰세요.','확인한 사실과 유지하거나 고칠 점을 한 문장으로 연결합니다.'],
      ];
      const missing=order.find(([key])=>!values[key]?.trim());
      next=missing?item(missing[0],missing[1],missing[2]):item('','탐사계획 확정 완료','질문 하나를 근거로 검토했어요. 이제 완성한 계획서를 짝 모둠에 설명하세요.');
      parts=[
        {label:'질문 받기',done:!!values.route3?.trim()&&!!values.critique?.trim()},
        {label:'자료로 판단',done:!!values.critiqueDecision?.trim()},
        {label:'계획 확정',done:!!values.critiqueReason?.trim()},
      ];
    }else if(current.resource==='present'){
      if(!state?.published) next=item('','짝 모둠과 계획서를 설명하고 대표가 게시하세요.','탐사 질문·조사 방법·환경에 대한 대비를 설명한 뒤, 모둠 대표 한 명만 ‘학급 갤러리에 게시’를 누릅니다.');
      else if(!personal.recommendReason?.trim()) next=item('recommendReason','짝 모둠의 설득력 있는 근거를 한 줄로 쓰세요.','몇 조인지 밝히고, 발표에서 들은 구체적인 근거 하나를 남깁니다.');
      else next=item('','설명과 게시 완료','완성한 탐사계획서가 게시됐어요. 마지막 활동에서 내 생각을 돌아보세요.');
      parts=[
        {label:'계획서 설명·게시',done:!!state?.published},
        {label:'짝 모둠 근거 기록',done:!!personal.recommendReason?.trim()},
      ];
    }else{
      next=!personal.reflection?.trim()?item('reflection','첫 생각과 지금 생각을 근거로 연결하세요.','자료나 검토한 질문 하나를 예로 들어 생각이 달라졌거나 구체화된 점을 씁니다.'):item('','3차시 탐사계획서 완성','기록을 보관하고, 마지막 2분에 다음 SPACE 미션을 확인하세요.');
      parts=[{label:'개인 성찰',done:!!personal.reflection?.trim()},{label:'다음 미션 확인',done:!!personal.reflection?.trim()}];
    }
    return {...next,parts};
  }
  const lessonFlow=stage===0?lesson1Flow():stage===1?lesson2Flow():lesson3Flow();

  function aiBox(level:number){
    const card=aiCards[level-1],peer=peerFallback.entries[level-1],missing=level===1?comparisonMissingItems(values):[];
    const ready=level===1?missing.length===0:['question','data','method'].every(k=>values[k]?.trim());
    return <div className="ai-box">
      <span className="eyebrow">{level===1?'우리 생각과 AI 생각 비교':level===2?'AI에게 묻기':'AI 또는 동료 검토'}</span><h2>{level===2?'우리 초안을 AI에게 보내고, 확인할 문장 하나 고르기':card.title}</h2>
      <p>{level===1?'우리가 먼저 쓴 생각과 AI가 한 말을 비교한 뒤, 활동 3의 탐사 자료를 보고 우리 생각을 그대로 둘지 고칩니다.':level===2?'AI에게 우리 계획을 보여 주고, 다음 활동에서 자료로 확인할 문장 하나만 고릅니다.':'아래 질문을 복사해 AI에 보내세요. 받은 질문 하나를 우리 자료로 검토해요.'}</p>
      {level===1&&<p className="ai-purpose"><b>핵심</b> AI가 정답인지 맞히는 활동이 아니에요. <strong>우리 생각과 AI 생각을 같은 탐사 자료로 확인</strong>하는 활동입니다.</p>}
      {level===2&&<section className="ai-compare-focus"><p className="eyebrow">딱 세 가지만</p><ol className="ai-compare-steps"><li><b>1</b> 아래 버튼으로 우리 초안이 들어간 질문을 복사해 AI에 보내기</li><li><b>2</b> AI 답에서 자료로 확인할 수 있는 설명 한 문장 찾기</li><li><b>3</b> 그 설명을 아래 기록칸에 그대로 옮기기</li></ol>{/[?？]$/.test(values.claim2?.trim()||'')&&<p className="notice">지금 쓴 문장은 질문으로 끝나요. AI가 그 질문에 답한 부분에서 확인할 사실 한 문장을 골라 보세요.</p>}</section>}
      {level===1&&<>
        <section className="ai-compare-focus">
          <p className="eyebrow">지금 비교할 것</p>
          <div className="ai-compare-targets">
            <article>
              <span>활동 3에서 고른 우리 문장</span>
              <p>{values.selectedClaimKind?values.selectedClaim:'활동 3에서 AI와 비교할 문장을 먼저 고르세요.'}</p>
            </article>
            <article>
              <span>AI 답에서 찾을 문장</span>
              <p>위 우리 문장과 같은 내용을 말한 문장 1개</p>
            </article>
          </div>
          <ol className="ai-compare-steps">
            <li><b>1</b> AI 답에서 우리 말과 비슷한 문장 1개 찾기</li>
            <li><b>2</b> 활동 3에서 비교한 두 탐사 자료로 두 문장을 확인하기</li>
            <li><b>3</b> 우리 문장을 그대로 둘지 고칠지 정하기</li>
          </ol>
        </section>
        <Readback title="활동 3에서 비교한 두 탐사 자료와 근거" value={[comparisonSource(values),values.fact].filter(Boolean).join('\n')}/>
        {values.selectedClaimKind==='change'&&<Readback title="우리 문장을 만든 근거" value={values.claimReason}/>}
      </>}
      <div className="prompt-card"><b>{level===1||level===2?'1. AI에게 질문하기':'질문에 포함할 내용'}</b><p>{level===1?'활동 3에서 고른 우리 문장과 두 탐사 자료가 함께 복사됩니다.':level===2?'우리 모둠의 초안과 선택한 탐사지의 확인 자료':'현재 탐사계획서, 환경 조사표, 검증 기록'}</p>
        <p className="hint">{level===1?'복사한 질문을 학교에서 허용한 AI에 붙여 넣고 답을 받으세요. 이름이나 학번은 보내지 않습니다.':'개인의 첫 생각과 성찰은 복사하지 않아요. 직접 쓴 탐사 기록에도 이름과 학번을 넣지 마세요.'}</p>
        <button className="primary" disabled={!ready||busy||!!authError||!!state?.student.closed} onClick={()=>void copyAi(level)}><Copy size={16}/>{level===1||level===2?'AI에 보낼 질문 복사':'질문 복사'}</button>
        {!ready&&(level===1?<div className="comparison-missing" role="status"><b>아직 필요한 기록</b><ul>{missing.map(item=><li key={item}>{item}</li>)}</ul><button className="text-btn" onClick={()=>void navigate(0,2)}>두 탐사 비교로 돌아가기</button></div>:<p className="hint">먼저 미션 질문과 얻을 자료, 방법을 저장하세요.</p>)}
        <details><summary>보낼 질문 전체 확인</summary><pre className="prompt-preview">{buildAiPrompt(level,values)}</pre></details>
      </div>
      <p className="notice">{level===1?'AI 답을 받으면 아래 기록에서 우리 문장과 비슷한 AI 문장 하나만 옮기면 됩니다.':level===2?'AI 답을 받으면 아래 기록에서 자료로 확인할 문장 하나만 옮기면 됩니다.':'이곳에서 AI 답변을 자동 생성하지 않아요. 학교에서 허용한 AI를 사용하고 실제로 받은 내용을 기록하세요.'}</p>
      {level===3&&<details className="reading-card"><summary>AI 연결이 어려우면 짝 모둠에 질문 받기</summary><ol>{peer.instructions.map(t=><li key={t}>{t}</li>)}</ol>{peer.questions.map(q=><blockquote key={q}>{q}</blockquote>)}</details>}
      {level===3&&<><Readback title="환경 조건과 출처" value={[values.envInfo1,values.envSource1].filter(Boolean).join(' · ')}/>
        <Readback title="우리 계획의 대비 방법" value={values.envResponse1}/>
        <details className="reading-card"><summary>조사 방법이나 대비 방법 고치기</summary>{fieldsByKeys(['method','envResponse1'])}</details></>}
    </div>;
  }
  function galleryUI(){return <div><div className="section-heading"><h2>우리 반 탐사계획서</h2><button className="secondary" onClick={()=>void getGallery()}><RefreshCw size={16}/> 새로고침</button></div><p className="muted">같은 학급에 게시한 탐사계획서만 보여요. 개인 기록은 보이지 않아요.</p>{mode==='demo'&&<p className="notice">체험에서는 내가 게시한 체험 탐사계획서만 보여요. 실제 학급에 입장하면 다른 모둠의 게시물도 읽을 수 있어요.</p>}{gallery.length?gallery.map(t=><details className="gallery-item" key={t.id}><summary><b>{t.label} / {recordMap(t.records).missionName||'탐사 미션'}</b><ChevronDown size={16}/></summary><Proposal rows={t.records} label={t.label}/></details>):<p className="empty">아직 게시한 탐사계획서가 없어요. 발표할 때 모둠 탐사계획서를 게시하세요.</p>}<CriteriaCards/></div>;}
  function resource(){
    if(current.resource==='data')return <DataExplorer notify={notify} selection={readComparison(comparisonRecord.value).ids} onSelectionChange={(ids:ComparisonIds)=>{if(comparisonRecord.change(writeComparison(ids,comparisonRecord.value)))void comparisonRecord.persist();}} disabled={!!state?.student.closed||!!authError}/>;
    if(current.resource==='evidence')return <EvidenceCards/>;
    if(current.resource==='apollo')return <ApolloReading/>;
    if(current.resource.startsWith('ai'))return aiBox(Number(current.resource.slice(-1)));
    if(stage===1&&current.resource==='destinations')return <><section className="carry-forward-card"><span>오늘 이어갈 우리 질문</span><p>{values.gap?.trim()||values.question?.trim()||'1차시에서 만든 질문을 확인하세요.'}</p></section><Readback title="우리 모둠이 정한 탐사지" value={[values.destination,values.selectionReason].filter(Boolean).join(' · ')}/><button className="destination-help-link" onClick={()=>void openPanel('destinationGuide')}><BookOpen size={18}/>탐사지 예시와 조사 출처 보기</button>{getReadingCard(values.destination)?<details className="reading-card draft-source"><summary>우리 탐사지 자료 펼쳐 읽기<ChevronDown size={16}/></summary><DestinationCards selected={values.destination}/></details>:<div className="notice"><b>직접 정한 탐사지의 자료를 하나 찾으세요.</b><p>공신력 있는 기관이나 연구기관 자료에서 우리 질문과 관련된 사실 하나를 확인하고, 아래 기록칸에 자료 이름과 확인한 사실을 남기면 됩니다.<br/>준비된 달·화성·유로파 자료를 억지로 사용할 필요는 없습니다.</p></div>}</>;
    if(current.resource==='verify2')return <><section className="ai-compare-focus"><p className="eyebrow">지금 비교할 것</p><div className="ai-compare-targets"><article><span>AI에서 고른 문장</span><p>{values.claim2||'앞 활동에서 AI 문장 하나를 먼저 고르세요.'}</p></article><article><span>우리가 읽은 자료</span><p>{[values.additionalRef,values.additionalFact].filter(Boolean).join(' · ')||'탐사계획서 초안을 쓸 때 확인한 자료를 다시 봅니다.'}</p></article></div></section></>;
    if(current.resource==='environment3')return <><Readback title="우리 모둠의 탐사지" value={values.destination}/><Readback title="2차시에 세운 탐사계획" value={[values.question,values.data,values.method].filter(Boolean).join('\n')}/><Readback title="자료로 확인한 결과" value={[values.claim2,values.verdict,values.reason,values.revision].filter(Boolean).join('\n')}/>{getReadingCard(values.destination)?<DestinationCards selected={values.destination} environmentOnly/>:<div className="notice"><b>우리 모둠이 정한 탐사지: {values.destination||'미작성'}</b><Readback title="2차시에 읽은 자료" value={[values.additionalRef,values.additionalFact].filter(Boolean).join(' · ')}/><p>이 탐사지는 준비된 환경 카드가 없어요. 2차시에 읽은 자료나 선생님과 확인한 출처에서 환경 조건 하나를 찾고, 찾지 못한 값은 ‘확인 필요’라고 남겨도 됩니다.</p></div>}</>;
    if(current.resource==='summary2')return <><p className="notice">모둠 초안과 AI 검증을 마치고, 각자 판단까지 저장한 뒤 선생님 안내에 따라 3차시를 시작하세요.</p><h2>나는 어떤 근거로 계획을 판단했나요?</h2><p>아래 자료와 모둠의 검토 내용을 읽으세요.<br/>계획을 유지·수정·보류해야 한다고 생각한 이유를 각자 한 문장으로 씁니다. 모둠과 의견이 같아도 내 판단의 근거가 드러나게 쓰세요.</p><Readback title="모둠이 검증한 주장" value={values.claim2}/><Readback title="판정과 근거" value={[values.verifySource,values.verdict,values.reason].filter(Boolean).join('\n')}/><Readback title="계획에 반영한 점" value={values.revision}/></>;
    if(current.resource==='present')return <><PresentationGuide/>
      <div className="button-row"><button className="primary" onClick={()=>void beginPresentation()}><Presentation size={16}/> 계획서로 발표</button>
      <button className="secondary" disabled={state?.published} onClick={()=>void publish()}>{state?.published?'학급 갤러리에 게시됨':'학급 갤러리에 게시'}</button></div>
      <details className="reading-card"><summary>우리 모둠 계획서 확인</summary><Proposal rows={state!.group}/></details></>;
    if(current.resource==='gallery')return galleryUI();
    if(current.resource==='reflection')return <><Readback title="자료를 읽기 전 나의 첫 생각" value={personal.first}/><Readback title="2차시 나의 판단과 근거" value={personal.myVerdict}/><details className="next-story"><summary>마지막 2분, 다음 SPACE 미션 열기</summary><small>{storyTransition.badge}</small><h2>{storyTransition.title}</h2><p>{storyTransition.introduction}</p>{storyTransition.scenes.map(s=><p key={s.title}><b>{s.title}</b><br/>{s.text}</p>)}<blockquote>{storyTransition.openingQuestion}</blockquote><p className="notice">{storyTransition.environmentBoundary}</p><p>{storyTransition.nextLesson}</p></details></>;
    return <div className="intro-resource"><span className="eyebrow">세 차시의 탐사 여정</span><h2>기록에서 질문을,<br/>질문에서 탐사를.</h2><p>과거의 탐사 자료를 읽고, 우리 모둠이 더 알아볼 질문을 정해요. 그 질문에 답할 탐사 방법을 설계하고 근거를 확인해요.</p>{mode==='demo'&&!studentPreview&&<p className="notice">체험 모드에서는 실제 반과 모둠 배정이 표시되지 않아요. 실제 수업에서는 반과 번호로 입장하면 상단에 자기 모둠이 표시됩니다.</p>}<ol className="intro-journey">{stages.map((s,i)=><li key={i}><b>{i+1}차시 / {s.short}</b><p>{s.subtitle}</p></li>)}</ol><div className="notice"><b>함께 기록하는 방법</b><p>모둠 기록은 같은 모둠이 함께 써요. 같은 칸을 한꺼번에 고치기보다 읽기, 자료 확인, 기록 역할을 나누세요. 나의 기록은 각자 작성해요.</p></div></div>;
  }
  function readiness(){
    const merged={...values,...personal},ids=readComparison(merged.comparison).ids,evidence=readMissionEvidence(merged.__rawFact??merged.fact);
    return <section className="learning-summary"><h3>{stage+1}차시 기록 확인</h3><p className="hint">아래는 작성 여부만 확인해요. 근거가 타당한지는 모둠과 선생님이 따로 확인합니다.</p><ul>{requiredByLesson[stage].map(k=>{
      const done=k==='comparison'?comparisonComplete(merged[k]):k==='fact'?comparisonComplete(merged.comparison)&&ids.every(id=>id!==null&&!!evidence.entries[id]?.trim()):k==='gap'?!!merged.gapStatement?.trim()&&!!merged.gap?.trim():!!merged[k]?.trim();
      return <li key={k} className={done?'recorded':'missing'}><span>{done?'작성됨':k==='comparison'?'두 탐사 선택 필요':'미작성'}</span>{k==='gap'?'자료의 한계와 추가 질문':label(k)}</li>;
    })}{stage===2&&<li className={state?.published?'recorded':'missing'}><span>{state?.published?'게시됨':'게시 전'}</span>모둠 탐사계획서</li>}</ul></section>;
  }
  function draftsUI(){const local=drafts.filter(d=>d.draft.personal||d.draft.teamId===state!.student.teamId),old=drafts.filter(d=>!d.draft.personal&&d.draft.teamId!==state!.student.teamId);return <><h2>저장 전 입력을 확인하세요.</h2><p>먼저 저장된 내용과 다르면 두 답을 비교하세요. 이전 모둠의 입력은 새 모둠에 자동으로 옮기지 않아요.</p>{local.length?fields(local.map(d=>allFields.find(f=>f.key===d.draft.key)).filter((f):f is FieldDef=>!!f),true):<p className="empty">현재 모둠과 나의 기록은 모두 저장했어요.</p>}{old.length>0&&<details className="reading-card" open><summary>이전 모둠에서 남긴 입력 {old.length}개</summary>{old.map(d=><Readback key={d.cacheKey} title={label(d.draft.key)} value={recordValueText(d.draft.key,d.draft.value,Object.fromEntries(old.filter(x=>x.draft.teamId===d.draft.teamId).map(x=>[x.draft.key,x.draft.value])))}/>)}<button className="secondary" onClick={()=>download('SPACE_이전모둠_저장전입력.json',JSON.stringify(old.map(x=>x.draft),null,2))}><Download size={15}/> 이전 입력 내려받기</button></details>}<div className="button-row"><button className="primary" disabled={!!state?.student.closed||!!authError} onClick={()=>void flush()}>저장 다시 시도</button><button className="secondary" onClick={()=>download('SPACE_저장전입력.json',JSON.stringify(drafts.map(x=>x.draft),null,2))}><Download size={15}/> 저장 전 입력 내려받기</button><button className="secondary" onClick={()=>void goHome()}>처음 화면</button></div></>;}

  if(full&&state)return <div className={'presentation-mode '+(large?'large-text':'')}><div className="presentation-toolbar"><Brand/><span>{state.student.teamLabel}</span><button className="secondary" onClick={()=>window.print()}>PDF로 저장</button><button className="secondary" onClick={()=>setFull(false)}><X size={16}/> 닫기</button></div>{stage===2&&panel==='lesson'&&current.resource==='present'?<PresentationBrief rows={state.group} label={state.student.teamLabel}/>:<Proposal rows={state.group} label={state.student.teamLabel}/>}</div>;
  return <div className={'space-app '+(mode==='home'?'home-mode ':'')+(large?'large-text':'')}><header className={'topbar '+(mode==='home'?'space-topbar':'')}><button className="brand-button" aria-label="처음 화면" onClick={()=>void goHome()}><Brand cover={mode==='home'}/></button><span className="course-label">과학B{generalEntry?' · 일반수업':''}</span>{mode!=='home'&&<nav><button className="text-btn" aria-pressed={large} onClick={()=>{setLarge(!large);try{localStorage.setItem('SPACE_LARGE_TEXT',String(!large));}catch{}}}><Type size={17}/><span>글자 {large?'기본':'크게'}</span></button>{['student','demo'].includes(mode)&&<button className="text-btn" onClick={()=>void leave()}><LogOut size={16}/><span>{mode==='demo'?'체험 나가기':'로그아웃'}</span></button>}{['review','materials','teacher'].includes(mode)&&<button className="text-btn" onClick={()=>changeMode('home')}>처음으로</button>}</nav>}</header>
    {notice&&<div className="toast" role="status"><span>{notice}</span><button aria-label="알림 닫기" onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {!online&&<div className="offline-banner"><WifiOff size={16}/>인터넷 연결이 끊겼어요. 입력을 유지하고 연결 후 저장하세요.</div>}
    {mode==='home'&&<Landing reviewOnly={typeof window!=='undefined'&&isLocalReviewOnly()} simpleEntryPreview={typeof window!=='undefined'&&(!isLocalReviewOnly()||new URLSearchParams(window.location.search).get('entry')==='preview')} entryClasses={generalEntry?[5,7,8,9,10]:[4,6]} entryLabel={generalEntry?'일반 수업용입니다. 3학년 5·7·8·9·10반과 자신의 번호를 입력하세요.':'연구 수업용입니다. 3학년 4·6반과 자신의 번호를 입력하세요.'} code={code} onCodeChange={setCode} onJoin={()=>void join()} busy={busy} welcome={welcome} onResume={()=>{const ctx=contextGen.current;setBusy(true);void api('state').then(s=>{if(ctx!==contextGen.current)return;acceptState(s);changeMode('student');setStage(0);setStep(0);setPanel('lesson');setAuthError('');setGallery([]);setSnapView(null);}).catch(e=>{setWelcome('');setJoinError(e.message);}).finally(()=>setBusy(false));}} onReview={()=>changeMode('review')} onTeacher={()=>void openTeacher()} onStartReview={startReview} joinError={joinError}/>}
    {mode==='review'&&<ReviewGuide onStart={startReview} onMaterials={()=>changeMode('materials')}/>}
    {mode==='materials'&&<main className="materials-page"><h1>과학B 전체 수업 자료</h1><button className="secondary" onClick={()=>changeMode('review')}>검토 안내로 돌아가기</button><FullMaterials notify={notify}/></main>}
    {mode==='teacher'&&<Teacher notify={notify} onStudentPreview={()=>{window.open(location.pathname+'?studentview=1&v=20261105b','_blank','noopener,noreferrer');}}/>}
    {(mode==='student'||mode==='demo')&&state&&<>
      <div className={mode==='demo'?'demo-banner':'student-banner'}>{mode==='demo'?studentPreview?<><Users size={17}/><span>학생 화면 미리보기 / 학생과 같은 활동 화면</span></>:<><BookOpen size={17}/><span>수업 내용 체험 / 입력은 이 기기에 저장돼요.</span></>:<><Users size={17}/><span>{state.student.className} / {state.student.number}번 / {state.student.teamLabel}</span></>}<button className="text-btn" onClick={()=>void openPanel('history')}>기록 보관</button></div>
      {authError&&<div className="auth-banner" role="alert"><p>{authError}</p><button className="secondary" onClick={()=>{changeMode('home');setWelcome('');}}>입장권으로 다시 접속</button><button className="secondary" onClick={()=>download('SPACE_저장전입력.json',JSON.stringify(drafts.map(x=>x.draft),null,2))}>입력 내려받기</button></div>}
      {state.student.closed&&<div className="notice">선생님이 작성을 마감했어요. 지금까지의 기록은 읽고 내려받을 수 있어요.</div>}
      <div className="course-tabs">{stages.map((s,i)=><button key={i} className={stage===i?'active':''} onClick={()=>void navigate(i)}><span>{i+1}차시</span><b>{s.short}</b></button>)}</div>
      <div className={'workspace '+(stage<=1&&panel==='lesson'?'lesson-one-workspace':'')}><aside className="sidebar"><p className="eyebrow">{stage+1}차시 활동{stage===2?' · 30분':''}</p><ol className="step-list">{stages[stage].steps.map((s,i)=>{const aiStep=s.resource==='ai1'||s.resource==='ai2';return <li key={s.id}><button className={(panel==='lesson'&&step===i?'active ':'')+(aiStep?'ai-step':'')} onClick={()=>void navigate(stage,i)}><span className="step-index">{i+1}</span><span>{s.name}{aiStep?<small className="ai-step-label">{stage===0?'우리 생각 ↔ AI':'우리 초안 → AI'}</small>:<small>{s.minutes}분</small>}</span>{aiStep&&<em className="ai-badge">AI</em>}</button></li>})}{stage===1&&<li><button className={'reference-step '+(panel==='destinationGuide'?'active':'')} aria-current={panel==='destinationGuide'?'page':undefined} onClick={()=>void openPanel('destinationGuide')}><span className="step-index">참고</span><span>탐사지 고르기</span></button></li>}</ol>{stage<=1&&panel==='lesson'?<details className="student-more"><summary>자료·기록 더보기</summary><div className="sidebar-divider"/>{[['data','탐사 자료실',Search],['record','모둠 탐사계획서',FileText],['personal','나의 기록',UserRound],['gallery','학급 갤러리',LayoutGrid],['history','보관본과 내려받기',Clock3]].map(([id,title,Icon]:any)=><button key={id} className={'nav-item '+(panel===id?'active':'')} onClick={()=>void openPanel(id)}><Icon size={17}/>{title}</button>)}{drafts.length>0&&<button className="nav-item" onClick={()=>setPanel('drafts')}><Save size={17}/>저장 전 입력 {drafts.length}개</button>}<div className="save-explainer"><CheckCircle2 size={16}/><p>자동 저장</p></div></details>:<><div className="sidebar-divider"/>{[['data','탐사 자료실',Search],['record','모둠 탐사계획서',FileText],['personal','나의 기록',UserRound],['gallery','학급 갤러리',LayoutGrid],['history','보관본과 내려받기',Clock3]].map(([id,title,Icon]:any)=><button key={id} className={'nav-item '+(panel===id?'active':'')} onClick={()=>void openPanel(id)}><Icon size={17}/>{title}</button>)}{drafts.length>0&&<button className="nav-item" onClick={()=>setPanel('drafts')}><Save size={17}/>저장 전 입력 {drafts.length}개</button>}<div className="save-explainer"><CheckCircle2 size={16}/><p>자동 저장</p></div></>}</aside>
      <main className="lesson-main"><div className="lesson-heading"><p className="eyebrow">{panel==='lesson'?`${stage+1}차시 · ${step+1}/${stages[stage].steps.length}`:'이어 쓰는 탐구 기록'}</p>{panel==='lesson'&&stage===0&&step===3&&<span className="lesson-ai-badge">AI 활동</span>}<h1>{panel==='lesson'?current.name:({destinationGuide:'탐사지 고르기 · 예시와 출처',data:'탐사 자료실',record:'우리 모둠 탐사계획서',personal:'나의 탐구 기록',gallery:'학급 갤러리',history:'보관본과 내려받기',drafts:'저장 전 입력'} as Record<string,string>)[panel]}</h1>{panel==='lesson'&&stage>1&&<p>{current.prompt}</p>}</div>
      {panel==='lesson'&&stage===2&&step===0&&<section className="lesson-three-mission" aria-label="3차시 완성 목표"><div><span>오늘 완성할 결과</span><h2>근거가 담긴 우리 모둠 탐사계획서</h2><p>식물 재배 조건을 정하는 시간이 아니에요. 선택한 탐사지에서 탐사를 수행할 수 있도록 계획을 완성합니다.</p></div><ol><li><b>1</b>환경 사실 확인</li><li><b>2</b>탐사 어려움·대비 보완</li><li><b>3</b>설명하고 게시</li></ol></section>}
      {panel==='lesson'&&current.id==='l2-draft'&&<section className="draft-activity-guide" aria-label="탐사지 선택과 계획서 작성 안내">
        <h2>이번 활동에서 할 일</h2>
        <p>1차시에서 만든 질문을 읽고 <strong>조사할 탐사지</strong>를 고릅니다. 자료를 읽은 뒤 기술 수업으로 가져갈 <strong>탐사계획서 초안</strong>에 무엇을 알아볼지, 무엇을 관찰할지, 어떻게 조사할지 정해 씁니다.</p>
        <ol>{current.instructions.map(instruction=>{
          const [title,...description]=instruction.split(' — ');
          return <li key={title}><h3>{title}</h3><p>{description.join(' — ')}</p></li>;
        })}</ol>
        <p className="draft-output"><strong>완료 기준</strong> 탐사지·선정 이유와 자료 이름·확인한 사실, 탐사 질문·관찰 대상·조사 방법을 쓰고 모둠원과 점검하세요. 이어서 AI의 제안을 검토하고, 환경 조사는 3차시에 진행합니다.</p>
      </section>}
      {panel==='lesson'&&lessonFlow&&<section className={'now-card '+(!lessonFlow.focus?'is-done':'')}><div className="now-card-label">지금 할 일</div><h2>{lessonFlow.title}</h2>{lessonFlow.detail&&<p>{lessonFlow.detail}</p>}<div className="now-progress">{lessonFlow.parts.map((part,i)=><span key={part.label} className={part.done?'done':''}><b>{part.done?'✓':i+1}</b>{part.label}</span>)}</div></section>}{values.teacherFeedback&&<div className="teacher-note"><GraduationCap size={18}/><div><b>선생님 피드백</b><p>{values.teacherFeedback}</p></div></div>}
      {panel==='lesson'&&<>{stage>1&&<details className="activity-directions"><summary>활동 안내</summary><ol>{current.instructions.map(t=><li key={t}>{clean(t)}</li>)}</ol><h3>확인</h3><ul>{current.doneWhen.map(t=><li key={t}>{clean(t)}</li>)}</ul></details>}{stage===0&&step===4?<div className="learning-grid lesson-one-flow conclusion-flow"><section className="resource-pane inline-evidence"><div className="section-heading"><h2>1. 영향 카드 읽기</h2></div>{resource()}</section><section className="writing-pane"><div className="section-heading"><h2>2. 카드의 사실로 탐사 이유 설명하기</h2></div>{fields(current.fields.filter(f=>['evidenceRef','meaning','conclusion'].includes(f.key)))}{personal.conclusion?.trim()?(personal.first?.trim()&&<section aria-label="처음 생각과 지금 생각 비교"><Readback title="첫 활동에서 쓴 나의 생각" value={personal.first}/><p className="hint">방금 쓴 생각과 비교해 보세요. 같은 점이나 달라진 점이 있나요? 처음보다 더 구체적으로 설명할 수 있게 된 점을 찾아보세요. 생각이 같아도 괜찮아요.</p></section>):<p className="hint">마지막 생각을 쓰고 저장하면, 이 아래에 처음 쓴 생각이 나타나요. 입력칸 밖을 누르면 자동으로 저장됩니다.</p>}</section></div>:<div className={'learning-grid '+(stage<=1?'lesson-one-flow ':'')+(!current.fields.length?'single':'')}><section className="resource-pane" key={stage+'-'+step}>{resource()}</section>{current.fields.length>0&&<section className="writing-pane"><div className="section-heading"><h2>{current.id==='l2-draft'?'우리 모둠 탐사계획서 초안':'기록'}</h2></div>{fields(current.fields)}</section>}</div>}{step===stages[stage].steps.length-1&&readiness()}<div className="lesson-footer"><button className="secondary" disabled={stage===0&&step===0} onClick={()=>void(step?navigate(stage,step-1):navigate(stage-1,stages[stage-1].steps.length-1))}><ArrowLeft size={16}/> 이전</button><span>{step+1} / {stages[stage].steps.length}</span>{step<stages[stage].steps.length-1?<button className={'primary '+(stage===0&&step===2?'next-ai-button':'')} onClick={()=>void navigate(stage,step+1)}>{stage===0&&step===2?'다음: AI와 비교하기':'다음 활동'} <ArrowRight size={16}/></button>:<div className="button-row"><button className="secondary" onClick={()=>void snapshot(stage===0?'1차시 끝':stage===1?'2차시 끝':'3차시 최종')}><Save size={16}/>{stage+1}차시 보관</button>{stage<2&&<button className="primary" onClick={()=>void navigate(stage+1)}>{stage===1?'2차시 마치고 3차시로':'다음 차시'} <ArrowRight size={16}/></button>}</div>}</div></>}
      {panel==='destinationGuide'&&<><button className="secondary guide-return-top" onClick={()=>void navigate(stage,step)}><ArrowLeft size={16}/>보고 있던 활동으로 돌아가기</button><DestinationGuide question={values.gap} destination={values.destination} onReturn={()=>void navigate(1,0)}/></>}
      {panel==='data'&&<FullMaterials selected={values.destination} notify={notify}/>}
      {panel==='record'&&<><Proposal rows={state.group}/><div className="button-row"><button className="primary" onClick={()=>void beginPresentation()}><Presentation size={16}/>탐사계획서로 발표</button><button className="secondary" onClick={()=>void publish()}>{state.published?'갤러리 게시 취소':'학급 갤러리에 게시'}</button></div><details className="process-details"><summary>탐사계획서 수정</summary>{fieldsByKeys(proposalKeys)}</details><details className="process-details"><summary>탐구 과정 기록 수정</summary>{fields(allFields.filter(f=>!f.personal&&!proposalKeys.includes(f.key)))}</details></>}
      {panel==='personal'&&<div className="personal-page"><p className="notice">{mode==='demo'?'체험 기록은 이 기기에만 남아요.':'이 기록은 나와 우리 학급을 만든 선생님만 확인해요.'}</p>{stages.map((s,i)=><section key={i}><h2>{i+1}차시 / {s.short}</h2>{fields(s.steps.flatMap(x=>x.fields).filter(f=>f.personal))}</section>)}</div>}
      {panel==='gallery'&&galleryUI()}
      {panel==='drafts'&&draftsUI()}
      {panel==='history'&&<><p>차시가 끝날 때 보관본을 남기세요. 보관본을 열면 그때의 모둠 기록을 읽을 수 있어요. 개인 기록은 아래 기록 파일에 함께 내려받을 수 있어요.</p><div className="button-row">{phaseNames.map(n=><button className="secondary" key={n} onClick={()=>void snapshot(n)}><Save size={15}/>{n}</button>)}</div><div className="history-list">{state.snapshots.map(s=><button key={s.id} onClick={()=>void readSnapshot(s)}><Clock3 size={17}/><b>{s.label}</b><span>{new Date(s.created).toLocaleString('ko-KR')}</span></button>)}{!state.snapshots.length&&<p className="empty">아직 보관본이 없어요.</p>}</div>{snapView&&<section className="snapshot-view"><div className="section-heading"><h2>{snapView.label}</h2><button className="icon-btn" aria-label="보관본 닫기" onClick={()=>setSnapView(null)}><X size={18}/></button></div><p className="hint">읽기 전용 보관본입니다.</p><Proposal rows={JSON.parse(snapView.body||'[]')}/><details><summary>당시 과정 기록 전체</summary><RecordList rows={JSON.parse(snapView.body||'[]')}/></details></section>}<button className="primary" onClick={async()=>{const saved=await flush();const current=stateRef.current!;download('SPACE_'+current.student.className+'_'+current.student.number+'번_기록.json',JSON.stringify({version:2,exported:new Date().toISOString(),mode,...current,pending:saved?[]:pendingDrafts(current.student.id).map(x=>x.draft)},null,2));}}><Download size={16}/>나의 기록과 모둠 기록 내려받기</button><p className="hint">JSON은 기록 보관용이에요. 읽기 좋은 파일이 필요하면 탐사계획서를 발표 화면으로 열고 PDF로 저장하세요.</p>{mode==='demo'&&<details className="reading-card"><summary>체험 기록 관리</summary><p>기록을 지우면 이 기기의 체험 기록이 사라져요. 필요한 기록은 먼저 내려받으세요.</p><button className="secondary" onClick={()=>{if(confirm('이 기기의 체험 기록을 모두 지울까요?')){pendingDrafts('review').forEach(x=>sessionStorage.removeItem(x.cacheKey));localStorage.removeItem(REVIEW_STORAGE);updateState(emptyReview(),false);setSnapView(null);notify('체험 기록을 지웠어요.');}}}>체험 기록 지우기</button></details>}</>}
      </main></div>
    </>}
  </div>;
}
