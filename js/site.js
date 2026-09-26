(() => {
  'use strict';

  const CONFIG = window.SUPABASE_CONFIG || {};
  const SUPABASE_URL = (CONFIG.url || '').trim().replace(/\/$/, '');
  const SUPABASE_KEY = (CONFIG.anonKey || '').trim();
  const hasSupabase = Boolean(SUPABASE_URL.startsWith('https://') && SUPABASE_KEY && !SUPABASE_URL.includes('YOUR_PROJECT'));
  const db = hasSupabase && window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const get = (object, path) => path.split('.').reduce((value, key) => value == null ? undefined : value[key], object);
  const setCopy = (data) => $$('[data-copy]').forEach((el) => {
    const value = get(data.copy, el.dataset.copy);
    if (typeof value === 'string') el.textContent = value;
  });
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  let toastTimer;
  function toast(message) {
    const node = $('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 4200);
  }

  function setLink(selector, href) {
    const node = $(selector);
    if (!node || typeof href !== 'string') return;
    const safe = /^(https?:\/\/|mailto:|tel:)/i.test(href.trim());
    if (safe) node.href = href;
    else node.removeAttribute('href');
  }

  function applySiteData(data) {
    if (!data || typeof data !== 'object' || !data.copy) throw new Error('The site content is incomplete. Restore the starter content or check the Supabase record.');
    setCopy(data);
    document.title = 'Thirsty Dreamer — Massimo “Massi” Zitti';
    const description = 'Massimo “Massi” Zitti — bartender, World Class coach and co-owner of Mother Cocktail Bar. A life in hospitality, fermentation and sustainability.';
    let metaDescription = $('meta[name="description"]');
    if (!metaDescription) { metaDescription = el('meta'); metaDescription.name = 'description'; document.head.append(metaDescription); }
    metaDescription.content = description;

    const heroMeta = $('#hero-meta');
    heroMeta.replaceChildren(...(data.copy.hero.meta || []).map((value, index) => {
      const item = el('span', '', value);
      if (index) heroMeta.append(el('i', 'dot'));
      return item;
    }));
    $('#about-tags').replaceChildren(...(data.copy.about.tags || []).map((text) => el('span', 'tag', text)));

    const cards = $('#journal-cards');
    cards.replaceChildren(...(data.copy.essays || []).map((essay, index) => {
      const card = el('article', `article a${(index % 4) + 1} reveal d${(index % 4) + 1}`);
      card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-label', `Read ${essay.title}`);
      const image = el('div', 'article-img');
      const artwork = el('div', 'tex'); artwork.setAttribute('aria-hidden', 'true'); image.append(artwork, el('span', 'article-num', String(index + 1).padStart(2, '0')));
      const body = el('div', 'article-body'); body.append(el('div', 'article-cat', essay.category), el('h3', '', essay.title));
      const read = el('div', 'read', get(data.copy, 'journal.readMore') || 'Read the story →'); body.append(read); card.append(image, body);
      card.addEventListener('click', () => showStory(essay));
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showStory(essay); } });
      return card;
    }));

    const availableVideos = (data.copy.videos || []).filter((video) => typeof video.url === 'string' && /^https:\/\//i.test(video.url));
    const gallery = $('#video-gallery');
    gallery.replaceChildren(...availableVideos.map((video, index) => {
      const card = el('article', `video-card reveal d${(index % 4) + 1}${index === 0 ? ' featured' : ''}`);
      const frame = el('div', 'video-frame');
      const player = el('video'); player.controls = true; player.playsInline = true; player.preload = 'metadata'; player.setAttribute('aria-label', video.title || `Video ${index + 1}`);
      if (video.poster && /^https?:\/\//i.test(video.poster)) player.poster = video.poster;
      if (video.url && /^https?:\/\//i.test(video.url)) {
        const source = el('source'); source.src = video.url;
        const suffix = video.url.split(/[?#]/)[0].toLowerCase();
        source.type = suffix.endsWith('.webm') ? 'video/webm' : (suffix.endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
        player.append(source); frame.classList.add('video-ready');
      }
      const missing = el('div', 'video-missing', video.url ? '' : (get(data.copy, 'film.videoPlaceholder') || 'Video coming soon'));
      const number = el('span', 'video-num', String(index + 1).padStart(2, '0'));
      frame.append(player, missing, number);
      const meta = el('div', 'video-meta'); meta.append(el('span', '', video.category || 'Thirsty Dreamer'), el('h3', '', video.title || `Film ${index + 1}`));
      card.append(frame, meta); return card;
    }));

    $('#partner-chips').replaceChildren(...(data.copy.collaborations.partners || []).map((name) => el('span', 'chip', name)));

    const portraits = data.copy.portraits || {};
    const portraitOne = portraits.one || 'assets/placeholders/massi-photo-01.svg';
    const portraitTwo = portraits.two || 'assets/placeholders/massi-photo-02.svg';
    $('#portrait-one').src = portraitOne;
    $('#portrait-two').src = portraitTwo;
    const hasPortraits = !/placeholders\/massi-photo-0[12]\.svg$/i.test(portraitOne) || !/placeholders\/massi-photo-0[12]\.svg$/i.test(portraitTwo);
    const hasVideos = availableVideos.length > 0;
    const film = $('#film');
    film.hidden = !(hasVideos || hasPortraits);
    $('#nav-film').hidden = film.hidden;
    $('#footer-film').hidden = film.hidden;
    $('#portrait-strip').hidden = !hasPortraits;

    const bioLink = $('#bio-read-more');
    bioLink.addEventListener('click', () => showStory({
      category: data.copy.about.eyebrow,
      title: data.copy.about.title,
      paragraphs: data.copy.about.paragraphs || []
    }));

    setLink('#instagram-cta', data.links.instagram);
    setLink('#partner-cta', `${data.links.email}?subject=${encodeURIComponent('Hospitality collaboration')}`);
    setLink('#contact-email', data.links.email);
    setLink('#contact-phone', data.links.phone);
    setLink('#contact-instagram', data.links.instagram);
    setLink('#footer-instagram', data.links.instagram);
    setLink('#footer-email', data.links.email);
    setLink('#mother-contact', data.links.motherMap);
    $('#secretEmail').placeholder = data.copy.diners.emailPlaceholder || 'you@example.com';

    initReveal();
  }

  function showStory(story) {
    const dialog = $('#story-dialog');
    $('#story-category').textContent = story.category || '';
    $('#story-title').textContent = story.title || '';
    const body = $('#story-body');
    body.replaceChildren(...(story.paragraphs || []).map((paragraph) => el('p', '', paragraph)));
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open', ''); dialog.hidden = false; }
  }

  function initReveal() {
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) { $$('.reveal').forEach((node) => node.classList.add('in')); return; }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    $$('.reveal:not(.in)').forEach((node) => observer.observe(node));
  }

  function setupNavigation() {
    const nav = $('#nav'); const burger = $('#burger');
    const syncScroll = () => nav.classList.toggle('solid', scrollY > 40);
    addEventListener('scroll', syncScroll, { passive: true }); syncScroll();
    burger.addEventListener('click', () => {
      const opened = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!opened)); burger.setAttribute('aria-label', opened ? 'Open menu' : 'Close menu');
      nav.classList.toggle('menu-open', !opened);
    });
    $$('#site-menu a').forEach((link) => link.addEventListener('click', () => {
      burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu'); nav.classList.remove('menu-open');
    }));
    const dialog = $('#story-dialog');
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') nav.classList.remove('menu-open'); });
    if (matchMedia('(min-width: 980px)').matches) {
      const visual = $('.hero-visual');
      addEventListener('mousemove', (event) => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        visual.style.transform = `translate(${(event.clientX / innerWidth - .5) * 8}px,${(event.clientY / innerHeight - .5) * 6}px)`;
      }, { passive: true });
    }
  }

  async function getInitialContent() {
    const response = await fetch('content.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Starter content could not be loaded.');
    const starter = await response.json();
    if (!db) return starter;
    const { data, error } = await db.from('site_content').select('content').eq('page_id', 'home').maybeSingle();
    if (error) { console.warn('Supabase content fallback:', error.message); return starter; }
    return data?.content || starter;
  }

  function setupSignups() {
    $$('.signup-form, #diners-form').forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = $('input[type="email"]', form); const email = input.value.trim().toLowerCase();
      if (!email || !form.checkValidity()) { form.reportValidity(); return; }
      if (!db) {
        const subject = encodeURIComponent(form.id === 'diners-form' ? 'Secret Diners invitation' : 'Thirsty Dreamer updates');
        toast('Sign-ups are not connected yet. Your email app will open instead.');
        location.href = `mailto:massi@motherdrinks.co?subject=${subject}&body=${encodeURIComponent(`Please add ${email} to the ${form.id === 'diners-form' ? 'Secret Diners' : 'Thirsty Dreamer'} list.`)}`;
        return;
      }
      const type = form.id === 'diners-form' ? 'secret_diners' : 'dream_journal';
      const button = $('button[type="submit"]', form); button.disabled = true;
      const { error } = await db.from('waitlist_signups').upsert({ email, signup_type: type }, { onConflict: 'email,signup_type', ignoreDuplicates: true });
      button.disabled = false;
      if (error) { console.error(error); toast('We could not save that just now. Please email Massi directly.'); return; }
      form.reset(); toast(type === 'secret_diners' ? 'Thanks — your interest is registered.' : 'Thanks for joining the Dream Journal.');
    }));
  }

  async function boot() {
    setupNavigation(); setupSignups();
    try { applySiteData(await getInitialContent()); }
    catch (error) { console.error(error); toast(error.message); }
    if (!hasSupabase) console.info('Supabase is not configured yet; the site is showing its bundled starter copy.');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
