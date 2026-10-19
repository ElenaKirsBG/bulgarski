/* Български език — учебное приложение (PWA)
   © Elena Kirsanova. Все права защищены. */
(function () {
'use strict';
const ACC = '́';
const VOW = 'аеиоуъюяѝАЕИОУЪЮЯ';
const $ = (s, el) => (el || document).querySelector(s);
const view = $('#view');

/* ---------- хранилище ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('bg.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('bg.' + k, JSON.stringify(v)); } catch (e) {} }
};
const S = Object.assign({ theme: 'auto', fs: 17, stress: 'color', rate: 0.9, voice: '', showRu: true, cardDir: 'bg' }, store.get('settings', {}));
function saveS() { store.set('settings', S); applyS(); }
function applyS() {
  document.documentElement.setAttribute('data-theme', S.theme);
  document.documentElement.style.setProperty('--fs', S.fs + 'px');
}
applyS();
let progress = store.get('progress', {});  // {lessonId: {done:true, score:0.8}}
let srs = store.get('srs', {});            // {key: {b:box, d:dueDay}}

/* ---------- текстовые утилиты ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plain = s => String(s).replace(/́/g, '');
const norm = s => plain(String(s)).toLowerCase().replace(/ѝ/g, 'и').replace(/ё/g, 'е').replace(/[!?.,…:;«»„“"]+/g, '').replace(/\s+/g, ' ').trim();
const vowelsCount = w => (plain(w).match(/[аеиоуъюяѝ]/gi) || []).length;
/* убираем знак ударения в односложных словах (так принято в учебниках) */
function tidy(s) {
  return String(s).replace(/[А-Яа-яЍѝ́̀-]+/g, w => (vowelsCount(w) <= 1 && !/-/.test(w)) ? w.replace(/́/g, '') : w);
}
/* вывод болгарского текста с ударениями согласно настройкам */
function st(s) {
  s = tidy(s);
  if (S.stress === 'none') return esc(plain(s));
  const e = esc(s);
  if (S.stress === 'color') return e.replace(new RegExp('([' + VOW + '])' + ACC, 'g'), '<span class="st">$1' + ACC + '</span>');
  return e;
}
/* inline-разметка: **жирный**, *курсив*, {болгарский} */
function inl(s) {
  let out = '', i = 0;
  const parts = String(s).split(/(\{[^}]+\}|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith('**')) out += '<b>' + st(p.slice(2, -2)) + '</b>';
    else if (p.startsWith('{')) out += '<b class="wordlink" data-say="' + esc(plain(p.slice(1, -1))) + '">' + st(p.slice(1, -1)) + '</b>';
    else if (p.startsWith('*')) out += '<i>' + st(p.slice(1, -1)) + '</i>';
    else out += st(p);
  }
  return out;
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1600); }

/* ---------- озвучка ---------- */
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices().filter(v => /^bg/i.test(v.lang)); } catch (e) { voices = []; } }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function say(text) {
  if (!('speechSynthesis' in window)) { toast('Озвучка недоступна в этом браузере'); return; }
  const u = new SpeechSynthesisUtterance(plain(text).replace(/ѝ/g, 'и'));
  u.lang = 'bg-BG'; u.rate = S.rate;
  const v = voices.find(v => v.name === S.voice) || voices[0];
  if (v) u.voice = v; else if (!voices.length) toast('Болгарский голос не найден — см. Настройки');
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
const SAY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';

/* ================= СЛОВАРЬ: разбор и формы ================= */
const POS = { 'м': 'сущ. м. р.', 'ж': 'сущ. ж. р.', 'ср': 'сущ. ср. р.', 'мн': 'сущ. мн. ч.', 'пр': 'прил.', 'гл': 'глагол', 'нар': 'наречие', 'мест': 'местоим.', 'числ': 'числит.', 'предл': 'предлог', 'съюз': 'союз', 'част': 'частица', 'межд': 'междом.', 'фр': 'выражение' };
const DICT = [];
(window.DICT_SRC || []).forEach(block => block.split('\n').forEach(line => {
  line = line.trim(); if (!line || line.startsWith('#')) return;
  const f = line.split('|').map(x => x.trim());
  if (f.length < 3) return;
  const e = { bg: f[0], pos: f[1], ru: f[2], g: {} };
  f.slice(3).forEach(t => {
    const m = t.match(/^(\S+)\s*(.*)$/); if (!m) return;
    let k = m[1], v = m[2];
    if (/^(нсв|св|дв)$/.test(k)) { e.g.asp = k; if (v) e.g.cl = v; return; }
    e.g[k] = v;
  });
  e.id = DICT.length; e.key = norm(e.bg) + '|' + e.pos;
  DICT.push(e);
}));

function stressPos(w) { const i = w.indexOf(ACC); return i; }
function endStressed(w) { return w.endsWith(ACC); }
function splitRefl(w) { const m = w.match(/^(.*?)( се| си)?$/); return [m[1], m[2] || '']; }

function verbForms(e) {
  let [base, refl] = splitRefl(e.bg); base = autoSt(base);
  const cleanR = x => x ? String(x).trim().replace(/ (се|си)$/, '') : x;
  const g = {}; Object.keys(e.g).forEach(k => g[k] = ['аор', 'аор2', 'прич', '2л', 'имп'].includes(k) ? cleanR(e.g[k]) : e.g[k]);
  const cl = g.cl || (base.endsWith('м') ? '3' : '1');
  const R = arr => arr.map(x => x && x !== '—' ? x + refl : x);
  const out = { cl, asp: g.asp };
  // настоящее время
  let p;
  if (g['наст']) p = g['наст'].split(',').map(s => cleanR(s));
  else if (cl === '3') { const s = base.slice(0, -1); p = [base, s + 'ш', s, s + 'ме', s + 'те', s + 'т']; }
  else {
    let s2 = g['2л'];
    if (!s2) {
      const th = cl === '2' ? 'и' : 'е';
      if (endStressed(base)) s2 = base.slice(0, -2) + th + ACC + 'ш';
      else s2 = base.slice(0, -1) + th + 'ш';
    }
    const s3 = s2.slice(0, -1);
    p = [base, s2, s3, s3 + 'м', s3 + 'те', base + 'т'];
  }
  out.pres = R(p);
  // имперфект
  let imp;
  if (g['имп']) imp = impFrom(g['имп']);
  else if (cl === '3') { const s = p[2]; imp = [s + 'х', s + 'ше', s + 'ше', s + 'хме', s + 'хте', s + 'ха']; }
  else {
    const s = p[1].replace(/ш$/, '');
    if (s.endsWith(ACC)) {
      const st0 = s.slice(0, -2);
      const v = /[жшчщ]$/.test(st0) ? 'а' : 'я';
      const a1 = st0 + v + ACC + 'х';
      imp = [a1, st0 + 'е' + ACC + 'ше', st0 + 'е' + ACC + 'ше', a1 + 'ме', a1 + 'те', a1 + 'а'];
    } else {
      const st0 = s.slice(0, -1);
      imp = [st0 + 'ех', st0 + 'еше', st0 + 'еше', st0 + 'ехме', st0 + 'ехте', st0 + 'еха'];
    }
  }
  out.imp = R(imp);
  // аорист
  const a1 = autoSt(g['аор'] || (cl === '3' ? imp[0] : ''));
  if (a1) {
    let a23 = autoSt(g['аор2']);
    if (!a23) {
      if (/ох$/.test(a1)) a23 = a1.slice(0, -2).replace(/к$/, 'ч').replace(/г$/, 'ж') + 'е';
      else a23 = a1.slice(0, -1);
    }
    out.aor = R([a1, a23, a23, a1 + 'ме', a1 + 'те', a1 + 'а']);
  }
  // причастие на -л
  let pr = g['прич'];
  if (pr && pr.includes('/')) out.part = pr.split('/').map(s => cleanR(s));
  else {
    if (!pr && a1) {
      if (/ох$/.test(a1)) { const s = a1.slice(0, -2); pr = /[тд]$/.test(s) ? s.slice(0, -1) + 'л' : s + 'ъл'; }
      else pr = a1.slice(0, -1) + 'л';
    }
    if (pr) {
      pr = autoSt(pr);
      const fem = /ъ́?л$/.test(pr) ? pr.replace(/ъ́?л$/, 'л') : pr;
      let pl = fem + 'и';
      if (cl !== '3' && /[^аеиоуъюя]я́?л$/.test(pr)) pl = pl.replace(/я(́?)ли$/, 'е$1ли');
      out.part = [pr, fem + 'а', fem + 'о', pl];
    }
  }
  // повелительное
  if (g['пов'] === '—') out.impv = null;
  else if (g['пов']) out.impv = g['пов'].split(',').map(s => cleanR(s) + refl);
  else if (cl === '3') out.impv = [p[2] + 'й' + refl, p[2] + 'йте' + refl];
  else if (/[аеиоуъюя]́?я$/.test(base)) { const s = base.slice(0, -1); out.impv = [s + 'й' + refl, s + 'йте' + refl]; }
  out.refl = refl;
  return out;
}
function impFrom(a1) { const s23 = a1.replace(/[ая](́?)х$/, 'е$1ше').replace(/ех$/, 'еше'); return [a1, s23, s23, a1 + 'ме', a1 + 'те', a1 + 'а']; }

function autoSt(w) { if (!w) return w; if (w.includes(ACC) || vowelsCount(w) !== 1 || /\s/.test(w)) return w; return w.replace(/([аеиоуъюя])/i, '$1' + ACC); }
function nounForms(e) {
  const w = autoSt(e.bg), g = e.g, pos = e.pos; const o = {};
  if (g['чл']) o.def = g['чл'].split(',').map(s => s.trim());
  else if (pos === 'м') {
    if (/[аяАЯ]́?$/.test(w)) o.def = [w + 'та'];
    else if (/[оеиуОЕИУ]́?$/.test(w)) o.def = [w + 'то'];
    else if (/й$/.test(w)) o.def = [w.slice(0, -1) + 'ят', w.slice(0, -1) + 'я'];
    else if (/тел$/.test(w)) o.def = [w + 'ят', w + 'я'];
    else o.def = [w + 'ът', w + 'а'];
  } else if (pos === 'ж') o.def = [w + 'та'];
  else if (pos === 'ср') o.def = [w + 'то'];
  if (g['мн']) {
    o.pl = g['мн'].split(',')[0].trim();
    o.pldef = g['мнчл'] || (/[аяАЯ]́?$/.test(o.pl) ? o.pl + 'та' : o.pl + 'те');
  }
  if (g['бр']) o.cnt = g['бр'];
  if (g['зв']) o.voc = g['зв'];
  return o;
}
function adjForms(e) {
  const w = autoSt(e.bg), g = e.g; let f, n, pl;
  if (g['ф']) [f, n, pl] = g['ф'].split(',').map(s => s.trim());
  else if (/ски$/.test(plain(w)) || /и$/.test(w)) { const s = w.slice(0, -1); f = s + 'а'; n = s + 'о'; pl = w; }
  else if (/[жшчщ]$/.test(w)) { f = w + 'а'; n = w + 'о'; pl = w + 'и'; }
  else { f = w + 'а'; n = w + 'о'; pl = w + 'и'; }
  return { m: w, f, n, pl, mdef: [pl + 'ят', pl + 'я'], fdef: f + 'та', ndef: n + 'то', pldef: pl + 'те' };
}

/* индекс всех словоформ -> статьи (для поиска по любой форме и для нажатия на слово) */
const FORMS = new Map();
function addForm(f, e) { if (!f) return; const k = norm(f); if (!k) return; if (!FORMS.has(k)) FORMS.set(k, new Set()); FORMS.get(k).add(e.id); }
DICT.forEach(e => {
  addForm(e.bg, e);
  try {
    if (e.pos === 'гл') { const v = verbForms(e); e._v = v;
      [v.pres, v.imp, v.aor, v.part, v.impv].forEach(a => (a || []).forEach(x => { addForm(x, e); addForm(splitRefl(x)[0], e); })); }
    else if (['м', 'ж', 'ср'].includes(e.pos)) { const n = nounForms(e); e._n = n; [...(n.def || []), n.pl, n.pldef, n.cnt].forEach(x => addForm(x, e)); }
    else if (e.pos === 'пр') { const a = adjForms(e); e._a = a; [a.f, a.n, a.pl, ...a.mdef, a.fdef, a.ndef, a.pldef].forEach(x => addForm(x, e)); }
    else if (['числ', 'мест'].includes(e.pos) && e.g['ф']) { const a = adjForms(e); [a.f, a.n, a.pl, ...(e.g['ф'].split(',').length === 3 && e.pos === 'числ' ? [...a.mdef, a.fdef, a.ndef, a.pldef] : [])].forEach(x => addForm(x, e)); }
    else if (e.pos === 'мн') { addForm(/[аяАЯ]́?$/.test(e.bg) ? e.bg + 'та' : e.bg + 'те', e); }
    if (e.g['фч']) e.g['фч'].split(',').forEach(x => addForm(x.trim(), e));
    if (e.g['ф'] && !['пр', 'числ', 'мест'].includes(e.pos)) e.g['ф'].split(',').forEach(x => addForm(x.trim(), e));
  } catch (err) { console.warn('forms', e.bg, err); }
});
function lookup(word) {
  let s = FORMS.get(norm(word));
  if (!s && /-/.test(word)) { const parts = norm(word).split('-').filter(Boolean); for (let i = parts.length - 1; i >= 0 && !s; i--) s = FORMS.get(parts[i]) || FORMS.get(parts[i] + '-'); }
  return s ? [...s].map(i => DICT[i]) : [];
}

/* ================= КУРС: разбор DSL ================= */
const LESSONS = [];
function parseLessons(src, arr, prefix) {
  let cur = null;
  src.split('\n').forEach(raw => {
    const line = raw.replace(/\s+$/, '');
    const m = line.match(/^===\s*(.+)$/);
    if (m) { const p = m[1].split('|').map(s => s.trim()); cur = { id: prefix + p[0], num: p[0], part: p[1] || '', title: p[2] || '', lvl: p[3] || '', lines: [] }; arr.push(cur); return; }
    if (cur) cur.lines.push(line);
  });
  arr.forEach(l => { if (!l.meta) parseBody(l); });
}
function parseBody(l) {
  l.meta = {}; const blocks = []; let para = [];
  const flush = () => { if (para.length) { blocks.push({ t: 'p', v: para.join(' ') }); para = []; } };
  const last = () => blocks[blocks.length - 1];
  for (const line of l.lines) {
    const t = line.trim();
    if (!t) { flush(); continue; }
    let m;
    if ((m = t.match(/^@(\w+)\s+(.*)$/))) { flush(); l.meta[m[1]] = m[2]; continue; }
    if (t.startsWith('### ')) { flush(); blocks.push({ t: 'h3', v: t.slice(4) }); continue; }
    if (t.startsWith('## ')) { flush(); blocks.push({ t: 'h2', v: t.slice(3) }); continue; }
    if (t.startsWith('|')) { flush(); const cells = t.replace(/^\||\|$/g, '').split('|').map(s => s.trim());
      if (cells.every(c => /^-+$/.test(c))) continue;
      if (last() && last().t === 'tbl') last().v.push(cells); else blocks.push({ t: 'tbl', v: [cells] }); continue; }
    if (t.startsWith('- ')) { flush(); if (last() && last().t === 'ul') last().v.push(t.slice(2)); else blocks.push({ t: 'ul', v: [t.slice(2)] }); continue; }
    if (t.startsWith('> ')) { flush(); const [bg, ru] = t.slice(2).split(' = '); if (last() && last().t === 'ex') last().v.push([bg, ru]); else blocks.push({ t: 'ex', v: [[bg, ru]] }); continue; }
    if (t.startsWith('D: ')) { flush(); const r = t.slice(3); const i = r.indexOf(': '); const who = r.slice(0, i); const [bg, ru] = r.slice(i + 2).split(' = ');
      if (last() && last().t === 'dlg') last().v.push([who, bg, ru]); else blocks.push({ t: 'dlg', v: [[who, bg, ru]] }); continue; }
    if (t.startsWith('W: ')) { flush(); const [bg, ru] = t.slice(3).split(' — '); if (last() && last().t === 'voc') last().v.push([bg, ru]); else blocks.push({ t: 'voc', v: [[bg, ru]] }); continue; }
    if (t.startsWith('!! ')) { flush(); blocks.push({ t: 'note', v: t.slice(3) }); continue; }
    if (t.startsWith('?? ')) { flush(); blocks.push({ t: 'tip', v: t.slice(3) }); continue; }
    if (t.startsWith('Q: ')) { flush(); const [qa, ex] = t.slice(3).split(' :: '); const parts = qa.split(' | '); const q = parts.shift();
      let a = 0; const o = parts.map((x, i) => { if (x.startsWith('*')) { a = i; return x.slice(1); } return x; });
      if (last() && last().t === 'quiz') last().v.push({ q, o, a, ex }); else blocks.push({ t: 'quiz', v: [{ q, o, a, ex }] }); continue; }
    para.push(t);
  }
  flush(); l.blocks = blocks; delete l.lines;
}
parseLessons((window.COURSE_SRC || []).join('\n'), LESSONS, 'L');
const GRAMMAR = []; parseLessons((window.GRAMMAR_SRC || []).join('\n'), GRAMMAR, 'G');

/* ---------- рендер блоков ---------- */
function sayBtn(text) { return '<button class="say" data-say="' + esc(plain(text)) + '" aria-label="Озвучить">' + SAY_ICON + '</button>'; }
function bgWords(s) { // болгарская фраза с кликабельными словами
  return tidy(s).split(/([А-Яа-яЍѝ́-]+)/).map(p => /[А-Яа-я]/.test(p) ? '<span class="tw" data-w="' + esc(plain(p)) + '">' + st(p) + '</span>' : esc(p)).join('');
}
function renderBlocks(blocks, lid) {
  let h = '', qn = 0;
  for (const b of blocks) {
    switch (b.t) {
      case 'h2': h += '<h2 id="s' + (h.length) + '">' + inl(b.v) + '</h2>'; break;
      case 'h3': h += '<h3>' + inl(b.v) + '</h3>'; break;
      case 'p': h += '<p>' + inl(b.v) + '</p>'; break;
      case 'ul': h += '<ul>' + b.v.map(x => '<li>' + inl(x) + '</li>').join('') + '</ul>'; break;
      case 'note': h += '<div class="note">' + inl(b.v) + '</div>'; break;
      case 'tip': h += '<div class="tip">' + inl(b.v) + '</div>'; break;
      case 'tbl': h += '<div class="tbl"><table><thead><tr>' + b.v[0].map(c => '<th>' + inl(c) + '</th>').join('') + '</tr></thead><tbody>' +
        b.v.slice(1).map(r => '<tr>' + r.map(c => '<td>' + inl(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>'; break;
      case 'ex': h += '<div class="exs">' + b.v.map(([bg, ru]) => '<div class="ex">' + sayBtn(bg) + '<div><div class="bg">' + bgWords(bg) + '</div>' + (ru ? '<div class="ru ruline">' + esc(ru) + '</div>' : '') + '</div></div>').join('') + '</div>'; break;
      case 'dlg': h += '<div class="exs dlg">' + b.v.map(([w, bg, ru]) => '<div class="ex">' + sayBtn(bg) + '<div><div class="bg"><span class="who">' + esc(w) + ':</span>' + bgWords(bg) + '</div>' + (ru ? '<div class="ru ruline">' + esc(ru) + '</div>' : '') + '</div></div>').join('') + '</div>'; break;
      case 'voc': h += '<div class="vocab">' + b.v.map(([bg, ru]) => '<div class="w" data-say="' + esc(plain(bg)) + '"><b>' + st(bg) + '</b><span>' + esc(ru || '') + '</span></div>').join('') + '</div>'; break;
      case 'quiz': h += '<div class="quiz" data-lid="' + (lid || '') + '">' + b.v.map(q => { qn++; const idx = q.o.map((_, i) => i); shuffle(idx);
        return '<div class="qq" data-a="' + q.a + '"><div class="q">' + qn + '. ' + inl(q.q) + '</div><div class="opts">' + idx.map(i => '<button data-i="' + i + '">' + inl(q.o[i]) + '</button>').join('') + '</div><div class="ex-ans">' + (q.ex ? inl(q.ex) : '') + '</div></div>'; }).join('') +
        '<div class="row" style="margin-top:14px"><span class="qscore muted small"></span></div></div>'; break;
    }
  }
  return h;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ================= ЭКРАНЫ ================= */
let tab = 'course';
function setTitle(t, back) { $('#title').textContent = t; $('#backBtn').classList.toggle('show', !!back); }
function go(h) { location.hash = h; }
window.addEventListener('hashchange', route);
$('#backBtn').onclick = () => history.length > 1 ? history.back() : go('#/course');
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => go('#/' + b.dataset.tab));

function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'course';
  const [p, a] = h.split('/');
  tab = ['course', 'lesson'].includes(p) ? 'course' : (p === 'gr' ? 'grammar' : p);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  closeSheet();
  if (p === 'lesson') renderLesson(LESSONS.find(l => l.id === a), LESSONS);
  else if (p === 'gr') renderLesson(GRAMMAR.find(l => l.id === a), GRAMMAR, true);
  else if (p === 'dict') renderDict(decodeURIComponent(a || ''));
  else if (p === 'grammar') renderGrammarList();
  else if (p === 'cards') renderCards();
  else if (p === 'settings') renderSettings();
  else renderCourse();
  window.scrollTo(0, 0);
}

/* ----- список уроков ----- */
function renderCourse() {
  setTitle('Български език', false);
  const done = LESSONS.filter(l => progress[l.id] && progress[l.id].done).length;
  const pct = LESSONS.length ? Math.round(done / LESSONS.length * 100) : 0;
  const next = LESSONS.find(l => !(progress[l.id] && progress[l.id].done)) || LESSONS[0];
  let h = '<div class="card"><div class="row" style="justify-content:space-between"><div><div style="font-weight:650">Ваш прогресс</div><div class="muted small">' + done + ' из ' + LESSONS.length + ' уроков · ' + DICT.length + ' слов в словаре</div></div><div class="big" style="color:var(--accent)">' + pct + '%</div></div><div class="progress"><i style="width:' + pct + '%"></i></div>' +
    (next ? '<div style="margin-top:12px"><button class="btn" data-go="#/lesson/' + next.id + '">' + (done ? 'Продолжить: ' : 'Начать: ') + 'урок ' + esc(next.num) + '</button></div>' : '') + '</div>';
  let part = null;
  LESSONS.forEach(l => {
    if (l.part !== part) { part = l.part; h += '<div class="part-h">' + esc(part) + '</div>'; }
    const d = progress[l.id] && progress[l.id].done;
    h += '<div class="card lesson-item' + (d ? ' done' : '') + '" data-go="#/lesson/' + l.id + '"><div class="num">' + (d ? '✓' : esc(l.num)) + '</div><div style="flex:1"><div class="t">' + inl(l.title) + '</div>' +
      (l.meta.sub ? '<div class="s">' + inl(l.meta.sub) + '</div>' : '') + '</div>' + (l.lvl ? '<span class="lvl">' + esc(l.lvl) + '</span>' : '') + '</div>';
  });
  h += '<div class="footer">© Elena Kirsanova · Курс составлен по учебникам Ивановой–Шановой–Димитровой, Даниловой, Гининой–Николовой–Сакызовой, Пашова–Пырвева–Радевой, Голяновской–Платоновой и грамматикам Ю. С. Маслова</div>';
  view.innerHTML = h;
}

/* ----- урок ----- */
function renderLesson(l, list, isGr) {
  if (!l) { renderCourse(); return; }
  setTitle((isGr ? '' : 'Урок ' + l.num + '. ') + plain(l.title), true);
  const i = list.indexOf(l), prev = list[i - 1], nxt = list[i + 1];
  const pre = isGr ? '#/gr/' : '#/lesson/';
  const heads = l.blocks.filter(b => b.t === 'h2');
  let h = '<article class="lesson' + (S.showRu ? '' : ' no-ru') + '">';
  h += '<div class="muted small">' + esc(l.part) + (l.lvl ? ' · <span class="lvl">' + esc(l.lvl) + '</span>' : '') + '</div>';
  h += '<h1 style="font-size:1.45em;margin:4px 0 6px;line-height:1.25">' + inl(l.title) + '</h1>';
  if (l.meta.src) h += '<div class="src">Источники: ' + esc(l.meta.src) + '</div>';
  if (l.meta.goal) h += '<div class="goal"><b>Цель урока.</b> ' + inl(l.meta.goal) + '</div>';
  if (heads.length > 2) h += '<div class="card toc small"><b>Содержание</b>' + heads.map((b, k) => '<a href="javascript:void 0" data-toc="' + k + '">' + inl(b.v) + '</a>').join('') + '</div>';
  h += renderBlocks(l.blocks, l.id);
  if (!isGr) {
    const d = progress[l.id] && progress[l.id].done;
    h += '<div class="card" style="margin-top:20px"><div class="row" style="justify-content:space-between"><span>' + (d ? '✅ Урок отмечен как пройденный' : 'Закончили урок?') + '</span>' +
      '<button class="btn ' + (d ? 'ghost' : '') + '" id="doneBtn">' + (d ? 'Снять отметку' : 'Отметить пройденным') + '</button></div></div>';
  }
  h += '<div class="row" style="justify-content:space-between;margin-top:10px">' + (prev ? '<button class="btn ghost" data-go="' + pre + prev.id + '">‹ ' + esc(isGr ? plain(prev.title) : 'Урок ' + prev.num) + '</button>' : '<span></span>') +
    (nxt ? '<button class="btn ghost" data-go="' + pre + nxt.id + '">' + esc(isGr ? plain(nxt.title) : 'Урок ' + nxt.num) + ' ›</button>' : '') + '</div></article>';
  view.innerHTML = h;
  view.querySelectorAll('[data-toc]').forEach(a => a.onclick = () => { const hs = view.querySelectorAll('.lesson h2'); const t = hs[+a.dataset.toc]; if (t) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 70, behavior: 'smooth' }); });
  const db = $('#doneBtn'); if (db) db.onclick = () => { progress[l.id] = Object.assign(progress[l.id] || {}, { done: !(progress[l.id] && progress[l.id].done) }); store.set('progress', progress); renderLesson(l, list, isGr); toast(progress[l.id].done ? 'Урок пройден!' : 'Отметка снята'); };
  if (!S.showRu) view.querySelectorAll('.ruline').forEach(r => { r.style.filter = 'blur(5px)'; r.style.cursor = 'pointer'; r.onclick = () => r.style.filter = ''; });
}

/* ----- обработка нажатий (делегирование) ----- */
document.addEventListener('click', ev => {
  const t = ev.target;
  const g = t.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
  const wl = t.closest('.wordlink[data-say]');
  if (wl && !t.closest('.quiz') && !t.closest('#sheet')) {
    const raw = wl.dataset.say; const c = [raw, raw.replace(/\s*\(.*?\)/g, '').replace(/,.*$/, '').trim(), raw.split(/[ ,(—–-]/)[0]];
    for (const x of c) { const r = lookup(x); if (r.length) { openEntry(r[0], x); say(x); return; } }
    say(raw); return;
  }
  const s = t.closest('[data-say]'); if (s && !t.closest('.quiz')) { say(s.dataset.say); return; }
  const w = t.closest('.tw'); if (w) { const r = lookup(w.dataset.w); if (r.length) openEntry(r[0], w.dataset.w); else { say(w.dataset.w); toast(w.dataset.w + ' — нет в словаре'); } return; }
  const ob = t.closest('.quiz .opts button');
  if (ob) {
    const qq = ob.closest('.qq'); if (qq.dataset.done) return; qq.dataset.done = '1';
    const ok = +ob.dataset.i === +qq.dataset.a; ob.classList.add(ok ? 'ok' : 'bad'); qq.dataset.ok = ok ? '1' : '0';
    if (!ok) qq.querySelector('[data-i="' + qq.dataset.a + '"]').classList.add('ok');
    qq.querySelector('.ex-ans').classList.add('show');
    const qz = ob.closest('.quiz'); const all = qz.querySelectorAll('.qq'); const answered = qz.querySelectorAll('.qq[data-done]');
    const good = qz.querySelectorAll('.qq[data-ok="1"]').length;
    qz.querySelector('.qscore').textContent = 'Верно: ' + good + ' из ' + answered.length + (answered.length === all.length ? ' — тест завершён' : '');
    if (answered.length === all.length && qz.dataset.lid) {
      const lid = qz.dataset.lid; const sc = good / all.length;
      progress[lid] = Object.assign(progress[lid] || {}, { score: sc }); if (sc >= 0.7) progress[lid].done = true;
      store.set('progress', progress); toast(sc >= 0.7 ? 'Отлично! Урок засчитан' : 'Повторите теорию и попробуйте ещё раз');
    }
  }
});

/* ----- словарь ----- */
let dictMode = 'bg', dictPos = '', dictLetter = '';
function renderDict(q) {
  setTitle('Словарь', false);
  let h = '<input class="search" id="dq" type="search" placeholder="Поиск: болгарский или русский, любая форма слова" autocomplete="off" autocapitalize="off" value="' + esc(q || '') + '">';
  h += '<div class="seg"><button data-m="bg" class="' + (dictMode === 'bg' ? 'on' : '') + '">Болгарско-русский</button><button data-m="ru" class="' + (dictMode === 'ru' ? 'on' : '') + '">Русско-болгарский</button></div>';
  h += '<div class="chips">' + [['', 'Все'], ['гл', 'Глаголы'], ['сущ', 'Сущ.'], ['пр', 'Прил.'], ['нар', 'Нареч.'], ['проч', 'Прочие'], ['фр', 'Выражения']].map(([k, n]) => '<button class="chip' + (dictPos === k ? ' on' : '') + '" data-pos="' + k + '">' + n + '</button>').join('') + '</div>';
  const letters = dictMode === 'bg' ? 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЮЯ' : 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ';
  h += '<div class="letters">' + [...letters].map(c => '<button data-l="' + c + '" class="' + (dictLetter === c ? 'on' : '') + '">' + c + '</button>').join('') + '</div>';
  h += '<div id="dres" class="card" style="padding:4px 14px"></div>';
  view.innerHTML = h;
  const inp = $('#dq'); inp.oninput = () => { dictLetter = ''; view.querySelectorAll('.letters button').forEach(b => b.classList.remove('on')); fillDict(inp.value); };
  view.querySelectorAll('.seg button').forEach(b => b.onclick = () => { dictMode = b.dataset.m; dictLetter = ''; renderDict(inp.value); });
  view.querySelectorAll('[data-pos]').forEach(b => b.onclick = () => { dictPos = b.dataset.pos; renderDict(inp.value); });
  view.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { dictLetter = dictLetter === b.dataset.l ? '' : b.dataset.l; inp.value = ''; renderDict(''); });
  fillDict(q || '');
}
function posOk(e) {
  if (!dictPos) return true;
  if (dictPos === 'сущ') return ['м', 'ж', 'ср', 'мн'].includes(e.pos);
  if (dictPos === 'проч') return ['мест', 'числ', 'предл', 'съюз', 'част', 'межд'].includes(e.pos);
  return e.pos === dictPos;
}
function fillDict(q) {
  const box = $('#dres'); const nq = norm(q);
  let res;
  if (nq) {
    const exact = new Set(); lookup(q).forEach(e => exact.add(e.id));
    res = DICT.filter(e => posOk(e) && (exact.has(e.id) || norm(e.bg).includes(nq) || norm(e.ru).includes(nq)));
    res.sort((a, b) => score(b, nq, exact) - score(a, nq, exact) || norm(a.bg).localeCompare(norm(b.bg), 'bg'));
  } else {
    res = DICT.filter(posOk);
    if (dictMode === 'ru') { res = res.slice().sort((a, b) => norm(a.ru).localeCompare(norm(b.ru), 'ru')); if (dictLetter) res = res.filter(e => norm(e.ru).startsWith(dictLetter.toLowerCase())); }
    else { res = res.slice().sort((a, b) => norm(a.bg).localeCompare(norm(b.bg), 'bg')); if (dictLetter) res = res.filter(e => norm(e.bg).startsWith(dictLetter.toLowerCase())); }
  }
  const total = res.length; res = res.slice(0, 300);
  box.innerHTML = (res.length ? res.map(e => dictMode === 'ru' && !nq ?
    '<div class="entry" data-e="' + e.id + '"><div>' + esc(e.ru) + '</div><div class="r"><b style="color:var(--ink)">' + st(e.bg) + '</b></div></div>' :
    '<div class="entry" data-e="' + e.id + '"><div><span class="h">' + st(e.bg) + '</span><span class="p">' + esc(shortPos(e)) + '</span></div><div class="r">' + esc(e.ru) + '</div></div>').join('') : '<p class="muted">Ничего не найдено</p>') +
    (total > 300 ? '<p class="muted small">Показано 300 из ' + total + '. Уточните запрос или выберите букву.</p>' : '<p class="muted small">Найдено: ' + total + '</p>');
  box.querySelectorAll('[data-e]').forEach(r => r.onclick = () => openEntry(DICT[+r.dataset.e]));
}
function score(e, q, exact) { const b = norm(e.bg), r = norm(e.ru); let s = 0; if (exact.has(e.id)) s += 5; if (b === q) s += 10; if (b.startsWith(q)) s += 4; if (r.split(/[,;() ]+/).includes(q)) s += 6; if (r.startsWith(q)) s += 3; return s; }
function shortPos(e) { const m = { 'м': 'м.', 'ж': 'ж.', 'ср': 'ср.', 'мн': 'мн.', 'пр': 'прил.', 'гл': e.g.asp || 'гл.', 'нар': 'нар.', 'мест': 'мест.', 'числ': 'числ.', 'предл': 'предл.', 'съюз': 'союз', 'част': 'част.', 'межд': 'межд.', 'фр': 'выраж.' }; return m[e.pos] || e.pos; }

/* ----- карточка слова ----- */
const PERS = ['аз', 'ти', 'той, тя, то', 'ние', 'вие', 'те'];
function tbl6(title, arr, pre) {
  if (!arr) return '';
  return '<h3>' + title + '</h3><div class="tbl"><table><tbody>' + arr.map((x, i) => '<tr><td class="muted" style="width:36%">' + PERS[i] + '</td><td>' + st((pre ? pre(i) : '') + x) + '</td></tr>').join('') + '</tbody></table></div>';
}
function openEntry(e, form) {
  let h = '<div class="row" style="justify-content:space-between;align-items:flex-start"><div><div class="big">' + st(e.bg) + '</div><div class="muted">' + esc(POS[e.pos] || e.pos) + (e.g.asp ? ' · ' + (e.g.asp === 'нсв' ? 'несовершенный вид' : e.g.asp === 'св' ? 'совершенный вид' : 'двувидовой') : '') + (e.g.cl ? ' · ' + ({ 1: 'I', 2: 'II', 3: 'III' }[e.g.cl] || e.g.cl) + ' спряжение' : '') + '</div></div>' + sayBtn(e.bg) + '</div>';
  if (form && norm(form) !== norm(e.bg)) h += '<div class="tag">форма «' + esc(form) + '»</div>';
  h += '<p style="font-size:1.1em;margin:10px 0">' + esc(e.ru) + '</p>';
  if (e.g['пара']) h += '<p>Видовая пара: ' + e.g['пара'].split(',').map(x => '<b class="wordlink" data-find="' + esc(plain(x.trim())) + '">' + st(x.trim()) + '</b>').join(', ') + '</p>';
  if (e.g['прим']) h += '<div class="tip">' + inl(e.g['прим']) + '</div>';
  if (e.g['пр']) h += '<div class="exs">' + e.g['пр'].split(' ;; ').map(x => { const [bg, ru] = x.split(' = '); return '<div class="ex">' + sayBtn(bg) + '<div><div class="bg">' + st(bg) + '</div><div class="ru">' + esc(ru || '') + '</div></div></div>'; }).join('') + '</div>';
  if (e._n) {
    const n = e._n; const rows = [];
    rows.push(['Единственное число', st(e.bg)]);
    if (n.def) rows.push(['Ед. ч. с артиклем', n.def.map(st).join(' / ') + (n.def.length > 1 ? '<div class="small muted">полный член / краткий член</div>' : '')]);
    if (n.pl) rows.push(['Множественное число', st(n.pl)]);
    if (n.pldef) rows.push(['Мн. ч. с артиклем', st(n.pldef)]);
    if (n.cnt) rows.push(['Счётная форма', st(n.cnt) + ' <span class="small muted">(два, три… + сущ.)</span>']);
    if (n.voc) rows.push(['Звательная форма', st(n.voc)]);
    h += '<h3>Формы</h3><div class="tbl"><table><tbody>' + rows.map(r => '<tr><td class="muted" style="width:44%">' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</tbody></table></div>';
  }
  if (e._a) {
    const a = e._a;
    h += '<h3>Формы прилагательного</h3><div class="tbl"><table><thead><tr><th></th><th>без артикля</th><th>с артиклем</th></tr></thead><tbody>' +
      '<tr><td class="muted">м. р.</td><td>' + st(a.m) + '</td><td>' + st(a.mdef[0]) + ' / ' + st(a.mdef[1]) + '</td></tr>' +
      '<tr><td class="muted">ж. р.</td><td>' + st(a.f) + '</td><td>' + st(a.fdef) + '</td></tr>' +
      '<tr><td class="muted">ср. р.</td><td>' + st(a.n) + '</td><td>' + st(a.ndef) + '</td></tr>' +
      '<tr><td class="muted">мн. ч.</td><td>' + st(a.pl) + '</td><td>' + st(a.pldef) + '</td></tr></tbody></table></div>';
    if (e.g['ср.ст'] !== 'нет' && !/ски$/.test(plain(e.bg))) h += '<p class="small muted">Сравнительная степень: ' + st('по-' + e.bg) + ', превосходная: ' + st('на́й-' + e.bg) + '</p>';
  }
  if (e._v) {
    const v = e._v;
    h += '<div class="seg" id="vseg"><button class="on" data-vt="pres">Наст.</button><button data-vt="past">Прош.</button><button data-vt="fut">Буд.</button><button data-vt="more">Ещё</button></div><div id="vbody"></div>';
    h += '<p class="small muted">Словарная форма болгарского глагола — 1-е лицо ед. ч. настоящего времени (инфинитива нет).</p>';
    openSheet(h, e);
    const body = $('#vbody');
    const SUM = ['съм', 'си', 'е', 'сме', 'сте', 'са'];
    const BYAH = ['бях', 'беше', 'беше', 'бяхме', 'бяхте', 'бяха'];
    const SHTYAH = ['щях', 'щеше', 'щеше', 'щяхме', 'щяхте', 'щяха'];
    const BIH = ['бих', 'би', 'би', 'бихме', 'бихте', 'биха'];
    const pg = i => v.part ? (i < 3 ? v.part[0] + ' / ' + v.part[1] : v.part[3]) : '';
    const R = v.refl;
    const withAux = (aux, i) => { const p = v.part ? (i < 3 ? splitRefl(v.part[0])[0] : v.part[3]) : ''; return R ? aux + R + ' ' + p : aux + ' ' + p; };
    const T = {
      pres: () => tbl6('Настоящее время (сегашно време)', v.pres) + (v.impv ? '<h3>Повелительное наклонение</h3><div class="tbl"><table><tbody><tr><td class="muted" style="width:36%">ти</td><td>' + st(v.impv[0]) + '</td></tr><tr><td class="muted">вие</td><td>' + st(v.impv[1] || '') + '</td></tr><tr><td class="muted">запрет</td><td>' + st('не ' + (v.asp === 'св' && e.g['пара'] ? '(НСВ) …' : v.impv[0])) + ' · ' + st('неде́й да ' + v.pres[1]) + '</td></tr></tbody></table></div>' : ''),
      past: () => (v.aor ? tbl6('Аорист (минало свършено време) — завершённое действие', v.aor) : '') + tbl6('Имперфект (минало несвършено време) — фон, процесс, повторение', v.imp) +
        (v.part ? '<h3>Перфект (минало неопределено време)</h3><div class="tbl"><table><tbody>' + SUM.map((a, i) => '<tr><td class="muted" style="width:36%">' + PERS[i] + '</td><td>' + st(perf(a, i)) + '</td></tr>').join('') + '</tbody></table></div>' : ''),
      fut: () => tbl6('Будущее время (бъдеще време)', v.pres.map(x => 'ще ' + x)) + tbl6('Отрицание будущего', v.pres.map(x => 'ня́ма да ' + x)) + tbl6('Будущее в прошедшем', v.pres.map((x, i) => SHTYAH[i] + ' да ' + x)),
      more: () => (v.part ? '<h3>Причастие на -л (аористное)</h3><div class="tbl"><table><tbody><tr><td class="muted">м. р.</td><td>' + st(v.part[0]) + '</td></tr><tr><td class="muted">ж. р.</td><td>' + st(v.part[1]) + '</td></tr><tr><td class="muted">ср. р.</td><td>' + st(v.part[2]) + '</td></tr><tr><td class="muted">мн. ч.</td><td>' + st(v.part[3]) + '</td></tr></tbody></table></div>' +
        tbl6('Условное наклонение', BIH.map((b, i) => (R ? b + R : b) + ' ' + (i < 3 ? splitRefl(v.part[0])[0] + '(-' + plain(splitRefl(v.part[1])[0]).slice(-2) + ')' : v.part[3]))) +
        tbl6('Плюсквамперфект (минало предварително)', BYAH.map((b, i) => (R ? b + R : b) + ' ' + (i < 3 ? splitRefl(v.part[0])[0] : v.part[3]))) +
        tbl6('Пересказывательное наклонение (аорист)', v.part.length ? ['съм ' + v.part[0], 'си ' + v.part[0], v.part[0], 'сме ' + v.part[3], 'сте ' + v.part[3], v.part[3]].map(x => R ? x.replace(/^(съм|си|сме|сте) /, '$1' + R + ' ').replace(/^([^ ]+)$/, R.trim() + ' $1') : x) : null) : '<p class="muted">Формы причастия не указаны.</p>')
    };
    function perf(a, i) { const p = i < 3 ? splitRefl(v.part[0])[0] : v.part[3]; if (!R) return a + ' ' + p; return i === 2 ? R.trim() + ' е ' + p : a + R + ' ' + p; }
    const show = k => { body.innerHTML = T[k](); };
    show('pres');
    $('#vseg').querySelectorAll('button').forEach(b => b.onclick = () => { $('#vseg').querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); show(b.dataset.vt); });
    return;
  }
  openSheet(h, e);
}
function openSheet(h, e) {
  if (e) h += '<div class="row" style="margin-top:16px"><button class="btn ghost" id="addCard">' + (srs[e.key] ? '✓ В карточках' : '+ В карточки') + '</button></div>';
  $('#sheetBody').innerHTML = h; $('#sheet').classList.add('open'); $('#sheetBg').classList.add('open'); $('#sheet').scrollTop = 0;
  const ac = $('#addCard'); if (ac) ac.onclick = () => { if (!srs[e.key]) { srs[e.key] = { b: 0, d: 0 }; store.set('srs', srs); ac.textContent = '✓ В карточках'; toast('Добавлено в карточки'); } };
  $('#sheetBody').querySelectorAll('[data-find]').forEach(x => x.onclick = () => { const r = lookup(x.dataset.find); if (r.length) openEntry(r[0]); });
}
function closeSheet() { $('#sheet').classList.remove('open'); $('#sheetBg').classList.remove('open'); }
$('#sheetBg').onclick = closeSheet;
let ty0 = null; $('#sheet').addEventListener('touchstart', e => { ty0 = $('#sheet').scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
$('#sheet').addEventListener('touchend', e => { if (ty0 != null && e.changedTouches[0].clientY - ty0 > 90) closeSheet(); ty0 = null; });

/* ----- таблицы грамматики ----- */
function renderGrammarList() {
  setTitle('Грамматические таблицы', false);
  let h = '<p class="muted small">Справочник: сводные таблицы по всей грамматике курса. Нажмите на любое болгарское слово в примерах, чтобы открыть его в словаре.</p>';
  let part = null;
  GRAMMAR.forEach(l => { if (l.part !== part) { part = l.part; h += '<div class="part-h">' + esc(part) + '</div>'; }
    h += '<div class="card lesson-item" data-go="#/gr/' + l.id + '"><div class="num">§</div><div style="flex:1"><div class="t">' + inl(l.title) + '</div>' + (l.meta.sub ? '<div class="s">' + inl(l.meta.sub) + '</div>' : '') + '</div></div>'; });
  h += '<div class="card"><b>Спрягатель глаголов</b><p class="small muted">Введите глагол в любой форме — откроются все времена.</p><input class="search" id="vq" placeholder="например: чета́, пи́сах, ще дойда" autocapitalize="off"><div id="vres"></div></div>';
  view.innerHTML = h;
  const vq = $('#vq'); vq.oninput = () => {
    const words = norm(vq.value).replace(/^(ще|ня́ма да|няма да|да)\s+/, '').split(/\s+/);
    const r = []; words.forEach(w => lookup(w).filter(e => e.pos === 'гл').forEach(e => { if (!r.includes(e)) r.push(e); }));
    if (!r.length && words[0]) DICT.filter(e => e.pos === 'гл' && norm(e.bg).startsWith(words[0])).slice(0, 8).forEach(e => r.push(e));
    $('#vres').innerHTML = r.map(e => '<div class="entry" data-e="' + e.id + '"><span class="h">' + st(e.bg) + '</span><span class="r">' + esc(e.ru) + '</span></div>').join('');
    $('#vres').querySelectorAll('[data-e]').forEach(x => x.onclick = () => openEntry(DICT[+x.dataset.e]));
  };
}

/* ----- карточки (интервальное повторение по Лейтнеру) ----- */
const INTERVALS = [0, 1, 2, 4, 8, 16, 32];
const today = () => Math.floor(Date.now() / 86400000);
let cardSet = 'all', cardQ = [], cardI = 0, flipped = false;
function deckEntries() {
  if (cardSet === 'mine') return DICT.filter(e => srs[e.key]);
  if (cardSet === 'verbs') return DICT.filter(e => e.pos === 'гл');
  if (cardSet === 'nouns') return DICT.filter(e => ['м', 'ж', 'ср'].includes(e.pos));
  if (cardSet === 'adj') return DICT.filter(e => e.pos === 'пр');
  if (cardSet === 'phr') return DICT.filter(e => e.pos === 'фр');
  if (cardSet.startsWith('t:')) return DICT.filter(e => e.g['тема'] === cardSet.slice(2));
  return DICT;
}
function renderCards() {
  setTitle('Карточки', false);
  const topics = [...new Set(DICT.map(e => e.g['тема']).filter(Boolean))].sort();
  const mine = DICT.filter(e => srs[e.key]); const due = mine.filter(e => srs[e.key].d <= today()).length;
  let h = '<div class="card"><div class="row" style="justify-content:space-between"><div><b>Мои карточки</b><div class="muted small">' + mine.length + ' слов · к повторению сегодня: ' + due + '</div></div><button class="btn" id="startMine">Повторять</button></div></div>';
  h += '<div class="card"><b>Тренировка по наборам</b><div class="chips">' + [['all', 'Все слова'], ['verbs', 'Глаголы'], ['nouns', 'Существительные'], ['adj', 'Прилагательные'], ['phr', 'Выражения']].concat(topics.map(t => ['t:' + t, t])).map(([k, n]) => '<button class="chip' + (cardSet === k ? ' on' : '') + '" data-set="' + k + '">' + esc(n) + '</button>').join('') + '</div>' +
    '<div class="seg"><button data-dir="bg" class="' + (S.cardDir === 'bg' ? 'on' : '') + '">БГ → РУ</button><button data-dir="ru" class="' + (S.cardDir === 'ru' ? 'on' : '') + '">РУ → БГ</button></div><button class="btn ghost" id="startSet">Начать (20 карточек)</button></div><div id="cardArea"></div>';
  view.innerHTML = h;
  view.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { cardSet = b.dataset.set; renderCards(); });
  view.querySelectorAll('[data-dir]').forEach(b => b.onclick = () => { S.cardDir = b.dataset.dir; saveS(); renderCards(); });
  $('#startMine').onclick = () => { const m = DICT.filter(e => srs[e.key] && srs[e.key].d <= today()); if (!m.length) { toast('Нет карточек к повторению. Добавляйте слова из словаря «+ В карточки»'); return; } startCards(shuffle(m).slice(0, 30)); };
  $('#startSet').onclick = () => { const d = deckEntries(); if (!d.length) { toast('Набор пуст'); return; } startCards(shuffle(d.slice()).slice(0, 20)); };
}
function startCards(q) { cardQ = q; cardI = 0; flipped = false; showCard(); }
function showCard() {
  const area = $('#cardArea'); if (!area) return;
  if (cardI >= cardQ.length) { area.innerHTML = '<div class="card" style="text-align:center"><div class="big">Готово! 🎉</div><p class="muted">Пройдено карточек: ' + cardQ.length + '</p></div>'; return; }
  const e = cardQ[cardI]; const front = S.cardDir === 'bg' ? st(e.bg) : esc(e.ru); const back = S.cardDir === 'bg' ? esc(e.ru) : st(e.bg);
  area.innerHTML = '<div class="card fc" id="fc"><div class="muted small">' + (cardI + 1) + ' / ' + cardQ.length + ' · ' + esc(shortPos(e)) + '</div><div class="front" style="margin-top:12px">' + front + '</div><div class="back" style="' + (flipped ? '' : 'visibility:hidden') + '">' + back + '</div><div class="muted small" style="margin-top:16px">' + (flipped ? '' : 'нажмите, чтобы перевернуть') + '</div></div>' +
    '<div class="row" style="justify-content:center"><button class="btn red" id="cNo">Не помню</button><button class="btn ghost" id="cSay">🔊</button><button class="btn ghost" id="cInfo">Формы</button><button class="btn" id="cYes">Помню</button></div>';
  $('#fc').onclick = () => { flipped = true; showCard(); if (S.cardDir === 'ru') say(e.bg); };
  $('#cSay').onclick = () => say(e.bg);
  $('#cInfo').onclick = () => openEntry(e);
  const mark = ok => { const r = srs[e.key] || { b: 0, d: 0 }; r.b = ok ? Math.min(r.b + 1, 6) : 0; r.d = today() + INTERVALS[r.b]; srs[e.key] = r; store.set('srs', srs); cardI++; flipped = false; showCard(); };
  $('#cNo').onclick = () => mark(false); $('#cYes').onclick = () => mark(true);
  area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ----- настройки ----- */
function renderSettings() {
  setTitle('Настройки', false);
  loadVoices();
  const vopts = voices.length ? voices.map(v => '<option ' + (v.name === S.voice ? 'selected' : '') + '>' + esc(v.name) + '</option>').join('') : '<option value="">нет болгарского голоса</option>';
  let h = '<div class="card">' +
    '<div class="set-row"><span>Тема оформления</span><select id="sTheme">' + [['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная'], ['sepia', 'Сепия'], ['blue', 'Морская']].map(([k, n]) => '<option value="' + k + '" ' + (S.theme === k ? 'selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
    '<div class="set-row"><span>Размер шрифта: <b id="fsv">' + S.fs + '</b></span><input id="sFs" type="range" min="14" max="26" value="' + S.fs + '"></div>' +
    '<div class="set-row"><span>Ударения</span><select id="sSt"><option value="color" ' + (S.stress === 'color' ? 'selected' : '') + '>Знак + цвет</option><option value="mark" ' + (S.stress === 'mark' ? 'selected' : '') + '>Только знак</option><option value="none" ' + (S.stress === 'none' ? 'selected' : '') + '>Скрыть</option></select></div>' +
    '<div class="set-row"><span>Показывать перевод примеров<div class="small muted">Если выключить — перевод размыт, нажмите, чтобы открыть (самопроверка)</div></span><label class="toggle"><input type="checkbox" id="sRu" ' + (S.showRu ? 'checked' : '') + '><span></span></label></div>' +
    '</div><div class="card"><b>Озвучка</b>' +
    '<div class="set-row"><span>Голос</span><select id="sVoice">' + vopts + '</select></div>' +
    '<div class="set-row"><span>Скорость: <b id="rv">' + S.rate + '</b></span><input id="sRate" type="range" min="0.5" max="1.2" step="0.05" value="' + S.rate + '"></div>' +
    '<div class="set-row"><span>Проверить</span><button class="btn ghost" id="sTest">▶ Здраве́йте!</button></div>' +
    '<p class="small muted">На iPhone болгарский голос включается так: Настройки → Универсальный доступ → Устный контент → Голоса → Болгарский → загрузите голос (например, «Daria»).</p></div>' +
    '<div class="card"><b>Прогресс</b><p class="small muted">Данные хранятся только на этом устройстве. Сохраните резервную копию, чтобы перенести прогресс на iPad или другой телефон.</p>' +
    '<div class="row"><button class="btn ghost" id="exp">Сохранить копию</button><label class="btn ghost" style="display:inline-block">Загрузить копию<input type="file" id="imp" accept=".json,application/json" hidden></label><button class="btn red" id="rst">Сбросить</button></div></div>' +
    '<div class="card small"><b>О приложении</b><p>Курс болгарского языка для русскоговорящих: ' + LESSONS.length + ' уроков, ' + GRAMMAR.length + ' справочных таблиц, словарь — ' + DICT.length + ' статей с грамматическими формами. Работает без интернета после первой загрузки.</p><p class="muted">© ' + new Date().getFullYear() + ' Elena Kirsanova. Все права защищены. Копирование и распространение без согласия автора запрещено.</p></div>';
  view.innerHTML = h;
  $('#sTheme').onchange = e => { S.theme = e.target.value; saveS(); };
  $('#sFs').oninput = e => { S.fs = +e.target.value; $('#fsv').textContent = S.fs; saveS(); };
  $('#sSt').onchange = e => { S.stress = e.target.value; saveS(); toast('Сохранено'); };
  $('#sRu').onchange = e => { S.showRu = e.target.checked; saveS(); };
  $('#sVoice').onchange = e => { S.voice = e.target.value; saveS(); };
  $('#sRate').oninput = e => { S.rate = +e.target.value; $('#rv').textContent = S.rate; saveS(); };
  $('#sTest').onclick = () => say('Здравейте! Как сте?');
  $('#exp').onclick = () => {
    const data = JSON.stringify({ app: 'bg-course', v: 1, progress, srs, settings: S }, null, 1);
    const blob = new Blob([data], { type: 'application/json' }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'bulgarian-progress-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove();
  };
  $('#imp').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (d.progress) { progress = d.progress; store.set('progress', progress); } if (d.srs) { srs = d.srs; store.set('srs', srs); } toast('Прогресс загружен'); } catch (er) { toast('Неверный файл'); } }; r.readAsText(f); };
  $('#rst').onclick = () => { if (confirm('Сбросить прогресс уроков и карточек?')) { progress = {}; srs = {}; store.set('progress', progress); store.set('srs', srs); toast('Прогресс сброшен'); } };
}

/* ---------- старт ---------- */
route();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__BG = { DICT, LESSONS, GRAMMAR, lookup, verbForms, nounForms, adjForms };
})();
