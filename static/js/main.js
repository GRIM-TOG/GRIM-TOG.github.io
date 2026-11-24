(() => {
  // ---- reveal on scroll ----
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // ---- nav: show after hero, highlight current section ----
  const nav = document.getElementById('nav');
  const hero = document.getElementById('top');
  new IntersectionObserver(([e]) => nav.classList.toggle('show', !e.isIntersecting), { threshold: 0.12 }).observe(hero);
  const links = [...nav.querySelectorAll('.nav-links a')];
  const byId = Object.fromEntries(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const secObs = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const id = e.target.id === 'fga' ? 'hor' : e.target.id;
    links.forEach((a) => a.classList.toggle('active', a === byId[id]));
  }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main > section').forEach((s) => secObs.observe(s));

  // ---- lite YouTube embed ----
  const yt = document.querySelector('.yt');
  yt.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${yt.dataset.id}?autoplay=1&rel=0`;
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.allowFullscreen = true;
    f.title = 'GRIM project video';
    yt.replaceChildren(f);
  }, { once: true });

  // ---- approach tabs ----
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.toggle('is-active', x === t));
    panels.forEach((p, i) => p.classList.toggle('is-active', String(i) === t.dataset.tab));
  }));

  // ---- lightbox ----
  const lb = document.getElementById('lightbox');
  document.querySelectorAll('.zoomable').forEach((img) => img.addEventListener('click', () => {
    lb.firstElementChild.src = img.src; lb.hidden = false;
  }));
  lb.addEventListener('click', () => { lb.hidden = true; });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.hidden = true; });

  // ---- Veo 2 video grid (load + play only while on screen) ----
  const VIDEOS = [
    ['strainer_handle', 'Strainer', 'Lift the strainer and place it over a container'],
    ['mug_body', 'Mug', 'Pick up the mug and place it somewhere else'],
    ['tongs_tip', 'Tongs', 'Pick up the tongs and prepare them for storage'],
    ['pitcher', 'Pitcher', 'Pick up the pitcher and pour liquid into a container'],
    ['flashlight', 'Flashlight', 'Use the flashlight to look around an area'],
    ['hanger', 'Hanger', 'Pick up the coat hanger and hang it on a rack or rod'],
    ['spoon', 'Spoon', 'Pick up the spoon and stir contents'],
    ['sponge', 'Sponge', 'Pick up the sponge and clean a surface'],
    ['ice_scrapper', 'Ice scraper', 'Clear the ice scraper from the surface'],
    ['bottle', 'Bottle', 'Handle the bottle to place it carefully'],
    ['charger', 'Charger', 'Lift the charger to manage the cable'],
    ['garlic_press', 'Garlic press', 'Crush garlic for cooking'],
  ];
  const grid = document.getElementById('vgrid');
  const vio = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.src) v.src = v.dataset.src;
      v.play().catch(() => {});
    } else v.pause();
  }), { threshold: 0.35 });
  VIDEOS.forEach(([f, obj, cap], i) => {
    const fig = document.createElement('figure');
    fig.className = 'vcard reveal';
    fig.style.transitionDelay = `${(i % 3) * 60}ms`;
    fig.innerHTML = `<video muted loop playsinline preload="none" poster="media/gemini_gen_videos/posters/${f}.webp" data-src="media/gemini_gen_videos/${f}.mp4"></video>
      <span class="obj">${obj}</span><figcaption>${cap}</figcaption>`;
    grid.appendChild(fig);
    io.observe(fig);
    vio.observe(fig.firstElementChild);
  });

  // ---- BibTeX copy ----
  const btn = document.getElementById('copy-bib');
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(document.getElementById('bib-text').textContent); btn.textContent = 'Copied!'; }
    catch { btn.textContent = 'Press Ctrl+C'; }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
  });
})();
