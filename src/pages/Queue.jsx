import {useState} from 'react';
import {useApp} from '../services/AppContext';
import Topbar from './Topbar';
import Preview from './Preview';
import {ftClass} from '../utils/helpers';
import '../styles/queue.css';

export default function Queue(){
  const {jobs,markJob,clearAllJobs,pricing}=useApp();
  const [previewOpen,setPreviewOpen]=useState(false);
  const [clearConfirm,setClearConfirm]=useState(false);
  const [previewData,setPreviewData]=useState({jobId:null,file:null,custName:''});
  const pending=jobs.filter(j=>j.status==='pending').length;

  function openPreview(jobId,file,custName){
    setPreviewData({jobId,file,custName});
    setPreviewOpen(true);
  }

  function finishPrint(){
    setPreviewOpen(false);
  }

  async function handleClearAll(){
    setClearConfirm(false);
    await clearAllJobs();
  }

  return(
    <div className="app-screen" style={{display:'flex',flexDirection:'column',minHeight:'100dvh',position:'relative',zIndex:1}}>
      <Topbar/>

      <div className="queue-header">
        <div className="queue-title">Queue</div>
        <div className="queue-tools">
          {jobs.length>0&&(
            <button className="clear-all-btn" onClick={()=>setClearConfirm(true)}>Clear all</button>
          )}
          <div className="queue-count">{pending} pending</div>
        </div>
      </div>

      <div className="day-label">Today</div>

      <div className="job-list">
        {jobs.length===0?(
          <div className="empty-queue">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p>No print jobs yet</p>
            <small>Waiting for customers to scan and send</small>
          </div>
        ):(
          jobs.map(job=><JobCard key={job.id} job={job} onPrint={openPreview} onMark={markJob}/>)
        )}
      </div>

      {/* <div className="footer-note">© 2026 ScanPress. All rights reserved.</div> */}

      {clearConfirm&&(
        <div className="clear-modal-backdrop" onClick={()=>setClearConfirm(false)}>
          <div className="clear-modal" onClick={e=>e.stopPropagation()}>
            <div className="clear-modal-title">Clear all queue logs?</div>
            <div className="clear-modal-text">All queue history will be permanently removed. This cannot be undone.</div>
            <div className="clear-modal-actions">
              <button onClick={()=>setClearConfirm(false)}>Cancel</button>
              <button className="danger" onClick={handleClearAll}>Clear all</button>
            </div>
          </div>
        </div>
      )}

      <Preview
        open={previewOpen}
        jobId={previewData.jobId}
        file={previewData.file}
        custName={previewData.custName}
        pricing={pricing}
        onClose={()=>setPreviewOpen(false)}
        onDone={finishPrint}
      />
    </div>
  );
}

function JobCard({job,onPrint,onMark}){
  const firstFile=job.files?.[0];

  function printFile(file){
    if(!file)return;
    onPrint(job.id,{
      name:file.n,
      ext:file.e,
      size:file.s,
      bucket:file.bucket,
      path:file.path,
      url:file.url,
      mime:file.mime
    },job.name);
  }

  return(
    <div className={`job-card s-${job.status}`}>
      <div className="job-top">
        <div className={`job-dot ${job.status}`}/>
        <div className="job-name">{job.name}</div>
        <div className="job-time">{job.time}</div>
      </div>

      {job.status==='pending'&&job.files?.length>0&&(
        <div className="job-files">
          {job.files.map((f,i)=>(
            <div key={f.id||i} className={`job-chip ${ftClass(f.e)}`} onClick={()=>printFile(f)}>
              <span>{f.e.toUpperCase()}</span>
              <span className="job-chip-name">{f.n}</span>
            </div>
          ))}
        </div>
      )}

      {job.status==='pending'&&job.notes?<div className="job-notes">{job.notes}</div>:null}

      {job.status==='pending'&&(
        <div className="job-actions">
          <button className="job-btn print" disabled={!firstFile} onClick={()=>printFile(firstFile)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5h-2M6 14h12v8H6v-8z"/>
            </svg>
            Print
          </button>

          <button className="job-btn cancel" onClick={()=>onMark(job.id,'cancelled')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Cancel
          </button>
        </div>
      )}

      {job.status==='done'&&(
        <div className="job-strip">
          <span className="job-strip-lbl" style={{color:'var(--ok)'}}>Successfully</span>
        </div>
      )}

      {job.status==='cancelled'&&(
        <div className="job-strip cancelled-strip">
          <span className="job-strip-lbl">Cancelled</span>
        </div>
      )}

      {job.status==='expired'&&(
        <div className="job-strip expired-strip">
          <span className="job-strip-lbl">Expired</span>
        </div>
      )}

      {job.status==='failed'&&(
        <div className="job-strip failed-strip">
          <span className="job-strip-lbl">Print failed</span>
          <button className="job-undo" onClick={()=>onMark(job.id,'pending')}>Retry</button>
        </div>
      )}
    </div>
  );
}