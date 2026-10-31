// 0.9.10: keep focused inputs above the on-screen keyboard (Android edge-to-edge does not shrink the WebView).
// Sets --kb (px of keyboard covering the layout viewport); fixed bottom sheets/bars use bottom: var(--kb).
export function overlap({ innerHeight, vvHeight, vvTop = 0, nativeKb = 0, baseHeight = innerHeight }) {
  const fromVV = Math.max(0, Math.round(innerHeight - (vvHeight ?? innerHeight) - vvTop));
  const shrunk = Math.max(0, baseHeight - innerHeight);               // the WebView already resized (adjustResize)
  const fromNative = Math.max(0, Math.round(nativeKb - shrunk));
  const v = Math.max(fromVV, fromNative);
  return v > 60 ? v : 0;                                               // ignore toolbars / rounding
}
export function setupKeyboard({ win = globalThis.window, doc = globalThis.document, native = null } = {}) {
  if (!win || !doc) return () => {};
  const root = doc.documentElement, base = { h: win.innerHeight }; let nativeKb = 0;
  const apply = () => { const vv = win.visualViewport; const kb = overlap({ innerHeight: win.innerHeight, vvHeight: vv?.height, vvTop: vv?.offsetTop || 0, nativeKb, baseHeight: base.h });
    root.style.setProperty('--kb', kb + 'px'); root.classList.toggle('kb-open', kb > 0); if (kb > 0) reveal(); };
  const reveal = () => { const el = doc.activeElement; if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) setTimeout(() => { try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch { /* old WebView */ } }, 60); };
  win.visualViewport?.addEventListener('resize', apply); win.visualViewport?.addEventListener('scroll', apply);
  win.addEventListener('orientationchange', () => { setTimeout(() => { base.h = win.innerHeight; apply(); }, 400); });
  doc.addEventListener('focusin', e => { if (/^(INPUT|TEXTAREA)$/.test(e.target?.tagName || '')) setTimeout(reveal, 320); });
  if (native) {
    native.addListener?.('keyboardWillShow', i => { nativeKb = Number(i?.keyboardHeight) || 0; apply(); });
    native.addListener?.('keyboardDidShow', i => { nativeKb = Number(i?.keyboardHeight) || nativeKb; apply(); });
    native.addListener?.('keyboardWillHide', () => { nativeKb = 0; apply(); });
  }
  apply(); return apply;
}
