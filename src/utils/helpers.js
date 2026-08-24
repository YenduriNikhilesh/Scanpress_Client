export function ftClass(ext) {
  const map = {
    pdf:'ft-pdf', doc:'ft-doc', docx:'ft-docx',
    xls:'ft-xls', xlsx:'ft-xlsx', ppt:'ft-ppt', pptx:'ft-pptx',
    jpg:'ft-img', jpeg:'ft-img', png:'ft-img', gif:'ft-img', webp:'ft-img',
  };
  return map[String(ext).toLowerCase()] || 'ft-def';
}

export function fmtINR(n) {
  return '₹' + Number(n).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function nowTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
