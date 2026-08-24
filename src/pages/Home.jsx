import {useEffect,useRef,useState,useCallback} from "react";
import {useNavigate} from "react-router-dom";
import {useApp} from "../services/AppContext";
import Topbar from "./Topbar";
import BottomNav from "./BottomNav";
import {buildQRCode,downloadQR,shopUrl} from "../services/qrService";
import {fmtINR} from "../utils/helpers";
import "../styles/home.css";

const AD_BANNERS=[
  {tag:"LIMITED OFFER",tagColor:"#ff9800",headline:"HP LaserJet Pro",sub:"Get 20% off on all HP laser printers this week only!",cta:"Shop Now →",bg:"linear-gradient(120deg,#b83200,#d84e00,#ff7a45)",shape1:"rgba(255,255,255,.10)",shape2:"rgba(255,255,255,.06)",emoji:"🖨️"},
  {tag:"BUY 3 GET 1",tagColor:"#4caf50",headline:"Ink Bundle Deal",sub:"Stock up on Epson EcoTank ink — buy 3 bottles, get 1 free",cta:"Grab Deal →",bg:"linear-gradient(120deg,#0d3b7a,#1565c0,#42a5f5)",shape1:"rgba(255,255,255,.09)",shape2:"rgba(255,255,255,.05)",emoji:"🖊️"},
  {tag:"COMBO DEAL",tagColor:"#8bc34a",headline:"Paper & Laminate",sub:"A4 reams + matte laminate pouches at unbeatable bundle price",cta:"View Offer →",bg:"linear-gradient(120deg,#1b5e20,#388e3c,#81c784)",shape1:"rgba(255,255,255,.10)",shape2:"rgba(255,255,255,.06)",emoji:"📄"},
  {tag:"SAME-DAY",tagColor:"#e91e63",headline:"Fast Print Service",sub:"Same-day delivery on all printing orders above ₹499",cta:"Order Now →",bg:"linear-gradient(120deg,#6a0035,#c2185b,#f06292)",shape1:"rgba(255,255,255,.10)",shape2:"rgba(255,255,255,.05)",emoji:"⚡"},
  {tag:"NEW LAUNCH",tagColor:"#9c27b0",headline:"Canon PIXMA G3770",sub:"Wireless colour MegaTank printer — now available at ₹11,990",cta:"Pre-Order →",bg:"linear-gradient(120deg,#3a006f,#7b1fa2,#ce93d8)",shape1:"rgba(255,255,255,.10)",shape2:"rgba(255,255,255,.06)",emoji:"🆕"}
];

function AdCarousel({onNavigate}){
  const[index,setIndex]=useState(0),timer=useRef(null),total=AD_BANNERS.length;
  const next=useCallback(()=>setIndex(i=>(i+1)%total),[total]);

  useEffect(()=>{
    timer.current=setInterval(next,3600);
    return()=>clearInterval(timer.current);
  },[next]);

  const ad=AD_BANNERS[index];

  return <div className="ad-carousel">
    <div className="ad-banner" style={{background:ad.bg}} onClick={()=>onNavigate("/shop")}>
      <div className="ad-circle ad-circle-1" style={{background:ad.shape1}}/>
      <div className="ad-circle ad-circle-2" style={{background:ad.shape2}}/>
      <div className="ad-circle ad-circle-3" style={{background:ad.shape2}}/>
      <div className="ad-tag" style={{background:ad.tagColor}}>{ad.tag}</div>
      <div className="ad-content">
        <div className="ad-headline">{ad.headline}</div>
        <div className="ad-sub">{ad.sub}</div>
        <div className="ad-cta">{ad.cta}</div>
      </div>
      <div className="ad-emoji-box"><span>{ad.emoji}</span></div>
    </div>

    <div className="ad-dots">
      {AD_BANNERS.map((_,i)=>
        <button key={i} className={`ad-dot${i===index?" active":""}`}
          onClick={()=>{
            clearInterval(timer.current);
            setIndex(i);
            timer.current=setInterval(next,3600);
          }}
          aria-label={`Banner ${i+1}`}
        />
      )}
    </div>
  </div>;
}

export default function Home(){
  const navigate=useNavigate();
  const{shopName,shopId,serialNumber,jobs,pricing,todayPrints,todayRevenue,showToast}=useApp();
  const qrBuilt=useRef(false);
  const[qrUrl,setQrUrl]=useState("");
  const[printer,setPrinter]=useState(null);

  const loadPrinter=useCallback(()=>{
    try{
      const saved=localStorage.getItem("scanpress_connected_printer");
      setPrinter(saved?JSON.parse(saved):null);
    }catch{
      setPrinter(null);
    }
  },[]);

  useEffect(()=>{
    loadPrinter();
    const update=()=>loadPrinter();
    window.addEventListener("focus",update);
    window.addEventListener("storage",update);
    document.addEventListener("visibilitychange",update);
    return()=>{
      window.removeEventListener("focus",update);
      window.removeEventListener("storage",update);
      document.removeEventListener("visibilitychange",update);
    };
  },[loadPrinter]);

  useEffect(()=>{
    if(!shopId)return;

    const url=shopUrl(shopId,serialNumber);
    setQrUrl(url);
    qrBuilt.current=false;

    const build=()=>{
      if(!window.QRCode)return setTimeout(build,200);
      buildQRCode("home-qr",url);
      const el=document.getElementById("h-qr-url");
      if(el)el.textContent=url;
      qrBuilt.current=true;
    };

    build();
  },[shopId,serialNumber]);

  const done=todayPrints,revenue=todayRevenue;
  const printerConnected=!!printer;
  const printerClass=`status-pill ${printerConnected?"live":"offline"}`;
  const printerLabel=printerConnected?"Connected":"Not Connected";
  const printerName=printer?.name||"No Printer Connected";

  async function handleDownloadQR(){
    if(!qrUrl)return showToast("QR not ready yet");
    const success=await downloadQR("home-qr",shopId,shopName);
    showToast(success?"QR downloaded!":"QR not ready");
  }

  async function handleShareQR(){
    if(!qrUrl)return showToast("QR not ready yet");
    try{
      if(navigator.share){
        await navigator.share({
          title:"ScanPress – Send files to print",
          text:`Scan to send documents to ${shopName}`,
          url:qrUrl
        });
      }else{
        await navigator.clipboard.writeText(qrUrl);
        showToast("Link copied!");
      }
    }catch{
      showToast("Share cancelled");
    }
  }

  return <div className="app-screen home-screen">
    <Topbar/>

    <AdCarousel onNavigate={navigate}/>

    <section className="home-hero">
      <div className="hero-eyebrow">
        <span className="hero-eyebrow-dot"/>
        Less Manual. More Digital
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Today's Prints</div>
          <div className="stat-value">{done}</div>
          <div className="stat-sub">completed prints</div>
        </div>

        <div className="card printer-card" onClick={()=>navigate("/printer-discovery")}>
          <div className="printer-top">
            <div className="printer-title">Printer</div>
            <div className={printerClass}>
              <span className="status-dot"/>
              {printerLabel}
            </div>
          </div>
          <h2 className="printer-id">{printerName}</h2>
        </div>

        <div className="revenue-card">
          <div className="revenue-label">Today's Revenue</div>
          <div className="revenue-value">{fmtINR(revenue)}</div>
          <div className="revenue-sub">
            {done} completed print{done!==1?"s":""}
          </div>
        </div>
      </div>
    </section>

    <section className="qr-section">
      <h2 className="qr-section-title">Your Shop QR Code</h2>

      <div className="qr-card">
        <div className="qr-note">
          This QR code is <strong>permanent</strong>. Print it once and paste it at your counter.
          <br/>
          Customers scan → send files directly to your queue.
        </div>

        <div className="qr-frame">
          <div className="qr-frame-inner" id="home-qr"/>
        </div>

        <div className="qr-url" id="h-qr-url">
          {qrUrl||"Loading QR..."}
        </div>

        <div className="qr-btns">
          <button className="qr-btn dl" onClick={handleDownloadQR}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>

          <button className="qr-btn sh" onClick={handleShareQR}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share Link
          </button>
        </div>
      </div>
    </section>

    <div className="footer-note">© 2026 ScanPress. All rights reserved.</div>
    <BottomNav active="home"/>
  </div>;
}