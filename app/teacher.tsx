'use client';
import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,Copy,Download,ExternalLink,RefreshCw,Users,UserRound} from 'lucide-react';
import {api,getBackendUrl} from '../lib/classroom-client';
import {proposalKeys} from './course';
import {Row,Proposal,RecordList,recordMap,download,csv,fmtCode} from './record-ui';

type Props={notify:(message:string)=>void};
function studentBase(){
  const config=(window as any).__SPACE_CONFIG__||{};
  try {const url=new URL(config.PUBLIC_STUDENT_URL||window.location.href);if(!['https:','http:'].includes(url.protocol))return '';url.hash='';url.search='';return url.href;}catch{return '';}
}
function ticket(code:string){return studentBase()+'#ticket='+encodeURIComponent(code);}
export default function Teacher({notify}:Props) {
  const [classes,setClasses]=useState<any[]>([]),[selected,setSelected]=useState(''),[data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [name,setName]=useState('3학년 4반'),[count,setCount]=useState(25),[groups,setGroups]=useState(6),[tab,setTab]=useState('roster'),[feedback,setFeedback]=useState<Record<string,string>>({});
  const [classLoading,setClassLoading]=useState(false),[classError,setClassError]=useState('');
  const mounted=useRef(false),selectedRef=useRef(''),selectionGeneration=useRef(0),classRequest=useRef(0),listRequest=useRef(0),operation=useRef(0),busyRef=useRef(false),loadingRef=useRef(false);
  const current=classes.find(c=>c.id===selected);
  const sameSelection=(id:string,generation:number)=>mounted.current&&selectedRef.current===id&&selectionGeneration.current===generation;
  async function load(){
    const request=++listRequest.current;
    if(!mounted.current)return;
    setError('');
    try{const r=await api('teacher');if(mounted.current&&request===listRequest.current)setClasses(r.classes);}
    catch(e:any){if(mounted.current&&request===listRequest.current)setError(e.message);}
  }
  async function loadClass(id:string,choose=true){
    if(!mounted.current||!id||(!choose&&selectedRef.current!==id))return;
    if(choose&&selectedRef.current!==id){selectedRef.current=id;selectionGeneration.current++;setSelected(id);}
    const generation=selectionGeneration.current,request=++classRequest.current;
    loadingRef.current=true;setClassLoading(true);setClassError('');setData(null);
    try{
      const result=await api('action=class&id='+encodeURIComponent(id));
      if(sameSelection(id,generation)&&request===classRequest.current)setData({...result,classId:id});
    }catch(e:any){
      if(sameSelection(id,generation)&&request===classRequest.current){setClassError(e.message);notify(e.message);}
    }finally{
      if(sameSelection(id,generation)&&request===classRequest.current){loadingRef.current=false;setClassLoading(false);}
    }
  }
  useEffect(()=>{
    mounted.current=true;void load();
    return()=>{mounted.current=false;selectionGeneration.current++;classRequest.current++;listRequest.current++;operation.current++;};
  },[]);
  async function action(actionName:string,body:Record<string,unknown>){
    const classId=selectedRef.current,generation=selectionGeneration.current;
    if(busyRef.current||loadingRef.current||!classId||data?.classId!==classId)return;
    const request=++operation.current;busyRef.current=true;setBusy(true);
    try{
      await api(actionName,{...body,classId});
      if(!mounted.current||request!==operation.current)return;
      if(sameSelection(classId,generation))await loadClass(classId,false);
      if(!mounted.current||request!==operation.current)return;
      await load();
      if(mounted.current&&request===operation.current)notify('반영했어요.');
    }catch(e:any){if(mounted.current&&request===operation.current)notify(e.message);}
    finally{if(mounted.current&&request===operation.current){busyRef.current=false;setBusy(false);}}
  }
  async function createClass(e:React.FormEvent){
    e.preventDefault();if(busyRef.current)return;
    const generation=selectionGeneration.current,request=++operation.current;
    busyRef.current=true;setBusy(true);
    try{
      const created=await api('create',{name,count,groups});
      if(!mounted.current||request!==operation.current)return;
      await load();
      if(!mounted.current||request!==operation.current)return;
      if(selectionGeneration.current===generation)await loadClass(created.id);
      if(mounted.current&&request===operation.current)notify('학급을 만들었어요. 학생별로 본인의 입장권을 전달하세요.');
    }catch(e:any){if(mounted.current&&request===operation.current)notify(e.message);}
    finally{if(mounted.current&&request===operation.current){busyRef.current=false;setBusy(false);}}
  }
  async function copyTicket(code:string){const text=ticket(code);try{await navigator.clipboard.writeText(text);notify('개인 입장권 링크를 복사했어요. 해당 학생에게만 전달하세요.');}catch{download('개인입장권.txt',text,'text/plain');}}
  return <main className="teacher-page"><div className="section-heading"><div><p className="eyebrow">교사 공간</p><h1>우리 반 탐사 관리</h1><p className="muted">학생은 개인 입장권으로 참여하고, 모둠은 같은 제안서를 함께 씁니다.</p></div><button className="secondary" onClick={load}><RefreshCw size={16}/> 새로고침</button></div>
    {error?<div className="notice"><p>{error}</p><a className="primary" href={getBackendUrl()+'/signin-with-chatgpt?return_to='+encodeURIComponent('/?teacher=1')} target="_top">교사 계정 로그인</a><p className="hint">학급을 만든 계정으로 로그인해 주세요.</p></div>:<>
    <div className="teacher-setup"><form onSubmit={createClass}><h2>새 학급</h2><label>학급 이름<input value={name} onChange={e=>setName(e.target.value)} maxLength={60} required/></label><div className="two-cols"><label>학생 수<input type="number" min={1} max={40} value={count} onChange={e=>setCount(Number(e.target.value))}/></label><label>모둠 수<input type="number" min={1} max={Math.min(10,count)} value={groups} onChange={e=>setGroups(Number(e.target.value))}/></label></div><button className="primary" disabled={busy||groups>count}>학급과 개인 입장권 만들기</button></form><section><h2>내 학급</h2>{classes.map(c=><button key={c.id} className={'class-card '+(c.id===selected?'active':'')} onClick={()=>loadClass(c.id)}><div><b>{c.name}</b><small>{c.closed?'작성 마감':'작성 가능'}</small></div></button>)}{!classes.length&&<p className="empty">아직 만든 학급이 없어요.</p>}</section></div>
    {classLoading&&<p className="notice" role="status">선택한 학급을 불러오고 있어요.</p>}
    {classError&&!classLoading&&<div className="notice"><p>{classError}</p><button className="secondary" onClick={()=>void loadClass(selectedRef.current,false)}>다시 불러오기</button></div>}
    {data&&data.classId===selected&&!classLoading&&<section className="class-dashboard"><div className="section-heading"><h2>{current?.name}</h2><div className="button-row"><button className="secondary" onClick={()=>loadClass(selected)}><RefreshCw size={15}/> 기록 갱신</button><button className="secondary" onClick={()=>download('SPACE_학급기록.json',JSON.stringify({exported:new Date().toISOString(),classroom:current,teams:data.teams,students:data.students.map(({code,...s}:any)=>s)},null,2))}><Download size={15}/> 전체 기록</button><button className="secondary" disabled={busy} onClick={()=>action('close',{closed:!current?.closed})}>{current?.closed?'작성 다시 열기':'작성 마감'}</button></div></div><div className="pill-tabs">{[['roster','입장권과 모둠'],['teams','모둠 기록과 피드백'],['students','개인 기록']].map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
      {tab==='roster'&&<><p className="notice">입장권에는 개인 기록에 들어갈 수 있는 코드가 포함됩니다. 학생에게 본인의 링크만 전달하세요. 전체 입장권 명단을 학급 공지에 올리지 마세요.</p><p>클래스룸에서는 학생별 과제나 개인 안내에 링크를 넣을 수 있어요. 이 화면에서 클래스룸으로 자동 전송하지는 않습니다.</p><button className="secondary" onClick={()=>download('SPACE_개인입장권_교사용.csv',csv([['번호','모둠','개인 접속 코드','개인 입장권 링크'],...data.students.map((s:any)=>[s.number,data.teams.find((t:any)=>t.id===s.team_id)?.label,fmtCode(s.code),ticket(s.code)])]),'text/csv;charset=utf-8')}><Download size={15}/> 입장권 명단 CSV</button><div className="table-wrap"><table><thead><tr><th>번호</th><th>모둠</th><th>개인 코드</th><th>입장권</th><th>관리</th></tr></thead><tbody>{data.students.map((s:any)=><tr key={s.id}><td>{s.number}번</td><td><select aria-label={`${s.number}번 모둠`} value={s.team_id} disabled={busy} onChange={e=>{const teamId=e.target.value;if(confirm(`${s.number}번 학생의 모둠을 바꿀까요? 개인 기록은 유지되고 모둠 기록은 새 모둠의 기록을 사용합니다.`))void action('regroup',{studentId:s.id,teamId});}}>{data.teams.map((t:any)=><option value={t.id} key={t.id}>{t.label}</option>)}</select></td><td><code>{fmtCode(s.code)}</code></td><td><button className="text-btn" onClick={()=>copyTicket(s.code)}><Copy size={14}/> 링크 복사</button></td><td><button className="text-btn" disabled={busy} onClick={()=>{if(confirm(`${s.number}번의 입장권을 다시 만들까요? 이전 코드와 입장권은 사용할 수 없게 됩니다.`))void action('resetcode',{studentId:s.id});}}>재발급</button></td></tr>)}</tbody></table></div></>}
      {tab==='teams'&&data.teams.map((t:any)=><details className="teacher-team" key={t.id}><summary><Users size={18}/><b>{t.label}</b><span>{t.records.filter((r:Row)=>r.value.trim()&&r.key!=='teacherFeedback').length}개 항목 작성 / {t.published?'게시됨':'작성 중'}</span><ChevronDown size={16}/></summary><Proposal rows={t.records} label={t.label}/><details><summary>탐구 과정 기록</summary><RecordList rows={t.records.filter((r:Row)=>!proposalKeys.includes(r.key)&&r.key!=='teacherFeedback')}/></details><details><summary>보관본 {t.snapshots.length}개</summary>{t.snapshots.map((s:any)=><details key={s.id}><summary>{s.label} / {new Date(s.created).toLocaleString('ko-KR')}</summary><Proposal rows={JSON.parse(s.body)} label={t.label}/><RecordList rows={JSON.parse(s.body).filter((r:Row)=>!proposalKeys.includes(r.key))}/></details>)}</details><label className="feedback-label">선생님 피드백<textarea rows={3} maxLength={3000} value={feedback[t.id]??recordMap(t.records).teacherFeedback??''} onChange={e=>setFeedback({...feedback,[t.id]:e.target.value})}/></label><button className="secondary" disabled={busy} onClick={()=>action('feedback',{teamId:t.id,value:feedback[t.id]??recordMap(t.records).teacherFeedback??''})}>피드백 저장</button></details>)}
      {tab==='students'&&data.students.map((s:any)=><details className="teacher-team" key={s.id}><summary><UserRound size={18}/><b>{s.number}번</b><span>{data.teams.find((t:any)=>t.id===s.team_id)?.label} / 개인 기록 {s.records.length}개</span><ChevronDown size={16}/></summary>{s.records.length?<RecordList rows={s.records}/>:<p className="empty">아직 작성한 개인 기록이 없어요.</p>}</details>)}
    </section>}
    </>}
  </main>;
}
