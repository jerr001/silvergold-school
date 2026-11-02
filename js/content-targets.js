(() => {
  const ignored = 'script,style,noscript,template,[data-public-news],.gallery-grid,.theme-toggle,.hamburger,.carousel-nav,.why-icon,.stars,#imageModal';

  function excluded(node) { return Boolean(node.parentElement?.closest(ignored)); }

  // Build an identity from the target's local place in the page, not its global
  // order. Adding a navigation item or section elsewhere will not remap saved copy.
  function elementPath(element, root) {
    const parts = [];
    while (element && element !== root) {
      const siblings = element.parentElement
        ? [...element.parentElement.children].filter(item => item.tagName === element.tagName)
        : [];
      const position = siblings.indexOf(element) + 1;
      const classes = [...element.classList].sort().join('.');
      const identity = element.id ? `#${element.id}` : classes ? `.${classes}` : '';
      parts.unshift(`${element.tagName.toLowerCase()}${identity}:${position}`);
      element = element.parentElement;
    }
    return parts.join('>');
  }

  function hash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index++) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(16).padStart(8, '0');
  }

  function keyFor(root, node, prefix, attribute = '') {
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    let identity = elementPath(element, root);
    if (node.nodeType === Node.TEXT_NODE) {
      const textSiblings = [...element.childNodes].filter(child => child.nodeType === Node.TEXT_NODE);
      identity += `:text-${textSiblings.indexOf(node)}`;
    }
    if (attribute) identity += `:${attribute}`;
    return `cms-${prefix}-${hash(identity)}`;
  }

  function collect(root) {
    const targets = [];
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim() || excluded(node)) continue;
      const tag = node.parentElement?.tagName.toLowerCase() || 'text';
      targets.push({ key: keyFor(root, node, 'text'), kind: 'text', node, value: node.nodeValue, label: `${tag} text` });
    }
    const attributes = [['alt', 'alt'], ['placeholder', 'placeholder'], ['title', 'titleattr'], ['aria-label', 'aria'], ['href', 'href']];
    for (const [attribute, prefix] of attributes) {
      for (const element of root.querySelectorAll(`[${attribute}]`)) {
        if (element.closest(ignored)) continue;
        const value = element.getAttribute(attribute);
        if (value === null || !value.trim()) continue;
        targets.push({ key: keyFor(root, element, prefix, attribute), kind: 'attribute', node: element, attribute, value, label: `${element.tagName.toLowerCase()} ${attribute}` });
      }
    }
    for (const element of root.querySelectorAll('img[src]')) {
      if (element.closest(ignored)) continue;
      targets.push({ key: keyFor(root, element, 'image', 'src'), kind: 'attribute', node: element, attribute: 'src', value: element.getAttribute('src') || '', label: 'image source URL' });
    }
    return targets;
  }

  window.SilvergoldContentTargets = { collect };
})();
