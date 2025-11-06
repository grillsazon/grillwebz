// theme.js — apply theme and background
document.addEventListener('DOMContentLoaded', async ()=>{
  try {
    const t = await DB.getTheme();
    if (t){
      if (t.primary) document.documentElement.style.setProperty('--primary', t.primary);
      if (t.secondary) document.documentElement.style.setProperty('--secondary', t.secondary);
      if (t.bgBlobId){
        const url = await DB.getBlobUrl(t.bgBlobId);
        if (url) document.body.style.backgroundImage = `url(${url})`;
      }
    }
    const s = await DB.getSettings();
    if (s && s.bizName) document.getElementById('brandName').textContent = s.bizName;
  } catch(e){ console.error('Theme error', e); }
});
