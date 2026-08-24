// CUSTOMER PAGE URL
const CUSTOMER_BASE_URL='https://scanpress-customer.vercel.app/customer.html';

// GENERATE SHOP URL
export function shopUrl(shopId,shopSerialNumber){
  if(!shopSerialNumber)return CUSTOMER_BASE_URL;
  return `${CUSTOMER_BASE_URL}?serial=${encodeURIComponent(shopSerialNumber)}`;
}

// BUILD QR ON SCREEN
export function buildQRCode(containerId,url){
  const el=document.getElementById(containerId);
  if(!el||!window.QRCode)return;
  el.innerHTML='';
  new window.QRCode(el,{
    text:url,width:240,height:240,colorDark:'#111111',colorLight:'#ffffff',
    correctLevel:window.QRCode.CorrectLevel.H
  });
}

// DRAW HELPERS
function rRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r);ctx.closePath();
}
function rRectTop(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h);
  ctx.lineTo(x,y+h);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}
function rRectBottom(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y);ctx.closePath();
}

// HIGH-RES QR
function buildHighResQR(url){
  return new Promise(resolve=>{
    const div=document.createElement('div');
    div.style.cssText='position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(div);
    new window.QRCode(div,{
      text:url,width:700,height:700,colorDark:'#111111',colorLight:'#ffffff',
      correctLevel:window.QRCode.CorrectLevel.H
    });
    setTimeout(()=>{
      const canvas=div.querySelector('canvas');
      resolve(canvas);
      document.body.removeChild(div);
    },200);
  });
}

// DOWNLOAD PREMIUM QR
export async function downloadQR(containerId,shopId,shopName,shopSerialNumber){
  if(!window.QRCode)return false;

  const url=shopUrl(shopId,shopSerialNumber);
  const name=shopName||'Print Shop';
  const SF='"Inter","Poppins",Arial,sans-serif';
  const qrCanvas=await buildHighResQR(url);
  if(!qrCanvas)return false;

  const W=1240,H=1754,M=70,CW=W-M*2,CH=H-M*2;
  const c=document.createElement('canvas');
  c.width=W;c.height=H;
  const ctx=c.getContext('2d');

  // BACKGROUND
  ctx.fillStyle='#EEE8E2';
  ctx.fillRect(0,0,W,H);

  // CARD
  ctx.shadowColor='rgba(0,0,0,0.18)';
  ctx.shadowBlur=40;ctx.shadowOffsetY=14;
  rRect(ctx,M,M,CW,CH,34);
  ctx.fillStyle='#fff';ctx.fill();
  ctx.shadowColor='transparent';

  // HEADER
  const HH=320;
  const grad=ctx.createLinearGradient(M,M,W,HH);
  grad.addColorStop(0,'#C6400E');
  grad.addColorStop(.5,'#E8521A');
  grad.addColorStop(1,'#FF8855');
  rRectTop(ctx,M,M,CW,HH,34);
  ctx.fillStyle=grad;ctx.fill();

  // BRAND
  const lx=M+48,ly=M+42,ls=86;
  rRect(ctx,lx,ly,ls,ls,20);
  ctx.fillStyle='rgba(255,255,255,.22)';ctx.fill();

  ctx.textAlign='left';
  ctx.fillStyle='#fff';
  ctx.font=`800 52px ${SF}`;
  ctx.fillText('ScanPress',lx+120,ly+56);
  ctx.fillStyle='rgba(255,255,255,.76)';
  ctx.font=`500 24px ${SF}`;
  ctx.fillText('Digital Print Queue',lx+120,ly+92);

  // SHOP NAME
  ctx.textAlign='center';
  ctx.fillStyle='#fff';
  ctx.font=`800 52px ${SF}`;
  ctx.fillText(name,W/2,260);
  ctx.fillStyle='rgba(255,255,255,.8)';
  ctx.font=`600 24px ${SF}`;
  ctx.fillText('Smart Digital Printing',W/2,305);

  // INSTRUCTION
  ctx.fillStyle='#444';
  ctx.font=`600 28px ${SF}`;
  ctx.fillText(
    'Scan this QR code to upload documents directly to this print shop',
    W/2,430
  );

  // QR FRAME
  const QS=540,QX=(W-QS)/2,QY=520;
  ctx.shadowColor='rgba(232,82,26,.15)';
  ctx.shadowBlur=35;ctx.shadowOffsetY=10;
  rRect(ctx,QX-30,QY-30,QS+60,QS+60,30);
  ctx.fillStyle='#fff';ctx.fill();
  ctx.shadowColor='transparent';
  ctx.strokeStyle='rgba(232,82,26,.22)';
  ctx.lineWidth=3;ctx.stroke();
  ctx.drawImage(qrCanvas,QX,QY,QS,QS);

  // URL
  ctx.fillStyle='#999';
  ctx.font=`18px ${SF}`;
  ctx.fillText(url,W/2,QY+QS+55);

  // DIVIDER
  ctx.strokeStyle='rgba(0,0,0,.08)';
  ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(140,1180);ctx.lineTo(W-140,1180);ctx.stroke();

  // STEPS
  const tips=[
    ['1','Scan QR Code','Using mobile camera'],
    ['2','Upload Files','Select print settings'],
    ['3','Ready to Print','Files appear instantly']
  ];
  const tw=CW/3;

  tips.forEach(([icon,line1,line2],i)=>{
    const bx=M+tw*i+20,bw=tw-40,by=1240;
    rRect(ctx,bx,by,bw,170,22);
    ctx.fillStyle='rgba(232,82,26,.05)';ctx.fill();
    ctx.fillStyle='#E8521A';
    ctx.font=`800 42px ${SF}`;
    ctx.textAlign='center';
    ctx.fillText(icon,bx+bw/2,by+60);
    ctx.fillStyle='#222';
    ctx.font=`700 24px ${SF}`;
    ctx.fillText(line1,bx+bw/2,by+102);
    ctx.fillStyle='#777';
    ctx.font=`18px ${SF}`;
    ctx.fillText(line2,bx+bw/2,by+136);
  });

  // FOOTER
  const FY=H-110;
  rRectBottom(ctx,M,FY,CW,60,30);
  ctx.fillStyle='#F5F1ED';ctx.fill();
  ctx.fillStyle='#888';
  ctx.textAlign='center';
  ctx.font=`600 20px ${SF}`;
  ctx.fillText(
    'Powered by ScanPress • Secure Digital Printing Platform',
    W/2,FY+38
  );

  // DOWNLOAD
  return new Promise(resolve=>{
    c.toBlob(blob=>{
      if(!blob)return resolve(false);
      const bUrl=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.download=`ScanPress-${name}.png`;
      a.href=bUrl;a.click();
      setTimeout(()=>URL.revokeObjectURL(bUrl),2000);
      resolve(true);
    },'image/png');
  });
}

// SHARE QR
export async function shareQR(shopId,shopName,shopSerialNumber){
  const url=shopUrl(shopId,shopSerialNumber);
  const name=shopName||'Print Shop';

  if(navigator.share){
    return navigator.share({
      title:`${name} — Print Files`,
      text:`Upload files directly to ${name} for printing.`,
      url
    });
  }

  await navigator.clipboard.writeText(url);
  return 'copied';
}