'use strict';

const STORAGE_KEY = 'dsh.reply-beautify.v1';
const CODE_FONT = '"Cascadia Code",Consolas,"Microsoft YaHei",monospace';
const PRESETS = Object.freeze({
  default: Object.freeze({ label: '默认', font: 15, code: 13, leading: 1.7, paragraph: 14,
    family: '"Segoe UI","Microsoft YaHei UI","Microsoft YaHei",system-ui,sans-serif',
    description: '清晰的中英混排，克制的标题与留白' }),
  chatgpt: Object.freeze({ label: 'ChatGPT', font: 15, code: 13, leading: 1.75, paragraph: 16,
    family: 'system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif',
    description: '无衬线字体与清晰层次，偏简洁的对话阅读感' }),
  claude: Object.freeze({ label: 'Claude', font: 15, code: 13, leading: 1.8, paragraph: 17,
    family: 'Georgia,"Noto Serif SC","Source Han Serif SC","Songti SC",SimSun,serif',
    description: '衬线正文与舒展行距，偏书页式阅读感' })
});
const RANGES = Object.freeze({ font: [12, 20, 1], code: [11, 18, 1], leading: [1.4, 2, 0.05], paragraph: [8, 24, 1] });
// These are semantic Chat row markers plus the Markdown class stem in DSH 0.2.1.
// Do not use body-wide tokens: they also change the composer and user messages.
const REPLY_SELECTOR = '[data-chat-flow-kind="assistant-step"]:not([data-chat-group-part="reasoning"]) [class^="_markdown_"]:not([data-markdown-variant="compact"])';
// DSH 0.2.1's official SVG wordmark: replace only the leading lowercase d.
// Default retains the other native letters; alternate names retain the native badge.
const CAPITAL_D_PATH = 'M26.9563 4.62842H31.05C35.12 4.62842 37.3611 7.06 37.3611 11.625S35.12 18.6219 31.05 18.6219H26.9563ZM29.352 6.8V16.45H30.95C33.62 16.45 34.965 14.84 34.965 11.625S33.62 6.8 30.95 6.8Z';
const BRAND_COLORS = Object.freeze({ default: '#4D6BFE', chatgpt: '#FFFFFF', claude: '#D97757' });
const ORANGE_SCALE = Object.freeze({ 50:'#fff4ee', '50p':'#fff0e7', 75:'#ffede2', 100:'#fde7d9', 200:'#f8d0b7', 300:'#efb18f', 400:'#D97757', 450:'#D97757', 500:'#b55c3d', 600:'#98472e', 700:'#7b3926', 800:'#59372b', 900:'#3f2b24', 950:'#2f211c' });

function claudeAccentCSS() {
  const declarations = Object.entries(ORANGE_SCALE).flatMap(([level,color]) => ['blue','deepseek'].map(family => `--dsw-static-${family}-${level}:${color}`));
  declarations.push('--dsw-static-deepseek-700-delete:#7b3926',
    '--dsw-alias-brand-primary-new-colorprimary-new-color:var(--dsw-alias-state-business-primary)',
    '--dsw-alias-onboarding-accent:#D97757','--dsh-boot-brand:#D97757',
    '--dsw-gradient-onboarding-blue-stops:#b55c3d 18.75%,#D97757 51.78%,#efb18f 86.252%,#b55c3d',
    '--dsw-gradient-onboarding-cyan-stops:#98472e 21.154%,#D97757 50.954%,#f8d0b7 85.326%,#98472e',
    '--dsw-gradient-onboarding-violet-stops:#98472e 33.102%,#D97757 50.954%,#f8d0b7 85.326%,#98472e');
  // The native theme is lazy-loaded and may append its body rules AFTER ours.
  // Outrank both native light/dark selectors rather than depending on load order.
  return `html body,html body[data-ds-dark-theme]{${declarations.join(';')}}
body{--dsh-rb-trajectory-assistant:#7650bf;--dsh-rb-trajectory-tool:#956600;--dsh-rb-trajectory-subtool:#92733a}
body[data-ds-dark-theme]{--dsh-rb-trajectory-assistant:#b39bf5;--dsh-rb-trajectory-tool:#dfb45c;--dsh-rb-trajectory-subtool:#bb9b61}
body .haSm5q_assistantVioletBright{color:var(--dsh-rb-trajectory-assistant);background:color-mix(in srgb,var(--dsh-rb-trajectory-assistant) 16%,var(--dsw-alias-bg-layer-1))}
body .haSm5q_toolAmber{color:var(--dsh-rb-trajectory-tool);background:color-mix(in srgb,var(--dsh-rb-trajectory-tool) 16%,var(--dsw-alias-bg-layer-1))}
body .haSm5q_subtoolAmber{color:var(--dsh-rb-trajectory-subtool);background:color-mix(in srgb,var(--dsh-rb-trajectory-subtool) 12%,var(--dsw-alias-bg-layer-1))}
body .ZNyiNW_span[data-timeline-span=message]{--trajectory-assistant-decoding-color:var(--dsh-rb-trajectory-assistant);--trajectory-assistant-ttft-color:color-mix(in srgb,var(--dsh-rb-trajectory-assistant) 48%,var(--dsw-alias-bg-layer-2))}
body .ZNyiNW_span:is([data-timeline-span=tool],[data-timeline-span=subtool]):not([data-error=true]){background:var(--dsh-rb-trajectory-tool)}
[data-platform=darwin] .BynINW_sidebarCol{background:linear-gradient(to bottom,#d977571a,#d9775700 35%,#b55c3d00 68%,#b55c3d17),color-mix(in srgb,var(--dsw-specific-sidebar-fill) 97%,#D97757)}
[data-platform=darwin] [data-ds-dark-theme] .BynINW_sidebarCol{background:linear-gradient(to bottom,#d9775714,#d9775700 35%,#b55c3d00 68%,#b55c3d12),color-mix(in srgb,var(--dsw-specific-sidebar-fill) 50%,transparent)}`;
}

// Leave the wordmark at its original position. Move the badge to the common
// letter baseline, deliberately excluding p's descender per the user's request.
function alignBrandCaption(caption) {
  const view = caption.ownerDocument.defaultView;
  const svg = caption.querySelector('svg');
  if (!svg) return;
  const style = view.getComputedStyle(caption,'::before');
  if (style.content === 'none' || style.content === 'normal') return;
  const ctx = caption.ownerDocument.createElement('canvas').getContext('2d');
  if (!ctx) return;
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const m = ctx.measureText('Deeseek');
  const ascent = m.fontBoundingBoxAscent, descent = m.fontBoundingBoxDescent;
  if (![ascent,descent,m.actualBoundingBoxDescent].every(Number.isFinite)) return;
  const line = parseFloat(style.lineHeight);
  const target = svg.getBoundingClientRect().top - caption.getBoundingClientRect().top + svg.getBoundingClientRect().height * 19.5 / 24;
  const inkBottom = (line-ascent-descent)/2 + ascent + m.actualBoundingBoxDescent;
  caption.style.setProperty('--dsh-rb-badge-shift',`${Number((inkBottom-target).toFixed(3))}px`);
  return { originalBadgeBottom:target,letterBottom:inkBottom,badgeShift:inkBottom-target };
}

function pageCSS(input) {
  const s = normalize(input);
  if (!s.enabled) return '';
  const sidebar = '._2H3hWW_root';
  const caption = sidebar + ' ._2H3hWW_brandName';
  // Native slot rendering can wrap the artwork; do not require a direct child.
  const wordmark = caption + ' svg';
  const alternateName = s.preset === 'chatgpt' || s.preset === 'claude';
  return `
${s.preset === 'chatgpt' ? `body{--dsw-font-family:${PRESETS.chatgpt.family};font-family:${PRESETS.chatgpt.family}}` : ''}
${s.preset === 'claude' ? claudeAccentCSS() : ''}
${sidebar}{--dsh-rb-brand-accent:${BRAND_COLORS[s.preset]}}
${sidebar} :is(._2H3hWW_brandMark,._2H3hWW_railMark){color:var(--dsh-rb-brand-accent)}
${wordmark}>path:nth-of-type(2){d:path("${CAPITAL_D_PATH}");fill-rule:evenodd}
${wordmark}>rect{fill:var(--dsh-rb-brand-accent)}
${wordmark}>g[clip-path="url(#dsh-wordmark-badge-clip)"] path{fill:#000}
${alternateName ? `
${caption}{position:relative}
${wordmark}>path{visibility:hidden}
${caption}::before{content:"Deepseek";position:absolute;left:0;top:0;z-index:1;pointer-events:none;white-space:nowrap;font:${s.preset === 'chatgpt' ? '600 20px/24px Arial,Helvetica,sans-serif' : '500 22px/24px Georgia,"Times New Roman",serif'};letter-spacing:0;color:inherit}
${wordmark}>rect,${wordmark}>g[clip-path="url(#dsh-wordmark-badge-clip)"]{transform:translateY(var(--dsh-rb-badge-shift,0px))}
` : ''}
${s.preset === 'chatgpt' ? `body:not([data-ds-dark-theme]) ${sidebar} :is(._2H3hWW_brandMark,._2H3hWW_railMark),body:not([data-ds-dark-theme]) ${wordmark}>rect{filter:drop-shadow(0 0 .6px #000b)}` : ''}
`;
}

function validPreset(value) { return typeof value === 'string' && Object.hasOwn(PRESETS, value); }
function normalize(input) {
  const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const preset = validPreset(data.preset) ? data.preset : 'default';
  const result = { schema: 1, enabled: typeof data.enabled === 'boolean' ? data.enabled : true, welcomeMascot: typeof data.welcomeMascot === 'boolean' ? data.welcomeMascot : true, preset };
  for (const [key, [min, max, step]] of Object.entries(RANGES)) {
    const value = typeof data[key] === 'number' && Number.isFinite(data[key]) ? data[key] : PRESETS[preset][key];
    result[key] = Number((Math.round(Math.min(max, Math.max(min, value)) / step) * step).toFixed(2));
  }
  return Object.freeze(result);
}
function parsePreferences(raw) {
  try {
    const data = JSON.parse(raw);
    if (data?.schema !== undefined && data.schema !== 1) return normalize();
    return normalize(data);
  } catch { return normalize(); }
}
function presetValues(preset) {
  const chosen = validPreset(preset) ? preset : 'default';
  const p = PRESETS[chosen];
  return { preset: chosen, font: p.font, code: p.code, leading: p.leading, paragraph: p.paragraph };
}
function isCustom(state) { return Object.keys(RANGES).some(key => Math.abs(state[key] - PRESETS[state.preset][key]) > 0.001); }

function createPreferences(storage) {
  let state;
  let storageAvailable = true;
  try { state = parsePreferences(storage.getItem(STORAGE_KEY)); } catch { state = normalize(); storageAvailable = false; }
  let snapshot = Object.freeze({ preferences: state, storageAvailable });
  const listeners = new Set();
  function publish() { snapshot = Object.freeze({ preferences: state, storageAvailable }); for (const callback of [...listeners]) callback(); }
  function update(patch) {
    state = normalize({ ...state, ...patch });
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); storageAvailable = true; } catch { storageAvailable = false; }
    publish();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    update,
    setPreset(preset) { update(presetValues(preset)); },
    reset() { update(presetValues(state.preset)); },
    receive(raw) { state = parsePreferences(raw); publish(); },
    dispose() { listeners.clear(); }
  };
}

function replyCSS(input) {
  const s = normalize(input);
  if (!s.enabled) return '';
  const q = REPLY_SELECTOR;
  const family = PRESETS[s.preset].family;
  const codeLine = Number((s.code * 1.75).toFixed(2));
  return `
${q}{
  font-family:${family};font-size:${s.font}px;line-height:${s.leading};
  --ds-font-family-code:${CODE_FONT};
  --dsw-font-markdown-code-block:400 ${s.code}px/${codeLine}px ${CODE_FONT};
  --dsw-font-markdown-code-block-small:400 ${s.code}px/${codeLine}px ${CODE_FONT};
}
${q} :where(h1,h2,h3,h4,h5,h6){font-family:${family};font-weight:600;line-height:1.45;letter-spacing:normal;margin:${s.paragraph + 10}px 0 ${Math.max(8,s.paragraph-3)}px}
${q} h1{font-size:${s.font+7}px}
${q} h2{font-size:${s.font+4}px}
${q} h3{font-size:${s.font+2}px}
${q} :where(h4,h5,h6){font-size:${s.font}px}
${q} p{margin:0 0 ${s.paragraph}px}
${q} :where(table,div:has(>table))+p{margin-top:${Math.max(16,s.paragraph)}px}
${q}>:first-child{margin-top:0}
${q}>:last-child{margin-bottom:0}
${q} :where(ul,ol){margin:${s.paragraph}px 0;padding-left:1.5em}
${q} li:not(:first-child){margin-top:6px}
${q} li::marker{line-height:inherit}
${q} li>p{margin:6px 0}
${q} li>:where(ul,ol){margin-top:6px;margin-bottom:6px}
${q} blockquote{margin:${s.paragraph}px 0;padding:3px 0 3px 15px;border-left:2px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary)}
${q} blockquote p:last-child{margin-bottom:0}
${q} .md-code-block{margin:${s.paragraph}px 0}
${q} pre{font-family:${CODE_FONT};font-size:${s.code}px;line-height:${codeLine}px;tab-size:4}
${q} :not(pre)>code{font-family:${CODE_FONT}}
${q} .md-table-wide{box-sizing:border-box;width:100%;max-width:100%;margin-left:0;padding-left:0}
${q} table{border-collapse:collapse}
${q} :where(th,td){font-family:${family};font-size:${Math.max(12,s.font-1)}px;line-height:${s.leading};padding:10px 14px;min-width:0}
${q} th{font-weight:600}
${q} .katex{font-size:1.12em}
${q} .katex-display{margin:${s.paragraph}px 0;overflow-x:auto;overflow-y:hidden}
${s.preset === 'claude' ? `
${q},${q} :where(h1,h2,h3,h4,h5,h6,th,td){font-variant-numeric:lining-nums tabular-nums}
${q} :where(code,pre,.katex){font-variant-numeric:normal}
` : ''}
`;
}

module.exports = { STORAGE_KEY, CODE_FONT, PRESETS, RANGES, REPLY_SELECTOR, CAPITAL_D_PATH, BRAND_COLORS, ORANGE_SCALE, alignBrandCaption, normalize, parsePreferences, presetValues, isCustom, createPreferences, replyCSS, pageCSS };
