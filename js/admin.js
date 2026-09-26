(() => {
  'use strict';
  const CONFIG = window.SUPABASE_CONFIG || {};
  const BASE = (CONFIG.url || '').trim().replace(/\/$/, '');
  const KEY = (CONFIG.anonKey || '').trim();
  const configured = Boolean(BASE.startsWith('https://') && KEY && !BASE.includes('YOUR_PROJECT'));
  const client = configured && window.supabase?.createClient
    ? window.supabase.createClient(BASE, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const setup = $('#setup-notice');
  const login = $('#login-panel');
  const editor = $('#editor-panel');
  const signout = $('#sign-out');
  let siteContent;
  let dirty = false;
  let allSignups = [];
  let toastTimer;
  const visibleSections = ['navigation', 'hero', 'about', 'journal', 'essays', 'film', 'videos', 'collaborations', 'diners', 'contact', 'footer', 'portraits'];
  const pretty = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (s) => s.toUpperCase());
  const getPath = (obj, path) => path.split('.').reduce((v, k) => v?.[k], obj);
  const setPath = (obj, path, value) => {
    const parts = path.split('.'); const last = parts.pop();
    const target = parts.reduce((v, k) => v[k], obj); target[last] = value;
  };

  function showToast(message, error = false) {
    const node = $('#admin-toast'); node.textContent = message; node.classList.toggle('error', error); node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 4500);
  }

  function showSetup() {
    setup.hidden = false;
    setup.innerHTML = `<h2>Finish connecting the editor</h2><p>The CMS has three setup pieces: the database schema, an Auth user allowlisted as a CMS admin, and this site's public Supabase URL/key. Running the schema alone does not fill in the website config or make a user an admin. The public/publishable key belongs in <code>supabase-config.js</code>; never put a service-role or secret key in browser code.</p><ol><li>Create or confirm your administrator account under <strong>Supabase → Authentication → Users</strong>, with a password you can use to sign in.</li><li>If you already ran <code>supabase/schema.sql</code>, do not rerun the old script with the zero UUID. After the current schema has succeeded, run this separately in <strong>Supabase → SQL Editor</strong>, replacing the email with the exact Auth email:<pre><code>insert into public.cms_admins (user_id)&#10;select id from auth.users&#10;where lower(email) = lower('YOUR_AUTH_EMAIL')&#10;on conflict (user_id) do nothing&#10;returning user_id;</code></pre>You should see your user UUID returned. The schema itself contains no placeholder admin insert.</li><li>In <strong>Supabase → Project Settings → API</strong>, copy the Project URL and public publishable/anon key into <code>supabase-config.js</code>, then commit and push that file to <code>main</code>. After deployment, sign in at <a href="/admin.html">/admin.html</a>.</li></ol><p>The public key is safe to use in browser code because access is restricted by the SQL row-level security policies. Never use a service-role/secret key here. See <a href="https://supabase.com/docs/guides/database/postgres/row-level-security" target="_blank" rel="noopener">Supabase RLS guidance</a>.</p>`;
    login.hidden = true; editor.hidden = true;
  }

  function makeField(value, path, label, parent, opts = {}) {
    const wrap = document.createElement('div'); wrap.className = 'editor-field';
    const controlId = `field-${Math.random().toString(36).slice(2, 10)}`;
    const labelEl = document.createElement('label'); labelEl.htmlFor = controlId; labelEl.textContent = label; wrap.append(labelEl);
    const longText = opts.long || value.length > 125 || /paragraph|intro|body|text|description|quote/i.test(path);
    const control = document.createElement(longText ? 'textarea' : 'input'); control.id = controlId;
    if (control instanceof HTMLInputElement) control.type = /email/i.test(path) ? 'email' : 'text';
    control.value = value; control.dataset.fieldPath = path;
    if (opts.long) control.classList.add('paragraph-field');
    control.addEventListener('input', () => { setPath(siteContent, path, control.value); markDirty(); });
    wrap.append(control);
    if (/url|^links\./i.test(path)) {
      const note = document.createElement('small'); note.textContent = 'Use a full https://, mailto:, or tel: link.'; wrap.append(note);
    }
    parent.append(wrap);
  }

  function addArrayItem(path, values) {
    if (path === 'copy.essays') return { id: 'new-story', category: 'New story', title: 'New story', paragraphs: [''] };
    if (path === 'copy.videos') return { category: 'New video', title: 'New video', url: '', poster: '' };
    if (path === 'copy.speaking.cards') return { title: 'New topic', kicker: '', body: '' };
    if (path === 'copy.social.cards') return { category: 'New moment', title: '' };
    if (values.length && typeof values[0] === 'object') return JSON.parse(JSON.stringify(values[values.length - 1]));
    return '';
  }

  function renderNode(label, value, path, parent) {
    if (Array.isArray(value)) {
      if (!value.length || typeof value[0] !== 'object' || value[0] === null) {
        const field = document.createElement('div'); field.className = 'editor-field';
        const inputId = `field-${Math.random().toString(36).slice(2, 10)}`;
        const title = document.createElement('label'); title.htmlFor = inputId; title.textContent = label; field.append(title);
        const textarea = document.createElement('textarea'); textarea.id = inputId; textarea.className = 'paragraph-field'; textarea.value = value.join('\n');
        textarea.addEventListener('input', () => { setPath(siteContent, path, textarea.value.split('\n').map((s) => s.trim()).filter(Boolean)); markDirty(); });
        field.append(textarea); parent.append(field); return;
      }
      const block = document.createElement('div'); block.className = 'editor-array';
      value.forEach((item, index) => {
        const card = document.createElement('div'); card.className = 'array-card';
        const cardHead = document.createElement('div'); cardHead.className = 'array-card-head';
        const cardTitle = document.createElement('span'); cardTitle.textContent = `${label} ${String(index + 1).padStart(2, '0')}`;
        const actions = document.createElement('div'); actions.className = 'array-actions';
        if (index > 0) { const up = document.createElement('button'); up.type = 'button'; up.textContent = 'Move up'; up.addEventListener('click', () => moveArray(path, index, index - 1)); actions.append(up); }
        if (index < value.length - 1) { const down = document.createElement('button'); down.type = 'button'; down.textContent = 'Move down'; down.addEventListener('click', () => moveArray(path, index, index + 1)); actions.append(down); }
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-item'; remove.textContent = 'Remove'; remove.addEventListener('click', () => { value.splice(index, 1); setPath(siteContent, path, value); markDirty(); renderFields(); });
        actions.append(remove); cardHead.append(cardTitle, actions); card.append(cardHead);
        Object.entries(item).forEach(([key, child]) => {
          if (key === 'id' && path === 'copy.essays') return;
          const fieldPath = `${path}.${index}.${key}`;
          if (Array.isArray(child)) renderNode(pretty(key), child, fieldPath, card);
          else if (typeof child === 'string') makeField(child, fieldPath, pretty(key), card, { long: key === 'paragraphs' });
        });
        if (path === 'copy.videos') {
          const pick = document.createElement('button'); pick.type = 'button'; pick.className = 'small-action'; pick.textContent = 'Upload / replace video'; pick.addEventListener('click', () => startUpload(`copy.videos.${index}.url`)); card.append(pick);
          const poster = document.createElement('button'); poster.type = 'button'; poster.className = 'small-action'; poster.textContent = 'Upload poster image'; poster.addEventListener('click', () => startUpload(`copy.videos.${index}.poster`)); card.append(poster);
        }
        block.append(card);
      });
      const add = document.createElement('button'); add.type = 'button'; add.className = 'array-add'; add.textContent = `+ Add ${label.toLowerCase()}`;
      add.addEventListener('click', () => { value.push(addArrayItem(path, value)); setPath(siteContent, path, value); markDirty(); renderFields(); });
      block.append(add); parent.append(block); return;
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, child]) => renderNode(pretty(key), child, `${path}.${key}`, parent));
      return;
    }
    if (typeof value === 'string') makeField(value, path, label, parent);
  }

  function moveArray(path, from, to) {
    const list = getPath(siteContent, path); const [item] = list.splice(from, 1); list.splice(to, 0, item); markDirty(); renderFields();
  }

  function renderFields() {
    const container = $('#content-fields'); container.replaceChildren();
    const copy = siteContent?.copy || {};
    visibleSections.forEach((key) => {
      if (!(key in copy)) return;
      const group = document.createElement('details'); group.className = 'content-group';
      if (key === 'hero' || key === 'videos') group.open = true;
      const summary = document.createElement('summary'); summary.textContent = pretty(key); group.append(summary);
      const inside = document.createElement('div'); inside.className = 'group-inner';
      renderNode(pretty(key), copy[key], `copy.${key}`, inside);
      group.append(inside); container.append(group);
    });
    const links = document.createElement('details'); links.className = 'content-group';
    const linkHead = document.createElement('summary'); linkHead.textContent = 'Site links'; links.append(linkHead);
    const linkBody = document.createElement('div'); linkBody.className = 'group-inner'; renderNode('Links', siteContent.links || {}, 'links', linkBody); links.append(linkBody); container.append(links);
    buildUploadTargets();
  }

  function buildUploadTargets() {
    const select = $('#upload-target'); select.replaceChildren();
    (siteContent.copy.videos || []).forEach((video, index) => {
      const option = document.createElement('option'); option.value = `copy.videos.${index}.url`; option.textContent = `Video ${String(index + 1).padStart(2, '0')} — ${video.title || 'Untitled'}`; select.append(option);
      const poster = document.createElement('option'); poster.value = `copy.videos.${index}.poster`; poster.textContent = `Video ${String(index + 1).padStart(2, '0')} — poster image`; select.append(poster);
    });
    [['copy.portraits.one', 'Portrait 01'], ['copy.portraits.two', 'Portrait 02']].forEach(([path, label]) => {
      if (getPath(siteContent, path) !== undefined) { const option = document.createElement('option'); option.value = path; option.textContent = label; select.append(option); }
    });
  }

  function markDirty() {
    dirty = true; $('#editor-message').textContent = 'Unsaved edits'; $('#save-site').textContent = 'Save changes';
  }

  async function starterContent() {
    const response = await fetch('content.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the bundled starter content.');
    return response.json();
  }

  async function loadContent() {
    $('#editor-message').textContent = 'Loading saved content…';
    const { data, error } = await client.from('site_content').select('content').eq('page_id', 'home').maybeSingle();
    if (error) throw error;
    siteContent = data?.content || await starterContent();
    renderFields(); dirty = false; $('#editor-message').textContent = data ? 'Loaded the published site copy.' : 'Using starter copy. Save once to publish it to Supabase.';
  }

  function validateContent() {
    if (!siteContent?.copy || !siteContent.links || !Array.isArray(siteContent.copy.videos)) throw new Error('Check that your site content still includes copy, links, and the video list.');
    const values = Object.entries(siteContent.links);
    for (const [name, raw] of values) {
      if (typeof raw !== 'string') throw new Error(`The ${name} link must be text.`);
      if (raw && !/^(https:\/\/|http:\/\/|mailto:|tel:)/i.test(raw)) throw new Error(`${pretty(name)} must start with https://, http://, mailto:, or tel:.`);
    }
    for (const [index, video] of siteContent.copy.videos.entries()) {
      if (video.url && !/^(https:\/\/|http:\/\/)/i.test(video.url)) throw new Error(`Video ${index + 1} must use a public https:// URL.`);
    }
  }

  async function saveContent() {
    try {
      validateContent(); const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Your session has expired; please sign in again.');
      const button = $('#save-site'); button.disabled = true; button.textContent = 'Saving…';
      const { error } = await client.from('site_content').upsert({ page_id: 'home', content: siteContent, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: 'page_id' });
      if (error) throw error;
      dirty = false; $('#editor-message').classList.remove('error'); $('#editor-message').textContent = `Published successfully · ${new Date().toLocaleString()}`; showToast('Site content published.');
    } catch (error) { $('#editor-message').textContent = error.message; $('#editor-message').classList.add('error'); }
    finally { const button = $('#save-site'); button.disabled = false; button.textContent = 'Save changes'; }
  }

  async function startUpload(targetOverride) {
    const target = targetOverride || $('#upload-target').value;
    const picker = $('#media-file'); picker.dataset.uploadTarget = target; picker.click();
  }

  async function uploadFile(file, target) {
    if (!window.tus?.Upload) throw new Error('Resumable uploader did not load. Refresh the page and try again.');
    if (!file || !target) return;
    const mime = file.type || '';
    if (!/^(video\/(mp4|webm|quicktime)|image\/(jpeg|png|webp|avif))$/i.test(mime)) throw new Error('Choose an MP4/WebM/MOV video or JPEG/PNG/WebP/AVIF image.');
    if (file.size > 50 * 1024 * 1024) throw new Error('That file is larger than the configured 50 MiB per-file limit.');
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error('Please sign in again before uploading.');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const baseName = (file.name.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'media');
    const objectName = `${Date.now()}-${baseName}.${ext}`;
    const progress = $('#upload-progress'); const fill = $('#progress-fill'); const label = $('#progress-label');
    progress.hidden = false; fill.style.width = '0%'; label.textContent = 'Starting secure, resumable upload…';
    $('#media-file').disabled = true;
    try {
      const projectId = new URL(BASE).hostname.split('.')[0];
      await new Promise((resolve, reject) => {
        const task = new tus.Upload(file, {
          endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000, 20000], chunkSize: 6 * 1024 * 1024,
          headers: { authorization: `Bearer ${session.access_token}`, apikey: KEY, 'x-upsert': 'false' },
          uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
          metadata: { bucketName: 'site-media', objectName, contentType: mime, cacheControl: '31536000' },
          onError: reject,
          onProgress: (sent, total) => { const pct = total ? Math.round(sent / total * 100) : 0; fill.style.width = `${pct}%`; label.textContent = `Uploading ${pct}% · ${file.name}`; },
          onSuccess: resolve
        });
        task.findPreviousUploads().then((previous) => { if (previous.length) task.resumeFromPreviousUpload(previous[0]); task.start(); }).catch(reject);
      });
      const publicUrl = `${BASE}/storage/v1/object/public/site-media/${objectName}`;
      setPath(siteContent, target, publicUrl); markDirty();
      renderFields();
      label.textContent = `Uploaded: ${file.name} · Save changes to publish the site update.`; showToast('Media uploaded to Supabase Storage.');
    } catch (error) { label.textContent = 'Upload failed. Check Storage policies, allowed MIME types, and network connection.'; throw error; }
    finally { $('#media-file').disabled = false; }
  }

  async function refreshSignups() {
    const status = $('#signup-count'); status.textContent = 'Loading sign-ups…';
    const { data, error } = await client.from('waitlist_signups').select('email,signup_type,created_at').order('created_at', { ascending: false }).limit(5000);
    if (error) { status.textContent = `Could not load sign-ups: ${error.message}`; return; }
    allSignups = data || []; status.textContent = `${allSignups.length} sign-up${allSignups.length === 1 ? '' : 's'} loaded (most recent 5,000 max).`;
    $('#export-signups').disabled = !allSignups.length;
    const list = $('#signup-list'); list.replaceChildren(...allSignups.slice(0, 100).map((row) => {
      const line = document.createElement('div'); line.className = 'signup-row'; const email = document.createElement('strong'); email.textContent = row.email;
      const meta = document.createElement('span'); meta.textContent = `${row.signup_type.replace('_', ' ')} · ${new Date(row.created_at).toLocaleDateString()}`; line.append(email, meta); return line;
    }));
  }

  function exportSignups() {
    if (!allSignups.length) return;
    const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [['email', 'signup_type', 'created_at'], ...allSignups.map((r) => [r.email, r.signup_type, r.created_at])];
    const blob = new Blob(['\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `thirsty-dreamer-signups-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  async function signedIn(user) {
    const { data: membership, error: membershipError } = await client.from('cms_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (membershipError) throw new Error(`Could not verify administrator access: ${membershipError.message}`);
    if (!membership) throw new Error('This Supabase account is not on the website administrator list.');
    login.hidden = true; setup.hidden = true; editor.hidden = false; signout.hidden = false;
    $('#editor-message').textContent = `Signed in as ${user.email || 'administrator'}.`;
    await loadContent(); await refreshSignups();
  }

  function bind() {
    $('#login-form').addEventListener('submit', async (event) => {
      event.preventDefault(); const status = $('#login-message'); status.textContent = 'Signing in…'; status.classList.remove('error');
      const { data, error } = await client.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-password').value });
      if (error) { status.textContent = error.message; status.classList.add('error'); return; }
      try { await signedIn(data.user); } catch (err) { status.textContent = err.message; status.classList.add('error'); }
    });
    $('#save-site').addEventListener('click', saveContent);
    $('#media-file').addEventListener('change', async (event) => {
      const [file] = event.target.files || []; const target = event.target.dataset.uploadTarget || $('#upload-target').value;
      try { if (file) await uploadFile(file, target); } catch (error) { showToast(error.message, true); }
      event.target.value = '';
    });
    $('#refresh-signups').addEventListener('click', refreshSignups);
    $('#export-signups').addEventListener('click', exportSignups);
    signout.addEventListener('click', async () => { await client.auth.signOut(); editor.hidden = true; signout.hidden = true; login.hidden = false; setup.hidden = true; $('#login-message').textContent = 'You are signed out.'; });
    addEventListener('beforeunload', (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  }

  async function init() {
    if (!configured || !window.supabase?.createClient) { showSetup(); return; }
    bind();
    const { data, error } = await client.auth.getUser();
    if (!error && data.user) {
      try { await signedIn(data.user); } catch (err) { login.hidden = false; editor.hidden = true; $('#login-message').textContent = err.message; }
    } else { login.hidden = false; editor.hidden = true; setup.hidden = true; }
  }
  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
