// Galleriet: alla bilder från festen, med bildtext. Spara ger bilden i sin ram, med texten under.

const wrap = (ctx, text, width) => {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

export async function framedPhoto(item, { frames, folder, font, ink, paper }) {
  const key = `${folder}-${item.aspect === '4:3' ? 'landscape' : 'portrait'}`;
  const geo = frames[key];
  const [photo, frame] = await Promise.all([loadImage(item.url), loadImage(`/img/frame-${key}.webp`)]);
  const W = 1200;
  const H = Math.round(W / geo.ratio);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `44px ${font}`;
  const lines = wrap(ctx, item.caption, W - 160);
  canvas.width = W;
  canvas.height = H + 60 + lines.length * 58 + 40;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(photo, geo.x * W, geo.y * H, geo.w * W, geo.h * H);
  ctx.drawImage(frame, 0, 0, W, H);
  ctx.font = `44px ${font}`;
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H + 56 + i * 58));
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

export async function savePhoto(item, options) {
  const blob = await framedPhoto(item, options);
  const file = new File([blob], `spegeln-${item.id.slice(0, 8)}.jpg`, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      return await navigator.share({ files: [file] });
    } catch (err) {
      if (err.name === 'AbortError') return undefined;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return undefined;
}

export class Gallery {
  constructor({ root, api, sound, options, title, emptyText }) {
    Object.assign(this, { root, api, sound, options });
    this.items = [];
    this.grid = root.querySelector('.gallery-grid');
    this.empty = root.querySelector('.gallery-empty');
    this.view = root.querySelector('.lightbox');
    root.querySelector('h2').textContent = title;
    this.empty.textContent = emptyText;
    root.querySelector('.gallery-close').onclick = () => this.close();
    this.view.querySelector('.lightbox-close').onclick = () => this.closePhoto();
    this.view.querySelector('.lightbox-save').onclick = () => savePhoto(this.current, options);
    this.view.querySelector('.lightbox-delete').onclick = () => this.confirmDelete();
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!this.view.hidden) this.closePhoto();
      else if (!root.hidden) this.close();
    });
  }

  async open() {
    this.sound.play('lid');
    this.root.hidden = false;
    this.items = await this.api('/api/gallery');
    this.render();
  }

  close() {
    this.root.hidden = true;
    this.closePhoto();
  }

  render() {
    this.empty.hidden = this.items.length > 0;
    this.grid.replaceChildren(...this.items.map((item) => {
      const card = document.createElement('button');
      card.className = 'gallery-card';
      const img = document.createElement('img');
      img.src = item.url;
      img.loading = 'lazy';
      img.alt = item.caption;
      const text = document.createElement('span');
      text.textContent = item.caption;
      card.append(img, text);
      card.onclick = () => this.openPhoto(item);
      return card;
    }));
  }

  openPhoto(item) {
    this.current = item;
    this.view.hidden = false;
    this.view.querySelector('img').src = item.url;
    this.view.querySelector('img').alt = item.caption;
    this.view.querySelector('p').textContent = item.caption;
    const del = this.view.querySelector('.lightbox-delete');
    del.textContent = del.dataset.label;
    del.classList.remove('armed');
  }

  closePhoto() {
    this.view.hidden = true;
    this.current = null;
  }

  // Två tryck i stället för en webbläsardialog, som bryter stämningen och fryser mobilen.
  async confirmDelete() {
    const del = this.view.querySelector('.lightbox-delete');
    if (!del.classList.contains('armed')) {
      del.classList.add('armed');
      del.textContent = del.dataset.confirm;
      return;
    }
    await this.api(`/api/photos/${this.current.id}`, { method: 'DELETE' });
    this.items = this.items.filter((x) => x.id !== this.current.id);
    this.closePhoto();
    this.render();
  }
}
