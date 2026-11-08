// Yeryüzü Sızıntısı: beğeni, okur sayısı, onaylı yorum ve günlük ziyaretçi
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, doc, addDoc, setDoc, getDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, getCountFromServer } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyAdkwMyytWSek2RvQ6B_bKs92xyrei_lzI",
  authDomain: "yeryuzu-sizintisi.firebaseapp.com",
  projectId: "yeryuzu-sizintisi",
  storageBucket: "yeryuzu-sizintisi.firebasestorage.app",
  messagingSenderId: "452663303676",
  appId: "1:452663303676:web:f69a5eeff2fea34e112679",
  measurementId: "G-KWZDMBW1HG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const store = {
  get(k, d = '') { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
const $ = (id) => document.getElementById(id);
const esc = (t) => { const d = document.createElement('div'); d.textContent = String(t ?? ''); return d.innerHTML; };
const toast = (m) => (window.showToast ? window.showToast(m) : console.log(m));
const postCol = (id, sub) => collection(db, 'posts', String(id), sub);

// Firestore'da yazının klasör adı: "12-yazinin-basligi"
// Bir yazının başlığını sonradan değiştirirsen eski adı buraya yaz: { 12: '12-eski-baslik' }
const KEY_PINS = {};
const TR = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
function postKey(post) {
  if (post.number == null) return String(post.id);
  if (KEY_PINS[post.number]) return KEY_PINS[post.number];
  const slug = String(post.title || '').toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => TR[c])
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '');
  return post.number + (slug ? '-' + slug : '');
}

// Her tarayıcıya gizli, anonim bir kimlik verir (giriş gerekmez)
let uidPromise = null;
function getUid() {
  if (!uidPromise) {
    uidPromise = signInAnonymously(auth).then((c) => c.user.uid).catch((e) => { uidPromise = null; throw e; });
  }
  return uidPromise;
}

// ---------- Günlük ziyaretçi: gün başına tarayıcı başına 1 kayıt ----------
async function recordDailyVisit() {
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  if (store.get('ys_daily') === day) return;
  try {
    const uid = await getUid();
    await setDoc(doc(db, 'daily', day, 'visitors', uid), { createdAt: serverTimestamp() });
  } catch (e) {
    if (e.code !== 'permission-denied') { console.warn('Günlük ziyaret kaydedilemedi:', e); return; }
  }
  store.set('ys_daily', day);
}

// ---------- Okur kaydı: yazı başına kişi başına 1 kayıt ----------
async function markRead(id) {
  const key = 'ys_read_' + id;
  if (store.get(key)) return;
  try {
    const uid = await getUid();
    await setDoc(doc(db, 'posts', String(id), 'readers', uid), { createdAt: serverTimestamp() });
  } catch (e) { if (e.code !== 'permission-denied') throw e; }
  store.set(key, '1');
}

// ---------- Arayüz stilleri ----------
const style = document.createElement('style');
style.textContent = `
.engage-bar{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-top:2.2rem}
.like-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.55rem 1.1rem;border-radius:999px;border:1px solid var(--glass-border);background:var(--surface-soft);color:var(--text-muted);cursor:pointer;font-size:.9rem;font-weight:600;transition:all .25s var(--ease-out)}
.like-btn:hover:not(:disabled){color:var(--accent-green-light);border-color:var(--accent-green-light);transform:translateY(-2px)}
.like-btn.liked{background:linear-gradient(135deg,var(--accent-green-primary),var(--accent-green-secondary));color:#fff;border-color:transparent;box-shadow:0 6px 16px rgba(39,73,58,.35)}
.like-btn.liked i{animation:pop .45s var(--ease-spring)}
.like-btn:disabled{opacity:.6;cursor:default}
.engage-stat{color:var(--text-muted);font-size:.85rem;display:inline-flex;align-items:center;gap:.4rem}
.engage-stat i{color:var(--accent-green-light)}
.comments-title{font-size:1.15rem;font-weight:700;display:flex;align-items:center;gap:.5rem}
.comments-title i{color:var(--accent-green-secondary)}
.comment-form{display:flex;flex-direction:column;gap:.7rem;margin:1.2rem 0 1.6rem}
.comment-name{padding:.75rem 1.1rem;border:1px solid var(--glass-border);border-radius:14px;background:var(--surface-soft);color:var(--text-main);font-size:.92rem;transition:all .3s}
.comment-name:focus{outline:none;border-color:var(--accent-green-secondary);box-shadow:0 0 0 3px var(--ring-color)}
.comment-name::placeholder,.comment-input::placeholder{color:var(--text-muted)}
.comment-form-footer{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.comment-note{color:var(--text-muted);font-size:.8rem}
.comment-submit:disabled{opacity:.6;cursor:default;transform:none}
.comment-head{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap;margin-bottom:.35rem}
.comment-date{color:var(--text-muted);font-size:.78rem}
.comment-text{white-space:pre-wrap;word-break:break-word;font-size:.95rem}
.comment-empty{color:var(--text-muted);font-size:.9rem;font-style:italic}`;
document.head.appendChild(style);

// ---------- Yazı penceresi mantığı ----------
let activeId = null;
let unsubComments = null;
let like = { liked: false, count: 0, busy: false };
let activePost = null;
let activeKey = null;

function teardown() {
  if (unsubComments) unsubComments();
  unsubComments = null;
  activeId = null;
  activePost = null;
  activeKey = null;
}

function engagementHtml() {
  return `
  <div class="engage-bar">
    <button type="button" id="likeBtn" class="like-btn" disabled aria-label="Yazıyı beğen"><i class="far fa-thumbs-up"></i><span>Beğen</span><span id="likeCount">–</span></button>
    <button type="button" id="shareBtn" class="like-btn" aria-label="Yazının bağlantısını paylaş"><i class="fas fa-share-nodes"></i><span>Paylaş</span></button>
    <span class="engage-stat"><i class="far fa-comment"></i> <span id="commentCount">–</span> yorum</span>
  </div>
  <section class="comments-section">
    <h3 class="comments-title"><i class="far fa-comments"></i> Yorumlar</h3>
    <div class="comment-form">
      <input type="text" id="commentName" class="comment-name" maxlength="40" placeholder="Adınız (isteğe bağlı)">
      <textarea id="commentText" class="comment-input" maxlength="1000" placeholder="Yorumunuzu yazın..."></textarea>
      <div class="comment-form-footer">
        <span class="comment-note">Yorumlar onaylandıktan sonra yayınlanır.</span>
        <button type="button" id="commentSubmit" class="comment-submit">Yorumu gönder</button>
      </div>
    </div>
    <div id="commentList"><p class="comment-empty">Yorumlar yükleniyor...</p></div>
  </section>`;
}

function renderLike() {
  const b = $('likeBtn');
  if (!b) return;
  b.classList.toggle('liked', like.liked);
  b.querySelector('i').className = (like.liked ? 'fas' : 'far') + ' fa-thumbs-up';
  $('likeCount').textContent = like.count;
}

function renderComments(items) {
  const list = $('commentList');
  if (!list) return;
  items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  const cnt = $('commentCount');
  if (cnt) cnt.textContent = items.length;
  list.innerHTML = items.length ? items.map((c) => `
    <div class="comment-card">
      <div class="comment-head">
        <span class="comment-user">${esc(c.userName || 'Okur')}</span>
        <span class="comment-date">${c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('tr-TR') : ''}</span>
      </div>
      <p class="comment-text">${esc(c.text)}</p>
    </div>`).join('') : '<p class="comment-empty">Henüz onaylanmış yorum yok. İlk yorumu sen yaz.</p>';
}

async function onLike() {
  if (like.busy || !activeId) return;
  const id = activeId, key = activeKey, was = like.liked;
  like = { liked: !was, count: like.count + (was ? -1 : 1), busy: true };
  renderLike();
  try {
    const uid = await getUid();
    const ref = doc(db, 'posts', key, 'likes', uid);
    if (was) await deleteDoc(ref); else await setDoc(ref, { createdAt: serverTimestamp() });
  } catch (e) {
    console.warn(e);
    if (activeId === id) { like = { liked: was, count: like.count + (was ? 1 : -1), busy: false }; renderLike(); }
    toast('Beğeni kaydedilemedi');
    return;
  }
  like.busy = false;
}

async function onSubmitComment() {
  const id = activeId, key = activeKey, btn = $('commentSubmit'), t = $('commentText'), n = $('commentName');
  if (!id || !btn || !t || !n) return;
  const text = t.value.trim(), name = n.value.trim().slice(0, 40);
  if (text.length < 2) { toast('Lütfen bir yorum yazın'); return; }
  if (Date.now() - Number(store.get('ys_last_comment', '0')) < 30000) { toast('Yeni bir yorum için biraz bekleyin'); return; }
  btn.disabled = true;
  try {
    const uid = await getUid();
    await addDoc(postCol(key, 'comments'), {
      text: text.slice(0, 1000), userName: name || 'Okur', createdAt: serverTimestamp(), uid, approved: false
    });
    store.set('ys_last_comment', String(Date.now()));
    store.set('ys_name', name);
    t.value = '';
    toast('Yorumunuz alındı, onaylandıktan sonra yayınlanacak');
  } catch (e) {
    console.warn(e);
    toast('Yorum gönderilemedi, lütfen tekrar deneyin');
  }
  btn.disabled = false;
}

async function setup(post) {
  teardown();
  const body = $('modalBody');
  if (post.fallback || !body) return;
  const id = post.id;
  activeId = id;
  activePost = post;
  activeKey = postKey(post);
  const key = activeKey;

  body.insertAdjacentHTML('beforeend', engagementHtml());
  const meta = body.querySelector('.post-meta');
  if (meta) {
    const s = document.createElement('span');
    s.innerHTML = '<i class="far fa-eye"></i><span id="readerCount">–</span> okur';
    meta.insertBefore(s, $('modalSaveBtn'));
  }
  $('commentName').value = store.get('ys_name');
  $('likeBtn').addEventListener('click', onLike);
  $('shareBtn').addEventListener('click', onShare);
  $('commentSubmit').addEventListener('click', onSubmitComment);

  // Yalnızca onaylı yorumlar okunabilir (kurallar da bunu zorunlu kılar)
  unsubComments = onSnapshot(
    query(postCol(key, 'comments'), where('approved', '==', true)),
    (snap) => { if (activeId === id) renderComments(snap.docs.map((d) => d.data())); },
    (err) => {
      console.warn('Yorumlar okunamadı:', err);
      const l = $('commentList');
      if (l && activeId === id) l.innerHTML = '<p class="comment-empty">Yorumlar şu an yüklenemedi.</p>';
    }
  );

  try {
    await markRead(key).catch((e) => console.warn('Okur kaydı:', e));
    const uid = await getUid();
    const [l, r, mine] = await Promise.all([
      getCountFromServer(postCol(key, 'likes')),
      getCountFromServer(postCol(key, 'readers')),
      getDoc(doc(db, 'posts', key, 'likes', uid))
    ]);
    if (activeId !== id) return;
    like = { liked: mine.exists(), count: l.data().count, busy: false };
    const rc = $('readerCount');
    if (rc) rc.textContent = r.data().count;
    $('likeBtn').disabled = false;
    renderLike();
  } catch (e) {
    console.warn('İstatistikler alınamadı:', e);
  }
}

// ---------- Mevcut sayfaya bağlan ----------
const originalOpen = window.openModal;
if (typeof originalOpen === 'function') {
  window.openModal = function (post) { originalOpen(post); setup(post); setHash(post); };
}
const modal = $('postModal');
if (modal) {
  new MutationObserver(() => { if (!modal.classList.contains('is-open')) { teardown(); clearHash(); } })
    .observe(modal, { attributes: true, attributeFilter: ['class'] });
}

// ---------- Yazı bağlantısı: #yazi-NUMARA ----------
const slugOf = (p) => '#yazi-' + (p.number ?? p.id);
const postUrl = (p) => location.origin + location.pathname + slugOf(p);

function setHash(post) {
  if (post.fallback) return;
  try { history.replaceState(null, '', slugOf(post)); } catch (e) {}
}
function clearHash() {
  if (!location.hash.startsWith('#yazi-')) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
}

async function onShare() {
  if (!activePost) return;
  const url = postUrl(activePost), title = activePost.title;
  if (navigator.share) {
    try { await navigator.share({ title, text: title + ' | Yeryüzü Sızıntısı', url }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Yazının bağlantısı kopyalandı'); }
  catch (e) { window.prompt('Bağlantıyı kopyalayın:', url); }
}

// Bağlantıyla gelen ziyaretçi için ilgili yazıyı açar (yazılar yüklenene kadar bekler)
function openFromHash(tries = 0) {
  const m = location.hash.match(/^#yazi-(\d+)$/);
  if (!m) return;
  const list = typeof allPosts !== 'undefined' ? allPosts : [];
  const post = list.find((p) => String(p.number ?? p.id) === m[1]);
  if (post) { if (!activePost || activePost.id !== post.id) window.openModalById(post.id); return; }
  if (list.length) { toast('Bağlantıdaki yazı bulunamadı'); return; }
  if (tries < 40) setTimeout(() => openFromHash(tries + 1), 250);
}
window.addEventListener('hashchange', () => openFromHash());
openFromHash();

recordDailyVisit();
