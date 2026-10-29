(() => {
  const ignored = 'script,style,noscript,template,[data-public-news],.gallery-grid,.theme-toggle,.hamburger,.carousel-nav,.why-icon,.stars,#imageModal';
  function excluded(node) { return Boolean(node.parentElement?.closest(ignored)); }
  function collect(root) {
    const targets = [];
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node, index = 0;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim() || excluded(node)) continue;
      const tag = node.parentElement?.tagName.toLowerCase() || 'text';
      targets.push({ key: `text-${index++}`, kind: 'text', node, value: node.nodeValue, label: `${tag} text` });
    }
    const attributes = [['alt', 'alt'], ['placeholder', 'placeholder'], ['title', 'titleattr'], ['aria-label', 'aria'], ['href', 'href']];
    for (const [attribute, prefix] of attributes) {
      let attrIndex = 0;
      for (const element of root.querySelectorAll(`[${attribute}]`)) {
        if (element.closest(ignored)) continue;
        const value = element.getAttribute(attribute);
        if (value === null || !value.trim()) continue;
        targets.push({ key: `${prefix}-${attrIndex++}`, kind: 'attribute', node: element, attribute, value, label: `${element.tagName.toLowerCase()} ${attribute}` });
      }
    }
    let imageIndex = 0;
    for (const element of root.querySelectorAll('img[src]')) {
      if (element.closest(ignored)) continue;
      targets.push({ key: `image-${imageIndex++}`, kind: 'attribute', node: element, attribute: 'src', value: element.getAttribute('src') || '', label: 'image source URL' });
    }
    return targets;
  }
  window.SilvergoldContentTargets = { collect };
})();
