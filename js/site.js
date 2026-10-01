(() => {
  'use strict';

  const CONFIG = window.SUPABASE_CONFIG || {};
  const SUPABASE_URL = (CONFIG.url || '').trim().replace(/\/$/, '');
  const SUPABASE_KEY = (CONFIG.anonKey || '').trim();
  const configured = /^https:\/\//i.test(SUPABASE_URL) && SUPABASE_KEY && !SUPABASE_URL.includes('YOUR_PROJECT');
  const db = configured && window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    }) : null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const path = (object, key) => key.split('.').reduce((value, part) => value == null ? undefined : value[part], object);
  let siteData;
  let revealObserver;
  let toastTimer;

  function toast(message) {
    const box = $('#toast');
    const label = $('#toastMsg');
    if (!box || !label) return;
    label.textContent = message;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 4000);
  }

  function setText(selector, value, root = document) {
    const node = $(selector, root);
    if (node && typeof value === 'string') node.textContent = value;
    return node;
  }

  function safeExternal(url) {
    return typeof url === 'string' && /^https:\/\//i.test(url.trim()) ? url.trim() : '';
  }

  function compactPreview(value, maxLength = 220) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    const segment = text.slice(0, maxLength - 1);
    const sentence = segment.lastIndexOf('. ');
    const boundary = sentence >= maxLength * 0.62 ? sentence + 1 : segment.lastIndexOf(' ');
    return `${segment.slice(0, boundary > 0 ? boundary : maxLength - 1).trimEnd()}…`;
  }

  function setExternalLink(selector, url) {
    const node = $(selector);
    const safe = safeExternal(url);
    if (!node) return;
    if (safe) {
      node.href = safe;
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
    } else {
      node.removeAttribute('href');
    }
  }

  function showStory(story) {
    const dialog = $('#story-dialog');
    if (!dialog || !story) return;
    setText('#story-category', story.category || 'The Dream Journal');
    setText('#story-title', story.title || 'A story from behind the bar');
    const content = $('#story-body');
    const summary = compactPreview(Array.isArray(story.paragraphs) ? story.paragraphs.join(' ') : '');
    content.replaceChildren(...(summary ? [summary] : []).map((text) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      return paragraph;
    }));
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function makeStoryCard(node, card, index, essay) {
    node.dataset.storyIndex = String(index);
    node.setAttribute('aria-label', `Read ${card.title}`);
    const category = $('.article-cat', node);
    const title = $('h3', node);
    const read = $('.read', node);
    if (category) category.textContent = card.category;
    if (title) title.textContent = card.title;
    if (read) read.textContent = siteData.copy.journal.readMore || 'Read the journal →';
    const open = () => showStory({ category: card.category, title: card.title, paragraphs: essay.paragraphs });
    node.addEventListener('click', open);
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
  }

  function makeTags(tags) {
    const parent = $('#about .tags');
    if (!parent) return;
    const colors = ['clay', '', 'moss', '', ''];
    parent.replaceChildren(...tags.map((text, index) => {
      const chip = document.createElement('span');
      chip.className = `tag${colors[index] ? ` ${colors[index]}` : ''}`;
      chip.textContent = text;
      return chip;
    }));
  }

  function renderSite(data) {
    if (!data?.copy) throw new Error('The website copy is missing. Check the starter content or Supabase site record.');
    siteData = data;
    const copy = data.copy;
    const hero = copy.hero || {};
    const heroTitle = $('#top h1');
    if (heroTitle) {
      const accent = $('.l2', heroTitle);
      heroTitle.firstChild && heroTitle.firstChild.nodeType === Node.TEXT_NODE
        ? heroTitle.firstChild.textContent = `${hero.titleStart || ''} `
        : heroTitle.insertBefore(document.createTextNode(`${hero.titleStart || ''} `), accent);
      if (accent) accent.textContent = hero.titleAccent || '';
    }
    setText('.hero-never', hero.kicker);
    setText('.hero-intro', hero.intro);
    const heroActions = $$('#top button');
      if (heroActions[0]) {
        heroActions[0].textContent = `${hero.primaryCta || 'Read the Dream'} →`;
        heroActions[0].dataset.scroll = '#about';
      }
    if (heroActions[1]) heroActions[1].textContent = hero.secondaryCta || 'Get in touch';
    const meta = $('#top .hero-meta');
    if (meta) {
      meta.replaceChildren(...(hero.meta || []).flatMap((text, index) => {
        const label = document.createElement('span'); label.textContent = text;
        return index ? [Object.assign(document.createElement('i'), { className: 'dot', 'aria-hidden': 'true' }), label] : [label];
      }));
    }

    const about = copy.about || {};
    setText('#about .eyebrow', about.eyebrow);
    setText('#about h2', about.title);
    setText('#about .about-quote', about.displayQuote || about.quote);
    const aboutCopy = $('#about .about-copy');
    if (aboutCopy) {
      const oldParagraphs = $$('.about-copy > p:not(.about-quote)', aboutCopy);
      const insertionPoint = oldParagraphs[0] || $('.tags', aboutCopy);
      oldParagraphs.forEach((p) => p.remove());
      (about.paragraphs || []).forEach((text, index) => {
        const paragraph = document.createElement('p');
        paragraph.className = `reveal d${Math.min(index + 1, 4)}`;
        paragraph.textContent = text;
        aboutCopy.insertBefore(paragraph, $('.tags', aboutCopy));
      });
      if (insertionPoint && !insertionPoint.isConnected && !$('.tags', aboutCopy)) aboutCopy.append(insertionPoint);
    }
    makeTags(about.tags || []);
    renderMedia(data);

    const journal = copy.journal || {};
    setText('#blog .eyebrow', journal.eyebrow);
    const journalTitle = $('#blog .news-head h2');
    if (journalTitle) {
      journalTitle.replaceChildren(document.createTextNode(`${journal.titleStart || 'The Dream Come True'} `));
      const accent = document.createElement('span'); accent.className = 'clay'; accent.textContent = journal.titleAccent || 'Journal';
      journalTitle.append(accent);
    }
    setText('#blog .news-sub', journal.intro);
    const journalForm = $('#journal-form');
    if (journalForm) {
      setText('.sl', journal.signupLabel, journalForm);
      setText('.sp', journal.signupCopy, journalForm);
      const email = $('input[type="email"]', journalForm);
      if (email) email.placeholder = journal.emailPlaceholder || 'you@example.com';
      const label = $('.signup-consent span', journalForm);
      if (label) label.textContent = journal.signupConsent || 'I agree to receive occasional Thirsty Dreamer emails.';
      const submit = $('button[type="submit"]', journalForm);
      if (submit) submit.textContent = journal.signupButton || 'Join the journal';
    }
    const essays = copy.essays || [];
    const cards = journal.cards || [];
    $$('#journal-cards .article').forEach((node, index) => {
      const item = cards[index];
      if (!item) { node.hidden = true; return; }
      const essay = item.storyId === 'about'
        ? { category: about.eyebrow, paragraphs: about.paragraphs }
        : essays.find((story) => story.id === item.storyId) || essays[index];
      if (!essay) { node.hidden = true; return; }
      node.hidden = false;
      makeStoryCard(node, item, index, essay);
    });

    const speaking = copy.speaking || {};
    setText('#seminars .eyebrow', speaking.eyebrow);
    setText('#seminars h2', speaking.title);
    setText('#seminars > .wrap > p', speaking.intro);
    $$('#seminar-cards .sem-card').forEach((card, index) => {
      const item = speaking.cards?.[index];
      if (!item) { card.hidden = true; return; }
      card.hidden = false;
      setText('h3', item.title, card); setText('.sem-kicker', item.kicker, card); setText('p', item.body, card);
      setText('.sem-link', 'Request this seminar →', card);
    });
    const seminarFoot = $('#seminars .sem-foot');
    if (seminarFoot && speaking.footer) {
      const link = $('span', seminarFoot);
      seminarFoot.firstChild.textContent = speaking.footer;
      if (link) link.textContent = speaking.checkAvailability || 'Check availability →';
    }

    const social = copy.social || {};
    setText('#social .eyebrow', social.eyebrow); setText('#social .social-head h2', social.title);
    setText('#social .followers .big', social.followers); setText('#social .followers .lab', social.handle);
    $$('#social-cards .ig').forEach((card, index) => {
      const item = social.cards?.[index];
      if (!item) { card.hidden = true; return; }
      card.hidden = false; setText('.ig-cat', item.category, card); setText('.ig-t', item.title, card); setText('.views', item.views, card);
      card.dataset.topic = item.topic || '';
    });
    const socialButton = $('#instagram-cta');
    if (socialButton) socialButton.textContent = social.button || 'Follow @thirstydreamer →';

    const brand = copy.brand || {};
    setText('#partner .eyebrow', brand.eyebrow); setText('#partner h2', brand.title);
    const paragraphs = $$('#partner .brand-copy > p');
    if (paragraphs[0]) paragraphs[0].textContent = brand.intro || '';
    if (paragraphs[1]) paragraphs[1].textContent = brand.subintro || '';
    setText('#partner .reel-sponsor', brand.reelSponsor);
    const reelIcos = $$('#partner .reel-side .ico');
    [brand.reelViews, brand.reelComments, brand.reelLikes].forEach((text, i) => { if (reelIcos[i]) reelIcos[i].textContent = text || ''; });
    setText('#partner .reel-cap', brand.reelCaption); setText('#partner .reel-tag', brand.reelTags);
    $$('#partner .brand-steps .bstep').forEach((step, index) => {
      const item = brand.steps?.[index]; if (!item) { step.hidden = true; return; }
      step.hidden = false; setText('.bstep-t .h', item.title, step); setText('.bstep-t .d', item.description, step);
    });
    setText('#partner .brand-logos .lbl', brand.typesLabel);
    $$('#partner .brand-logos .bchip').forEach((node, index) => { if (brand.types?.[index]) node.textContent = brand.types[index]; });
    if ($('#partner .brand-logos')) $$('#partner .brand-logos .bchip').slice((brand.types || []).length).forEach((node) => node.remove());
    const partnerButton = $('#partner-cta'); if (partnerButton) partnerButton.textContent = brand.button || 'Start a partnership →';
    setText('#partner .brand-rate', brand.rate);

    const diners = copy.diners || {};
    setText('#secret .eyebrow', diners.eyebrow); setText('#secret h2', diners.title);
    setText('#secret .secret-copy', diners.intro); setText('#secret .secret-sub', diners.sub);
    setText('#secret .secret-meta', diners.meta);
    const dinersForm = $('#diners-form');
    if (dinersForm) {
      const email = $('input[type="email"]', dinersForm); if (email) email.placeholder = diners.emailPlaceholder || 'you@example.com';
      const button = $('button[type="submit"]', dinersForm); if (button) button.textContent = diners.submitLabel || 'Join the waitlist';
    }

    const contact = copy.contact || {};
    setText('#contact .eyebrow', contact.eyebrow); setText('#contact h2', contact.title);
    setText('#contact .contact-lead', contact.intro); setText('#contact .contact-sign', contact.signoff);
    setText('#contact .contact-dream', contact.dream);
    setText('.contact-form-title', contact.formTitle); setText('.contact-form-intro', contact.formIntro);
    $$('.form-field label').forEach((node) => {
      const map = { 'inquiry-name': contact.nameLabel, 'inquiry-email': contact.emailLabel,
        'inquiry-phone': contact.phoneLabel, 'inquiry-kind': contact.kindLabel, 'inquiry-message': contact.messageLabel };
      const id = node.htmlFor;
      if (map[id]) node.textContent = `${map[id]} *`;
    });
    setText('.form-consent span', contact.consent); setText('.inquiry-submit', `${contact.submitLabel || 'Send inquiry'} →`);
    const booking = $('.booking-list');
    if (booking) {
      $$('.booking-list .booking').forEach((node, index) => {
        const item = contact.bookingCards?.[index]; if (!item) { node.hidden = true; return; }
        node.hidden = false; setText('.bt', item.title, node); setText('.bd', item.detail, node); node.dataset.inquiryType = item.kind;
      });
    }

    const footer = copy.footer || {};
    setText('.foot-never', footer.tagline);
    const footerLinks = $$('.foot-links a');
    const labels = [footer.linkAbout, footer.linkSpeaking, footer.linkJournal, footer.linkDiners, footer.linkContact];
    footerLinks.forEach((node, index) => { if (labels[index]) node.textContent = labels[index]; });
    const bottom = $('.foot-bottom p');
    if (bottom) bottom.textContent = footer.copyright || '© 2026 Thirsty Dreamer · Massimo Zitti · Toronto';

    setExternalLink('#instagram-cta', data.links?.instagram);
    setExternalLink('#footer-instagram', data.links?.instagram);
    setExternalLink('#mother-contact', data.links?.motherMap);
    document.title = 'Thirsty Dreamer — Massimo “Massi” Zitti';
    initialiseReveal();
  }

  async function loadContent() {
    const response = await fetch('content.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the website starter content. Please refresh and try again.');
    const starter = await response.json();
    if (!db) return starter;
    const { data, error } = await db.from('site_content').select('content').eq('page_id', 'home').maybeSingle();
    if (error) { console.warn('Using starter copy after the Supabase content lookup failed:', error.message); return starter; }
    return data?.content || starter;
  }

  function renderMedia(data) {
    const section = $('#film-gallery');
    const copy = data.copy || {};
    const film = copy.film || {};
    if (section) {
      setText('#film-eyebrow', film.eyebrow || 'In motion');
      setText('#film-title', `${film.titleStart || 'The dream,'} ${film.titleAccent || 'in motion.'}`);
      setText('#film-intro', film.intro || 'Films from behind the bar, the fermentation process, and the people who make it happen.');
      const videos = (copy.videos || []).filter((item) => typeof item.url === 'string' && item.url.trim());
      const cards = $('#film-cards');
      if (cards) cards.replaceChildren(...videos.map((item) => {
        const card = document.createElement('article'); card.className = 'film-card';
        const source = item.url.trim();
        const isLocal = /^assets\/[\w./-]+$/i.test(source);
        const isHttps = /^https:\/\//i.test(source);
        if (!isHttps && !isLocal) return card;
        const isVideo = /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(source);
        if (isVideo) {
          const video = document.createElement('video'); video.controls = true; video.preload = 'metadata'; video.playsInline = true;
          video.src = source;
          if (typeof item.poster === 'string' && (/^https:\/\//i.test(item.poster) || /^assets\/[\w./-]+$/i.test(item.poster))) video.poster = item.poster;
          card.append(video);
        } else {
          const preview = document.createElement('a'); preview.className = 'film-preview'; preview.href = source;
          preview.target = '_blank'; preview.rel = 'noopener noreferrer'; preview.textContent = 'Open film ↗'; card.append(preview);
        }
        const label = document.createElement('div'); label.className = 'film-copy';
        const category = document.createElement('span'); category.textContent = item.category || 'Film';
        const title = document.createElement('h3'); title.textContent = item.title || 'A story in motion';
        label.append(category, title); card.append(label); return card;
      }));
      section.hidden = !videos.length;
    }
    const imageSource = copy.portraits?.one || '';
    if (imageSource && !imageSource.includes('placeholders/')) {
      const holder = $('.hero-visual .portrait-main');
      if (holder && (/^https:\/\//i.test(imageSource) || /^assets\/[\w./-]+$/i.test(imageSource))) {
        let portrait = $('.cms-portrait', holder);
        if (!portrait) { portrait = document.createElement('img'); portrait.className = 'cms-portrait'; portrait.alt = 'Massi behind the bar'; holder.append(portrait); }
        portrait.src = imageSource;
      }
    }
  }

  function initialiseReveal() {
    const nodes = $$('.reveal:not(.in)');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('in')); return;
    }
    if (revealObserver) revealObserver.disconnect();
    revealObserver = new IntersectionObserver((entries, observer) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    nodes.forEach((node) => revealObserver.observe(node));
  }

  function setInquiryType(type) {
    const select = $('#inquiry-kind');
    if (select && [...select.options].some((option) => option.value === type)) select.value = type;
  }

  function setupNavigation() {
    const nav = $('#nav'); const burger = $('#burger');
    const sync = () => nav?.classList.toggle('solid', scrollY > 40);
    addEventListener('scroll', sync, { passive: true }); sync();
    burger?.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', String(open)); burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      nav?.classList.toggle('menu-open', open);
    });
    $$('#site-menu a, .nav-links a').forEach((link) => link.addEventListener('click', () => {
      burger?.setAttribute('aria-expanded', 'false'); burger?.setAttribute('aria-label', 'Open menu'); nav?.classList.remove('menu-open');
    }));
    $$('[data-scroll]').forEach((button) => button.addEventListener('click', () => {
      if (button.dataset.inquiryType) setInquiryType(button.dataset.inquiryType);
      const target = $(button.dataset.scroll);
      target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
    $$('.booking-list .booking, .sem-link').forEach((card) => {
      const select = () => { setInquiryType(card.dataset.inquiryType || 'speaking'); $('#contact-form-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      card.addEventListener('click', select);
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
    });
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href="#contact-form"]');
      if (link?.dataset.inquiryType) setInquiryType(link.dataset.inquiryType);
    });
    const dialog = $('#story-dialog');
    $('#dialog-close')?.addEventListener('click', () => dialog?.close());
    dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { nav?.classList.remove('menu-open'); burger?.setAttribute('aria-expanded', 'false'); } });
    const visual = $('.hero-visual');
    if (visual && matchMedia('(min-width:980px)').matches) addEventListener('mousemove', (event) => {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) visual.style.transform = `translate(${(event.clientX / innerWidth - .5) * 8}px,${(event.clientY / innerHeight - .5) * 6}px)`;
    }, { passive: true });
  }

  function setupTopics() {
    $$('.chip[data-topic="storytelling"]').forEach((chip) => chip.remove());
    const popup = $('#topicPop'); const key = $('#topicPopK'); const body = $('#topicPopB');
    if (!popup || !key || !body) return;
    let pinned = false; let timer;
    const dataForTopic = (topic) => {
      const names = { fermentation: 'fermentation', sustainability: 'sustainability', secret: 'secret-diners-story', mother: 'mother' };
      const story = (siteData?.copy?.essays || []).find((item) => item.id === names[topic]);
      if (story) return { heading: story.category, text: compactPreview(story.paragraphs.join(' ')) };
      if (topic === 'speaking') return { heading: siteData?.copy?.speaking?.title || 'Public Speaking', text: compactPreview(siteData?.copy?.speaking?.intro || '') };
      return { heading: 'Cocktails', text: compactPreview(siteData?.copy?.hero?.intro || '') };
    };
    const open = (topic) => {
      const item = dataForTopic(topic); key.textContent = item.heading; body.textContent = item.text;
      popup.classList.add('show'); $$('.chip').forEach((chip) => chip.classList.toggle('active', chip.dataset.topic === topic));
    };
    const close = () => { popup.classList.remove('show'); pinned = false; $$('.chip.active').forEach((chip) => chip.classList.remove('active')); };
    $$('.chip').forEach((chip) => {
      chip.addEventListener('mouseenter', () => { if (!pinned) { clearTimeout(timer); open(chip.dataset.topic); } });
      chip.addEventListener('focus', () => open(chip.dataset.topic));
      chip.addEventListener('click', (event) => { event.stopPropagation(); pinned = true; open(chip.dataset.topic); });
    });
    $('#strip')?.addEventListener('mouseleave', () => { if (!pinned) timer = setTimeout(close, 180); });
    popup.addEventListener('mouseenter', () => clearTimeout(timer));
    popup.addEventListener('mouseleave', () => { if (!pinned) timer = setTimeout(close, 180); });
    $('#topicPopX')?.addEventListener('click', close);
    document.addEventListener('click', (event) => { if (pinned && !popup.contains(event.target) && !event.target.closest('.chip')) close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  }

  async function submitContact(event) {
    event.preventDefault();
    const form = event.currentTarget; const status = $('#inquiry-status'); const button = $('button[type="submit"]', form);
    const phone = $('#inquiry-phone');
    const digits = phone.value.replace(/\D/g, '');
    phone.setCustomValidity(digits.length < 7 || digits.length > 15 ? 'Enter a phone number with 7 to 15 digits.' : '');
    if (!form.reportValidity()) return;
    if ($('#inquiry-website')?.value) { form.reset(); status.textContent = 'Thanks. Your inquiry has been received.'; return; }
    if (!db) { status.textContent = 'The secure inbox is not connected yet. Please try again later.'; return; }
    const values = new FormData(form);
    const payload = {
      full_name: String(values.get('full_name') || '').trim(),
      email: String(values.get('email') || '').trim().toLowerCase(),
      phone: String(values.get('phone') || '').trim(),
      inquiry_type: String(values.get('inquiry_type') || ''),
      message: String(values.get('message') || '').trim(),
      consent: values.get('consent') === 'on'
    };
    button.disabled = true; status.textContent = 'Sending securely…';
    try {
      const { error } = await db.from('contact_inquiries').insert(payload);
      if (error) throw error;
      form.reset();
      status.textContent = 'Thank you — your inquiry has been sent securely. Massi will follow up soon.';
      toast('Thanks. Your inquiry is on its way to Massi.');
    } catch (error) {
      console.error('Contact inquiry failed:', error?.message || 'Network request failed');
      status.textContent = 'We could not send that just now. Please check your connection and try again.';
    } finally {
      button.disabled = false;
    }
  }

  function setupForms() {
    $('#contact-form')?.addEventListener('submit', submitContact);
    $$('.signup-form, #diners-form').forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = $('input[type="email"]', form); const email = input?.value.trim().toLowerCase();
      if (!email || !form.reportValidity()) return;
      if (!db) { toast('The sign-up list is not connected yet. Please try again later.'); return; }
      const type = form.id === 'diners-form' ? 'secret_diners' : 'dream_journal';
      const button = $('button[type="submit"]', form); if (button) button.disabled = true;
      try {
        const { error } = await db.from('waitlist_signups').upsert({ email, signup_type: type }, { onConflict: 'email,signup_type', ignoreDuplicates: true });
        if (error) throw error;
        form.reset(); toast(type === 'secret_diners' ? 'Thanks — your interest is registered.' : 'Thanks for joining the Dream Journal.');
      } catch (error) {
        console.error('Signup insert failed:', error?.message || 'Network request failed');
        toast('We could not save that just now. Please check your connection and try again.');
      } finally { if (button) button.disabled = false; }
    }));
    $('#social .ig') && $$('#social .ig').forEach((card) => card.addEventListener('click', () => {
      if (dataUrl()) window.open(dataUrl(), '_blank', 'noopener,noreferrer');
    }));
    $('#instagram-cta')?.addEventListener('click', () => { if (dataUrl()) window.open(dataUrl(), '_blank', 'noopener,noreferrer'); });
  }
  const dataUrl = () => safeExternal(siteData?.links?.instagram);

  async function boot() {
    setupNavigation(); setupTopics(); setupForms();
    try { renderSite(await loadContent()); }
    catch (error) { console.error(error); toast(error.message || 'The site is temporarily unavailable.'); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
