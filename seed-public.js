
// seed-public.js — Auto-import shared data for all visitors (runs once per browser)
// v3: imports blobs, maps tabName, and forces reload
(async () => {
  const FLAG = 'seed_public_v3';
  try {
    if (localStorage.getItem(FLAG)) return;
    // Wait until storage.js loaded and window.DB exists
    const ensureDB = () => new Promise(res => {
      if (window.DB) return res();
      const iv = setInterval(()=>{ if (window.DB){ clearInterval(iv); res(); }}, 50);
      setTimeout(()=>{ clearInterval(iv); res(); }, 6000);
    });
    await ensureDB();
    if (!window.DB) return;

    const res = await fetch('./data/seed.json', { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    if (!json || json.version !== 'v1') return;

    await window.DB.clearAllData?.();
    await window.DB.resetTabs?.();
    await window.DB.ensureDefaultTabs?.();
    await window.DB.ensureDefaultMenuSections?.();

    if (json.theme) await window.DB.saveTheme(json.theme);
    if (json.settings) await window.DB.saveSettings(json.settings);

    if (Array.isArray(json.menuSections)) {
      for (const s of json.menuSections) {
        await window.DB.saveMenuSection({ id: s.id, name: s.name, order: s.order, enabled: s.enabled });
      }
    }
    if (Array.isArray(json.coupons)) {
      for (const c of json.coupons) { try { await window.DB.addCoupon(c); } catch(e){} }
    }

    // Import blobs (images)
    if (Array.isArray(json.blobs)) {
      for (const b of json.blobs) {
        try {
          const arr = b.dataUrl.split(',');
          const mime = arr[0].match(/:(.*?);/)[1];
          const bstr = atob(arr[1]);
          let n = bstr.length; const u8 = new Uint8Array(n);
          while(n--) u8[n] = bstr.charCodeAt(n);
          const blob = new Blob([u8], {type: mime});
          await window.DB.putBlob(b.id, blob);
        } catch (e) { console.warn('blob import fail', e); }
      }
    }

    const tabsPromo = await window.DB.listTabsByCategory('promo');
    const tabsCombo = await window.DB.listTabsByCategory('combo');
    const byName = {};
    for (const t of tabsPromo) byName['promo::'+t.name] = t.id;
    for (const t of tabsCombo) byName['combo::'+t.name] = t.id;

    if (Array.isArray(json.items)) {
      for (const it of json.items) {
        const copy = {
          category: it.category,
          name: it.name,
          price: parseFloat(it.price || 0),
          desc: it.desc || '',
          createdAt: Date.now()
        };
        if (it.imgBlobId) copy.imgBlobId = it.imgBlobId;
        if (it.category === 'menu') copy.menuSection = it.menuSection || 'Menú';
        if (it.category === 'promo' || it.category === 'combo') {
          if (it.tabId) copy.tabId = it.tabId;
          else if (it.tabName) {
            const k = it.category + '::' + it.tabName;
            copy.tabId = byName[k] || (it.category==='promo' ? tabsPromo[0]?.id : tabsCombo[0]?.id);
          } else {
            copy.tabId = (it.category==='promo' ? tabsPromo[0]?.id : tabsCombo[0]?.id);
          }
        }
        try { await window.DB.addItem(copy); } catch(e){ console.warn('addItem fail', e); }
      }
    }

    if (json.cart) await window.DB.saveCart(json.cart);

    localStorage.setItem(FLAG, '1');
    setTimeout(()=>location.reload(), 120);
  } catch (e) {
    console.warn('Seed bootstrap failed', e);
  }
})();
