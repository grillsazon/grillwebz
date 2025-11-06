// imageUtils.js — compress to max 1200px, quality 0.72
async function fileToBlobIdAndUrl(file, prefix='img'){
  const bmp = await createImageBitmap(file);
  const maxSide = Math.max(bmp.width, bmp.height);
  const scale = Math.min(1, 1200 / maxSide);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.72));
  const id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  await DB.putBlob(id, blob);
  const url = URL.createObjectURL(blob);
  return { id, url };
}
