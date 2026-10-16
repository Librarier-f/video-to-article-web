(() => {
  'use strict';
  const body = document.body;
  const article = document.getElementById('article-body');
  if (!article) return;
  let fontSize = 17;
  const decrease = document.querySelector('[data-action="font-decrease"]');
  const increase = document.querySelector('[data-action="font-increase"]');
  function updateSize() {
    body.style.setProperty('--reader-size', fontSize + 'px');
    decrease.disabled = fontSize <= 15;
    increase.disabled = fontSize >= 23;
  }
  decrease.addEventListener('click', () => { fontSize = Math.max(15, fontSize - 1); updateSize(); });
  increase.addEventListener('click', () => { fontSize = Math.min(23, fontSize + 1); updateSize(); });
  updateSize();
  const appearance = document.querySelector('[data-action="appearance"]');
  appearance.addEventListener('click', () => {
    const current = body.dataset.scheme || body.dataset.defaultScheme;
    const next = current === 'dark' ? 'light' : 'dark';
    if (next === body.dataset.defaultScheme) delete body.dataset.scheme;
    else body.dataset.scheme = next;
    appearance.textContent = next === 'dark' ? '浅色' : '深色';
    appearance.setAttribute('aria-label', next === 'dark' ? '切换浅色阅读' : '切换深色阅读');
  });
  const focus = document.querySelector('[data-action="focus"]');
  focus.addEventListener('click', () => {
    const enabled = body.classList.toggle('is-focus');
    focus.setAttribute('aria-pressed', String(enabled));
    focus.textContent = enabled ? '退出专注' : '专注阅读';
  });
  document.querySelector('[data-action="print"]').addEventListener('click', () => {
    try { window.print(); } catch (_) { /* Embedded browsers may prohibit printing. */ }
  });
  const toc = document.querySelector('.toc');
  if (window.matchMedia('(max-width: 767px)').matches) toc.open = false;
  const links = [...document.querySelectorAll('.toc a')];
  function activate(id) {
    links.forEach(link => {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  links.forEach(link => link.addEventListener('click', () => {
    activate(link.hash.slice(1));
    if (window.matchMedia('(max-width: 767px)').matches) toc.open = false;
  }));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) activate(visible[0].target.id);
    }, { rootMargin: '-10% 0px -65% 0px' });
    article.querySelectorAll('h2[id], h3[id]').forEach(heading => observer.observe(heading));
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  }
  const lightbox = document.getElementById('reader-lightbox');
  const largeImage = lightbox.querySelector('img');
  function showImage(image) {
    if (!image.currentSrc && !image.src) return;
    largeImage.src = image.currentSrc || image.src;
    largeImage.alt = image.alt;
    lightbox.querySelector('p').textContent = image.closest('figure')?.querySelector('figcaption')?.textContent || image.alt;
    if (typeof lightbox.showModal === 'function') lightbox.showModal();
  }
  article.querySelectorAll('img').forEach(image => {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', '放大图片：' + (image.alt || '视频配图'));
    image.addEventListener('click', () => showImage(image));
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showImage(image); }
    });
  });
  document.querySelector('.source-cover img')?.addEventListener('error', event => event.target.closest('figure').hidden = true);
  lightbox.querySelector('button').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  article.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = '复制代码';
    const code = pre.querySelector('code');
    const text = code ? code.textContent : pre.textContent;
    button.addEventListener('click', async () => {
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch (_) { /* Fall back for downloaded files and sandboxed previews. */ }
      if (!copied) {
        const field = document.createElement('textarea');
        field.value = text;
        field.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.append(field);
        field.select();
        try { copied = document.execCommand('copy'); } catch (_) { /* Display failure. */ }
        field.remove();
        button.focus();
      }
      button.textContent = copied ? '已复制' : '请选中代码复制';
      setTimeout(() => { button.textContent = '复制代码'; }, 2200);
    });
    pre.prepend(button);
  });
})();
