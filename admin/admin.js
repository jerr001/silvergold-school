const $ = (selector, root = document) => root.querySelector(selector);
const view = $('#view'), notice = $('#notice'), dialog = $('#newsDialog'), newsForm = $('#newsForm');
const headings = { overview: 'Dashboard overview', content: 'Website content', news: 'News management', gallery: 'Gallery management', videos: 'Video management', admissions: 'Admission applications', contact: 'Contact messages', feedback: 'Parent feedback and suggestions', settings: 'Settings' };
let csrfToken = sessionStorage.getItem('sg-csrf') || '';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const mediaSrc = value => { const source = String(value ?? '').trim(); return /^(?:https?:\/\/|\/)/i.test(source) ? source : `/${source.replace(/^\.\//, '')}`; };
const date = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';
function say(message, error = false) { notice.className = `notice${error ? ' error' : ''}`; notice.textContent = message; setTimeout(() => { notice.textContent = ''; notice.className = ''; }, 5000); }
async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase()) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(url, { credentials: 'same-origin', ...options, headers, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The server did not respond within 15 seconds. Check that npm start is running and MongoDB is connected, then refresh.');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  if (response.status === 401) { sessionStorage.removeItem('sg-csrf'); location.replace('/admin/login.html'); throw new Error('Please sign in again.'); }
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status}). Please restart the school server and try again.`);
  return data;
}
function setView(name) { document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === name)); $('#pageTitle').textContent = headings[name]; render(name).catch(error => { if (error.message !== 'Please sign in again.') say(error.message, true); view.innerHTML = `<p class="empty">${esc(error.message)}</p>`; }); }
async function render(name) {
  view.innerHTML = '<p class="empty">Loading…</p>';
  if (name === 'overview') return overview();
  if (name === 'content') return contentPage();
  if (name === 'news') return newsPage();
  if (name === 'gallery' || name === 'videos') return mediaPage(name);
  if (name === 'admissions' || name === 'contact' || name === 'feedback') return submissionsPage(name);
  if (name === 'settings') return settingsPage();
}
async function overview() {
  const d = await api('/api/admin/dashboard');
  const cards = [['Published articles', d.news], ['Gallery images', d.gallery], ['Published videos', d.videos], ['Admission applications', d.applications], ['Unread messages', d.unreadMessages], ['Applications awaiting review', d.pendingApplications]];
  view.innerHTML = `<div class="cards">${cards.map(([label, count]) => `<article class="metric"><span>${label}</span><strong>${count}</strong></article>`).join('')}</div><section class="panel"><h2>Recent admission applications</h2>${d.recentAdmissions.length ? table(['Reference', 'Student', 'Class', 'Status', 'Received'], d.recentAdmissions.map(x => [esc(x.reference), esc(x.studentName), esc(x.yearGroup), badge(x.status), date(x.createdAt)])) : '<p class="empty">No applications have arrived yet.</p>'}</section><section class="panel"><h2>Recent contact messages</h2>${d.recentMessages.length ? table(['Name', 'Email', 'Message', 'Status', 'Received'], d.recentMessages.map(x => [esc(x.name), esc(x.email), `<details data-read-message="${x._id}"><summary>Read message</summary><p style="white-space:pre-wrap">${esc(x.message)}</p></details>`, badge(x.status), date(x.createdAt)])) : '<p class="empty">No messages have arrived yet.</p>'}</section>`;
  view.querySelectorAll('details[data-read-message]').forEach(details => details.addEventListener('toggle', async () => {
    if (!details.open) return;
    const row = details.closest('tr');
    if (row?.querySelector('.status.unread')) {
      try {
        await api(`/api/admin/contact/${details.dataset.readMessage}`, { method: 'PATCH', body: JSON.stringify({ status: 'read' }) });
        const badgeEl = row.querySelector('.status'); badgeEl.className = 'status read'; badgeEl.textContent = 'read';
        const unreadCard = [...view.querySelectorAll('.metric')].find(card => card.querySelector('span')?.textContent === 'Unread messages');
        if (unreadCard) unreadCard.querySelector('strong').textContent = Math.max(0, Number(unreadCard.querySelector('strong').textContent) - 1);
      }
      catch (error) { say(error.message, true); }
    }
  }, { once: true }));
}
function badge(status) { return `<span class="status ${esc(status)}">${esc(status)}</span>`; }
function table(headers, rows) { return `<div class="table-wrap"><table><thead><tr>${headers.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
async function newsPage(q = '', page = 1, status = '') {
  const data = await api(`/api/admin/news?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${page}&limit=20`);
  view.innerHTML = `<div class="section-heading"><h2>Articles</h2><div class="toolbar"><input id="search" type="search" placeholder="Search headlines" value="${esc(q)}"><select id="newsFilter"><option value="">All statuses</option><option value="published" ${status === 'published' ? 'selected' : ''}>Published</option><option value="draft" ${status === 'draft' ? 'selected' : ''}>Drafts</option></select><button class="button" id="newNews">＋ New article</button></div></div>${data.items.length ? table(['Headline', 'Category', 'Status', 'Publish date', 'Actions'], data.items.map(x => [esc(x.title), esc(x.category), badge(x.status), date(x.publishedAt), `<button class="button secondary" data-edit="${x._id}">Edit</button> <button class="button danger" data-delete="${x._id}">Delete</button>`])) + pager(data.page, data.pages) : '<div class="panel empty">No articles found. Add a news article to get started.</div>'}`;
  $('#newNews').onclick = () => openNews();
  $('#search').oninput = debounce(e => newsPage(e.target.value, 1, $('#newsFilter').value));
  $('#newsFilter').onchange = e => newsPage($('#search').value, 1, e.target.value);
  wirePager(data, p => newsPage(q, p, status));
  view.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openNews(btn.dataset.edit));
  view.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = async () => { if (!confirm('Delete this article permanently?')) return; try { await api(`/api/admin/news/${btn.dataset.delete}`, { method: 'DELETE' }); say('Article deleted.'); newsPage($('#search')?.value || ''); } catch (e) { say(e.message, true); } });
}
async function openNews(id) {
  newsForm.reset(); $('#featuredPreview').hidden = true; $('#articlePreview').hidden = true; newsForm.elements.id.value = ''; newsForm.elements.publishedAt.value = new Date().toISOString().slice(0, 10); $('#newsDialogTitle').textContent = id ? 'Edit article' : 'New article';
  if (id) { try { const { items } = await api('/api/admin/news?limit=100'); const item = items.find(x => x._id === id); if (!item) throw new Error('Article no longer exists.'); for (const key of ['title', 'excerpt', 'content', 'imageUrl', 'category', 'status']) newsForm.elements[key].value = item[key] || ''; newsForm.elements.id.value = id; newsForm.elements.publishedAt.value = new Date(item.publishedAt).toISOString().slice(0, 10); } catch (e) { return say(e.message, true); } }
  dialog.showModal();
}
newsForm.addEventListener('submit', async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(newsForm)); const id = data.id; delete data.id; try { await api(id ? `/api/admin/news/${id}` : '/api/admin/news', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(data) }); dialog.close(); say('Article saved.'); newsPage(); } catch (e) { say(e.message, true); } });
$('#previewNews').onclick = () => { const title = newsForm.elements.title.value.trim(), excerpt = newsForm.elements.excerpt.value.trim(), content = newsForm.elements.content.value.trim(), imageUrl = newsForm.elements.imageUrl.value.trim(); const preview = $('#articlePreview'); preview.innerHTML = `<h2>${esc(title || 'Article headline')}</h2>${imageUrl ? `<img src="${esc(imageUrl)}" alt="" style="max-width:100%;max-height:220px;object-fit:cover">` : ''}<p>${esc(excerpt)}</p><p style="white-space:pre-wrap">${esc(content)}</p>`; preview.hidden = false; };
$('#featuredImageFile').addEventListener('change', async event => {
  const file = event.target.files[0], preview = $('#featuredPreview'); if (!file) return;
  preview.src = URL.createObjectURL(file); preview.hidden = false;
  const payload = new FormData(); payload.append('file', file);
  try { const result = await api('/api/admin/uploads/image', { method: 'POST', body: payload }); newsForm.elements.imageUrl.value = result.url; say('Featured image uploaded.'); }
  catch (e) { newsForm.elements.imageUrl.value = ''; say(e.message, true); }
});
async function mediaPage(kind, page = 1, q = '', category = '') {
  const images = kind === 'gallery'; const collection = images ? 'gallery' : 'videos'; const data = await api(`/api/admin/${collection}?page=${page}&limit=20&q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`);
  view.innerHTML = `<div class="section-heading"><h2>${images ? 'School photo gallery' : 'School videos'}</h2><div class="toolbar"><input id="mediaSearch" type="search" placeholder="Search titles" value="${esc(q)}"><select id="mediaCategory"><option value="">All categories</option>${['School Events','Classrooms','Sports','Facilities','Excursions'].map(c => `<option value="${c}" ${category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div><form id="uploadForm" class="panel form-card"><h2>Upload ${images ? 'images' : 'video'}</h2><label>Title<input name="title" maxlength="160" ${images ? '' : 'required'}></label><label>${images ? 'Caption' : 'Description'}<textarea name="${images ? 'caption' : 'description'}" rows="2"></textarea></label>${images ? '' : '<label>Thumbnail image URL<input name="thumbnailUrl" type="url"></label>'}<div class="form-row"><label>Category<input name="category" value="School Events" maxlength="80"></label><label>Choose ${images ? 'image' : 'video'}<input name="${images ? 'files' : 'file'}" type="file" accept="${images ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm,video/quicktime'}" ${images ? 'multiple' : ''} required></label></div><label><span><input name="published" type="checkbox" ${images ? 'checked' : ''}> Publish immediately</span></label><button class="button">Upload ${images ? 'image(s)' : 'video'}</button><small>Media is sent securely to managed Cloudinary storage. Upload limits are set by the server.</small></form><section class="panel"><h2>Existing ${images ? 'images' : 'videos'}</h2>${data.items.length ? `<div class="media-grid">${data.items.map(x => `<article class="media-card">${images ? `<img src="${esc(mediaSrc(x.url))}" alt="${esc(x.title || x.caption)}" loading="lazy">` : `<video src="${esc(x.url)}" controls preload="metadata" ${x.thumbnailUrl ? `poster="${esc(x.thumbnailUrl)}"` : ''}></video>`}<div>${images ? `<label>Image URL<input data-edit-field="url" data-id="${x._id}" value="${esc(x.url)}" maxlength="1000"></label>` : ''}<label>Title<input data-edit-field="title" data-id="${x._id}" value="${esc(x.title)}" maxlength="160"></label><label>${images ? 'Caption' : 'Description'}<input data-edit-field="${images ? 'caption' : 'description'}" data-id="${x._id}" value="${esc(images ? x.caption : x.description)}" maxlength="1000"></label><label>Category<input data-edit-field="category" data-id="${x._id}" value="${esc(x.category)}" maxlength="80"></label><button class="button secondary" data-save="${x._id}">Save details</button><label><input type="checkbox" data-publish="${x._id}" ${x.published ? 'checked' : ''}> Published</label><button class="button danger" data-delete="${x._id}">Delete</button></div></article>`).join('')}</div>${pager(data.page, data.pages)}</section>` : '<p class="empty">No media uploaded yet.</p></section>'}`;
  $('#mediaSearch').oninput = debounce(e => mediaPage(kind, 1, e.target.value, $('#mediaCategory').value)); $('#mediaCategory').onchange = e => mediaPage(kind, 1, $('#mediaSearch').value, e.target.value);
  wirePager(data, p => mediaPage(kind, p, q, category));
  const uploadForm = $('#uploadForm');
  uploadForm.querySelector('[type="file"]').addEventListener('change', event => {
    let preview = $('#uploadPreview');
    if (!preview) { preview = document.createElement('div'); preview.id = 'uploadPreview'; event.target.closest('.form-row').after(preview); }
    preview.innerHTML = [...event.target.files].map(file => { const src = URL.createObjectURL(file); return images ? `<img src="${src}" alt="Preview: ${esc(file.name)}" style="max-width:150px;max-height:110px;object-fit:cover;margin:6px">` : `<video src="${src}" controls style="max-width:280px;max-height:180px"></video>`; }).join('');
  });
  uploadForm.onsubmit = async e => { e.preventDefault(); const form = e.currentTarget, button = form.querySelector('button'); button.disabled = true; const payload = new FormData(form); payload.set('published', String(payload.has('published'))); try { await api(`/api/admin/${collection}`, { method: 'POST', body: payload }); say('Upload complete.'); mediaPage(kind); } catch (error) { say(error.message, true); } finally { button.disabled = false; } };
  view.querySelectorAll('[data-save]').forEach(button => button.onclick = async () => { const values = {}; view.querySelectorAll(`[data-id="${button.dataset.save}"][data-edit-field]`).forEach(input => values[input.dataset.editField] = input.value); try { await api(`/api/admin/${collection}/${button.dataset.save}`, { method: 'PATCH', body: JSON.stringify(values) }); say('Media details saved.'); } catch (e) { say(e.message, true); } });
  view.querySelectorAll('[data-publish]').forEach(input => input.onchange = async () => { try { await api(`/api/admin/${collection}/${input.dataset.publish}`, { method: 'PATCH', body: JSON.stringify({ published: input.checked }) }); say('Publication status updated.'); } catch (e) { input.checked = !input.checked; say(e.message, true); } });
  view.querySelectorAll('[data-delete]').forEach(button => button.onclick = async () => { if (!confirm('Delete this media item permanently?')) return; try { await api(`/api/admin/${collection}/${button.dataset.delete}`, { method: 'DELETE' }); say('Media deleted.'); mediaPage(kind); } catch (e) { say(e.message, true); } });
}
async function submissionsPage(kind, q = '', status = '', page = 1) {
  const admissions = kind === 'admissions', feedback = kind === 'feedback', endpoint = admissions ? 'admissions' : feedback ? 'feedback' : 'contact';
  const data = await api(`/api/admin/${endpoint}?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${page}&limit=20`);
  const rows = data.items.map(x => {
    if (admissions) {
      const fullApplication = `<details><summary>View full application</summary><dl><dt>Date of birth</dt><dd>${esc(x.dateOfBirth ? new Date(x.dateOfBirth).toLocaleDateString() : '')}</dd><dt>Gender</dt><dd>${esc(x.gender)}</dd><dt>Current school</dt><dd>${esc(x.currentSchool)}</dd><dt>Parent or guardian</dt><dd>${esc(x.guardianName)}</dd><dt>Relationship</dt><dd>${esc(x.relationship)}</dd><dt>Phone</dt><dd>${esc(x.phone)}</dd><dt>Email</dt><dd>${esc(x.email)}</dd><dt>Address</dt><dd>${esc(x.address)}</dd><dt>Additional message</dt><dd style="white-space:pre-wrap">${esc(x.message)}</dd></dl></details>`;
      const statusSelect = `<select data-status="${x._id}">${['new', 'reviewing', 'accepted', 'declined'].map(s => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
      return [esc(x.reference), `<strong>${esc(x.studentName)}</strong>`, esc(x.yearGroup), fullApplication, date(x.createdAt), statusSelect];
    }
    const messageDetails = feedback
      ? `<details><summary>View feedback</summary><dl><dt>Type</dt><dd>${esc(x.category)}</dd><dt>Subject</dt><dd>${esc(x.subject)}</dd><dt>Parent or guardian</dt><dd>${esc(x.parentName)}</dd><dt>Phone</dt><dd>${esc(x.phone)}</dd><dt>Student</dt><dd>${esc(x.studentName)}</dd><dt>Class</dt><dd>${esc(x.className)}</dd><dt>Message</dt><dd style="white-space:pre-wrap">${esc(x.message)}</dd></dl></details>`
      : `<details><summary>Read message</summary><p>${esc(x.message)}</p></details>`;
    const statusSelect = `<select data-status="${x._id}">${['unread', 'read', 'archived'].map(s => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
    return feedback ? [`<strong>${esc(x.parentName)}</strong>`, esc(x.email), messageDetails, date(x.createdAt), statusSelect] : [esc(x.name), esc(x.email), messageDetails, date(x.createdAt), statusSelect];
  });
  view.innerHTML = `<div class="section-heading"><h2>${admissions ? 'Applications received' : feedback ? 'Parent feedback and suggestions received' : 'Messages received'}</h2><div class="toolbar"><input id="search" type="search" placeholder="Search ${admissions ? 'student or guardian' : feedback ? 'parent or guardian' : 'sender name'}" value="${esc(q)}"><select id="filter"><option value="">All statuses</option>${(admissions ? ['new', 'reviewing', 'accepted', 'declined'] : ['unread', 'read', 'archived']).map(s => `<option ${s === status ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="button secondary" id="export">Export CSV</button></div></div>${rows.length ? table(admissions ? ['Reference', 'Student', 'Class', 'Application details', 'Received', 'Review status'] : feedback ? ['Parent or guardian', 'Email', 'Feedback', 'Received', 'Status'] : ['Sender', 'Email', 'Message', 'Received', 'Status'], rows) + pager(data.page, data.pages) : '<div class="panel empty">No records match your search.</div>'}`;
  wirePager(data, p => submissionsPage(kind, q, status, p));
  $('#export').onclick = async () => { try { const response = await fetch(`/api/admin/export/${endpoint}`, { headers: { 'X-CSRF-Token': csrfToken } }); if (!response.ok) throw new Error('Unable to export records.'); const blob = await response.blob(), link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${endpoint}.csv`; link.click(); URL.revokeObjectURL(link.href); } catch (e) { say(e.message, true); } };
  view.querySelectorAll('[data-status]').forEach(select => select.onchange = async () => { try { await api(`/api/admin/${endpoint}/${select.dataset.status}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); say('Status updated.'); } catch (e) { say(e.message, true); } });
  if (!admissions) view.querySelectorAll('td details').forEach(details => details.addEventListener('toggle', async () => {
    if (!details.open) return;
    const select = details.closest('tr')?.querySelector('[data-status]');
    if (select?.value === 'unread') {
      try { await api(`/api/admin/${endpoint}/${select.dataset.status}`, { method: 'PATCH', body: JSON.stringify({ status: 'read' }) }); select.value = 'read'; say('Message marked as read.'); }
      catch (error) { say(error.message, true); }
    }
  }));
}
function settingsPage() {
  view.innerHTML = `<section class="panel"><h2>Your account</h2><p>You are signed in as <strong>${esc($('#adminEmail').textContent)}</strong>.</p><p>Keep your sign-in details private, and log out when you have finished using the dashboard. To change your account details or request access for another staff member, contact the person who manages the website.</p></section><section class="panel"><h2>Photos and videos</h2><p>Manage school photos in <strong>Gallery Management</strong> and school videos in <strong>Video Management</strong>. Items marked as published can appear on the public website.</p><p>If an upload does not work, contact the person who manages the website for help.</p></section>`;
}
const contentPages = [['index', 'Home'], ['about', 'About'], ['academics', 'Academics'], ['admissions', 'Admissions'], ['contact', 'Contact'], ['feedback', 'Parent feedback'], ['gallery', 'Gallery'], ['news', 'News']];
function friendlyContentLabel(target) {
  if (target.attribute === 'alt') return 'Image description';
  if (target.attribute === 'placeholder') return 'Input hint';
  if (target.attribute === 'title') return 'Extra help text';
  if (target.attribute === 'aria-label') return 'Screen reader description';
  if (target.attribute === 'href') return 'Link address';
  if (target.attribute === 'src') return 'Image file address';
  const element = target.node.nodeType === Node.TEXT_NODE ? target.node.parentElement : target.node;
  const tag = element?.closest('h1,h2,h3,p,a,button,li,label')?.tagName.toLowerCase();
  return ({ h1: 'Main heading', h2: 'Section heading', h3: 'Subheading', p: 'Paragraph text', a: 'Link label', button: 'Button label', li: 'List item', label: 'Form field label' })[tag] || 'Page text';
}
async function contentPage(pageName = 'index') {
  view.innerHTML = `<section class="panel"><div class="section-heading"><div><h2>Edit website copy</h2><p>Choose a page, update the labeled fields in each section, then save. Preview the page to review your changes.</p></div><select id="contentPage" aria-label="Choose a website page">${contentPages.map(([id, label]) => `<option value="${id}" ${id === pageName ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div id="contentFields" class="content-fields"><p class="empty">Loading page content…</p></div></section>`;
  $('#contentPage').onchange = event => contentPage(event.target.value);
  const [source, saved] = await Promise.all([fetch(`/${pageName}.html`).then(response => { if (!response.ok) throw new Error('Could not load that website page.'); return response.text(); }), api(`/api/admin/content?page=${encodeURIComponent(pageName)}`)]);
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  const targets = window.SilvergoldContentTargets.collect(parsed.body);
  const values = saved.values || {};
  const titleValue = values['page-title'] ?? parsed.title;
  const groupedTargets = new Map();
  const fallbackSectionNumbers = new Map();
  for (const target of targets) {
    const element = target.node.nodeType === Node.TEXT_NODE ? target.node.parentElement : target.node;
    const section = element?.closest('section');
    const context = section?.querySelector('h1,h2,h3')?.textContent.trim();
    let groupName = context || 'Page header and footer';
    if (!context && section) {
      if (!fallbackSectionNumbers.has(section)) fallbackSectionNumbers.set(section, fallbackSectionNumbers.size + 1);
      groupName = `Other page section ${fallbackSectionNumbers.get(section)}`;
    }
    if (!groupedTargets.has(groupName)) groupedTargets.set(groupName, []);
    groupedTargets.get(groupName).push(target);
  }
  const sections = [...groupedTargets].map(([groupName, groupTargets]) => {
    const labelCounts = new Map();
    const fields = groupTargets.map(target => {
      const baseLabel = friendlyContentLabel(target);
      const count = (labelCounts.get(baseLabel) || 0) + 1;
      labelCounts.set(baseLabel, count);
      const label = count > 1 ? `${baseLabel} ${count}` : baseLabel;
      const value = values[target.key] ?? target.value;
      const help = target.attribute === 'href' ? '<small>Use a page name like about.html or a full web address.</small>' : target.attribute === 'src' ? '<small>Change this only if you have a replacement image address.</small>' : '';
      return `<label class="content-field"><span>${esc(label)}</span>${target.kind === 'text' ? `<textarea rows="${value.length > 120 ? 4 : 2}" data-content-key="${esc(target.key)}">${esc(value)}</textarea>` : `<input data-content-key="${esc(target.key)}" value="${esc(value)}" maxlength="5000">${help}`}</label>`;
    }).join('');
    return `<fieldset class="content-group"><legend>${esc(groupName)}</legend>${fields}</fieldset>`;
  }).join('');
  $('#contentFields').innerHTML = `<fieldset class="content-group"><legend>Page settings</legend><label class="content-field"><span>Browser tab title</span><input data-content-key="page-title" value="${esc(titleValue)}" maxlength="200"></label></fieldset>${sections}<div class="toolbar"><button class="button" id="savePageContent">Save ${esc(contentPages.find(([id]) => id === pageName)?.[1] || 'page')} content</button><a class="button secondary" href="/${pageName}.html" target="_blank" rel="noopener">Preview page</a></div>`;  $('#savePageContent').onclick = async event => {
    const button = event.currentTarget; button.disabled = true;
    const updated = Object.fromEntries([...$('#contentFields').querySelectorAll('[data-content-key]')].map(field => [field.dataset.contentKey, field.value]));
    try { await api('/api/admin/content', { method: 'PUT', body: JSON.stringify({ page: pageName, values: updated }) }); say('Website content saved. Refresh the public page to see your changes.'); }
    catch (error) { say(error.message, true); }
    finally { button.disabled = false; }
  };
}
function debounce(fn, delay = 250) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; }
function pager(page, pages) { return pages > 1 ? `<div class="toolbar" style="justify-content:flex-end;margin-top:14px"><button class="button secondary" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${page} of ${pages}</span><button class="button secondary" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next</button></div>` : ''; }
function wirePager(data, callback) { view.querySelectorAll('[data-page]').forEach(button => button.onclick = () => callback(Number(button.dataset.page))); }
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => dialog.close());
document.querySelectorAll('.nav-item').forEach(button => button.onclick = () => setView(button.dataset.view));
$('#logout').onclick = async () => { try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } catch {} sessionStorage.removeItem('sg-csrf'); location.replace('/admin/login.html'); };
(async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const me = await fetch('/api/admin/me', { signal: controller.signal });
    if (!me.ok) return location.replace('/admin/login.html');
    const data = await me.json(); csrfToken = data.csrfToken; sessionStorage.setItem('sg-csrf', csrfToken); $('#adminEmail').textContent = data.email || 'Administrator'; setView('overview');
  } catch {
    view.innerHTML = `<p class="empty">${controller.signal.aborted ? 'The server did not respond within 15 seconds. Check that npm start is running and MongoDB is connected, then refresh.' : 'Could not reach the school server. Check that npm start is running, then refresh.'}</p>`;
  } finally { clearTimeout(timeoutId); }
})();
