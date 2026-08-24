import {useState,useRef,useEffect} from 'react';
import {createPortal} from 'react-dom';
import {useApp} from '../services/AppContext';
import {ftClass} from '../utils/helpers';
import PrintService from '../services/PrintService';
import {calcPrice} from '../utils/pricing';
import '../styles/preview.css';

function SuccessRing(){
  const ringRef=useRef(null),checkRef=useRef(null),glowRef=useRef(null);
  useEffect(()=>{
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(ringRef.current){
        ringRef.current.style.transition='stroke-dashoffset .75s cubic-bezier(.4,0,.2,1)';
        ringRef.current.style.strokeDashoffset='0';
      }
    }));
    const t=setTimeout(()=>{checkRef.current?.classList.add('show');glowRef.current?.classList.add('show');},400);
    return()=>clearTimeout(t);
  },[]);
  return <div className="success-ring-wrap"><div className="success-glow" ref={glowRef}/><svg className="success-circle" viewBox="0 0 88 88"><circle className="bg" cx="44" cy="44" r="38"/><circle className="ring" cx="44" cy="44" r="38" ref={ringRef} transform="rotate(-90 44 44)"/></svg><div className="success-check"><svg className="check-svg" ref={checkRef} width="30" height="30" viewBox="0 0 30 30" fill="none"><path d="M5 15L12 22L25 8" stroke="var(--ok)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div></div>;
}

function FailedRing(){
  const ringRef=useRef(null),xRef=useRef(null),glowRef=useRef(null);
  useEffect(()=>{
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(ringRef.current){
        ringRef.current.style.transition='stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)';
        ringRef.current.style.strokeDashoffset='0';
      }
    }));
    const t=setTimeout(()=>{xRef.current?.classList.add('show');glowRef.current?.classList.add('show');},350);
    return()=>clearTimeout(t);
  },[]);
  return <div className="failed-ring-wrap"><div className="failed-glow" ref={glowRef}/><svg className="failed-circle" viewBox="0 0 88 88"><circle className="bg" cx="44" cy="44" r="38"/><circle className="ring" cx="44" cy="44" r="38" ref={ringRef} transform="rotate(-90 44 44)"/></svg><div className="failed-x"><svg className="x-svg" ref={xRef} width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M5 5L23 23M23 5L5 23" stroke="var(--fail)" strokeWidth="3" strokeLinecap="round"/></svg></div></div>;
}

function PrintProcessModal({state,onRetry,onClose}){
  const active=state!=='hidden';
  return createPortal(
    <div className={`print-process-overlay${active?' active':''}`} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="print-modal">
        {state==='printing'&&<div className="process-ring-wrap"><svg className="process-ring" viewBox="0 0 88 88"><circle className="track" cx="44" cy="44" r="38"/><circle className="fill" cx="44" cy="44" r="38" transform="rotate(-90 44 44)"/></svg><div className="process-center-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"/></svg></div></div>}
        {state==='success'&&<SuccessRing/>}
        {state==='failed'&&<FailedRing/>}
        <div className="process-title" style={{color:state==='success'?'var(--ok)':state==='failed'?'var(--fail)':'var(--ink)'}}>{state==='printing'?'Sending to Printer':state==='success'?'Printed Successfully':'Print Failed'}</div>
        <div className="process-sub">
          {state==='printing'&&<><span>Please wait</span><span className="process-dots"><span className="process-dot"/><span className="process-dot"/><span className="process-dot"/></span></>}
          {state==='success'&&<span style={{color:'var(--ok)'}}>Job completed · Queue updated</span>}
          {state==='failed'&&<span style={{color:'var(--ink3)'}}>Check printer connection and try again</span>}
        </div>
        {state==='failed'&&<button className="process-retry-btn" onClick={onRetry}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6,verticalAlign:-2}}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.99"/></svg>Retry Print</button>}
      </div>
    </div>,
    document.body
  );
}

export default function Preview({open,jobId,file,custName,pricing,onClose,onDone}){
  const {jobs,markJob}=useApp();
  const [size,setSize]=useState('A4');
  const [mode,setMode]=useState('Black & White');
  const [sides,setSides]=useState('1-Sided');
  const [copies,setCopies]=useState(1);
  const [copiesRaw,setCopiesRaw]=useState('1');
  const [procState,setProcState]=useState('hidden');

  const job=jobs.find(j=>j.id===jobId);

  useEffect(()=>{
    if(!open)return;
    const y=window.scrollY;
    document.body.style.position='fixed';
    document.body.style.top=`-${y}px`;
    document.body.style.left='0';
    document.body.style.right='0';
    document.body.style.overflowY='scroll';
    return()=>{
      const top=parseInt(document.body.style.top||'0')*-1;
      document.body.style.position='';
      document.body.style.top='';
      document.body.style.left='';
      document.body.style.right='';
      document.body.style.overflowY='';
      window.scrollTo(0,top);
    };
  },[open]);

  useEffect(()=>{
    if(!open||!job)return;

    const rawSize=job.paper_size??job.paperSize??job.size??'A4';
    const rawMode=job.print_type??job.printType??job.mode??'black_white';
    const rawSides=job.sides??job.side??'single';
    const rawCopies=Number(job.copies??job.copy_count??job.copyCount??1);

    setSize(String(rawSize).toLowerCase()==='legal'?'Legal':String(rawSize).toUpperCase());
    setMode(['color','colour','colored','colour_print'].includes(String(rawMode).toLowerCase())?'Colour':'Black & White');
    setSides(['double','duplex','2-sided','2_sided'].includes(String(rawSides).toLowerCase())?'2-Sided':'1-Sided');
    setCopies(rawCopies>=1?rawCopies:1);
    setCopiesRaw(String(rawCopies>=1?rawCopies:1));
  },[open,job]);

  const p=pricing||{bwS:2,bwD:3,colS:10,colD:18,a4S:2,a4D:3.5,legS:3,legD:5};
  const {display:priceDisplay,summary,total}=calcPrice({size,mode,sides,copies},p);
  const ext=file?.ext||'pdf',fname=file?.name||'document.pdf',fsize=file?.size||'';

  function handleCopiesChange(e){
    const raw=e.target.value;
    if(raw===''||/^\d+$/.test(raw)){
      setCopiesRaw(raw);
      const v=parseInt(raw,10);
      if(!isNaN(v)&&v>=1&&v<=99)setCopies(v);
    }
  }

  function handleCopiesBlur(){
    let v=parseInt(copiesRaw,10);
    if(isNaN(v)||v<1)v=1;
    if(v>99)v=99;
    setCopies(v);
    setCopiesRaw(String(v));
  }

  function adjustCopies(delta){
    const next=Math.max(1,Math.min(99,copies+delta));
    setCopies(next);
    setCopiesRaw(String(next));
  }

  async function runPrint(){
    setProcState('printing');
    if(!file?.url){
      setProcState('failed');
      return;
    }
    try{
      await PrintService.print({id:jobId,file,copies,size,mode,side:sides,customer:custName});
      await markJob(jobId,'done',total);
      setProcState('success');
      setTimeout(()=>{setProcState('hidden');onDone?.();},2600);
    }catch(error){
      console.error('Print failed:',error);
      setProcState('failed');
    }
  }

  function confirmPrint(){
    onClose();
    runPrint();
  }

  const retryPrint=runPrint;
  const SIZES=['A3','A4','A5','A6','Legal','Letter'];
  const MODES=['Black & White','Colour'];
  const SIDES=['1-Sided','2-Sided'];

  return <>
    {createPortal(
      <div className={`overlay${open?' open':''}`} onClick={e=>{if(e.target.classList.contains('overlay'))onClose()}}>
        <div className="sheet" onClick={e=>e.stopPropagation()}>
          <div className="sheet-handle"/>

          <div className="prev-hdr">
            <div className="prev-hdr-info">
              <div className="prev-hdr-name">{fname}</div>
              <div className="prev-hdr-meta">From: {custName}{fsize?' · '+fsize:''}</div>
            </div>
            <button className="prev-close" onClick={onClose} aria-label="Close">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="prev-body">
            <div className="doc-preview">
              <div className={`doc-big-icon ${ftClass(ext)}`}>{ext.toUpperCase().slice(0,4)}</div>
              <div className="doc-name">{fname}</div>
              <div className="doc-size">{fsize||'Tap Print to send to printer'}</div>
            </div>

            <div className="opt-section">
              <div className="opt-title">Paper Size</div>
              <div className="opts-row">
                {SIZES.map(s=>
                  <button key={s} className={`opt${size===s?' sel':''}`} onClick={()=>setSize(s)}>
                    {s}
                  </button>
                )}
              </div>
            </div>

            <div className="opt-section">
              <div className="opt-title">Print Type</div>
              <div className="opts-row">
                {MODES.map(m=>
                  <button key={m} className={`opt${mode===m?' sel':''}`} onClick={()=>setMode(m)}>
                    {m}
                  </button>
                )}
              </div>
            </div>

            <div className="opt-section">
              <div className="opt-title">Printing Sides</div>
              <div className="opts-row">
                {SIDES.map(s=>
                  <button key={s} className={`opt${sides===s?' sel':''}`} onClick={()=>setSides(s)}>
                    {s}
                  </button>
                )}
              </div>
            </div>

            <div className="copies-row">
              <div className="copies-label">Copies</div>
              <div className="copies-ctrl">
                <button className="copies-btn" type="button" onClick={()=>adjustCopies(-1)}>−</button>
                <input className="copies-input" type="number" min="1" max="99" value={copiesRaw} onChange={handleCopiesChange} onBlur={handleCopiesBlur} aria-label="Number of copies"/>
                <button className="copies-btn" type="button" onClick={()=>adjustCopies(1)}>+</button>
              </div>
            </div>
          </div>

          <div className="order-bar">
            <div className="order-bar-row">
              <span className="order-bar-label">Your Order</span>
              <span className="order-price">{priceDisplay}</span>
            </div>
            <div className="order-bar-detail">{summary}</div>

            <button className="print-submit" onClick={confirmPrint}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"/>
              </svg>
              Confirm Print
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    <PrintProcessModal state={procState} onRetry={retryPrint} onClose={()=>setProcState('hidden')}/>
  </>;
}