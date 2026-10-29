(async () => {
  const page = location.pathname.split('/').pop().replace(/\.html?$/i, '') || 'index';
  try {
    const response = await fetch(`/api/content/${encodeURIComponent(page)}`);
    if (!response.ok) return;
    const { values } = await response.json();
    if (!values || typeof values !== 'object') return;
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
