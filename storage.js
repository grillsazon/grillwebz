// storage.js — DB v6 with tabs reset, sections, coupons, cart
(() => {
  const DB_NAME = 'grill_db';
  const DB_VERSION = 6;
  const STORE_ITEMS = 'items';
  const STORE_THEME = 'theme';
  const STORE_BLOBS = 'blobs';
  const STORE_SETTINGS = 'settings';
  const STORE_TABS = 'tabs';
  const STORE_MENU_SECTIONS = 'menu_sections';
  const STORE_CART = 'cart';       // {id:'cart', items:[], coupon:{}}
  const STORE_COUPONS = 'coupons'; // {id, code, percent, amount, minSubtotal, expiresAt}

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // ITEMS
        if (!db.objectStoreNames.contains(STORE_ITEMS)) {
          const s = db.createObjectStore(STORE_ITEMS, { keyPath: 'id', autoIncrement: true });
          s.createIndex('byCategory', 'category', { unique: false });
          s.createIndex('byTab', 'tabId', { unique: false });
        } else {
          const s = req.transaction.objectStore(STORE_ITEMS);
          if (!s.indexNames.contains('byTab')) s.createIndex('byTab', 'tabId', { unique: false });
        }
        // THEME
        if (!db.objectStoreNames.contains(STORE_THEME)) db.createObjectStore(STORE_THEME, { keyPath: 'id' });
        // BLOBS
        if (!db.objectStoreNames.contains(STORE_BLOBS)) db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        // SETTINGS
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
        // TABS
        if (!db.objectStoreNames.contains(STORE_TABS)) {
          const t = db.createObjectStore(STORE_TABS, { keyPath: 'id', autoIncrement: true });
          t.createIndex('byCategory', 'category', { unique: false });
          t.createIndex('byOrder', 'order', { unique: false });
        }
        // MENU SECTIONS
        if (!db.objectStoreNames.contains(STORE_MENU_SECTIONS)) {
          const s = db.createObjectStore(STORE_MENU_SECTIONS, { keyPath: 'id', autoIncrement: true });
          s.createIndex('byOrder', 'order', { unique: false });
        }
        // BLOBS dump
  async function listAllBlobs(){ const { t, stores } = await tx([STORE_BLOBS], 'readonly'); return getAll(stores[STORE_BLOBS], null, t); }

  // CART
        if (!db.objectStoreNames.contains(STORE_CART)) db.createObjectStore(STORE_CART, { keyPath: 'id' });
        // COUPONS
        if (!db.objectStoreNames.contains(STORE_COUPONS)) {
          const s = db.createObjectStore(STORE_COUPONS, { keyPath: 'id', autoIncrement: true });
          s.createIndex('byCode', 'code', { unique: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(storeNames, mode='readonly') {
    const db = await openDB();
    const t = db.transaction(storeNames, mode);
    return { t, stores: storeNames.reduce((acc, name)=> (acc[name]=t.objectStore(name), acc), {}) };
  }

  // Helpers
  function getAll(storeOrIndex, query, t) {
    return new Promise((resolve, reject) => {
      const req = query ? storeOrIndex.getAll(query) : storeOrIndex.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  function reqAsPromise(req, t) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // TABS
  async function ensureDefaultTabs() {
    const NEEDS = { promo: { n:10, prefix:'Promo' }, combo:{ n:10, prefix:'Combo' }, menu:{ n:20, prefix:'Menú' } };
    const { t, stores } = await tx([STORE_TABS], 'readwrite');
    const existing = await getAll(stores[STORE_TABS], null, t);
    const byCat = { promo:[], combo:[], menu:[] };
    for (const r of existing) if (byCat[r.category]) byCat[r.category].push(r);
    for (const cat of Object.keys(NEEDS)) {
      const need = NEEDS[cat].n;
      const prefix = NEEDS[cat].prefix;
      const list = byCat[cat].sort((a,b)=>a.order-b.order);
      // create missing
      for (let i=list.length+1;i<=need;i++) {
        stores[STORE_TABS].add({ category: cat, name: `${prefix} ${i}`, order: i });
      }
      // normalize order 1..N (keep existing names)
      const after = (await getAll(stores[STORE_TABS], null, t)).filter(x=>x.category===cat).sort((a,b)=>a.order-b.order);
      for (let i=0;i<after.length;i++){ after[i].order = i+1; stores[STORE_TABS].put(after[i]); }
    }
    return new Promise((resolve)=>{ t.oncomplete = async ()=>{
      const { t:t2, stores:s2 } = await tx([STORE_TABS],'readonly');
      resolve(await getAll(s2[STORE_TABS], null, t2));
    }});
  }
  async function listTabsByCategory(category) {
    await ensureDefaultTabs();
    const { t, stores } = await tx([STORE_TABS], 'readonly');
    const all = await getAll(stores[STORE_TABS], null, t);
    return all.filter(t=>t.category===category).sort((a,b)=>a.order-b.order);
  }
  async function resetTabs() {
    const { t, stores } = await tx([STORE_TABS], 'readwrite');
    // clear
    const clearReq = stores[STORE_TABS].clear();
    await reqAsPromise(clearReq, t);
    // recreate
    return ensureDefaultTabs();
  }

  // MENU SECTIONS
  async function ensureDefaultMenuSections() {
    const { t, stores } = await tx([STORE_MENU_SECTIONS], 'readwrite');
    const all = await getAll(stores[STORE_MENU_SECTIONS], null, t);
    if (all.length > 0) return all;
    const defaults = ['Extras','Bebidas','Hamburguesas','Pepitos','Al barril'];
    defaults.forEach((name, i) => stores[STORE_MENU_SECTIONS].add({ name, order: i+1, enabled: true }));
    return new Promise((resolve) => {
      t.oncomplete = async () => {
        const { t: t2, stores: s2 } = await tx([STORE_MENU_SECTIONS], 'readonly');
        resolve(await getAll(s2[STORE_MENU_SECTIONS], null, t2));
      };
    });
  }
  async function listMenuSections() {
    await ensureDefaultMenuSections();
    const { t, stores } = await tx([STORE_MENU_SECTIONS], 'readonly');
    const all = await getAll(stores[STORE_MENU_SECTIONS], null, t);
    return all.sort((a,b)=>a.order-b.order);
  }
  async function saveMenuSection(section) {
    const { t, stores } = await tx([STORE_MENU_SECTIONS], 'readwrite');
    return reqAsPromise(stores[STORE_MENU_SECTIONS].put(section), t);
  }
  async function deleteMenuSection(id) {
    const { t, stores } = await tx([STORE_MENU_SECTIONS], 'readwrite');
    return reqAsPromise(stores[STORE_MENU_SECTIONS].delete(id), t);
  }

  // ITEMS
  async function addItem(item) { const { t, stores } = await tx([STORE_ITEMS],'readwrite'); return reqAsPromise(stores[STORE_ITEMS].add(item), t); }
  async function updateItem(item){ const { t, stores } = await tx([STORE_ITEMS],'readwrite'); return reqAsPromise(stores[STORE_ITEMS].put(item), t); }
  async function deleteItem(id){ const { t, stores } = await tx([STORE_ITEMS],'readwrite'); return reqAsPromise(stores[STORE_ITEMS].delete(id), t); }
  async function listItemsByCategory(category){ const { t, stores } = await tx([STORE_ITEMS],'readonly'); const idx = stores[STORE_ITEMS].index('byCategory'); return getAll(idx, IDBKeyRange.only(category), t); }
  async function listItemsByTab(tabId){ const { t, stores } = await tx([STORE_ITEMS],'readonly'); const idx = stores[STORE_ITEMS].index('byTab'); return getAll(idx, IDBKeyRange.only(tabId), t); }
  async function listAllItems(){ const { t, stores } = await tx([STORE_ITEMS],'readonly'); return getAll(stores[STORE_ITEMS], null, t); }

  // THEME & SETTINGS
  async function saveTheme(theme){ const { t, stores } = await tx([STORE_THEME],'readwrite'); theme.id='theme'; return reqAsPromise(stores[STORE_THEME].put(theme), t); }
  async function getTheme(){ const { t, stores } = await tx([STORE_THEME],'readonly'); return reqAsPromise(stores[STORE_THEME].get('theme'), t); }
  async function saveSettings(settings){ const { t, stores } = await tx([STORE_SETTINGS],'readwrite'); settings.id='settings'; return reqAsPromise(stores[STORE_SETTINGS].put(settings), t); }
  async function getSettings(){ const { t, stores } = await tx([STORE_SETTINGS],'readonly'); return reqAsPromise(stores[STORE_SETTINGS].get('settings'), t); }

  // BLOBS
  async function putBlob(id, blob){ const { t, stores } = await tx([STORE_BLOBS],'readwrite'); return reqAsPromise(stores[STORE_BLOBS].put({id, blob}), t); }
  async function getBlobUrl(id){ const { t, stores } = await tx([STORE_BLOBS],'readonly'); const rec = await reqAsPromise(stores[STORE_BLOBS].get(id), t); return (rec&&rec.blob)?URL.createObjectURL(rec.blob):null; }

  // BLOBS dump
  async function listAllBlobs(){ const { t, stores } = await tx([STORE_BLOBS], 'readonly'); return getAll(stores[STORE_BLOBS], null, t); }

  // CART
  async function saveCart(cart){ const { t, stores } = await tx([STORE_CART],'readwrite'); cart.id='cart'; return reqAsPromise(stores[STORE_CART].put(cart), t); }
  async function getCart(){ const { t, stores } = await tx([STORE_CART],'readonly'); return reqAsPromise(stores[STORE_CART].get('cart'), t); }

  // COUPONS
  async function addCoupon(coupon){ const { t, stores } = await tx([STORE_COUPONS],'readwrite'); coupon.code=(coupon.code||'').toUpperCase().trim(); return reqAsPromise(stores[STORE_COUPONS].add(coupon), t); }
  async function deleteCoupon(id){ const { t, stores } = await tx([STORE_COUPONS],'readwrite'); return reqAsPromise(stores[STORE_COUPONS].delete(id), t); }
  async function listCoupons(){ const { t, stores } = await tx([STORE_COUPONS],'readonly'); return getAll(stores[STORE_COUPONS], null, t); }
  async function findCouponByCode(code){ code=(code||'').toUpperCase().trim(); const { t, stores } = await tx([STORE_COUPONS],'readonly'); const idx=stores[STORE_COUPONS].index('byCode'); return new Promise((res,rej)=>{ const r=idx.get(code); r.onsuccess=()=>res(r.result||null); r.onerror=()=>rej(r.error); }); }

  // Expose
  window.DB = {
    ensureDefaultTabs, listTabsByCategory, resetTabs,
    ensureDefaultMenuSections, listMenuSections, saveMenuSection, deleteMenuSection,
    addItem, updateItem, deleteItem, listItemsByCategory, listItemsByTab, listAllItems,
    saveTheme, getTheme, saveSettings, getSettings,
    putBlob, getBlobUrl, listAllBlobs, saveCart, getCart,
    addCoupon, deleteCoupon, listCoupons, findCouponByCode
  };
})();

  // Clear helpers for import
  async function clearStore(name){ const { t, stores } = await tx([name], 'readwrite'); return new Promise((res,rej)=>{ const r=stores[name].clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); }); }
  async function clearAllData(){
    await clearStore(STORE_ITEMS);
    await clearStore(STORE_TABS);
    await clearStore(STORE_MENU_SECTIONS);
    await clearStore(STORE_CART);
    await clearStore(STORE_COUPONS);
    await clearStore(STORE_BLOBS);
    try { const { t, stores } = await tx([STORE_THEME],'readwrite'); stores[STORE_THEME].delete('theme'); } catch(e){}
    try { const { t, stores } = await tx([STORE_SETTINGS],'readwrite'); stores[STORE_SETTINGS].delete('settings'); } catch(e){}
  }
  window.DB.clearStore = clearStore;
  window.DB.clearAllData = clearAllData;
