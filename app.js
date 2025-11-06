// app.js — store with tabs, cart, coupons, persistence
const cart = {
  items: [],
  coupon: null,
  async load(){ const saved = await DB.getCart(); if (saved){ this.items=saved.items||[]; this.coupon=saved.coupon||null; } },
  async save(){ await DB.saveCart({ id:'cart', items:this.items, coupon:this.coupon }); },
  add(it){ const e=this.items.find(x=>x.id===it.id); if(e){e.qty+=1;} else { this.items.push({ id:it.id, name:it.name, price:it.price, qty:1 }); } this.render(); this.save(); },
  inc(id){ const it=this.items.find(x=>x.id===id); if(it){ it.qty++; this.render(); this.save(); } },
  dec(id){ const it=this.items.find(x=>x.id===id); if(it){ it.qty--; if(it.qty<=0) this.remove(id,false); this.render(); this.save(); } },
  remove(id,saveNow=true){ this.items=this.items.filter(x=>x.id!==id); this.render(); if(saveNow) this.save(); },
  subtotal(){ return this.items.reduce((s,x)=>s+x.price*x.qty,0); },
  discountAmount(){ if(!this.coupon) return 0; const sub=this.subtotal(); let val=0; const pct=parseFloat(this.coupon.percent||0); const amt=parseFloat(this.coupon.amount||0); if(pct>0) val+= sub*(pct/100); if(amt>0) val+=amt; return Math.min(+val.toFixed(2), sub); },
  total(){ return Math.max(0, this.subtotal() - this.discountAmount()); },
  clearCoupon(){ this.coupon=null; this.render(); this.save(); },
  async applyCoupon(code){
    const found = await DB.findCouponByCode(code);
    if (!found){ alert('Cupón no válido'); return; }
    const now=Date.now();
    if (found.expiresAt && now>found.expiresAt){ alert('El cupón está vencido'); return; }
    const min=parseFloat(found.minSubtotal||0);
    if (min>0 && this.subtotal()<min){ alert(`Compra mínima $${min.toFixed(2)} para este cupón`); return; }
    const percent=parseInt(found.percent||0,10)||0;
    const amount=parseFloat(found.amount||0)||0;
    if (!(percent>0) && !(amount>0)){ alert('Cupón sin descuento válido'); return; }
    this.coupon={ code:found.code, percent, amount, minSubtotal:min, expiresAt:found.expiresAt||null };
    this.render(); this.save();
  },
  clear(){ this.items=[]; this.coupon=null; this.render(); this.save(); },
  render(){
    document.getElementById('cartCount').textContent = this.items.reduce((s,x)=>s+x.qty,0);
    const list=document.getElementById('cartItems'); list.innerHTML='';
    for (const it of this.items){
      const row=document.createElement('div'); row.className='cart-item';
      row.innerHTML=`<div><strong>${it.name}</strong><div>$${it.price.toFixed(2)}</div></div>`;
      const qty=document.createElement('div'); qty.className='qty';
      const minus=document.createElement('button'); minus.className='btn'; minus.textContent='−';
      const plus=document.createElement('button'); plus.className='btn'; plus.textContent='+';
      const del=document.createElement('button'); del.className='btn'; del.textContent='🗑';
      const q=document.createElement('span'); q.textContent=it.qty;
      minus.onclick=()=>this.dec(it.id); plus.onclick=()=>this.inc(it.id); del.onclick=()=>this.remove(it.id);
      qty.append(minus,q,plus,del); row.appendChild(qty); list.appendChild(row);
    }
    document.getElementById('cartDiscount').textContent = '-$'+this.discountAmount().toFixed(2);
    document.getElementById('cartTotal').textContent = '$'+this.total().toFixed(2);
  }
};

async function makeTabs(containerId, category, onChange){
  const tabs = await DB.listTabsByCategory(category);
  const c = document.getElementById(containerId); c.innerHTML='';
  let activeId = tabs[0]?.id;
  const render = ()=>{
    c.innerHTML='';
    tabs.forEach(t=>{
      const b=document.createElement('button'); b.className='tab'+(t.id===activeId?' active':''); b.textContent=t.name;
      b.onclick=()=>{ activeId=t.id; render(); onChange(activeId); };
      c.appendChild(b);
    });
    const info=document.createElement('span'); info.style.opacity=.6; info.style.fontSize='.85rem'; info.textContent=` (${tabs.length})`;
    c.appendChild(info);
  };
  render();
  if (activeId) onChange(activeId);
}

async function makeDynamicMenuTabs(containerId, onChange){
  const c = document.getElementById(containerId);
  const sections = (await DB.listMenuSections()).filter(s=>s.enabled).sort((a,b)=>a.order-b.order);
  c.innerHTML='';
  let active = sections[0]?.name;
  const render = ()=>{
    c.innerHTML='';
    sections.forEach(s=>{
      const b=document.createElement('button'); b.className='tab'+(s.name===active?' active':''); b.textContent=s.name;
      b.onclick=()=>{ active=s.name; render(); onChange(active); };
      c.appendChild(b);
    });
    const info=document.createElement('span'); info.style.opacity=.6; info.style.fontSize='.85rem'; info.textContent=` (${sections.length})`;
    c.appendChild(info);
  };
  render();
  if (active) onChange(active);
}

async function renderGridForTab(gridId, tabId){
  const items = await DB.listItemsByTab(tabId);
  const grid=document.getElementById(gridId); grid.innerHTML='';
  for (const it of items){
    const card=document.createElement('div'); card.className='card-item';
    const img=document.createElement('img'); img.className='card-thumb'; if (it.imgBlobId) img.src=await DB.getBlobUrl(it.imgBlobId);
    const body=document.createElement('div'); body.className='card-body';
    const title=document.createElement('h3'); title.className='card-title'; title.textContent=it.name;
    const desc=document.createElement('p'); desc.className='card-desc'; desc.textContent=it.desc||'';
    const price=document.createElement('div'); price.className='card-price'; price.textContent='$'+it.price.toFixed(2);
    const actions=document.createElement('div'); actions.className='card-actions';
    const btn=document.createElement('button'); btn.className='btn-primary'; btn.textContent='Añadir al carrito'; btn.onclick=()=>cart.add(it);
    actions.appendChild(btn); body.append(title,desc,price); card.append(img,body,actions); grid.appendChild(card);
  }
}

async function renderGridForMenuSection(gridId, sectionName){
  const all = await DB.listItemsByCategory('menu');
  const items = sectionName ? all.filter(it=>(it.menuSection||'Otros')===sectionName) : [];
  const grid=document.getElementById(gridId); grid.innerHTML='';
  for (const it of items){
    const card=document.createElement('div'); card.className='card-item';
    const img=document.createElement('img'); img.className='card-thumb'; if (it.imgBlobId) img.src=await DB.getBlobUrl(it.imgBlobId);
    const body=document.createElement('div'); body.className='card-body';
    const title=document.createElement('h3'); title.className='card-title'; title.textContent=it.name;
    const desc=document.createElement('p'); desc.className='card-desc'; desc.textContent=it.desc||'';
    const price=document.createElement('div'); price.className='card-price'; price.textContent='$'+it.price.toFixed(2);
    const actions=document.createElement('div'); actions.className='card-actions';
    const btn=document.createElement('button'); btn.className='btn-primary'; btn.textContent='Añadir al carrito'; btn.onclick=()=>cart.add(it);
    actions.appendChild(btn); body.append(title,desc,price); card.append(img,body,actions); grid.appendChild(card);
  }
}

function setupCartUI(){
  const panel=document.getElementById('cartPanel');
  document.getElementById('cartBtn').onclick=()=>panel.classList.toggle('hidden');
  document.getElementById('closeCart').onclick=()=>panel.classList.add('hidden');
  document.getElementById('applyCoupon').onclick=async()=>{ const code=(document.getElementById('couponInput').value||'').trim(); if(code) await cart.applyCoupon(code); };
  document.getElementById('clearCartBtn').onclick=()=>cart.clear();
  document.getElementById('sendWhatsApp').onclick=async()=>{
    const s = await DB.getSettings() || {};
    const num = (s.waNumber||'').replace(/\D/g,'');
    if (!num){ alert('Configura tu número de WhatsApp en Admin > Ajustes'); return; }
    if (cart.items.length===0){ alert('Tu carrito está vacío'); return; }
    const lines = cart.items.map(i=>`• ${i.name} x${i.qty} — $${(i.price*i.qty).toFixed(2)}`);
    lines.push(`Subtotal: $${cart.subtotal().toFixed(2)}`);
    if (cart.coupon){ const parts=[]; if (cart.coupon.percent>0) parts.push(`${cart.coupon.percent}%`); if (cart.coupon.amount>0) parts.push(`$${Number(cart.coupon.amount).toFixed(2)}`); lines.push(`Cupón ${cart.coupon.code} (${parts.join(' + ')}): -$${cart.discountAmount().toFixed(2)}`); }
    lines.push(`Total: $${cart.total().toFixed(2)}`);
    const text = encodeURIComponent(`Hola, quiero hacer este pedido:\n\n${lines.join('\n')}`);
    window.open(`https://wa.me/${num}?text=${text}`, '_blank');
  };
}

document.addEventListener('DOMContentLoaded', async ()=>{
  setupCartUI();
  await DB.ensureDefaultTabs();
  await DB.ensureDefaultMenuSections();
  await cart.load();
  await makeTabs('promosTabs','promo', id=>renderGridForTab('promosGrid', id));
  await makeTabs('combosTabs','combo', id=>renderGridForTab('combosGrid', id));
  await makeDynamicMenuTabs('menuTabs', sec=>renderGridForMenuSection('menuGrid', sec));
  cart.render();
});
