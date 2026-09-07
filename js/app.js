// ==========================================================================
// app.js — সিনেবক্স-এর মূল লজিক। কী-গুলোর জন্য config.js দেখুন।
// ==========================================================================

const IMG = 'https://image.tmdb.org/t/p/w342';
const IMG_BACKDROP = 'https://image.tmdb.org/t/p/w780';
const IMG_PROFILE = 'https://image.tmdb.org/t/p/w185';
const FAV_KEY = 'cinebox_favorites';

// ---------------------------------------------------------------- TMDB core
async function tmdb(path, params = '') {
  const url = `https://api.themoviedb.org/3${path}?api_key=${CONFIG.TMDB_API_KEY}&language=${CONFIG.LANG}${params}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status_code) throw new Error(data.status_message || 'TMDB error');
  return data;
}

function showKeyIssue(rowId, msg) {
  const row = document.getElementById(rowId);
  row.innerHTML = `<div class="key-issue" style="margin:0;">${msg}</div>`;
}

// ---------------------------------------------------------------- Favorites
function getFavs() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
  catch (e) { return []; }
}
function isFav(id, type) {
  return getFavs().some(f => f.id === id && f.type === type);
}
function toggleFav(item) {
  let favs = getFavs();
  const exists = favs.some(f => f.id === item.id && f.type === item.type);
  if (exists) favs = favs.filter(f => !(f.id === item.id && f.type === item.type));
  else favs.unshift(item);
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  document.querySelectorAll(`.fav-btn[data-id="${item.id}"][data-type="${item.type}"]`)
    .forEach(b => b.classList.toggle('active', !exists));
  if (currentDetailId === item.id && currentDetailType === item.type) {
    overlayFav.classList.toggle('active', !exists);
  }
  if (document.getElementById('listTab').style.display !== 'none') renderFavGrid();
}

function renderFavGrid() {
  const grid = document.getElementById('favGrid');
  const favs = getFavs();
  grid.innerHTML = '';
  if (!favs.length) {
    grid.innerHTML = `<div class="center-note" style="width:100%;">এখনো কিছু যোগ করেননি।<br>যেকোনো মুভির পোস্টারে ♥ চেপে তালিকায় যোগ করুন।</div>`;
    return;
  }
  favs.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="poster" style="background-image:url('${item.poster}')">
        <div class="fav-btn active" data-id="${item.id}" data-type="${item.type}">♥</div>
      </div>
      <div class="title">${item.title}</div>`;
    card.querySelector('.fav-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleFav(item); });
    card.addEventListener('click', () => item.type === 'movie' ? openDetail(item.id) : openFreeDetailById(item));
    grid.appendChild(card);
  });
}

// ---------------------------------------------------------------- Cards
function skeletonCard() {
  const d = document.createElement('div');
  d.className = 'card';
  d.innerHTML = `<div class="poster skeleton"></div><div class="title skeleton" style="height:14px;border-radius:4px;margin-top:8px;"></div>`;
  return d;
}

function movieCard(m) {
  const d = document.createElement('div');
  d.className = 'card';
  const poster = m.poster_path ? `${IMG}${m.poster_path}` : '';
  const fav = isFav(m.id, 'movie');
  d.innerHTML = `
    <div class="poster" style="background-image:url('${poster}')">
      <div class="rating">★ ${(m.vote_average || 0).toFixed(1)}</div>
      <div class="fav-btn ${fav ? 'active' : ''}" data-id="${m.id}" data-type="movie">♥</div>
    </div>
    <div class="title">${m.title || m.name || 'শিরোনাম নেই'}</div>`;
  d.querySelector('.fav-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFav({ id: m.id, type: 'movie', title: m.title || m.name, poster });
  });
  d.addEventListener('click', () => openDetail(m.id));
  return d;
}

function freeMovieCard(item) {
  const d = document.createElement('div');
  d.className = 'card';
  const thumb = item.snippet.thumbnails.medium.url;
  const videoId = item.id.videoId;
  const fav = isFav(videoId, 'free');
  d.innerHTML = `
    <div class="poster" style="background-image:url('${thumb}'); height:120px;">
      <div class="rating">▶ ফ্রি</div>
      <div class="fav-btn ${fav ? 'active' : ''}" data-id="${videoId}" data-type="free">♥</div>
    </div>
    <div class="title">${item.snippet.title}</div>`;
  d.querySelector('.fav-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFav({ id: videoId, type: 'free', title: item.snippet.title, poster: thumb, description: item.snippet.description });
  });
  d.addEventListener('click', () => openFreeDetail(item));
  return d;
}

// ---------------------------------------------------------------- Rows
async function fillRow(rowId, path, params = '') {
  const row = document.getElementById(rowId);
  row.innerHTML = '';
  for (let i = 0; i < 6; i++) row.appendChild(skeletonCard());
  try {
    const data = await tmdb(path, params);
    row.innerHTML = '';
    (data.results || []).slice(0, 14).forEach(m => row.appendChild(movieCard(m)));
    if (!(data.results || []).length) row.innerHTML = `<div class="empty-note">কিছু পাওয়া যায়নি।</div>`;
  } catch (e) {
    showKeyIssue(rowId, 'TMDB API কী-তে সমস্যা হয়েছে — js/config.js ফাইলে কী-টি যাচাই করুন।');
  }
}

async function fillFreeRow() {
  const row = document.getElementById('rowFree');
  row.innerHTML = '';
  if (!CONFIG.YOUTUBE_API_KEY) {
    row.innerHTML = `<div class="empty-note">js/config.js-এ YOUTUBE_API_KEY যোগ করলে এই সেকশন চালু হবে।</div>`;
    return;
  }
  for (let i = 0; i < 6; i++) row.appendChild(skeletonCard());
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CONFIG.FREE_MOVIES_CHANNEL_ID}&maxResults=16&order=viewCount&type=video&videoDuration=long&videoEmbeddable=true&key=${CONFIG.YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    row.innerHTML = '';
    if (data.error) { showKeyIssue('rowFree', 'YouTube API কী-তে সমস্যা হয়েছে — js/config.js ফাইলে কী-টি যাচাই করুন।'); return; }
    (data.items || []).forEach(item => row.appendChild(freeMovieCard(item)));
    if (!(data.items || []).length) row.innerHTML = `<div class="empty-note">এই মুহূর্তে কোনো মুভি পাওয়া যায়নি।</div>`;
  } catch (e) {
    showKeyIssue('rowFree', 'লোড করা যায়নি, আবার চেষ্টা করুন।');
  }
}

// ---------------------------------------------------------------- Hero
const heroBgs = [];
let heroIdx = 0;
async function setupHero() {
  try {
    const data = await tmdb('/trending/movie/week');
    const withBackdrop = (data.results || []).filter(m => m.backdrop_path);
    if (!withBackdrop.length) return;
    let i = 0;
    function show() {
      const m = withBackdrop[i % withBackdrop.length];
      const bg = heroBgs[heroIdx % 2];
      bg.style.backgroundImage = `url('${IMG_BACKDROP}${m.backdrop_path}')`;
      heroBgs.forEach(b => b.classList.remove('active'));
      bg.classList.add('active');
      heroIdx++; i++;
    }
    show();
    setInterval(show, 6000);
  } catch (e) { /* hero is decorative — fail silently */ }
}

// ---------------------------------------------------------------- Genres
async function fillGenreChips() {
  const wrap = document.getElementById('genreChips');
  try {
    const data = await tmdb('/genre/movie/list');
    const all = { id: null, name: 'সব' };
    [all, ...(data.genres || [])].forEach(g => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (g.id === null ? ' active' : '');
      chip.textContent = g.name;
      chip.addEventListener('click', () => {
        wrap.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (g.id === null) fillRow('rowTrending', '/trending/movie/week');
        else fillRow('rowTrending', '/discover/movie', `&with_genres=${g.id}&sort_by=popularity.desc`);
      });
      wrap.appendChild(chip);
    });
  } catch (e) { /* chips are optional enhancement */ }
}

// ---------------------------------------------------------------- Detail overlay
const detailOverlay = document.getElementById('detailOverlay');
const overlayFav = document.getElementById('overlayFav');
let currentDetailId = null, currentDetailType = null;

document.getElementById('closeDetail').addEventListener('click', () => {
  detailOverlay.classList.remove('open');
  document.getElementById('detailTrailer').innerHTML = '';
});

async function openDetail(id) {
  detailOverlay.classList.add('open');
  currentDetailId = id; currentDetailType = 'movie';
  document.getElementById('castSection').style.display = 'block';
  document.getElementById('trailerSubhead').textContent = 'ট্রেলার';
  document.getElementById('detailTitle').textContent = 'লোড হচ্ছে...';
  document.getElementById('detailMeta').innerHTML = '';
  document.getElementById('detailOverview').textContent = '';
  document.getElementById('detailCast').innerHTML = '';
  document.getElementById('detailTrailer').innerHTML = '';
  overlayFav.classList.remove('active');

  let m;
  try {
    m = await tmdb(`/movie/${id}`, '&append_to_response=credits,videos');
  } catch (e) {
    document.getElementById('detailTitle').textContent = 'লোড করা যায়নি';
    document.getElementById('detailOverview').textContent = 'TMDB API কী-তে সমস্যা হয়েছে।';
    return;
  }
  if (!m.overview) {
    try {
      const en = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${CONFIG.TMDB_API_KEY}&language=${CONFIG.FALLBACK_LANG}&append_to_response=credits,videos`).then(r => r.json());
      m.overview = en.overview || m.overview;
      if (!m.credits || !m.credits.cast || !m.credits.cast.length) m.credits = en.credits;
      if (!m.videos || !m.videos.results || !m.videos.results.length) m.videos = en.videos;
    } catch (e) { /* keep whatever we have */ }
  }

  const poster = m.poster_path ? `${IMG}${m.poster_path}` : '';
  overlayFav.classList.toggle('active', isFav(id, 'movie'));
  overlayFav.onclick = () => toggleFav({ id, type: 'movie', title: m.title, poster });

  document.getElementById('detailBackdrop').style.backgroundImage = m.backdrop_path ? `url('${IMG_BACKDROP}${m.backdrop_path}')` : '';
  document.getElementById('detailTitle').textContent = m.title || 'শিরোনাম নেই';
  const year = (m.release_date || '').slice(0, 4);
  const runtime = m.runtime ? `${m.runtime} মিনিট` : '';
  const genres = (m.genres || []).map(g => g.name).join(', ');
  document.getElementById('detailMeta').innerHTML = `
    <span><b>★ ${(m.vote_average || 0).toFixed(1)}</b></span>
    ${year ? `<span>${year}</span>` : ''}
    ${runtime ? `<span>${runtime}</span>` : ''}
    ${genres ? `<span>${genres}</span>` : ''}`;
  document.getElementById('detailOverview').textContent = m.overview || 'বিবরণ পাওয়া যায়নি।';

  const castRow = document.getElementById('detailCast');
  const cast = (m.credits && m.credits.cast) ? m.credits.cast.slice(0, 10) : [];
  castRow.innerHTML = cast.length ? '' : '<div class="empty-note">কাস্ট তথ্য পাওয়া যায়নি।</div>';
  cast.forEach(c => {
    const pic = c.profile_path ? `${IMG_PROFILE}${c.profile_path}` : '';
    const el = document.createElement('div');
    el.className = 'cast-item';
    el.innerHTML = `<div class="pic" style="background-image:url('${pic}')"></div><div class="nm">${c.name}</div>`;
    castRow.appendChild(el);
  });

  const vids = (m.videos && m.videos.results) ? m.videos.results : [];
  const trailer = vids.find(v => v.type === 'Trailer' && v.site === 'YouTube') || vids.find(v => v.site === 'YouTube');
  const tWrap = document.getElementById('detailTrailer');
  tWrap.innerHTML = trailer
    ? `<div class="trailer-wrap"><iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen></iframe></div>`
    : '<div class="empty-note">এই মুভির জন্য কোনো ট্রেলার পাওয়া যায়নি।</div>';
}

function openFreeDetail(item) {
  const videoId = item.id.videoId;
  const thumb = item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : item.snippet.thumbnails.medium.url;
  renderFreeDetail({
    id: videoId, type: 'free', title: item.snippet.title, poster: thumb, description: item.snippet.description,
  });
}
function openFreeDetailById(item) {
  // used when opening from the favorites list (no live YouTube item object)
  renderFreeDetail(item);
}
function renderFreeDetail(item) {
  detailOverlay.classList.add('open');
  currentDetailId = item.id; currentDetailType = 'free';
  document.getElementById('detailBackdrop').style.backgroundImage = `url('${item.poster}')`;
  document.getElementById('detailTitle').textContent = item.title;
  document.getElementById('detailMeta').innerHTML = `<span><b>পাবলিক ডোমেইন</b></span><span>YouTube-এ ফ্রি</span>`;
  document.getElementById('detailOverview').textContent = item.description || 'কোনো বিবরণ পাওয়া যায়নি।';
  document.getElementById('castSection').style.display = 'none';
  document.getElementById('trailerSubhead').textContent = 'সম্পূর্ণ মুভি দেখুন';
  document.getElementById('detailTrailer').innerHTML = `<div class="trailer-wrap"><iframe src="https://www.youtube.com/embed/${item.id}?autoplay=1" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
  overlayFav.classList.toggle('active', isFav(item.id, 'free'));
  overlayFav.onclick = () => toggleFav(item);
}

// ---------------------------------------------------------------- Search
let searchTimer;
document.getElementById('searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  const resultsBox = document.getElementById('searchResults');
  const mainBox = document.getElementById('mainSections');
  if (!q) { resultsBox.style.display = 'none'; mainBox.style.display = 'block'; return; }
  searchTimer = setTimeout(async () => {
    mainBox.style.display = 'none';
    resultsBox.style.display = 'block';
    resultsBox.innerHTML = `<div class="section-head" style="padding:18px 18px 10px;"><h2>ফলাফল</h2></div>`;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;padding:0 18px;';
    resultsBox.appendChild(row);
    try {
      const data = await tmdb('/search/movie', `&query=${encodeURIComponent(q)}`);
      (data.results || []).forEach(m => { const c = movieCard(m); c.style.flex = '0 0 120px'; row.appendChild(c); });
      if (!(data.results || []).length) row.innerHTML = '<div class="empty-note">কোনো ফলাফল পাওয়া যায়নি।</div>';
    } catch (e) {
      row.innerHTML = '<div class="key-issue">TMDB API কী-তে সমস্যা হয়েছে।</div>';
    }
  }, 450);
});

// ---------------------------------------------------------------- Bottom nav / tabs
const homeTab = document.getElementById('homeTab');
const listTab = document.getElementById('listTab');
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const tab = item.dataset.tab;
    if (tab === 'list') {
      homeTab.style.display = 'none'; listTab.style.display = 'block';
      renderFavGrid();
    } else {
      homeTab.style.display = 'block'; listTab.style.display = 'none';
      if (tab === 'search') { document.getElementById('searchInput').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
  });
});

document.getElementById('refreshBtn').addEventListener('click', () => location.reload());

// ---------------------------------------------------------------- Install prompt
let deferredPrompt = null;
const installBanner = document.getElementById('installBanner');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!localStorage.getItem('cinebox_install_dismissed')) installBanner.classList.add('show');
});
document.getElementById('installBtn').addEventListener('click', async () => {
  installBanner.classList.remove('show');
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});
document.getElementById('dismissInstall').addEventListener('click', () => {
  installBanner.classList.remove('show');
  localStorage.setItem('cinebox_install_dismissed', '1');
});

// ---------------------------------------------------------------- Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// ---------------------------------------------------------------- Init
function init() {
  heroBgs.push(document.getElementById('heroBg1'), document.getElementById('heroBg2'));
  setupHero();
  fillGenreChips();
  fillRow('rowTrending', '/trending/movie/week');
  fillRow('rowTop', '/movie/top_rated');
  fillRow('rowUpcoming', '/movie/upcoming');
  fillFreeRow();
}
init();
