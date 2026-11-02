(async () => {
  const page = location.pathname.split('/').pop().replace(/\.html?$/i, '') || 'index';
  try {
    const response = await fetch(`/api/content/${encodeURIComponent(page)}`, { cache: 'no-store' });
    if (!response.ok) return;
    const { values } = await response.json();
    if (!values || typeof values !== 'object') return;
    // Preserve the school's explicitly requested hero wording from its old saved
    // positional field while the admin re-saves it under the current stable field key.
    if (page === 'index' && values['text-8'] === "God's Own School") {
      const heroTagline = window.SilvergoldContentTargets.collect(document.body)
        .find(target => target.kind === 'text' && target.value.trim() === 'Raising Future Leaders with Excellence and Integrity');
      if (heroTagline && (!values[heroTagline.key] || values[heroTagline.key] === heroTagline.value)) {
        values[heroTagline.key] = values['text-8'];
      }
    }
    const pageTitle = document.querySelector('head title');
    if (pageTitle && typeof values['page-title'] === 'string') pageTitle.textContent = values['page-title'];
    for (const target of window.SilvergoldContentTargets.collect(document.body)) {
      const value = values[target.key];
      if (typeof value !== 'string') continue;
      if (target.kind === 'text') {
        const leading = target.value.match(/^\s*/)?.[0] || '';
        const trailing = target.value.match(/\s*$/)?.[0] || '';
        target.node.nodeValue = `${leading}${value}${trailing}`;
      } else target.node.setAttribute(target.attribute, value);
    }
  } catch { /* Keep the original page copy available if content storage is temporarily offline. */ }
})();
