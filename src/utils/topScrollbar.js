export function initTopScrollbar() {
  const wrappers = document.querySelectorAll('.table-wrapper:not([data-top-scroll])');
  wrappers.forEach((wrapper) => {
    wrapper.setAttribute('data-top-scroll', '1');
    const top = document.createElement('div');
    top.style.cssText = 'overflow-x:scroll;overflow-y:hidden;height:16px;margin-bottom:0';
    const inner = document.createElement('div');
    inner.style.cssText = 'height:1px';
    top.appendChild(inner);
    wrapper.parentNode.insertBefore(top, wrapper);
    const sync = () => { requestAnimationFrame(() => { inner.style.width = wrapper.scrollWidth + 'px'; }); };
    top.addEventListener('scroll', () => { wrapper.scrollLeft = top.scrollLeft; });
    wrapper.addEventListener('scroll', () => { top.scrollLeft = wrapper.scrollLeft; });
    const ro = new ResizeObserver(sync);
    ro.observe(wrapper);
    new MutationObserver(sync).observe(wrapper, { childList: true, subtree: true, attributes: true });
    sync();
  });
}
