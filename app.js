const get = id => document.getElementById(id);
const stage = get('stage');
const film = get('film');
const music = get('music');

function startMusic() {
  if (music.paused) music.play().catch(() => {});
}

document.addEventListener('pointerdown', startMusic, { passive: true });
document.addEventListener('keydown', startMusic);
const textCanvas = get('manifesto');
const textContext = textCanvas.getContext('2d');
const water = new WaterRipple(get('water'), film);
const flowers = window.FLOWERS;
const boxes = {
  tulip: { x: .312, y: .702, w: .084, h: .148 },
  rose: { x: .398, y: .65, w: .15, h: .27 },
  orchid: { x: .484, y: .325, w: .31, h: .44 },
  calla: { x: .664, y: .365, w: .17, h: .37 },
  lily: { x: .441, y: .755, w: .20, h: .31 }
};
let scene = 'home';
let index = 0;
let stopped = false;
let lastTextFrame = -1;
let finaleReturn = null;
let operation = 0;
let introTimer;
let abortLoad;
let busy = false;
let pointerStart;
let lastPointer;
let lastWave = 0;

function show(id, visible) { get(id).hidden = !visible; }

function setScene(next) {
  operation++;
  abortLoad?.abort();
  busy = false;
  film.pause();
  clearTimeout(introTimer);
  stage.removeAttribute('data-intro');
  scene = next;
  stopped = false;
  stage.dataset.scene = next;
  stage.style.removeProperty('--focus-x');
  stage.style.removeProperty('--focus-y');
  water.clear();
  textContext.clearRect(0, 0, textCanvas.width, textCanvas.height);
  lastTextFrame = -1;
  lastPointer = pointerStart = null;
  show('home', next === 'home');
  show('back', next !== 'home');
  show('skip', next === 'manifesto' || next === 'aigc');
  show('advance', next === 'manifesto');
  for (const id of ['hotspot', 'stop-frame', 'continue', 'restart', 'status', 'play']) show(id, false);
  get('transcript').textContent = next === 'manifesto' ? flowers[index].text : '';
}

function waitFor(event, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('The film took too long to load.')), 15000);
    function finish(error) {
      clearTimeout(timeout);
      film.removeEventListener(event, ready);
      film.removeEventListener('error', failed);
      signal.removeEventListener('abort', canceled);
      if (error) reject(error);
      else resolve();
    }
    const ready = () => finish();
    const failed = () => finish(new Error('The film could not be opened.'));
    const canceled = () => finish(new DOMException('Canceled', 'AbortError'));
    film.addEventListener(event, ready, { once: true });
    film.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', canceled, { once: true });
  });
}

async function play() {
  const token = operation;
  try {
    await film.play();
    if (token === operation) show('play', false);
  } catch {
    if (token === operation) show('play', true);
  }
}

async function loadFilm(name, { time = 0, loop = false, paused = false } = {}) {
  const token = ++operation;
  abortLoad?.abort();
  abortLoad = new AbortController();
  const { signal } = abortLoad;
  busy = true;
  film.poster = 'assets/images/garden.jpg';
  film.loop = loop;
  const src = 'assets/videos/' + name + '.mp4';
  try {
    if (film.getAttribute('src') !== src || film.readyState === 0) {
      const ready = waitFor('loadedmetadata', signal);
      film.src = src;
      film.load();
      await ready;
    }
    if (token !== operation) return;
    if (Math.abs(film.currentTime - time) > .02) {
      const seeked = waitFor('seeked', signal);
      film.currentTime = time;
      await seeked;
    }
    if (token !== operation) return;
    busy = false;
    if (!paused) await play();
  } catch (error) {
    if (token !== operation || signal.aborted) return;
    busy = false;
    get('status').textContent = error.message + ' Go back to try again.';
    show('status', true);
  }
}

function goHome(showIntro = false) {
  setScene('home');
  if (showIntro) {
    stage.setAttribute('data-intro', '');
    introTimer = setTimeout(() => stage.removeAttribute('data-intro'), 2500);
  }
  loadFilm('opening', { loop: true });
}

function showGarden(time = 0, freeze = false) {
  setScene('garden');
  if (freeze) stopGarden();
  loadFilm('opening', { time, paused: freeze });
}

function stopGarden() {
  stopped = true;
  film.pause();
  const flower = flowers[index];
  get('stop-frame').src = 'assets/images/' + flower.id + '-stop.jpg';
  get('hotspot').firstElementChild.textContent = flower.en;
  get('hotspot').setAttribute('aria-label', 'Open the ' + flower.en.toLowerCase() + ' manifesto');
  placeHotspot();
  show('stop-frame', true);
  show('hotspot', true);
  show('play', false);
}

function placeHotspot() {
  if (!stopped) return;
  const box = boxes[flowers[index].id];
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const frameW = Math.max(w, h * 16 / 9);
  const frameH = frameW * 9 / 16;
  const crop = frameW - w;
  // Anchor the cover crop on the target when a narrow screen would crop it out.
  const objectPosition = crop > 0 ? Math.max(0, Math.min(1, (box.x * frameW - w / 2) / crop)) : .5;
  stage.style.setProperty('--focus-x', objectPosition * 100 + '%');
  const verticalCrop = frameH - h;
  const verticalPosition = verticalCrop > 0 ? Math.max(0, Math.min(1, (box.y * frameH - h / 2) / verticalCrop)) : .5;
  stage.style.setProperty('--focus-y', verticalPosition * 100 + '%');
  const hotspot = get('hotspot').style;
  hotspot.left = (box.x * frameW - crop * objectPosition) + 'px';
  hotspot.top = (box.y * frameH - verticalCrop * verticalPosition) + 'px';
  hotspot.width = Math.min(w * .85, Math.max(72, box.w * frameW)) + 'px';
  hotspot.height = Math.min(h * .60, Math.max(64, box.h * frameH)) + 'px';
}

function showManifesto() {
  setScene('manifesto');
  loadFilm(flowers[index].id, { loop: true });
}

function showAigc(time = 0) {
  setScene('aigc');
  show('continue', true);
  loadFilm(flowers[index].id + '-aigc', { time });
}

function showFinale() {
  finaleReturn = { scene, index, time: film.currentTime };
  setScene('finale');
  show('restart', true);
  loadFilm('finale');
}

function nextFlower() {
  if (index === flowers.length - 1) {
    showFinale();
    return;
  }
  const time = flowers[index].time + .12;
  index++;
  showGarden(time);
}

function back() {
  if (scene === 'garden') goHome();
  else if (scene === 'manifesto') showGarden(flowers[index].time, true);
  else if (scene === 'aigc') showManifesto();
  else if (scene === 'finale' && finaleReturn) {
    index = finaleReturn.index;
    if (finaleReturn.scene === 'aigc') showAigc(Math.min(finaleReturn.time, 14.5));
    else showManifesto();
  }
}

function reset() {
  index = 0;
  finaleReturn = null;
  goHome(true);
}

get('home').onclick = () => { index = 0; showGarden(); };
get('hotspot').onclick = showManifesto;
get('advance').onclick = () => showAigc();
get('back').onclick = back;
get('skip').onclick = showFinale;
get('continue').onclick = nextFlower;
get('restart').onclick = reset;
get('play').onclick = play;
stage.addEventListener('click', event => {
  if (scene === 'manifesto' && !event.target.closest('button') && event.detail === 0) showAigc();
});
film.addEventListener('ended', () => {
  if (scene === 'aigc') nextFlower();
  else if (scene === 'garden' && !stopped) stopGarden();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') back();
});

function rippleEnabled() {
  return scene === 'aigc';
}

stage.addEventListener('pointerdown', event => {
  if (!(rippleEnabled() || scene === 'manifesto') || !event.isPrimary || event.button !== 0 || event.target.closest('button')) return;
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  stage.setPointerCapture?.(event.pointerId);
});

stage.addEventListener('pointermove', event => {
  if (!(rippleEnabled() || scene === 'manifesto') || !event.isPrimary) return;
  const now = performance.now();
  const { clientX: x, clientY: y } = event;
  const step = lastPointer ? Math.hypot(x - lastPointer.x, y - lastPointer.y) : 0;
  const speed = lastPointer ? step / Math.max(8, now - lastPointer.time) : 0;
  lastPointer = { x, y, time: now };
  const drag = pointerStart ? Math.hypot(x - pointerStart.x, y - pointerStart.y) : 0;
  if (pointerStart && drag > 8) pointerStart.moved = true;
  if (!rippleEnabled()) return;
  if (step < 2 || now - lastWave < 45) return;
  const strength = pointerStart ? Math.min(58, 12 + drag * .19 + speed * 8) : Math.min(19, 5 + speed * 5);
  const bounds = stage.getBoundingClientRect();
  water.add((x - bounds.left) / bounds.width, (y - bounds.top) / bounds.height, strength, now);
  lastWave = now;
});

stage.addEventListener('pointerup', event => {
  if (pointerStart?.id !== event.pointerId) return;
  const tapped = !pointerStart.moved && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) <= 8;
  pointerStart = null;
  if (tapped && scene === 'manifesto') showAigc();
});
stage.addEventListener('pointercancel', () => { pointerStart = null; lastPointer = null; });
stage.addEventListener('pointerleave', () => { lastPointer = null; });

function drawManifesto(force = false) {
  if (scene !== 'manifesto') return;
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const flower = flowers[index];
  const mask = window.FLOWER_MASKS[flower.id];
  const frame = Math.min(mask.timeline.length - 1, Math.floor(film.currentTime * mask.fps));
  if (frame === lastTextFrame && !force) return;
  lastTextFrame = frame;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  textCanvas.width = Math.round(width * dpr);
  textCanvas.height = Math.round(height * dpr);
  if (busy) { lastTextFrame = -1; return; }
  textContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vw = film.videoWidth || 1920;
  const vh = film.videoHeight || 1080;
  const scale = Math.max(width / vw, height / vh);
  const rect = { x: (width - vw * scale) / 2, y: (height - vh * scale) / 2, w: vw * scale, h: vh * scale };
  const font = Math.min(64, Math.max(30, width * .034));
  const margin = Math.max(18, Math.min(42, width * .025));
  const words = flower.text.split(/\s+/);
  const rowHeight = font * 1.22;
  const family = getComputedStyle(stage).getPropertyValue('--serif').trim();
  textContext.font = font + 'px ' + family;
  textContext.fillStyle = '#fff';
  textContext.textBaseline = 'top';
  const widths = words.map(word => textContext.measureText(word + ' ').width);
  let wordIndex = 0;
  for (let y = Math.max(margin, 62); y + font < height - margin; y += rowHeight) {
    // Use a fixed text grid and reveal only complete words in clear areas.
    const open = window.FlowerCore.intervals(mask.timeline[frame], y, font, 16, rect);
    let x = margin;
    while (x + widths[wordIndex] <= width - margin) {
      const nextX = x + widths[wordIndex];
      if (open.some(([left, right]) => x >= left && nextX <= right)) {
        textContext.fillText(words[wordIndex], x, y);
      }
      x = nextX;
      wordIndex = (wordIndex + 1) % words.length;
    }
  }
}

new ResizeObserver(() => { placeHotspot(); drawManifesto(true); }).observe(stage);
function tick(now) {
  if (scene === 'garden' && !busy && !stopped && film.currentTime >= flowers[index].time - .008) stopGarden();
  if (rippleEnabled()) water.render(now, stage.clientWidth, stage.clientHeight);
  drawManifesto();
  requestAnimationFrame(tick);
}
startMusic();
goHome(true);
requestAnimationFrame(tick);
