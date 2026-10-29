const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const displayDate = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(value)) : '';
function setupNewsCarousel(track) {
  const slides = [...track.querySelectorAll('.carousel-item')];
  const previous = document.getElementById('prevBtn'), next = document.getElementById('nextBtn');
  const container = track.closest('.carousel-container');
  const controls = [previous, next].filter(Boolean);
  controls.forEach(button => { button.hidden = slides.length < 2; });
  if (slides.length < 2) return;
  let index = 0, timer;
  const move = step => {
    index = (index + step + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    start();
  };
  const pause = () => { clearInterval(timer); timer = undefined; };
  function start() {
    pause();
    if (!document.hidden && !container.matches(':hover') && !container.contains(document.activeElement)) timer = setInterval(() => move(1), 5000);
  }
  previous?.addEventListener('click', () => move(-1));
  next?.addEventListener('click', () => move(1));
  container.addEventListener('mouseenter', pause);
  container.addEventListener('mouseleave', start);
  container.addEventListener('focusin', pause);
  container.addEventListener('focusout', event => { if (!container.contains(event.relatedTarget)) start(); });
  document.addEventListener('visibilitychange', start);
  start();
}
async function loadPublicNews() {
  const targets = document.querySelectorAll('[data-public-news]');
  if (!targets.length) return;
  const params = new URLSearchParams(location.search);
  const slug = params.get('article');
  try {
    if (slug) {
      const response = await fetch(`/api/news/${encodeURIComponent(slug)}`);
      const item = await response.json(); if (!response.ok) throw new Error(item.error || 'Article not found.');
      const section = document.querySelector('.news-section');
      section.innerHTML = `<div class="container"><article class="news-article"><a class="btn secondary" href="news.html">← All news</a><h1>${escapeText(item.title)}</h1><p class="date">${displayDate(item.publishedAt)}</p>${item.imageUrl ? `<img src="${escapeText(item.imageUrl)}" alt="${escapeText(item.title)}" loading="lazy">` : ''}<div class="article-content"></div></article></div>`;
      section.querySelector('.article-content').textContent = item.content;
      return;
    }
    const response = await fetch('/api/news'); if (!response.ok) throw new Error('School news API is unavailable. Open the school site at http://localhost:3000.');
    const items = await response.json();
    for (const target of targets) {
      if (!items.length) { target.innerHTML = '<p class="content-empty news-empty-state">There are no news articles to display at this time.</p>'; if (target.id === 'newsCarousel') [document.getElementById('prevBtn'), document.getElementById('nextBtn')].filter(Boolean).forEach(button => { button.hidden = true; }); continue; }
      const displayItems = items.slice(0, target.id === 'newsCarousel' ? 5 : 50);
      target.innerHTML = displayItems.map(item => `<article class="news-card${target.id === 'newsCarousel' ? ' carousel-item' : ''}">${item.imageUrl ? `<img src="${escapeText(item.imageUrl)}" alt="${escapeText(item.title)}" loading="lazy">` : ''}<h2>${escapeText(item.title)}</h2><p class="date">${displayDate(item.publishedAt)}</p><p>${escapeText(item.excerpt || item.content?.slice(0, 180) || '')}</p><a href="news.html?article=${encodeURIComponent(item.slug)}">Read article</a></article>`).join('');
      if (target.id === 'newsCarousel') { target.style.transform = 'translateX(0)'; setupNewsCarousel(target); }
    }
  } catch (error) {
    if (slug) document.querySelector('.news-section').innerHTML = `<div class="container"><p class="content-empty">${escapeText(error.message)}</p></div>`;
    else { targets.forEach(target => { target.innerHTML = `<p class="content-empty">${escapeText(error.message || 'School news could not be loaded. Open the school site at http://localhost:3000.')}</p>`; }); [document.getElementById('prevBtn'), document.getElementById('nextBtn')].filter(Boolean).forEach(button => { button.hidden = true; }); }
  }
}
async function loadPublicGallery() {
  const grid = document.querySelector('.gallery-grid'); if (!grid) return;
  try {
    const response = await fetch('/api/gallery'); if (!response.ok) return; const items = await response.json();
    if (!items.length) { grid.innerHTML = '<p class="content-empty">There are no gallery images to display at this time.</p>'; return; }
    grid.innerHTML = items.map(item => `<button class="gallery-card" type="button" data-image="${escapeText(item.url)}" data-alt="${escapeText(item.title || item.caption || 'SilverGold school gallery')}"><img src="${escapeText(item.url)}" alt="${escapeText(item.title || item.caption || 'SilverGold school gallery')}" loading="lazy">${item.title || item.caption ? `<h3>${escapeText(item.title || item.caption)}</h3>` : ''}</button>`).join('');
    const modal = document.getElementById('imageModal'), image = document.getElementById('modalImage'); let index = 0;
    const cards = [...grid.querySelectorAll('.gallery-card')]; const update = () => { image.src = cards[index].dataset.image; image.alt = cards[index].dataset.alt; };
    cards.forEach((card, i) => card.addEventListener('click', () => { index = i; update(); modal.classList.add('active'); document.body.style.overflow = 'hidden'; }));
    document.querySelector('.modal-close')?.addEventListener('click', () => { modal.classList.remove('active'); document.body.style.overflow = ''; });
    document.querySelector('.modal-prev')?.addEventListener('click', () => { index = (index - 1 + cards.length) % cards.length; update(); });
    document.querySelector('.modal-next')?.addEventListener('click', () => { index = (index + 1) % cards.length; update(); });
  } catch {}
}
async function loadPublicVideos() {
  const section = document.querySelector('#schoolVideos'); if (!section) return;
  try { const response = await fetch('/api/videos'); if (!response.ok) return; const items = await response.json(); section.innerHTML = `<div class="container"><h2>School Videos</h2>${items.length ? `<div class="video-grid">${items.map(item => `<article class="news-card"><video controls preload="metadata" ${item.thumbnailUrl ? `poster="${escapeText(item.thumbnailUrl)}"` : ''}><source src="${escapeText(item.url)}"></video><h3>${escapeText(item.title)}</h3><p>${escapeText(item.description)}</p></article>`).join('')}</div>` : '<p class="content-empty">There are no videos to display at this time.</p>'}</div>`; } catch {}
}
loadPublicNews(); loadPublicGallery(); loadPublicVideos();
