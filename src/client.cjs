'use strict';
const React = require('react');
const { Tooltip, MarkdownText } = require('@deepseek-ai/dsh-client-ui-primitives');
const { createRoot } = require('react-dom/client');
const { STORAGE_KEY, PRESETS, RANGES, isCustom, createPreferences, replyCSS, pageCSS, alignBrandCaption } = require('./core.cjs');
const PANEL_CSS = require('./panel.css');
const CONTENT_CSS = require('./content.css');
const { createContentController } = require('./content-controller.cjs');
const { createArtifactWorkspace,TAB_KIND,TAB_ID } = require('./artifact-view.cjs');
const h = React.createElement;
const PLUGIN_ID = 'dsh-reply-beautify';

function BrushIcon() {
  return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('path', { d: 'M10.5 12.5 19 3a1.4 1.4 0 0 1 2 2l-8.5 9.5M10.5 12.5 8 15l3 3 2.5-3.5' }), h('path', { d: 'M8 15c-3-1-4 1-4 3 0 1-1 2-2 3 3 1 7-1 7-4' }));
}

// A hidden session-scoped dock entry supplies a reliable storage namespace.
// It occupies no layout space and never sends a message or takes the composer.
function SessionMarker(props) {
  const ref=React.useRef(null),sessionId=props.sessionId??props.owner?.sessionId;
  React.useLayoutEffect(()=>{
    if(!sessionId||!ref.current)return;
    let container=ref.current.parentElement;
    while(container&&!container.querySelector('[data-chat-flow]'))container=container.parentElement;
    if(!container || container===document.body)return;
    container.setAttribute('data-dsh-rb-session',sessionId);
    return()=>{if(container.getAttribute('data-dsh-rb-session')===sessionId)container.removeAttribute('data-dsh-rb-session');};
  },[sessionId]);
  return h('span',{ref,hidden:true,'data-dsh-rb-session-marker':''});
}

function BeautifyControl(props) {
  const store = props.preferences;
  // The sidebar's owner payload is forwarded by the framework; support both faces.
  const wide = props.wide ?? props.owner?.wide ?? true;
  const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const p = snapshot.preferences;
  React.useLayoutEffect(() => {
    const caption = document.querySelector('._2H3hWW_root ._2H3hWW_brandName');
    if (!caption) return;
    caption.style.removeProperty('--dsh-rb-wordmark-top');
    caption.style.removeProperty('--dsh-rb-badge-shift');
    if (!p.enabled || p.preset === 'default') return;
    let alive = true;
    const update = () => { if (alive) alignBrandCaption(caption); };
    update();
    const resize = new ResizeObserver(update); resize.observe(caption);
    document.fonts?.ready.then(update);
    return () => { alive=false;resize.disconnect();caption.style.removeProperty('--dsh-rb-badge-shift'); };
  }, [p.enabled,p.preset,wide]);
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef(null);
  const panelRef = React.useRef(null);
  const closeRef = React.useRef(null);
  const updatePosition = React.useCallback(() => {
    const button = buttonRef.current, panel = panelRef.current;
    if (!button || !panel) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(320, Math.max(240, window.innerWidth - 24));
    panel.style.width = width + 'px';
    const height = panel.getBoundingClientRect().height;
    panel.style.left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)) + 'px';
    panel.style.top = Math.max(12, rect.top - height - 10) + 'px';
  }, []);
  function close(returnFocus = false) { setOpen(false); if (returnFocus) buttonRef.current?.focus(); }
  React.useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!open) { try { if (panel.matches(':popover-open')) panel.hidePopover(); } catch {} return; }
    if (typeof panel.showPopover === 'function') { try { panel.showPopover(); } catch {} }
    updatePosition();
    closeRef.current?.focus({ preventScroll: true });
    const resize = new ResizeObserver(updatePosition); resize.observe(panel);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const outside = event => { if (!panel.contains(event.target) && !buttonRef.current?.contains(event.target)) close(); };
    const key = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); } };
    document.addEventListener('pointerdown', outside, true);
    panel.addEventListener('keydown', key);
    return () => {
      resize.disconnect(); window.removeEventListener('resize', updatePosition); window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', outside, true); panel.removeEventListener('keydown', key);
      try { if (panel.matches(':popover-open')) panel.hidePopover(); } catch {}
    };
  }, [open, updatePosition]);

  const presetKeys = Object.keys(PRESETS);
  const fields = [ ['font', '正文字号', 'px'], ['code', '代码字号', 'px'], ['leading', '行距', '倍'], ['paragraph', '段间距', 'px'] ];
  const sectionId = 'dsh-rb-adjustments';
  const disabled = !p.enabled;
  const tabKeys = (event, index) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % presetKeys.length;
    else if (event.key === 'ArrowLeft') next = (index + presetKeys.length - 1) % presetKeys.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = presetKeys.length - 1;
    else return;
    event.preventDefault(); store.setPreset(presetKeys[next]);
    panelRef.current?.querySelector(`[data-rb-preset="${presetKeys[next]}"]`)?.focus();
  };
  return h('div', { className: 'dsh-rb-footer', 'data-wide': String(wide), 'data-reply-beautify': '0.6.1' },
    h(Tooltip, { label: '回复美化', delayMs: 350 },
      h('button', { ref: buttonRef, className: 'dsh-rb-launcher', type: 'button', 'aria-label': '回复美化', 'aria-expanded': open, 'aria-controls': 'dsh-rb-panel', onClick: () => setOpen(!open) }, h(BrushIcon))),
    h('section', { id: 'dsh-rb-panel', ref: panelRef, className: 'dsh-rb-panel', popover: 'manual', role: 'dialog', 'aria-label': '回复美化设置', 'aria-modal': false, 'data-open': open ? '' : undefined },
      h('div', { className: 'dsh-rb-heading' }, h('div', null, h('strong', null, '回复美化'), h('p', null, '回复排版、图示与交互组件')),
        h('button', { ref: closeRef, type: 'button', className: 'dsh-rb-close', 'aria-label': '关闭美化设置', onClick: () => close(true) }, '×')),
      h('label', { className: 'dsh-rb-enable' }, h('span', null, '启用美化'),
        h('input', { type: 'checkbox', role: 'switch', 'aria-label': '启用美化', checked: p.enabled, onChange: event => store.update({ enabled: event.target.checked }) })),
      h('div', { className: 'dsh-rb-adjustable', 'data-disabled': disabled ? '' : undefined },
        h('div', { className: 'dsh-rb-tabs', role: 'tablist', 'aria-label': '正文样式' }, presetKeys.map((key, index) =>
          h('button', { key, id: 'dsh-rb-preset-' + key, type: 'button', role: 'tab', 'data-rb-preset': key, 'aria-selected': p.preset === key, 'aria-controls': sectionId,
            tabIndex: p.preset === key ? 0 : -1, disabled, onClick: () => store.setPreset(key), onKeyDown: event => tabKeys(event, index) }, PRESETS[key].label))),
        h('div', { id: sectionId, role: 'tabpanel', 'aria-labelledby': 'dsh-rb-preset-' + p.preset },
          h('p', { className: 'dsh-rb-description' }, PRESETS[p.preset].description),
          fields.map(([key, label, unit]) => h('label', { key, className: 'dsh-rb-range' },
            h('span', null, label, h('output', null, (key === 'leading' ? p[key].toFixed(2) : p[key]) + ' ' + unit)),
            h('input', { type: 'range', min: RANGES[key][0], max: RANGES[key][1], step: RANGES[key][2], value: p[key], disabled, 'aria-label': label,
              onChange: event => store.update({ [key]: Number(event.target.value) }) }))),
          h('div', { className: 'dsh-rb-reset-row' }, h('span', { role: 'status', 'aria-live': 'polite' }, isCustom(p) ? '已微调' : '当前样式默认值'),
            h('button', { type: 'button', className: 'dsh-rb-reset', disabled, onClick: () => store.reset() }, '恢复当前样式')),
          h('p', { className: 'dsh-rb-note' }, '切换样式会应用该方案的默认参数，之后可继续微调。图示增强随美化开关启停，可随时查看原文。'))),
      h('div', { className: 'dsh-rb-save-status', role: 'status' }, snapshot.storageAvailable ? '设置保存在此设备 · 0.6.1' : '暂时无法保存，当前调整仅本次生效')));
}

function ArtifactSidebar({useTabInfo,workspace,preferences,sidebarRight}) {
  const {tab}=useTabInfo(),ref=React.useRef(null);
  const {preferences:p}=React.useSyncExternalStore(preferences.subscribe,preferences.getSnapshot,preferences.getSnapshot);
  const session=sidebarRight.mounted.getSnapshot();
  React.useLayoutEffect(()=>{
    if(!tab.visible||!p.enabled||!session||!ref.current)return;
    return workspace.mountSidebar(ref.current,session);
  },[tab.visible,p.enabled,session,workspace]);
  return h('div',{ref,className:'dsh-rb-artifact-sidebar','data-dsh-rb-owned':'','data-preset':p.preset},p.enabled?null:'请在画笔设置中开启美化，以查看作品。');
}

function apply(ctx) {
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('unavailable'); }, setItem() { throw new Error('unavailable'); } }; }
  const preferences = createPreferences(storage);
  ctx.effect(() => {
    const panelStyle = document.createElement('style'); panelStyle.dataset.plugin = PLUGIN_ID; panelStyle.dataset.pluginCss = PLUGIN_ID + '/panel'; panelStyle.textContent = PANEL_CSS;
    const replyStyle = document.createElement('style'); replyStyle.dataset.plugin = PLUGIN_ID; replyStyle.dataset.pluginCss = PLUGIN_ID + '/reply';
    const pageStyle = document.createElement('style'); pageStyle.dataset.plugin = PLUGIN_ID; pageStyle.dataset.pluginCss = PLUGIN_ID + '/page';
    const render = () => { const p = preferences.getSnapshot().preferences; replyStyle.textContent = replyCSS(p); pageStyle.textContent = pageCSS(p); };
    const contentStyle = document.createElement('style'); contentStyle.dataset.plugin = PLUGIN_ID; contentStyle.dataset.pluginCss = PLUGIN_ID + '/content'; contentStyle.textContent = CONTENT_CSS;
    render(); document.head.append(panelStyle, replyStyle, pageStyle, contentStyle);
    const workspace=createArtifactWorkspace(document,preferences,{storage,sidebar:ctx.sidebarRight});
    const releaseType=ctx.sidebarRightTabs?.register({id:TAB_ID,kind:TAB_KIND,title:()=> '作品空间',keepMounted:false});
    const releaseSeat=ctx.sidebarRightTabs?ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:TAB_ID,inject:()=>({workspace,preferences,sidebarRight:ctx.sidebarRight})},ArtifactSidebar)):null;
    const content = createContentController(document, preferences, {
      artifactWorkspace:workspace,
      mountMath(node, formula) {
        let failed=false;
        const root=createRoot(node,{onUncaughtError(){failed=true;}});
        root.render(h(MarkdownText,{text:`$$\n${formula}\n$$`,streaming:false}));
        return {failed:()=>failed,dispose:()=>root.unmount()};
      }
    });
    const unsubscribe = preferences.subscribe(render);
    const receive = event => { if (event.key === STORAGE_KEY && event.storageArea === storage) preferences.receive(event.newValue); };
    window.addEventListener('storage', receive);
    return () => { unsubscribe(); content.dispose(); releaseSeat?.();releaseType?.();workspace.dispose();window.removeEventListener('storage', receive); panelStyle.remove(); replyStyle.remove(); pageStyle.remove(); contentStyle.remove(); preferences.dispose(); };
  });
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: PLUGIN_ID, order: 100,
    inject: () => ({ preferences })
  }, BeautifyControl));
  ctx.slots.inject('conversation.composer.dock',()=>ctx.slots.register({name:'conversation.composer.dock',id:PLUGIN_ID+'/session',order:1000},SessionMarker));
}
module.exports = { name: 'reply-beautify', inject: ['slots','sidebarRight','sidebarRightTabs'], apply };
