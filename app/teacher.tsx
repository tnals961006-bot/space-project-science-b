'use client';
import React,{useEffect,useMemo,useState} from 'react';
import {Download,LogOut,RefreshCw,Users,UserRound,ChevronDown} from 'lucide-react';
import {api,hasTeacherSession} from '../lib/classroom-client';
import {proposalKeys} from './course';
import {Row,Proposal,RecordList,recordMap,download} from './record-ui';

type Props={notify:(message:string)=>void};

export default function Teacher({notify}:Props){
  const [loggedIn,setLoggedIn]=useState(()=>typeof window!=='undefined'&&hasTeacherSession());
  const [teacherCode,setTeacherCode]=useState('');
  const [loginError,setLoginError]=useState('');
  const [classes,setClasses]=useState<any[]>([]);
  const [selected,setSelected]=useState('class-4');
  const [data,setData]=useState<any>(null);
  const [tab,setTab]=useState<'teams'|'students'>('teams');
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState<Record<string,string>>({});
  const current=classes.find(c=>c.id===selected);

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
      if(!(r.classes||[]).some((c:any)=>c.id===selected)&&r.classes?.[0])setSelected(r.classes[0].id);
    }catch(e:any){
      if(e.status===401){setLoggedIn(false);setData(null);}
      else notify(e.message||'학급 목록을 불러오지 못했어요.');
    }
  }

  async function loadClass(id=selected,quiet=false){
    if(!id)return;
    if(!quiet)setBusy(true);
    try{
      const r=await api('action=class&id='+encodeURIComponent(id));
      setData(r);
    }catch(e:any){
      if(e.status===401){setLoggedIn(false);setData(null);}
      else notify(e.message||'학급 기록을 불러오지 못했어요.');
    }finally{if(!quiet)setBusy(false);}
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

  async function saveFeedback(teamId:string){
    setBusy(true);
    try{
      const value=feedback[teamId]??recordMap(data.teams.find((t:any)=>t.id===teamId)?.records||[]).teacherFeedback??'';
      await api('feedback',{classId:selected,teamId,value});
      await loadClass(selected,true);
      notify('피드백을 저장했어요.');
    }catch(e:any){notify(e.message||'피드백을 저장하지 못했어요.');}
    finally{setBusy(false);}
  }

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
      <p className="muted">4반과 6반의 모둠 기록과 개인 기록을 확인합니다.</p>
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

  return <main className="teacher-page">
    <div className="section-heading">
      <div><p className="eyebrow">교사 전용</p><h1>SPACE 수업 기록 대시보드</h1><p className="muted">학생이 따로 제출하지 않아도 저장된 기록을 여기서 확인할 수 있어요.</p></div>
      <div className="button-row">
        <button className="secondary" disabled={busy} onClick={()=>void loadClass()}><RefreshCw size={16}/> 지금 갱신</button>
        <button className="secondary" onClick={()=>void logout()}><LogOut size={16}/> 나가기</button>
      </div>
    </div>

    <div className="teacher-class-tabs">
      {classes.map(c=><button key={c.id} className={selected===c.id?'active':''} onClick={()=>setSelected(c.id)}>{c.name}</button>)}
    </div>

    {data&&<>
      <section className="teacher-summary-grid">
        <div><small>학생</small><strong>{summary.students}명</strong></div>
        <div><small>개인 기록 시작</small><strong>{summary.studentsStarted}명</strong></div>
        <div><small>모둠 기록 시작</small><strong>{summary.teamsStarted}/6조</strong></div>
        <div><small>저장된 기록</small><strong>{summary.personal+summary.group}개</strong></div>
      </section>

      <div className="button-row teacher-data-actions">
        <button className="secondary" onClick={()=>download('SPACE_'+(current?.name||selected)+'_전체기록.json',JSON.stringify({exported:new Date().toISOString(),classroom:current,teams:data.teams,students:data.students},null,2))}><Download size={15}/> 전체 기록 내려받기</button>
        <span className="hint">화면이 열려 있으면 약 15초마다 새 기록을 다시 확인해요.</span>
      </div>

      <div className="pill-tabs">
        <button className={tab==='teams'?'active':''} onClick={()=>setTab('teams')}><Users size={16}/> 모둠 기록</button>
        <button className={tab==='students'?'active':''} onClick={()=>setTab('students')}><UserRound size={16}/> 개인 기록</button>
      </div>

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
    </>}
  </main>;
}
