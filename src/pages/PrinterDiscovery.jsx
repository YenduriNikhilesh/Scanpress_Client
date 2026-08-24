import {useState,useEffect} from "react";
import {
  ArrowLeft,FileText,Printer,Wifi,Clock,ShieldCheck,Link2,
  Search,RefreshCw
} from "lucide-react";
import {useNavigate} from "react-router-dom";
import "../styles/printdiscovery.css";

const printers=[
  {id:1,name:"HP LaserJet Pro MFP M426fdw",ip:"192.168.1.101",protocol:"mDNS",signal:"Excellent"},
  {id:2,name:"Canon PIXMA G3010",ip:"192.168.1.120",protocol:"TCP",signal:"Excellent"},
  {id:3,name:"Brother HL-L2321D",ip:"192.168.1.135",protocol:"OS",signal:"Strong"},
  {id:4,name:"Epson L3110",ip:"192.168.1.150",protocol:"TCP",signal:"Strong"},
  {id:5,name:"Samsung L3110",ip:"192.168.1.150",protocol:"TCP",signal:"Strong"}
];

function SignalBars({strength}){
  const bars=strength==="Excellent"?4:strength==="Strong"?3:strength==="Good"?2:1;
  return <span className="signal-bars">
    {[1,2,3,4].map(i=><span key={i} className={`signal-bar ${i<=bars?"filled":""}`}/>)}
  </span>;
}

export default function PrinterDiscovery(){
  const navigate=useNavigate();

  const [connectedPrinter,setConnectedPrinter]=useState(()=>{
    try{
      const saved=localStorage.getItem("scanpress_connected_printer");
      return saved?JSON.parse(saved):null;
    }catch{return null;}
  });

  const [recentPrinters,setRecentPrinters]=useState(()=>{
    try{
      const saved=localStorage.getItem("scanpress_recent_printers");
      return saved?JSON.parse(saved):[];
    }catch{return [];}
  });

  const [activeTab,setActiveTab]=useState("discover");
  const [scanProgress,setScanProgress]=useState(65);
  const [scanning,setScanning]=useState(true);
  const [visiblePrinters,setVisiblePrinters]=useState(printers);

  useEffect(()=>{
    if(!scanning)return;
    const timer=setInterval(()=>{
      setScanProgress(p=>{
        const next=p+1;
        if(next>=100){
          setScanning(false);
          setVisiblePrinters(printers);
          return 100;
        }
        const count=Math.floor(next/20);
        if(count>0)setVisiblePrinters(printers.slice(0,count));
        return next;
      });
    },120);
    return()=>clearInterval(timer);
  },[scanning]);

  useEffect(()=>{
    if(connectedPrinter)
      localStorage.setItem("scanpress_connected_printer",JSON.stringify(connectedPrinter));
    else
      localStorage.removeItem("scanpress_connected_printer");
  },[connectedPrinter]);

  useEffect(()=>{
    localStorage.setItem("scanpress_recent_printers",JSON.stringify(recentPrinters));
  },[recentPrinters]);

  const scanAgain=()=>{
    setVisiblePrinters([]);
    setScanProgress(0);
    setScanning(true);
  };

  const connectPrinter=printer=>{
    setConnectedPrinter(printer);
    setRecentPrinters(prev=>[
      printer,
      ...prev.filter(p=>p.id!==printer.id)
    ].slice(0,5));
    setActiveTab("discover");
  };

  const disconnectPrinter=()=>{
    setConnectedPrinter(null);
  };

  const connectRecent=printer=>{
    setConnectedPrinter(printer);
    setRecentPrinters(prev=>[
      printer,
      ...prev.filter(p=>p.id!==printer.id)
    ].slice(0,5));
  };

  return <div className="pd-screen">

    {/* TOP BAR */}
    <header className="pd-topbar">
      <div className="pd-brand">
        <div className="pd-brand-icon"><FileText size={22}/></div>
        <strong>Printer<span>Discovery</span></strong>
      </div>

      <button className="pd-back-btn" onClick={()=>navigate(-1)} aria-label="Go back">
        <ArrowLeft size={21}/>
      </button>
    </header>

    {/* CONNECTED PRINTER */}
    {connectedPrinter?(
      <section className="pd-printer-status connected">
        <div className="pd-printer-image">
          <Printer size={58}/>
          <span className="pd-online-dot"/>
        </div>

        <div className="pd-printer-info">
          <span className="pd-status connected-status">● Connected</span>
          <h2>{connectedPrinter.name}</h2>
          <p>{connectedPrinter.ip} <b>·</b> <strong>{connectedPrinter.protocol}</strong></p>

          <div className="pd-status-badges">
            <span><Wifi size={12}/> Strong</span>
            <span><Clock size={12}/> Just now</span>
            <span><ShieldCheck size={12}/> Ready</span>
          </div>
        </div>

        <button className="pd-printer-action disconnect" onClick={disconnectPrinter}>
          <Link2 size={14}/> Disconnect
        </button>
      </section>
    ):(
      <section className="pd-no-printer">
        <div className="pd-no-printer-icon"><Printer size={48}/><i>×</i></div>
        <h2>No Printer Connected</h2>
        <p>Connect a printer to start printing.</p>

        <button className="pd-printer-action connect" onClick={()=>setActiveTab("discover")}>
          <Link2 size={16}/> Connect Printer
        </button>
      </section>
    )}

    {/* TABS */}
    <nav className="pd-tabs">
      <button className={`pd-tab ${activeTab==="discover"?"active":""}`} onClick={()=>setActiveTab("discover")}>
        <Search size={15}/> Discover
      </button>

      <button className={`pd-tab ${activeTab==="connected"?"active":""}`} onClick={()=>setActiveTab("connected")}>
        <Link2 size={15}/> Connected
      </button>

      <button className={`pd-tab ${activeTab==="recent"?"active":""}`} onClick={()=>setActiveTab("recent")}>
        <Clock size={15}/> Recent
      </button>
    </nav>

    {/* DISCOVER */}
    {activeTab==="discover"&&<>
      <section className="pd-scan-card">
        <div className="pd-radar">
          <span className="pd-radar-ring ring-1"/>
          <span className="pd-radar-ring ring-2"/>
          <span className="pd-radar-ring ring-3"/>
          <span className="pd-radar-dot"/>
        </div>

        <div className="pd-scan-info">
          <h3>{scanning?"Scanning for Printers...":"Scan complete"}</h3>
          <p>Searching in your local network</p>

          <div className="pd-progress-track">
            <div className="pd-progress-fill" style={{width:`${scanProgress}%`}}/>
          </div>
        </div>

        <div className="pd-scan-percent">
          <strong>{scanProgress}%</strong>
          <Wifi size={18}/>
        </div>
      </section>

      <section className="pd-available">
        <div className="pd-available-header">
          <h3>Available Printers <span>{visiblePrinters.length}</span></h3>

          <button className="pd-scan-again-btn" onClick={scanAgain} disabled={scanning}>
            <RefreshCw size={13}/> Scan Again
          </button>
        </div>

        <div className="pd-printer-list">
          {visiblePrinters.map(p=>{
            const connected=connectedPrinter?.id===p.id;

            return <article className="pd-printer-card" key={p.id}>
              <div className="pd-printer-picture"><Printer size={34}/></div>

              <div className="pd-printer-details">
                <h4>{p.name}</h4>
                <p>{p.ip} <b>·</b> {p.protocol}</p>

                <div className="pd-printer-status">
                  <span>● ONLINE</span>
                  <SignalBars strength={p.signal}/>
                </div>
              </div>

              <button
                className={`pd-connect-btn ${connected?"connected":""}`}
                onClick={()=>connected?disconnectPrinter():connectPrinter(p)}
              >
                {connected?"✓ Connected":"Connect"}
              </button>
            </article>;
          })}
        </div>
      </section>
    </>}

    {/* CONNECTED */}
    {activeTab==="connected"&&(
      <section className="pd-connected-list">
        {connectedPrinter?(
          <article className="pd-connected-card">
            <div className="pd-printer-picture"><Printer size={34}/></div>

            <div className="pd-printer-details">
              <h4>{connectedPrinter.name}</h4>
              <p>{connectedPrinter.ip} <b>·</b> {connectedPrinter.protocol}</p>

              <div className="pd-printer-status">
                <span>● CONNECTED</span>
                <SignalBars strength={connectedPrinter.signal}/>
              </div>
            </div>

            <button className="pd-connect-btn connected" onClick={disconnectPrinter}>
              ✓ Connected
            </button>
          </article>
        ):(
          <div className="pd-connected-empty">
            <Printer size={42}/>
            <h3>No Connected Printers</h3>
            <p>Connect a printer from the Discover tab.</p>
          </div>
        )}
      </section>
    )}

    {/* RECENT */}
    {activeTab==="recent"&&(
      <section className="pd-connected-list">
        {recentPrinters.length?recentPrinters.map(p=>(
          <article className="pd-connected-card" key={p.id}>
            <div className="pd-printer-picture"><Printer size={34}/></div>

            <div className="pd-printer-details">
              <h4>{p.name}</h4>
              <p>{p.ip} <b>·</b> {p.protocol}</p>

              <div className="pd-printer-status">
                <span>● RECENT</span>
                <SignalBars strength={p.signal}/>
              </div>
            </div>

            <button
              className={`pd-connect-btn ${connectedPrinter?.id===p.id?"connected":""}`}
              onClick={()=>connectedPrinter?.id===p.id?disconnectPrinter():connectRecent(p)}
            >
              {connectedPrinter?.id===p.id?"✓ Connected":"Connect"}
            </button>
          </article>
        )):(
          <div className="pd-connected-empty">
            <Clock size={42}/>
            <h3>No Recent Printers</h3>
            <p>Recently connected printers will appear here.</p>
          </div>
        )}
      </section>
    )}

    <footer className="pd-footer">
      © 2026 ScanPress. All rights reserved.
    </footer>

  </div>;
}