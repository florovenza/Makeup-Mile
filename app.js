import { SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_DEFAULT, WHATSAPP_MESSAGE_DEFAULT } from './config.js';

/* ==========================================================
   Setup
   ========================================================== */
const BUCKET = 'media';
const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
let sb = null;
if (configured) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Se muestran solo si Supabase no está conectado o falla la carga.
const DEFAULT_SERVICES = [
  {
    id: 'd1', title: 'Social makeup', price: '$85.000', duration: '2 horas.', image_url: '',
    description: 'Maquillaje profesional personalizado para eventos, fiestas y ocasiones especiales. Un look diseñado según tus facciones, estilo y preferencias.',
    includes: 'Preparación profesional de la piel.\nMaquillaje personalizado.\nAplicación de pestañas.\nTécnicas de larga duración.',
  },
  {
    id: 'd2', title: 'Quinceañeras', price: '$140.000', duration: '2 horas + prueba previa.', image_url: '',
    description: 'Un maquillaje especial para una noche inolvidable. Un look personalizado que acompañe tu vestido, tu estilo y la esencia de tu celebración.',
    includes: 'Prueba de maquillaje previa obligatoria.\nPreparación profesional de la piel.\nDiseño personalizado.\nKit de retoque.',
  },
  {
    id: 'd3', title: 'Bridal makeup', price: '$140.000', duration: '2 horas + prueba previa.', image_url: '',
    description: 'Una experiencia de maquillaje pensada especialmente para tu gran día. Un look que refleje tu personalidad y te haga sentir vos misma.',
    includes: 'Asesoramiento personalizado.\nPrueba de maquillaje previa obligatoria.\nPreparación de la piel.\nAplicación de pestañas.\nTécnicas de larga duración.\nKit de retoque.',
  },
];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  content: {},          // key -> value (site_content)
  services: [],
  gallery: [],
  isAdmin: false,
  dirty: new Map(),     // key -> value
  dirtyRows: new Map(), // "table:id" -> { table, id, fields: {} }
};

/* ==========================================================
   Render
   ========================================================== */
function applyContent() {
  const c = state.content;
  for (const n of $$('[data-k]')) {
    const k = n.dataset.k;
    if (c[k] != null && c[k] !== '' && document.activeElement !== n) n.textContent = c[k];
  }
  for (const box of $$('[data-img]')) setImage(box, c[box.dataset.img]);
  updateLinks();
}

function setImage(box, url) {
  const img = $('img', box);
  if (url) { img.src = url; box.classList.add('has-img'); }
  else { img.removeAttribute('src'); box.classList.remove('has-img'); }
}

function waHref(service) {
  const num = String(state.content['whatsapp.number'] || WHATSAPP_DEFAULT).replace(/\D/g, '');
  let msg = state.content['whatsapp.message'] || WHATSAPP_MESSAGE_DEFAULT;
  if (service) msg += ` Me interesa: ${service}.`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

function updateLinks() {
  for (const a of $$('[data-wa]')) {
    a.href = waHref(a.dataset.waService || '');
    a.target = '_blank';
    a.rel = 'noopener';
  }
  const handle = String(state.content['contact.instagram'] || '').trim().replace(/^@/, '').replace(/\s+/g, '');
  const ig = $('#igLink');
  ig.hidden = !handle;
  if (handle) ig.href = `https://www.instagram.com/${encodeURIComponent(handle)}/`;

  const turnero = String(state.content['booking.turnero'] || '').trim();
  const tl = $('#turneroLink');
  tl.hidden = !/^https?:\/\//i.test(turnero);
  if (!tl.hidden) tl.href = turnero;
}

function el(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('data-') || k === 'aria-hidden') n.setAttribute(k, v);
    else n[k] = v;
  }
  if (text != null) n.textContent = text;
  return n;
}

const pad = i => String(i + 1).padStart(2, '0');

function renderServices() {
  const list = $('#servicesList');
  list.replaceChildren();
  state.services.forEach((s, i) => {
    const art = el('article', { class: 'service', 'data-id': s.id });
    const f = (tag, cls, field, placeholder) =>
      el(tag, { class: cls, 'data-table': 'services', 'data-id': s.id, 'data-field': field, 'data-placeholder': placeholder || '' }, s[field] || '');

    // Foto
    const media = el('div', { class: 'service__media' });
    media.append(el('img', { alt: s.title || 'Servicio', loading: 'lazy' }));
    setImage(media, s.image_url);
    if (state.isAdmin) {
      const b = el('button', { type: 'button', class: 'img-edit' }, 'Cambiar foto');
      b.addEventListener('click', () => pickImage(file => uploadServiceImage(s, file)));
      media.append(b);
    }

    // Texto
    const body = el('div', { class: 'service__body' });
    body.append(
      el('p', { class: 'label service__num' }, `${pad(i)} — ${s.title || ''}`),
      f('h3', 'display service__title', 'title', 'Nombre del servicio'),
      f('p', 'body service__desc', 'description', 'Descripción'),
      f('p', 'service__price', 'price', '$0'),
    );

    const inc = el('div', { class: 'service__includes' });
    inc.append(el('p', { class: 'label label--accent' }, 'La experiencia incluye'));
    if (state.isAdmin) {
      inc.append(f('div', 'service__includes-edit', 'includes', 'Un ítem por renglón'));
    } else {
      const ul = el('ul');
      for (const item of String(s.includes || '').split('\n').map(t => t.trim()).filter(Boolean)) ul.append(el('li', {}, item));
      if (ul.children.length) inc.append(ul); else inc.hidden = true;
    }
    body.append(inc);

    if (s.duration || state.isAdmin) {
      const d = el('p', { class: 'service__duration' });
      d.append(el('strong', {}, 'DURACIÓN'), document.createTextNode(' · '), f('span', '', 'duration', 'Ej: 2 horas'));
      body.append(d);
    }

    const actions = el('div', { class: 'service__actions' });
    const book = el('a', { class: 'btn', 'data-wa': '', 'data-wa-service': s.title || '' });
    book.append(document.createTextNode('Consultar disponibilidad'), el('span', { class: 'arrow', 'aria-hidden': 'true' }, '↗'));
    actions.append(book);
    if (state.isAdmin) {
      const del = el('button', { type: 'button', class: 'btn btn--outline btn--sm' }, 'Eliminar servicio');
      del.addEventListener('click', () => deleteService(s.id));
      actions.append(del);
    }
    body.append(actions);

    art.append(media, body);
    list.append(art);
  });
  if (state.isAdmin) setEditable(true, list);
  updateLinks();
}

function renderGallery() {
  const grid = $('#galleryGrid');
  grid.replaceChildren();
  for (const g of state.gallery) {
    const fig = el('figure', { class: 'gallery__item' });
    fig.append(el('img', { src: g.image_url, alt: g.alt || 'Trabajo de maquillaje', loading: 'lazy', decoding: 'async' }));
    if (state.isAdmin) {
      const del = el('button', { type: 'button', class: 'img-edit img-edit--danger' }, 'Quitar');
      del.addEventListener('click', () => deleteGalleryItem(g));
      fig.append(del);
    }
    grid.append(fig);
  }
  const empty = state.gallery.length === 0;
  $('#galleryEmpty').hidden = !(empty && state.isAdmin);
  // Para visitantes, si no hay fotos se oculta la sección entera.
  $('#portfolio').hidden = empty && !state.isAdmin;
}

/* ==========================================================
   Carga de datos
   ========================================================== */
async function load() {
  if (!sb) {
    state.services = DEFAULT_SERVICES;
    applyContent(); renderServices(); renderGallery();
    return;
  }
  try {
    const [c, s, g] = await Promise.all([
      sb.from('site_content').select('key,value'),
      sb.from('services').select('*').order('sort').order('created_at'),
      sb.from('gallery').select('*').order('sort').order('created_at'),
    ]);
    if (c.error || s.error || g.error) throw c.error || s.error || g.error;
    state.content = Object.fromEntries(c.data.map(r => [r.key, r.value]));
    state.services = s.data;
    state.gallery = g.data;
  } catch (err) {
    console.error('No se pudo cargar el contenido', err);
    state.services = DEFAULT_SERVICES;
  }
  applyContent(); renderServices(); renderGallery();
}

/* ==========================================================
   Modo admin
   ========================================================== */
function setEditable(on, root = document) {
  for (const n of $$('[data-k], [data-field]', root)) {
    if (on) { n.contentEditable = 'true'; n.spellcheck = true; }
    else n.removeAttribute('contenteditable');
  }
}

function addImageButtons() {
  for (const box of $$('[data-img]:not(.logo__img)')) {
    if ($('.img-edit', box)) continue;
    const b = el('button', { type: 'button', class: 'img-edit' }, 'Cambiar foto');
    b.addEventListener('click', () => pickImage(file => uploadContentImage(box.dataset.img, file)));
    box.append(b);
  }
}

function enterAdmin() {
  state.isAdmin = true;
  document.body.classList.add('is-admin');
  $('#adminBar').hidden = false;
  setEditable(true);
  addImageButtons();
  renderServices(); renderGallery();
}

function exitAdmin() {
  state.isAdmin = false;
  document.body.classList.remove('is-admin');
  $('#adminBar').hidden = true;
  setEditable(false);
  $$('[data-img] > .img-edit').forEach(b => b.remove());
  renderServices(); renderGallery();
}

async function checkAdmin() {
  const { data, error } = await sb.rpc('is_admin');
  return !error && data === true;
}

function markDirty() {
  const n = state.dirty.size + state.dirtyRows.size;
  const btn = $('#btnSave');
  btn.disabled = n === 0;
  btn.textContent = n ? `Guardar cambios (${n})` : 'Guardar cambios';
}

// Registrar cambios mientras se escribe
document.addEventListener('input', e => {
  const t = e.target;
  if (!state.isAdmin || t.isContentEditable !== true) return;
  const value = t.innerText.replace(/\n{3,}/g, '\n\n').trim();
  if (t.dataset.k) {
    state.dirty.set(t.dataset.k, value);
    state.content[t.dataset.k] = value;
  } else if (t.dataset.field) {
    const { id, table, field } = t.dataset;
    const key = `${table}:${id}`;
    const entry = state.dirtyRows.get(key) || { table, id, fields: {} };
    entry.fields[field] = value;
    state.dirtyRows.set(key, entry);
    const row = state.services.find(s => s.id === id);
    if (row) row[field] = value;
    if (field === 'title') {
      const art = t.closest('.service');
      const num = $('.service__num', art);
      num.textContent = num.textContent.replace(/—.*$/, `— ${value}`);
      $('[data-wa-service]', art).dataset.waService = value;
    }
  }
  t.classList.add('is-dirty');
  markDirty();
  updateLinks();
});

// Pegar siempre como texto plano
document.addEventListener('paste', e => {
  if (!e.target.isContentEditable) return;
  e.preventDefault();
  document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
});

// En modo edición, los links no navegan (así se puede editar su texto)
document.addEventListener('click', e => {
  if (state.isAdmin && e.target.closest('a[data-wa], #igLink, #turneroLink')) e.preventDefault();
}, true);

window.addEventListener('beforeunload', e => {
  if (state.dirty.size || state.dirtyRows.size) { e.preventDefault(); e.returnValue = ''; }
});

async function save() {
  const btn = $('#btnSave');
  btn.disabled = true;
  btn.textContent = 'Guardando…';
  try {
    const now = new Date().toISOString();
    const rows = [...state.dirty].map(([key, value]) => ({ key, value, updated_at: now }));
    if (rows.length) {
      const { error } = await sb.from('site_content').upsert(rows);
      if (error) throw error;
    }
    for (const { table, id, fields } of state.dirtyRows.values()) {
      const { error } = await sb.from(table).update(fields).eq('id', id);
      if (error) throw error;
    }
    state.dirty.clear(); state.dirtyRows.clear();
    $$('.is-dirty').forEach(n => n.classList.remove('is-dirty'));
    toast('Cambios guardados');
  } catch (err) {
    console.error(err);
    toast('No se pudo guardar. Revisá la conexión y probá de nuevo.');
  }
  markDirty();
}

async function saveKeys(obj) {
  const now = new Date().toISOString();
  const rows = Object.entries(obj).map(([key, value]) => ({ key, value, updated_at: now }));
  const { error } = await sb.from('site_content').upsert(rows);
  if (error) throw error;
  Object.assign(state.content, obj);
}

/* ==========================================================
   Imágenes
   ========================================================== */
async function compress(file, max = 1800, quality = 0.85) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

async function uploadImage(file, folder) {
  const blob = await compress(file);
  const type = blob.type || file.type || 'image/jpeg';
  const ext = type === 'image/jpeg' ? 'jpg' : (type.split('/')[1] || 'img');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

function pathFromUrl(url) {
  const marker = `/object/public/${BUCKET}/`;
  const i = url ? url.indexOf(marker) : -1;
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

// Abre el selector de archivos y le pasa la foto elegida a `handler`
let pendingHandler = null;
function pickImage(handler) {
  pendingHandler = handler;
  const input = $('#singleImageInput');
  input.value = '';
  input.click();
}

$('#singleImageInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  const handler = pendingHandler;
  pendingHandler = null;
  if (!file || !handler) return;
  toast('Subiendo foto…', true);
  try {
    await handler(file);
    toast('Foto actualizada');
  } catch (err) {
    console.error(err);
    toast('No se pudo subir la foto. Probá con otra imagen.');
  }
});

async function uploadContentImage(key, file) {
  const old = pathFromUrl(state.content[key]);
  const { url } = await uploadImage(file, key.replace(/[^a-z0-9]+/gi, '-'));
  await saveKeys({ [key]: url });
  applyContent();
  if (old) sb.storage.from(BUCKET).remove([old]); // limpia la foto anterior
}

async function uploadServiceImage(s, file) {
  const old = s.image_path;
  const { url, path } = await uploadImage(file, 'services');
  const { error } = await sb.from('services').update({ image_url: url, image_path: path }).eq('id', s.id);
  if (error) throw error;
  s.image_url = url; s.image_path = path;
  renderServices();
  if (old) sb.storage.from(BUCKET).remove([old]);
}

/* ==========================================================
   Servicios y galería
   ========================================================== */
$('#btnAddService').addEventListener('click', async () => {
  const sort = state.services.reduce((m, s) => Math.max(m, s.sort ?? 0), 0) + 1;
  const { data, error } = await sb.from('services')
    .insert({ title: 'Nuevo servicio', description: 'Contá de qué se trata.', price: '$0', includes: '', duration: '', sort })
    .select().single();
  if (error) { console.error(error); return toast('No se pudo agregar el servicio.'); }
  state.services.push(data);
  renderServices();
  $(`[data-table="services"][data-id="${data.id}"][data-field="title"]`)?.focus();
  toast('Servicio agregado: editá sus textos y guardá');
});

async function deleteService(id) {
  const s = state.services.find(x => x.id === id);
  if (!confirm(`¿Eliminar "${s?.title || 'este servicio'}"?`)) return;
  const { error } = await sb.from('services').delete().eq('id', id);
  if (error) { console.error(error); return toast('No se pudo eliminar.'); }
  if (s?.image_path) sb.storage.from(BUCKET).remove([s.image_path]);
  state.services = state.services.filter(x => x.id !== id);
  state.dirtyRows.delete(`services:${id}`);
  markDirty(); renderServices();
}

$('#galleryInput').addEventListener('change', async e => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  let sort = state.gallery.reduce((m, g) => Math.max(m, g.sort ?? 0), 0);
  let ok = 0;
  for (const [i, file] of files.entries()) {
    toast(`Subiendo ${i + 1} de ${files.length}…`, true);
    try {
      const { url, path } = await uploadImage(file, 'gallery');
      const { data, error } = await sb.from('gallery').insert({ image_url: url, path, sort: ++sort }).select().single();
      if (error) throw error;
      state.gallery.push(data);
      ok++;
      renderGallery();
    } catch (err) { console.error(err); }
  }
  toast(ok === files.length ? 'Fotos agregadas' : `Se subieron ${ok} de ${files.length} fotos`);
});

async function deleteGalleryItem(g) {
  if (!confirm('¿Quitar esta foto del portfolio?')) return;
  const { error } = await sb.from('gallery').delete().eq('id', g.id);
  if (error) { console.error(error); return toast('No se pudo quitar la foto.'); }
  if (g.path) sb.storage.from(BUCKET).remove([g.path]);
  state.gallery = state.gallery.filter(x => x.id !== g.id);
  renderGallery();
}

/* ==========================================================
   Login, ajustes y barra
   ========================================================== */
const loginDialog = $('#loginDialog');
const settingsDialog = $('#settingsDialog');

$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

$('#logoBtn').addEventListener('click', () => {
  if (state.isAdmin) return openSettings();
  $('#loginError').textContent = '';
  if (!configured) $('#loginHint').textContent = 'Falta conectar Supabase en config.js.';
  loginDialog.showModal();
});

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!sb) return;
  const err = $('#loginError');
  const fd = new FormData(e.target);
  err.textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: fd.get('email'), password: fd.get('password') });
  if (error) { err.textContent = 'Email o contraseña incorrectos.'; return; }
  if (!(await checkAdmin())) {
    await sb.auth.signOut();
    err.textContent = 'Esta cuenta no tiene permiso para editar.';
    return;
  }
  e.target.reset();
  loginDialog.close();
  enterAdmin();
  toast('Listo, ya podés editar');
});

function openSettings() {
  const f = $('#settingsForm');
  f.number.value = state.content['whatsapp.number'] || WHATSAPP_DEFAULT;
  f.message.value = state.content['whatsapp.message'] || WHATSAPP_MESSAGE_DEFAULT;
  f.instagram.value = state.content['contact.instagram'] || '';
  f.turnero.value = state.content['booking.turnero'] || '';
  $('#btnRemoveLogo').hidden = !state.content['brand.logo'];
  settingsDialog.showModal();
}
$('#btnSettings').addEventListener('click', openSettings);

$('#settingsForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const number = f.number.value.replace(/\D/g, '');
  if (number.length < 8) { toast('Revisá el número: tiene que incluir código de país y área.'); return; }
  try {
    await saveKeys({
      'whatsapp.number': number,
      'whatsapp.message': f.message.value.trim(),
      'contact.instagram': f.instagram.value.trim().replace(/^@/, ''),
      'booking.turnero': f.turnero.value.trim(),
    });
    updateLinks();
    settingsDialog.close();
    toast('Ajustes guardados');
  } catch (err) { console.error(err); toast('No se pudieron guardar los ajustes.'); }
});

$('#btnChangeLogo').addEventListener('click', () => {
  settingsDialog.close();
  pickImage(file => uploadContentImage('brand.logo', file));
});
$('#btnRemoveLogo').addEventListener('click', async () => {
  const old = pathFromUrl(state.content['brand.logo']);
  try {
    await saveKeys({ 'brand.logo': '' });
    if (old) sb.storage.from(BUCKET).remove([old]);
    applyContent();
    settingsDialog.close();
    toast('Logo quitado');
  } catch (err) { console.error(err); toast('No se pudo quitar el logo.'); }
});

$('#btnSave').addEventListener('click', save);
$('#btnLogout').addEventListener('click', async () => {
  if ((state.dirty.size || state.dirtyRows.size) && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return;
  state.dirty.clear(); state.dirtyRows.clear(); markDirty();
  await sb.auth.signOut();
  exitAdmin();
  await load();
  toast('Sesión cerrada');
});

/* ==========================================================
   Toast
   ========================================================== */
let toastTimer;
function toast(msg, sticky = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => t.classList.remove('is-on'), 3200);
}

/* ==========================================================
   Inicio
   ========================================================== */
updateLinks();
await load();
if (sb) {
  const { data } = await sb.auth.getSession();
  if (data.session && (await checkAdmin())) enterAdmin();
}
