// nav solid on scroll
  const nav=document.getElementById('nav');
  addEventListener('scroll',()=>nav.classList.toggle('solid',scrollY>40),{passive:true});

  // smooth scroll buttons
  document.querySelectorAll('[data-scroll]').forEach(b=>{
    b.addEventListener('click',()=>document.querySelector(b.dataset.scroll)?.scrollIntoView({behavior:'smooth'}));
  });

  // reveal on scroll
  const io=new IntersectionObserver((es)=>{
    es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
  },{threshold:.12,rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.reveal:not(.in)').forEach(el=>io.observe(el));

  // toast
  const toast=document.getElementById('toast'),tmsg=document.getElementById('toastMsg');
  let tt;
  function showToast(m){tmsg.textContent=m;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>toast.classList.remove('show'),2600);}
  document.querySelectorAll('[data-toast]').forEach(el=>el.addEventListener('click',()=>showToast(el.dataset.toast)));

  // forms
  document.querySelectorAll('[data-form]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const wrap=btn.closest('.signup-form,.secret-form');
      const input=wrap.querySelector('input');
      const v=(input.value||'').trim();
      if(!v||!v.includes('@')){showToast('Enter a valid email to join');input.focus();return;}
      const msg=btn.dataset.form==='secret'?"You're on the waitlist. Watch your inbox.":"Welcome to the dream. Check your email.";
      showToast(msg);input.value='';
    });
  });

  // burger -> simple scroll to contact (mock)
  document.getElementById('burger').addEventListener('click',()=>document.getElementById('contact').scrollIntoView({behavior:'smooth'}));

  // subtle parallax on hero visual
  const hv=document.querySelector('.hero-visual');
  if(hv&&matchMedia('(min-width:980px)').matches){
    addEventListener('mousemove',e=>{
      const x=(e.clientX/innerWidth-.5),y=(e.clientY/innerHeight-.5);
      hv.style.transform=`translate(${x*14}px,${y*12}px)`;
    },{passive:true});
  }

// Client media slots: keep the page polished before the final files are supplied.
document.querySelectorAll('.video-frame video').forEach(video => {
  const frame = video.closest('.video-frame');
  video.addEventListener('loadeddata', () => frame?.classList.add('video-ready'));
  video.addEventListener('error', () => frame?.classList.remove('video-ready'));
});
