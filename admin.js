// admin.js — robust admin with reset-tabs button and toasts
let SEARCH_TERM = '';
let CURRENT_EDIT_ITEM = null;

function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(), 1800); }

async function initAdmin(){
  await DB.ensureDefaultTabs();
  await DB.ensureDefaultMenuSections();

  // Reset tabs button
  document.getElementById('btnResetTabs').onclick = async ()=>{
    await DB.resetTabs();
    await fillTabSelect('promoTab','promo');
    await fillTabSelect('comboTab','combo');
    await fillMenuSectionSelect();
    toast('Pestañas recreadas: 10/10/20 ✅');
  };

  // Settings
  const settings = await DB.getSettings() || { bizName:'Grill & Sazón', waNumber:'' };
  document.getElementById('bizName').value = settings.bizName || '';
  document.getElementById('waNumber').value = settings.waNumber || '';

  document.getElementById('saveSettings').addEventListener('click', async ()=>{
    try {
      const bizName = document.getElementById('bizName').value.trim() || 'Grill & Sazón';
      const waNumber = document.getElementById('waNumber').value.trim();
      await DB.saveSettings({ bizName, waNumber });
      toast('Ajustes guardados ✅');
    } catch(e){ alert('Error guardando ajustes: '+e.message); console.error(e); }
  });

  // Theme
  const theme = await DB.getTheme() || { primary:'#ff6a00', secondary:'#222222', bgBlobId:null };
  document.getElementById('colorPrimary').value = theme.primary || '#ff6a00';
  document.getElementById('colorSecondary').value = theme.secondary || '#222222';
  document.getElementById('saveTheme').addEventListener('click', async ()=>{
    try {
      let bgBlobId = theme.bgBlobId;
      const primary = document.getElementById('colorPrimary').value;
      const secondary = document.getElementById('colorSecondary').value;
      const bgFile = document.getElementById('bgFile').files[0];
      if (bgFile){ const { id } = await fileToBlobIdAndUrl(bgFile, 'bg'); bgBlobId = id; }
      await DB.saveTheme({ id:'theme', primary, secondary, bgBlobId });
      toast('Tema guardado 🎨');
    } catch(e){ alert('Error guardando tema: '+e.message); console.error(e); }
  });

  // Selects
  await fillTabSelect('promoTab','promo');
  await fillTabSelect('comboTab','combo');
  await fillMenuSectionSelect();

  // Lists
  await refreshLists();

  // Handlers items
  document.getElementById('addPromo').onclick = ()=> addItemFromForm('promo');
  document.getElementById('addCombo').onclick = ()=> addItemFromForm('combo');
  document.getElementById('addMenu').onclick  = ()=> addItemFromForm('menu');

  const searchEl = document.getElementById('searchBox');
  searchEl.addEventListener('input', async (e)=>{ SEARCH_TERM=(e.target.value||'').toLowerCase(); await refreshLists(); });
}

async function fillTabSelect(selectId, category){
  const sel = document.getElementById(selectId);
  sel.innerHTML = '';
  const tabs = await DB.listTabsByCategory(category);
  for (const t of tabs) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  }
  // Show count for sanity
  sel.title = `${tabs.length} pestañas`;
}

async function fillMenuSectionSelect(){
  const sel = document.getElementById('menuSection');
  const sections = (await DB.listMenuSections()).filter(s=>s.enabled).sort((a,b)=>a.order-b.order);
  sel.innerHTML = '';
  for (const s of sections){
    const opt=document.createElement('option'); opt.value=s.name; opt.textContent=s.name; sel.appendChild(opt);
  }
  sel.title = `${sections.length} secciones activas`;
}

function matchesSearch(it){
  if (!SEARCH_TERM) return true;
  const hay = (it.name||'') + ' ' + (it.desc||'');
  return hay.toLowerCase().includes(SEARCH_TERM);
}

async function addItemFromForm(category){
  const nameEl = document.getElementById(category+'Name');
  const priceEl= document.getElementById(category+'Price');
  const descEl = document.getElementById(category+'Desc');
  const imgEl  = document.getElementById(category+'Img');

  const name = (nameEl.value||'').trim();
  const price= parseFloat(priceEl.value||'0');
  const desc = (descEl.value||'').trim();
  const file = imgEl.files[0];

  if (!name || !(price>0)){ alert('Nombre y precio son obligatorios'); return; }

  let imgBlobId = null;
  if (file){ const { id } = await fileToBlobIdAndUrl(file, 'item'); imgBlobId = id; }

  const item = { category, name, price, desc, imgBlobId, createdAt:Date.now() };

  if (category==='menu'){
    const sectionSel = document.getElementById('menuSection');
    item.menuSection = sectionSel ? sectionSel.value : 'Otros';
  } else {
    const tabSel = document.getElementById(category+'Tab');
    const tabId = parseInt(tabSel.value,10);
    if (!tabId){ alert('Selecciona una pestaña'); return; }
    item.tabId = tabId;
  }

  await DB.addItem(item);
  nameEl.value=''; priceEl.value=''; descEl.value=''; imgEl.value='';
  await refreshLists();
  toast('Ítem añadido ✅');
}

async function refreshLists(){
  const all = await DB.listAllItems();
  const cats = { promo:[], combo:[], menu:[] };
  for (const it of all){ if (cats[it.category]) cats[it.category].push(it); }

  await renderListByTab('promoList', cats.promo, 'promo');
  await renderListByTab('comboList', cats.combo, 'combo');
  await renderListByMenuSections('menuList', cats.menu);
}

async function renderListByTab(containerId, items, category){
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  const byTab = {};
  for (const it of items){ if (!matchesSearch(it)) continue; byTab[it.tabId]=byTab[it.tabId]||[]; byTab[it.tabId].push(it); }
  const tabs = await DB.listTabsByCategory(category);
  for (const t of tabs){
    const header=document.createElement('div'); header.style.margin='8px 0'; header.innerHTML=`<span class="badge">${t.name}</span>`; el.appendChild(header);
    const group=document.createElement('div'); group.className='list';
    const list=byTab[t.id]||[];
    for (const it of list){
      const wrap=document.createElement('div'); wrap.className='list-item';
      const img=document.createElement('img'); if (it.imgBlobId) img.src=await DB.getBlobUrl(it.imgBlobId);
      const meta=document.createElement('div'); meta.className='meta'; meta.innerHTML=`<strong>${it.name}</strong><span>$${it.price.toFixed(2)}</span><small>${it.desc||''}</small>`;
      const edit=document.createElement('button'); edit.className='btn'; edit.textContent='Editar'; edit.onclick=()=>openEdit(it);
      const del=document.createElement('button'); del.className='delete-btn btn'; del.textContent='Eliminar'; del.onclick=async()=>{ await DB.deleteItem(it.id); await refreshLists(); };
      const actions=document.createElement('div'); actions.style.display='flex'; actions.style.gap='6px'; actions.append(edit,del);
      wrap.append(img,meta,actions); group.appendChild(wrap);
    }
    el.appendChild(group);
  }
}

async function renderListByMenuSections(containerId, items){
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  const sections = await DB.listMenuSections();
  for (const s of sections.sort((a,b)=>a.order-b.order)){
    const secName = s.name;
    const groupItems = s.enabled ? items.filter(it => (it.menuSection||'Otros')===secName && matchesSearch(it)) : [];
    if (!groupItems.length) continue;
    const header=document.createElement('div'); header.style.margin='8px 0'; header.innerHTML=`<span class="badge">${secName}</span>`; el.appendChild(header);
    const group=document.createElement('div'); group.className='list';
    for (const it of groupItems){
      const wrap=document.createElement('div'); wrap.className='list-item';
      const img=document.createElement('img'); if (it.imgBlobId) img.src=await DB.getBlobUrl(it.imgBlobId);
      const meta=document.createElement('div'); meta.className='meta'; meta.innerHTML=`<strong>${it.name}</strong><span>$${it.price.toFixed(2)}</span><small>${it.desc||''}</small>`;
      const edit=document.createElement('button'); edit.className='btn'; edit.textContent='Editar'; edit.onclick=()=>openEdit(it);
      const del=document.createElement('button'); del.className='delete-btn btn'; del.textContent='Eliminar'; del.onclick=async()=>{ await DB.deleteItem(it.id); await refreshLists(); };
      const actions=document.createElement('div'); actions.style.display='flex'; actions.style.gap='6px'; actions.append(edit,del);
      wrap.append(img,meta,actions); group.appendChild(wrap);
    }
    el.appendChild(group);
  }
}

// Simple edit dialog using prompt (robust across browsers)
async function openEdit(item){
  const name = prompt('Nombre', item.name||''); if (name===null) return;
  const priceStr = prompt('Precio', String(item.price||0)); if (priceStr===null) return;
  const price = parseFloat(priceStr)||item.price;
  const desc = prompt('Descripción', item.desc||''); if (desc===null) return;

  const updated = { ...item, name, price, desc };
  if (item.category==='menu'){
    const secs = (await DB.listMenuSections()).map(s=>s.name).join(', ');
    const sec = prompt('Sección (opciones: '+secs+')', item.menuSection||''); if (sec===null) return;
    updated.menuSection = sec;
  } else {
    const tabs = await DB.listTabsByCategory(item.category);
    const tabNames = tabs.map(t=>`${t.id}:${t.name}`).join(', ');
    const idStr = prompt('Tab ID (opciones: '+tabNames+')', String(item.tabId||'')); if (idStr===null) return;
    updated.tabId = parseInt(idStr,10)||item.tabId;
  }
  await DB.updateItem(updated);
  await refreshLists();
  toast('Ítem actualizado ✅');
}

// Sections editor
async function renderMenuSectionsEditor(){
  const container=document.getElementById('menuSectionsList');
  const sections=await DB.listMenuSections();
  container.innerHTML='';
  sections.forEach((s, idx)=>{
    const row=document.createElement('div'); row.className='list-item ms-row'; row.dataset.id=s.id;
    const meta=document.createElement('div'); meta.className='meta'; meta.innerHTML=`<strong>Orden <span class="ms-order">${s.order}</span></strong><small>ID ${s.id}</small>`;
    const controls=document.createElement('div'); controls.style.display='flex'; controls.style.gap='6px'; controls.style.alignItems='center';
    const nameInput=document.createElement('input'); nameInput.className='ms-name'; nameInput.value=s.name;
    const enabled=document.createElement('input'); enabled.type='checkbox'; enabled.className='ms-enabled'; enabled.checked=!!s.enabled;
    const up=document.createElement('button'); up.textContent='↑'; up.className='btn';
    const down=document.createElement('button'); down.textContent='↓'; down.className='btn';
    up.onclick=async()=>{ await moveSection(s.id,-1); };
    down.onclick=async()=>{ await moveSection(s.id,1); };
    const enabledLabel=document.createElement('label'); enabledLabel.textContent=' Activa'; enabledLabel.style.color='#ccc';
    controls.append(nameInput,enabled,enabledLabel,up,down);
    row.append(meta,controls); container.appendChild(row);
  });

  document.getElementById('addMenuSection').onclick = async ()=>{
    const name = (document.getElementById('newMenuSectionName').value||'').trim(); if (!name) return;
    const list = await DB.listMenuSections(); const next = list.length? Math.max(...list.map(s=>s.order))+1 : 1;
    await DB.saveMenuSection({ name, order: next, enabled: true });
    document.getElementById('newMenuSectionName').value='';
    await renderMenuSectionsEditor(); await fillMenuSectionSelect(); toast('Sección añadida ✅');
  };
  document.getElementById('saveMenuSections').onclick = async ()=>{
    const rows = document.querySelectorAll('#menuSectionsList .ms-row');
    for (const r of rows){
      const id = parseInt(r.dataset.id,10);
      const name = r.querySelector('.ms-name').value.trim() || 'Sección';
      const enabled = r.querySelector('.ms-enabled').checked;
      const order = parseInt(r.querySelector('.ms-order').textContent,10);
      await DB.saveMenuSection({ id, name, enabled, order });
    }
    await fillMenuSectionSelect();
    toast('Secciones guardadas ✅');
  };
}

async function moveSection(id, delta){
  const s = await DB.listMenuSections();
  const i = s.findIndex(x=>x.id===id);
  const j = i + delta;
  if (i<0 || j<0 || j>=s.length) return;
  const a = s[i], b = s[j];
  const tmp = a.order; a.order=b.order; b.order=tmp;
  await DB.saveMenuSection(a); await DB.saveMenuSection(b);
  await renderMenuSectionsEditor();
}

async function refreshCoupons(){
  const list = await DB.listCoupons();
  const el = document.getElementById('couponList'); el.innerHTML='';
  for (const c of list){
    const row=document.createElement('div'); row.className='list-item';
    const meta=document.createElement('div'); meta.className='meta';
    const parts=[];
    if (c.percent>0) parts.push(`${c.percent}%`);
    if (c.amount>0) parts.push(`$${Number(c.amount).toFixed(2)}`);
    if (c.minSubtotal>0) parts.push(`mín $${Number(c.minSubtotal).toFixed(2)}`);
    if (c.expiresAt){ const d=new Date(c.expiresAt); parts.push(`vence ${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); }
    meta.innerHTML = `<strong>${c.code}</strong><span>${parts.join(' · ') || '—'}</span>`;
    const del=document.createElement('button'); del.className='delete-btn btn'; del.textContent='Eliminar'; del.onclick=async()=>{ await DB.deleteCoupon(c.id); await refreshCoupons();
  const exp=document.getElementById('exportBtn'); if(exp) exp.onclick=exportAllData;
  const imp=document.getElementById('importBtn'); if(imp) imp.onclick=async()=>{ const f=document.getElementById('importFile').files[0]; if(!f){ alert('Selecciona un archivo .json'); return; } const txt=await f.text(); const json=JSON.parse(txt); await importAllData(json); }; };
    const blank=document.createElement('img'); blank.style.visibility='hidden';
    row.append(blank, meta, del); el.appendChild(row);
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{ initPinGate();
  try {
    await initAdmin();
    await renderMenuSectionsEditor();
    await refreshCoupons();
  const exp=document.getElementById('exportBtn'); if(exp) exp.onclick=exportAllData;
  const imp=document.getElementById('importBtn'); if(imp) imp.onclick=async()=>{ const f=document.getElementById('importFile').files[0]; if(!f){ alert('Selecciona un archivo .json'); return; } const txt=await f.text(); const json=JSON.parse(txt); await importAllData(json); };
  } catch (e){
    alert('Error inicializando Admin: '+e.message);
    console.error(e);
  }
});

function initPinGate(){
  const overlay=document.getElementById('adminPinOverlay');
  if(!overlay) return;
  const btn=document.getElementById('pinEnterBtn');
  btn.onclick=()=>{
    const v=(document.getElementById('pinInput').value||'').trim();
    if(v==='240507'){ overlay.style.display='none'; }
    else { alert('PIN incorrecto'); }
  };
}

async function blobToDataURL(blob){
  return new Promise((resolve,reject)=>{ const fr=new FileReader(); fr.onload=()=>resolve(fr.result); fr.onerror=()=>reject(fr.error); fr.readAsDataURL(blob); });
}
async function exportAllData(){
  const [items, tabsPromo, tabsCombo, tabsMenu] = [await DB.listAllItems(), await DB.listTabsByCategory('promo'), await DB.listTabsByCategory('combo'), await DB.listTabsByCategory('menu')];
  const menuSections = await DB.listMenuSections();
  const theme = await DB.getTheme();
  const settings = await DB.getSettings();
  const coupons = await DB.listCoupons();
  const cart = await DB.getCart();
  const blobs = await DB.listAllBlobs();
  const blobDump=[];
  for(const b of blobs){ const url=await blobToDataURL(b.blob); blobDump.push({id:b.id,dataUrl:url}); }
  const payload={version:'v1', items, tabs:{promo:tabsPromo, combo:tabsCombo, menu:tabsMenu}, menuSections, theme, settings, coupons, cart, blobs: blobDump};
  const str=JSON.stringify(payload);
  const file=new Blob([str],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download='backup_grill.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('Exportado ✅');
}
function dataURLtoBlob(dataUrl){ const arr=dataUrl.split(','); const mime=arr[0].match(/:(.*?);/)[1]; const bstr=atob(arr[1]); let n=bstr.length; const u8=new Uint8Array(n); while(n--) u8[n]=bstr.charCodeAt(n); return new Blob([u8],{type:mime}); }
async function importAllData(json){
  if(!json || json.version!=='v1'){ alert('Backup no válido'); return; }
  await DB.clearAllData();
  // Blobs
  if(json.blobs){ for(const b of json.blobs){ const blob=dataURLtoBlob(b.dataUrl); await DB.putBlob(b.id, blob); } }
  // Tabs default 10/10/20
  await DB.resetTabs?.(); // si existe
  // Menu sections
  if(json.menuSections){ for(const s of json.menuSections){ await DB.saveMenuSection({ id:s.id, name:s.name, order:s.order, enabled:s.enabled }); } }
  if(json.theme) await DB.saveTheme(json.theme);
  if(json.settings) await DB.saveSettings(json.settings);
  if(json.coupons){ for(const c of json.coupons){ try{ await DB.addCoupon(c);}catch(e){} } }
  if(json.cart) await DB.saveCart(json.cart);
  if(json.items){ for(const it of json.items){ const copy={ category:it.category, name:it.name, price:it.price, desc:it.desc, imgBlobId:it.imgBlobId, createdAt:it.createdAt, menuSection:it.menuSection }; await DB.addItem(copy); } }
  toast('Importado ✅ Recarga la página');
}
