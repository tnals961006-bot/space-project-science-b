'use client';
import React, {useEffect, useRef, useState} from 'react';
import {Save, UserRound, Users} from 'lucide-react';
import {allFields, FieldDef} from './course';
import {comparisonSource, comparisonText, missionChoiceLabel, missionRecords, readComparison, writeComparison, ComparisonIds} from './teaching-content';

export type Row = {key:string; value:string; rev:number; updated?:string; actor?:string};
export type Snapshot = {id:string; label:string; created:string; body?:string};
export type Student = {id:string; number:number; teamId:string; classId:string; className:string; teamLabel:string; closed?:boolean};
export type ClassroomState = {student:Student; group:Row[]; personal:Row[]; snapshots:Snapshot[]; published:boolean};
export type Draft = {version:2; studentId:string; teamId:string; personal:boolean; key:string; value:string; baseRev:number; updated:string};
export type SaveField = (def:FieldDef, value:string, rev:number, expectedTeamId:string)=>Promise<Row>;
export const recordMap = (rows:Row[] = []):Record<string,string> => {
  const values:Record<string,string> = Object.fromEntries(rows.map(r=>[r.key,r.value]));
  return 'comparison' in values ? {...values,factRef:comparisonSource(values)} : values;
};
export const clean = (s:unknown) => String(s??'').replace(/[·ㆍ•]/g, ', ').replace(/\s*,\s*,/g, ',').replace(/→/g, '다음');
export const draftKey = (studentId:string, teamId:string, personal:boolean, key:string) => `space-draft:v2:${studentId}:${personal?'personal':teamId}:${key}`;
export function readDraft(key:string):Draft|null {
  try { const d=JSON.parse(sessionStorage.getItem(key)||'null'); return d?.version===2 && typeof d.value==='string' && d.value.length<=3000 && Number.isInteger(d.baseRev) && d.baseRev>=0 ? d : null; } catch {return null;}
}
export function pendingDrafts(studentId:string, teamId?:string):{cacheKey:string; draft:Draft}[] {
  if(typeof sessionStorage==='undefined')return [];
  return Object.keys(sessionStorage).filter(k=>k.startsWith(`space-draft:v2:${studentId}:`)).map(cacheKey=>({cacheKey,draft:readDraft(cacheKey)})).filter((x):x is {cacheKey:string;draft:Draft}=>!!x.draft && (!teamId || x.draft.personal || x.draft.teamId===teamId));
}
export function storeDraft(key:string,d:Draft) {sessionStorage.setItem(key,JSON.stringify(d));}
export function finishDraft(studentId:string,teamId:string,def:FieldDef,submitted:string,row:Row) {
  const key=draftKey(studentId,teamId,!!def.personal,def.key);const current=readDraft(key);
  if(!current)return;
  if(current.value===submitted)sessionStorage.removeItem(key);
  else storeDraft(key,{...current,baseRev:row.rev});
  window.dispatchEvent(new CustomEvent('space-record-saved',{detail:{cacheKey:key,row,submitted}}));
}

type RecordFieldProps = {def:FieldDef;row?:Row;save:SaveField;student?:Student;disabled?:boolean};
/** One owner can share the same draft with the selects and the data explorer. */
export function useFieldRecord({def,row,save,student,disabled=false}:RecordFieldProps) {
  const cacheKey=student?draftKey(student.id,student.teamId,!!def.personal,def.key):'';
  const [value,setValue]=useState(row?.value||'');
  const [dirty,setDirty]=useState(false);
  const [status,setStatus]=useState('');
  const [conflict,setConflict]=useState<Row|null>(null);
  const valueRef=useRef(value), baseRef=useRef(row?.rev||0), dirtyRef=useRef(false), saving=useRef(false), conflictRef=useRef<Row|null>(null);
  const contextRef=useRef(cacheKey);contextRef.current=cacheKey;
  const boundKey=useRef(cacheKey);
  const setConflictState=(r:Row|null)=>{conflictRef.current=r;setConflict(r);};
  const setDirtyState=(v:boolean)=>{dirtyRef.current=v;setDirty(v);};
  useEffect(()=>{
    boundKey.current=cacheKey;
    const saved=cacheKey?readDraft(cacheKey):null;
    const v=saved?.value??row?.value??'';
    valueRef.current=v;setValue(v);baseRef.current=saved?.baseRev??row?.rev??0;
    saving.current=false;
    const pending=!!saved&&saved.value!==(row?.value||'');setDirtyState(pending);
    if(saved&&!pending)sessionStorage.removeItem(cacheKey);
    setConflictState(pending&&(row?.rev||0)!==saved!.baseRev ? row||{key:def.key,value:'',rev:0}:null);
    setStatus(pending?'저장 전 입력을 불러왔어요.':'');
  },[cacheKey]);
  useEffect(()=>{
    if(!dirtyRef.current){valueRef.current=row?.value||'';setValue(valueRef.current);baseRef.current=row?.rev||0;setConflictState(null);}
    else if(valueRef.current===(row?.value||'')){baseRef.current=row?.rev||0;setDirtyState(false);setConflictState(null);sessionStorage.removeItem(cacheKey);}
    else if((row?.rev||0)!==baseRef.current)setConflictState(row||{key:def.key,value:'',rev:0});
  },[row?.rev,row?.value,cacheKey]);
  useEffect(()=>{
    function synced(e:Event){const d=(e as CustomEvent).detail;if(d?.cacheKey!==cacheKey)return;baseRef.current=d.row.rev;if(valueRef.current===d.submitted){setDirtyState(false);setConflictState(null);setStatus('저장됨');}else setStatus('새 입력을 저장해 주세요.');}
    window.addEventListener('space-record-saved',synced);return()=>window.removeEventListener('space-record-saved',synced);
  },[cacheKey]);
  async function persist(revision?:number):Promise<boolean>{
    if(boundKey.current!==cacheKey)return false;
    if(!dirtyRef.current)return true;
    if(!student||saving.current||disabled||(conflictRef.current&&revision===undefined))return false;
    const submitted=valueRef.current,context=cacheKey;saving.current=true;setStatus('저장 중');
    try{const result=await save(def,submitted,revision??baseRef.current,student.teamId);if(contextRef.current!==context)return false;baseRef.current=result.rev;setDirtyState(valueRef.current!==submitted);setConflictState(null);setStatus(valueRef.current===submitted?'저장됨':'새 입력을 저장해 주세요.');return valueRef.current===submitted;}
    catch(e:any){if(contextRef.current===context){setStatus(e.message||'저장하지 못했어요. 입력은 이 기기에 남아 있어요.');if(e.conflict)setConflictState(e.current||{key:def.key,value:'',rev:0});}return false;}
    finally{if(contextRef.current===context)saving.current=false;}
  }
  function change(v:string){
    if(disabled||!student||boundKey.current!==cacheKey)return false;
    if(v.length>3000){setStatus('이전 기록을 포함한 내용이 너무 길어요. 원래 입력은 그대로 남겨 두었어요.');return false;}
    valueRef.current=v;setValue(v);setDirtyState(v!==(row?.value||''));
    try{if(v===(row?.value||'')){sessionStorage.removeItem(cacheKey);baseRef.current=row?.rev||0;setConflictState(null);setStatus('');}
      else{storeDraft(cacheKey,{version:2,studentId:student.id,teamId:student.teamId,personal:!!def.personal,key:def.key,value:v,baseRev:baseRef.current,updated:new Date().toISOString()});setStatus('입력칸을 나가면 저장');}}
    catch{setStatus('기기 저장 공간이 부족해요. 입력을 복사한 뒤 저장해 주세요.');}
    return true;
  }
  function useSaved(){const current=conflictRef.current;if(!current)return;valueRef.current=current.value;setValue(current.value);baseRef.current=current.rev;setDirtyState(false);setConflictState(null);sessionStorage.removeItem(cacheKey);setStatus('먼저 저장된 내용을 불러왔어요.');}
  const bound=boundKey.current===cacheKey;
  return {cacheKey,value:bound?value:(cacheKey?readDraft(cacheKey)?.value:undefined)??row?.value??'',dirty:bound&&dirty,status:bound?status:'',conflict:bound?conflict:null,change,persist,useSaved};
}
type FieldRecord = ReturnType<typeof useFieldRecord>;
type FieldProps = RecordFieldProps & {student:Student;record?:FieldRecord;comparisonValue?:string;legacyReference?:string;readOnly?:boolean};
export function Field(props:FieldProps) {
  if(props.def.hidden&&!props.readOnly)return null;
  return props.record?<FieldView {...props} record={props.record}/>:<OwnedField {...props}/>;
}
function OwnedField(props:FieldProps){const record=useFieldRecord(props);return <FieldView {...props} record={record}/>;}
function FieldView({def,row,disabled=false,record,comparisonValue,legacyReference,readOnly=false}:FieldProps&{record:FieldRecord}) {
  const {cacheKey,value,dirty,status,conflict,change,persist,useSaved}=record;
  const props={id:cacheKey,value,disabled,maxLength:3000,onBlur:()=>void persist(),onChange:(e:React.ChangeEvent<HTMLTextAreaElement|HTMLSelectElement>)=>change(e.target.value)};
  const selection=readComparison(def.input==='mission-pair'?value:comparisonValue);
  function choose(index:number,id:string){const ids:ComparisonIds=[...selection.ids];ids[index]=id?Number(id):null;if(change(writeComparison(ids,value)))void persist();}
  const time=row?.updated?new Date(row.updated).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'';
  return <div className={'field '+(def.personal?'personal-field':'')} data-field={def.key}>
    <div className="field-heading"><label htmlFor={def.input==='mission-pair'?cacheKey+'-0':cacheKey}>{clean(def.label)}{def.optional&&<small className="optional-label"> 선택</small>}</label><span className={'field-owner '+(def.personal?'purple':'')}>{def.personal?<UserRound size={13}/>:<Users size={13}/>} {def.personal?'나의 기록':'모둠 기록'}</span></div>
    {def.hint&&<p className="hint">{clean(def.hint)}</p>}
    {readOnly?<Readback title="보관 중인 이전 입력" value={value}/>:def.input==='mission-pair'?<>
      <div className="mission-pair-input" id={cacheKey}>{selection.ids.map((id,index)=><label key={index} htmlFor={cacheKey+'-'+index}><span>{index===0?'첫 번째':'두 번째'} 탐사</span><select id={cacheKey+'-'+index} value={id??''} disabled={disabled} onChange={e=>choose(index,e.target.value)} onBlur={()=>void persist()}><option value="">탐사를 선택하세요</option>{missionRecords.map(m=><option key={m.id} value={m.id} disabled={selection.ids[1-index]===m.id}>{missionChoiceLabel(m.id)}</option>)}</select></label>)}</div>
      <p className="hint selection-reminder">탐사를 바꾸었다면 이미 쓴 변화와 근거가 새로 고른 두 탐사와 맞는지 확인하세요.</p>
      {selection.legacy&&<details className="legacy-comparison" open={!selection.structured}><summary>이전에 쓴 비교 기록</summary><p>{selection.legacy}</p><small>원래 입력을 보관합니다. 비교할 두 탐사는 위에서 직접 골라 주세요.</small></details>}
      {legacyReference&&<details className="legacy-comparison"><summary>이전에 쓴 출발 근거 번호</summary><p>{legacyReference}</p></details>}
    </>:<>
      {def.key==='fact'&&selection.ids.some(id=>id!==null)&&<div className="fact-comparison-context">{selection.ids.map((id,index)=><p key={index}><b>{index===0?'첫 번째':'두 번째'} 탐사</b> {id===null?'아직 선택하지 않았어요.':missionChoiceLabel(id)}</p>)}</div>}
      {def.options?<select {...props}><option value="">선택하세요</option>{def.options.map(o=><option key={o} value={o}>{clean(o)}</option>)}</select>:<textarea {...props} rows={def.compact?2:3} placeholder={def.placeholder||'우리 생각과 근거를 적으세요.'}/>}
    </>}
    <div className="field-bottom"><span role="status">{status||(time?`${time} 저장${row?.actor?' / '+row.actor:''}`:'')}</span>{dirty&&<button className="text-btn" onClick={()=>void persist()} disabled={!!conflict||disabled}><Save size={13}/> 저장</button>}</div>
    {conflict&&<div className="conflict" role="alert"><b>다른 기기에서 먼저 수정했어요.</b><p>먼저 저장된 내용: {(def.input==='mission-pair'?comparisonText(conflict.value):conflict.value)||'빈 기록'}</p><p>내 입력은 위에 남아 있어요. 두 내용을 확인하고 저장할 내용을 결정하세요.</p><div className="button-row"><button onClick={()=>void persist(conflict.rev)} disabled={disabled}>{readOnly?'보관 중인 입력 반영':'위 입력을 반영'}</button><button onClick={useSaved}>먼저 저장된 내용 사용</button></div></div>}
  </div>;
}

export function Readback({title,value,empty='아직 작성하지 않았어요.'}:{title:string;value?:string;empty?:string}) {return <div className="readback"><small>{title}</small><p>{value?.trim()||empty}</p></div>;}
export function InquiryTrail({rows}:{rows:Row[]}) {
  const v=recordMap(rows);
  return <section className="inquiry-trail" aria-label="질문을 만든 과정"><h3>우리 질문이 만들어진 과정</h3><ol>{[
    ['1차시에서 확인한 사실',[v.factRef,v.fact].filter(Boolean).join('\n')],
    ['이 자료로는 답하지 못한 질문',v.gap],
    ['추가 자료에서 확인한 내용',[v.additionalRef,v.additionalFact].filter(Boolean).join('\n')],
    ['더 조사할 과제',v.task],
    ['우리 미션 질문',v.question]
  ].map(([title,value],i)=><li key={title}><span className="trail-number">{i+1}</span><Readback title={title} value={value}/></li>)}</ol></section>;
}
export function EnvironmentTable({rows}:{rows:Row[]}) {
  const v=recordMap(rows);
  return <section className="environment-table"><h3>탐사지 환경 조사표</h3><p className="hint">조사한 장소와 시기, 수치의 단위를 함께 확인해요.</p>{[1,2].map(i=><div className="environment-row" key={i}><h4>{v['env'+i]||`환경 ${i}`}</h4><dl><dt>확인한 정보와 조건</dt><dd>{v['envInfo'+i]||'미작성'}</dd><dt>자료 번호와 출처</dt><dd>{v['envSource'+i]||'미작성'}</dd><dt>예상 어려움과 대응</dt><dd>{v['envResponse'+i]||'미작성'}</dd>{v['envReview'+i]&&<><dt>3차시에서 보완한 점</dt><dd>{v['envReview'+i]}</dd></>}</dl></div>)}</section>;
}
export function Proposal({rows,label='우리 모둠 제안서'}:{rows:Row[];label?:string}) {
  const v=recordMap(rows);
  const sections=[['탐사 목표',v.goal],['선택한 까닭',v.selectionReason],['관찰하거나 측정할 대상',v.target],['얻으려는 자료',v.data],['자료를 얻는 방법과 이유',v.method],['예상 어려움',v.difficulty],['필요한 기술과 대응',[v.technology,v.response].filter(Boolean).join('\n')],['검증 후 반영한 내용',v.revision],['탐사의 의의와 영향',[v.evidenceRef,v.meaning].filter(Boolean).join('\n')],['우리 미션에서 기대하는 것',v.expectation],['남은 한계와 확인할 점',v.limitation]];
  return <article className="proposal"><p className="eyebrow">{label}</p><h2>{v.missionName||'우리 탐사 미션'}</h2><p className="destination-pill">{v.destination==='다른 탐사지'?v.otherDestination||'탐사지 미작성':v.destination||'탐사지 선택 전'}</p><div className="proposal-question">{v.question||'우리 모둠의 질문을 작성해 주세요.'}</div><InquiryTrail rows={rows}/><div className="proposal-grid">{sections.map(([title,value])=><section key={title}><h4>{title}</h4><p>{value?.trim()||'아직 작성하지 않았어요.'}</p></section>)}</div><EnvironmentTable rows={rows}/></article>;
}
export function RecordList({rows}:{rows:Row[]}) {return <>{rows.map(r=>{const selection=r.key==='comparison'?readComparison(r.value):null;return <React.Fragment key={r.key}><Readback title={clean(allFields.find(f=>f.key===r.key)?.label||r.key)} value={selection?comparisonText(r.value):r.value}/>{selection?.structured&&selection.legacy&&<Readback title="이전에 쓴 비교 기록" value={selection.legacy}/>}</React.Fragment>;})}</>;}

export function download(name:string,data:string,type='application/json') {const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export const csv=(rows:unknown[][])=>'\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
export const fmtCode=(c:string)=>c.match(/.{1,4}/g)?.join('-')||c;
