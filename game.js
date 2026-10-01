// Stackr
// A block slides above the tower. Tap to drop it. Whatever hangs over the edge is cut off.
// A little fox lives on top of the tower and hops onto every new block.
// Everything is drawn in a hand-drawn "doodle" style, like pen on notebook paper.

// ---------- Settings (numbers we can tweak later) ----------

// The size we design for (an iPhone held upright). Phaser stretches it to fit.
const GAME_WIDTH = 390;
const GAME_HEIGHT = 844;

// Block sizes, in pixels
const BASE_SIZE = 170;       // width of the first block
const BLOCK_HEIGHT = 36;     // how tall each block is
const BASE_DEPTH = 900;      // the base block reaches far down, off the bottom of the screen
const HOVER = 72;            // the sliding block floats this high above the tower (above the fox's head)

// Sliding
const SLIDE_RANGE = 165;     // how far from the center a sliding block travels
const SPEED_START = 120;     // starting speed (pixels per second)
const SPEED_STEP = 5;        // each new block is this much faster...
const SPEED_MAX = 400;       // ...but never faster than this

// Perfect drops
const PERFECT_TOLERANCE = 3; // missing by this much or less still counts as perfect
const GROW_AMOUNT = 8;       // how much a block grows back after 3 perfects in a row
const GROW_STREAK = 3;       // perfects in a row needed before blocks start growing back

// Fox, hearts, berries and bees
const HEARTS = 3;            // hearts per round
const NARROW = 50;           // on a block narrower than this, the fox gets nervous
const FOX_SCALE = 1.2;       // how big the fox is drawn
const ITEM_RADIUS = 13;      // size of a berry or bee (for touching)
const ITEM_GAP_MIN = 6;      // how far outside the tower edge items float...
const ITEM_GAP_MAX = 45;     // ...between these two distances
const BERRY_CHANCE = 0.55;   // chance of a berry next to each new block (from block 2)
const BEE_CHANCE = 0.35;     // chance of a bee next to each new block (from block 4)
const BERRY_POINTS = 2;      // points for catching a berry

// Look
const INK = 0x2b2340;        // the "pen" color for all outlines
const INK_CSS = '#2b2340';
const PAPER = 0xfdfaf0;      // notebook paper
const GRID = 0xcfe0ef;       // the light blue squares on the paper
const START_HUE = 330;       // starting color on the color wheel (0-360)
const HUE_STEP = 8;          // each block shifts the color a little
const CLOUD_COUNT = 5;       // doodle clouds drifting in the background

// Where the top of the base block sits on the screen
const ORIGIN_X = GAME_WIDTH / 2;
const ORIGIN_Y = 560;

const FONT = '"Gochi Hand", "Comic Sans MS", cursive';

// ---------- Doodle drawing helpers ----------

// A tiny random-number maker that always gives the same numbers for the same "seed".
// That way a block's wobbly outline stays the same every time it's drawn (no flickering).
function makeRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A slightly shaky line through a list of corner points, like drawn by hand.
function shakyPath(points, rand, shake, closed) {
  const out = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(2, Math.round(len / 12));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({
        x: a.x + (b.x - a.x) * t + (rand() - 0.5) * shake,
        y: a.y + (b.y - a.y) * t + (rand() - 0.5) * shake
      });
    }
  }
  if (!closed) out.push(points[points.length - 1]);
  return out;
}

// Draws a hand-drawn outline: one strong line and a lighter second line on top, like a sketch.
function sketchOutline(g, points, rand, closed = true, width = 2.6) {
  g.lineStyle(width, INK, 1);
  g.strokePoints(shakyPath(points, rand, 1.6, closed), closed);
  g.lineStyle(width * 0.45, INK, 0.45);
  g.strokePoints(shakyPath(points, rand, 2.4, closed), closed);
}

// Points around a circle or oval.
function ovalPoints(cx, cy, rx, ry, steps = 18) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

// Points of a heart shape, centered on (cx, cy).
function heartPoints(cx, cy, size) {
  const pts = [];
  const s = size / 34;
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push({ x: cx + x * s, y: cy - y * s });
  }
  return pts;
}

// The colors of a block on a given level: main color, shading, and hatching lines.
function blockColors(level) {
  const hue = ((START_HUE + level * HUE_STEP) % 360) / 360;
  return {
    fill: Phaser.Display.Color.HSLToColor(hue, 0.7, 0.74).color,
    shade: Phaser.Display.Color.HSLToColor(hue, 0.55, 0.6).color,
    hatch: Phaser.Display.Color.HSLToColor(hue, 0.5, 0.42).color
  };
}

// Draws a block as a hand-drawn rectangle. The drawing's (0, 0) point is the middle of the block's bottom edge.
function drawBlock(g, w, h, colors, seed) {
  const rand = makeRandom(seed);
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h;
  const y1 = 0;
  g.clear();

  // Main color, with a darker strip along the bottom
  g.fillStyle(colors.fill, 1);
  g.fillRect(x0, y0, w, h);
  g.fillStyle(colors.shade, 1);
  g.fillRect(x0, y1 - Math.min(10, h * 0.3), w, Math.min(10, h * 0.3));

  // Pencil hatching: thin diagonal lines, clipped to the block
  g.lineStyle(1.3, colors.hatch, 0.35);
  for (let k = x0 - h; k < x1; k += 9) {
    const xa = Math.max(x0, k);
    const xb = Math.min(x1, k + h);
    if (xa >= xb) continue;
    g.beginPath();
    g.moveTo(xa, y1 - (xa - k));
    g.lineTo(xb, y1 - (xb - k));
    g.strokePath();
  }

  // A light shine near the top
  g.lineStyle(2, 0xffffff, 0.7);
  g.beginPath();
  g.moveTo(x0 + 6, y0 + 5);
  g.lineTo(x0 + Math.max(8, w * 0.45), y0 + 5);
  g.strokePath();

  sketchOutline(g, [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], rand);
}

// A red berry with a shine and a little green leaf, centered on (0, 0).
function drawBerry(g, r = 9, seed = 7) {
  const rand = makeRandom(seed);
  g.fillStyle(0x6cc04a, 1);
  g.fillEllipse(4, -r - 1, 11, 6);
  sketchOutline(g, ovalPoints(4, -r - 1, 5.5, 3, 10), rand, true, 2);
  g.fillStyle(0xe8345a, 1);
  g.fillCircle(0, 0, r);
  g.fillStyle(0xb81f45, 1);
  g.fillCircle(2, 2, r * 0.55);
  g.fillStyle(0xe8345a, 1);
  g.fillCircle(-1, -1, r * 0.6);
  sketchOutline(g, ovalPoints(0, 0, r, r, 16), rand, true, 2.2);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(-r * 0.35, -r * 0.35, r * 0.25);
}

// A doodle star (used for sparkles).
function starPoints(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

// ---------- The fox ----------

const FOX_ORANGE = 0xf28c28;
const FOX_WHITE = 0xfff8ee;

// Builds the fox out of simple shapes. Its feet are at (0, 0).
// fox (moves, tilts) > rig (squashes, breathes, turns) > tail, ears, body, face
function makeFox(scene) {
  const fox = scene.add.container(0, 0);
  const rig = scene.add.container(0, 0);
  const rand = makeRandom(42);

  const tail = scene.add.graphics();
  tail.fillStyle(FOX_ORANGE, 1);
  tail.fillEllipse(0, -13, 14, 28);
  tail.fillStyle(FOX_WHITE, 1);
  tail.fillEllipse(0, -24, 10, 9);
  sketchOutline(tail, ovalPoints(0, -13, 7, 14, 16), rand, true, 2.2);
  tail.setPosition(11, -4);
  tail.angle = 40;

  // Ears are separate so they can twitch.
  const ears = scene.add.graphics();
  for (const side of [-1, 1]) {
    const pts = [{ x: side * 13, y: -2 }, { x: side * 3, y: -7 }, { x: side * 11, y: -19 }];
    ears.fillStyle(FOX_ORANGE, 1);
    ears.fillTriangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    ears.fillStyle(INK, 1);
    ears.fillTriangle(side * 10, -6, side * 6, -8, side * 10, -14);
    sketchOutline(ears, pts, rand, true, 2.2);
  }
  ears.setPosition(0, -33);

  const body = scene.add.graphics();
  // feet
  body.fillStyle(INK, 1);
  body.fillEllipse(-6, -1, 10, 5);
  body.fillEllipse(6, -1, 10, 5);
  // body and belly
  body.fillStyle(FOX_ORANGE, 1);
  body.fillEllipse(0, -13, 24, 26);
  body.fillStyle(FOX_WHITE, 1);
  body.fillEllipse(0, -10, 13, 15);
  sketchOutline(body, ovalPoints(0, -13, 12, 13, 18), rand, true, 2.4);
  // head and white muzzle
  body.fillStyle(FOX_ORANGE, 1);
  body.fillCircle(0, -33, 12.5);
  body.fillStyle(FOX_WHITE, 1);
  body.fillEllipse(0, -27, 17, 10);
  sketchOutline(body, ovalPoints(0, -33, 12.5, 12.5, 18), rand, true, 2.4);
  // rosy cheeks
  body.fillStyle(0xff8fa3, 0.55);
  body.fillCircle(-8, -28, 2.6);
  body.fillCircle(8, -28, 2.6);

  const face = scene.add.graphics();

  rig.add([tail, ears, body, face]);
  fox.add(rig);
  fox.rig = rig;
  fox.face = face;
  fox.ears = ears;
  fox.tail = tail;
  fox.squash = { x: 1, y: 1 };
  fox.turn = 1;          // 1 = normal, -1 = mirrored (used for the happy twirl)
  fox.mood = 'normal';   // temporary mood: 'happy' or 'hurt'
  fox.moodUntil = 0;
  fox.blinkUntil = 0;
  fox.nextBlink = 1500;
  fox.nextTwitch = 2500;

  // The tail swishes gently all the time.
  scene.tweens.add({ targets: tail, angle: 22, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return fox;
}

// Draws the fox's face. mood: 'normal', 'happy', 'hurt', 'dizzy' or 'scared'.
// look (-1 to 1) moves the eyes left or right. blink closes the eyes.
function drawFoxFace(f, mood, look, blink) {
  f.clear();
  f.lineStyle(2, INK, 1);
  f.fillStyle(INK, 1);
  f.fillEllipse(0, -29.5, 5, 3.6); // nose

  const eyeY = -36;
  const line = (pts) => {
    f.beginPath();
    f.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) f.lineTo(pts[i], pts[i + 1]);
    f.strokePath();
  };

  if (mood === 'happy') {
    line([-8, eyeY + 2, -5, eyeY - 2, -2, eyeY + 2]);
    line([2, eyeY + 2, 5, eyeY - 2, 8, eyeY + 2]);
    // open smiling mouth with a tongue
    f.fillStyle(INK, 1);
    f.slice(0, -26.5, 4.5, 0, Math.PI, false);
    f.fillPath();
    f.fillStyle(0xff7b8f, 1);
    f.fillCircle(0, -23.8, 2);
    return;
  }
  if (mood === 'hurt') {
    line([-8, eyeY - 3, -3, eyeY, -8, eyeY + 3]);
    line([8, eyeY - 3, 3, eyeY, 8, eyeY + 3]);
    line([-4, -24, -2, -26, 0, -24, 2, -26, 4, -24]); // wavy mouth
    return;
  }
  if (mood === 'dizzy') {
    for (const ex of [-5, 5]) {
      line([ex - 3, eyeY - 3, ex + 3, eyeY + 3]);
      line([ex + 3, eyeY - 3, ex - 3, eyeY + 3]);
    }
    f.strokeCircle(0, -24.5, 2.2);
    return;
  }

  const scared = mood === 'scared';
  if (blink) {
    line([-8, eyeY, -2, eyeY]);
    line([2, eyeY, 8, eyeY]);
  } else {
    const white = scared ? 4.6 : 3.8;
    const pupil = scared ? 1.4 : 2.1;
    for (const ex of [-5, 5]) {
      f.fillStyle(0xffffff, 1);
      f.fillEllipse(ex, eyeY, white * 2, white * 2.3);
      f.lineStyle(1.6, INK, 1);
      f.strokeEllipse(ex, eyeY, white * 2, white * 2.3);
      f.fillStyle(INK, 1);
      f.fillCircle(ex + look * (white - pupil - 0.4), eyeY + 0.5, pupil);
    }
  }
  f.lineStyle(2, INK, 1);
  if (scared) {
    f.strokeCircle(0, -24, 1.8); // small "o" mouth
    // a sweat drop
    f.fillStyle(0x7cc7ff, 1);
    f.fillTriangle(12, -44, 9.5, -38, 14.5, -38);
    f.fillCircle(12, -37.5, 2.6);
  } else {
    // little "w" mouth
    line([-4, -26, -2, -24, 0, -26, 2, -24, 4, -26]);
  }
}

// ---------- Sounds (made by code, no sound files needed) ----------

const Sfx = {
  ctx: null,
  muted: false,

  // Browsers only allow sound after the first tap, so we switch it on then.
  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  ready() {
    return this.ctx && !this.muted;
  },

  // A short tone that slides from one pitch to another and fades out.
  tone(type, fromHz, toHz, duration, volume, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, t);
    osc.frequency.exponentialRampToValueAtTime(toHz, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  },

  // A tiny burst of "hiss", like scissors closing.
  hiss(duration, volume, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2500;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  },

  thunk() {
    if (!this.ready()) return;
    this.tone('sine', 150, 55, 0.14, 0.7);
    this.tone('triangle', 90, 40, 0.1, 0.3);
  },

  snip() {
    if (!this.ready()) return;
    this.hiss(0.05, 0.35);
    this.hiss(0.04, 0.3, 0.06);
  },

  // The "ding!" climbs higher with every perfect in a row, like going up a scale.
  ding(streak) {
    if (!this.ready()) return;
    const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];
    const step = scale[Math.min(streak - 1, scale.length - 1)];
    const hz = 880 * Math.pow(2, step / 12);
    this.tone('sine', hz, hz, 0.6, 0.35);
    this.tone('sine', hz * 2.76, hz * 2.76, 0.25, 0.08);
  },

  // The fox hops.
  hop() {
    if (!this.ready()) return;
    this.tone('sine', 320, 640, 0.12, 0.18);
  },

  // A berry is caught.
  pop() {
    if (!this.ready()) return;
    this.tone('sine', 700, 1400, 0.09, 0.35);
    this.tone('triangle', 1400, 1900, 0.07, 0.15, 0.06);
  },

  // Ouch, a bee!
  buzz() {
    if (!this.ready()) return;
    this.tone('sawtooth', 190, 160, 0.22, 0.12);
    this.tone('square', 620, 220, 0.2, 0.12, 0.18);
  },

  // A falling "boing" when the round ends.
  fall() {
    if (!this.ready()) return;
    this.tone('triangle', 420, 90, 0.5, 0.45);
  }
};

// Remember the mute choice between visits. (Storage can be blocked, so we guard it.)
try { Sfx.muted = localStorage.getItem('stackr-muted') === '1'; } catch (e) { /* ignore */ }

// ---------- The game ----------

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.cameras.main.setScroll(0, 0);
    this.lastScrollY = 0;

    this.tower = [];       // blocks that have landed
    this.moving = null;    // the block that is sliding right now
    this.items = [];       // berries and bees next to the sliding block
    this.score = 0;
    this.streak = 0;       // perfect drops in a row
    this.hearts = HEARTS;
    this.berries = 0;      // berries caught this round
    this.state = 'playing';

    this.makeTextures();
    this.createBackground();
    this.createGround();

    // The base block: very tall, so the tower seems to rise from the ground.
    const base = { cx: 0, w: BASE_SIZE, bottom: -BASE_DEPTH, top: 0, level: 0, colors: blockColors(0) };
    base.gfx = this.add.graphics().setDepth(0);
    drawBlock(base.gfx, base.w, BASE_DEPTH, base.colors, 1);
    base.gfx.setPosition(ORIGIN_X, ORIGIN_Y + BASE_DEPTH);
    this.tower.push(base);

    // The fox stands in the middle of the top block. It is always drawn in front of the blocks,
    // so the sliding block never hides it.
    this.fox = makeFox(this);
    this.fox.setPosition(ORIGIN_X, ORIGIN_Y).setDepth(930);

    this.sparkles = this.add.particles(0, 0, 'star', {
      speed: { min: 90, max: 230 },
      angle: { min: 200, max: 340 },
      lifespan: 700,
      gravityY: 420,
      scale: { start: 1, end: 0.2 },
      rotate: { min: -180, max: 180 },
      emitting: false
    }).setDepth(950);

    this.createHud();

    // One finger: tap anywhere. (Space bar also works, for testing on the computer.)
    this.input.on('pointerdown', (pointer, over) => {
      Sfx.unlock();
      if (over.includes(this.muteZone)) return; // tapping the speaker doesn't drop a block
      this.handleTap();
    });
    this.input.keyboard.on('keydown-SPACE', () => {
      Sfx.unlock();
      this.handleTap();
    });

    this.spawnMovingBlock();
  }

  // Small pictures we reuse many times: the notebook paper and a sparkle star.
  makeTextures() {
    if (!this.textures.exists('paper')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(PAPER, 1);
      g.fillRect(0, 0, 44, 44);
      g.lineStyle(1, GRID, 1);
      g.strokeLineShape(new Phaser.Geom.Line(0, 0.5, 44, 0.5));
      g.strokeLineShape(new Phaser.Geom.Line(0, 22.5, 44, 22.5));
      g.strokeLineShape(new Phaser.Geom.Line(0.5, 0, 0.5, 44));
      g.strokeLineShape(new Phaser.Geom.Line(22.5, 0, 22.5, 44));
      g.generateTexture('paper', 44, 44);
      g.destroy();
    }
    if (!this.textures.exists('star')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffd23f, 1);
      g.fillPoints(starPoints(10, 10, 9, 4), true);
      g.lineStyle(1.8, INK, 1);
      g.strokePoints(starPoints(10, 10, 9, 4), true);
      g.generateTexture('star', 20, 20);
      g.destroy();
    }
  }

  // Notebook paper, doodle clouds, and a bird now and then.
  createBackground() {
    this.paper = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'paper')
      .setOrigin(0).setScrollFactor(0).setDepth(-100);

    // The red margin line, like on a school notebook
    const margin = this.add.graphics().setScrollFactor(0).setDepth(-99);
    margin.lineStyle(2, 0xf29a9a, 0.8);
    margin.strokeLineShape(new Phaser.Geom.Line(34, 0, 34, GAME_HEIGHT));

    this.clouds = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const cloud = this.add.graphics().setScrollFactor(0).setDepth(-50);
      this.drawCloud(cloud, Phaser.Math.Between(22, 36), i + 11);
      cloud.x = Phaser.Math.Between(0, GAME_WIDTH);
      cloud.y = Phaser.Math.Between(200, GAME_HEIGHT - 200);
      cloud.speed = Phaser.Math.FloatBetween(6, 16); // pixels per second
      this.clouds.push(cloud);
    }

    this.birds = [];
    this.time.addEvent({ delay: 3500, loop: true, callback: () => this.spawnBird() });
  }

  // A bumpy cloud: white circles, outlined only on the outside.
  drawCloud(g, size, seed) {
    const rand = makeRandom(seed);
    const bumps = [
      { x: -size * 1.1, y: 0, r: size * 0.55 },
      { x: -size * 0.4, y: -size * 0.35, r: size * 0.7 },
      { x: size * 0.45, y: -size * 0.25, r: size * 0.62 },
      { x: size * 1.1, y: 0.05 * size, r: size * 0.5 },
      { x: 0, y: size * 0.12, r: size * 0.6 }
    ];
    g.lineStyle(2.6, INK, 0.8);
    for (const b of bumps) g.strokePoints(shakyPath(ovalPoints(b.x, b.y, b.r, b.r, 14), rand, 1.2, true), true);
    g.fillStyle(0xffffff, 1);
    for (const b of bumps) g.fillCircle(b.x, b.y, b.r - 1.6);
  }

  // A doodle bird that flaps across the sky.
  spawnBird() {
    if (this.birds.length > 2) return;
    const fromLeft = Math.random() < 0.5;
    const bird = this.add.graphics().setScrollFactor(0).setDepth(-40);
    bird.lineStyle(2.4, INK, 0.85);
    bird.beginPath();
    bird.moveTo(-10, 0);
    bird.lineTo(-5, -5);
    bird.lineTo(0, 0);
    bird.lineTo(5, -5);
    bird.lineTo(10, 0);
    bird.strokePath();
    bird.x = fromLeft ? -20 : GAME_WIDTH + 20;
    bird.y = Phaser.Math.Between(60, 360);
    this.birds.push(bird);
    this.tweens.add({ targets: bird, scaleY: -0.6, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: bird,
      x: fromLeft ? GAME_WIDTH + 30 : -30,
      y: bird.y + Phaser.Math.Between(-40, 40),
      duration: Phaser.Math.Between(5000, 8000),
      onComplete: () => {
        this.birds = this.birds.filter(b => b !== bird);
        bird.destroy();
      }
    });
  }

  // Grass, flowers and little stones at the foot of the tower.
  createGround() {
    const g = this.add.graphics().setDepth(0.5);
    const rand = makeRandom(99);
    const top = ORIGIN_Y + 170;
    const pts = [];
    for (let x = -10; x <= GAME_WIDTH + 10; x += 20) pts.push({ x, y: top + Math.sin(x / 50) * 8 });
    const shape = pts.concat([{ x: GAME_WIDTH + 10, y: top + 400 }, { x: -10, y: top + 400 }]);
    g.fillStyle(0x9bdb6a, 1);
    g.fillPoints(shape, true);
    sketchOutline(g, pts, rand, false, 2.6);

    // grass tufts
    g.lineStyle(2, INK, 0.9);
    for (let x = 10; x < GAME_WIDTH; x += Phaser.Math.Between(22, 40)) {
      const y = top + Math.sin(x / 50) * 8 + 2;
      g.beginPath();
      g.moveTo(x - 4, y); g.lineTo(x - 6, y - 8);
      g.moveTo(x, y); g.lineTo(x, y - 10);
      g.moveTo(x + 4, y); g.lineTo(x + 6, y - 8);
      g.strokePath();
    }
    // flowers
    for (const fx of [40, 110, 290, 350]) {
      const fy = top + 30 + Phaser.Math.Between(0, 30);
      g.lineStyle(2, INK, 0.9);
      g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy + 16); g.strokePath();
      const petal = fx % 3 === 0 ? 0xfff27a : 0xffffff;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.fillStyle(petal, 1);
        g.fillCircle(fx + Math.cos(a) * 5, fy + Math.sin(a) * 5, 3.6);
        g.lineStyle(1.4, INK, 1);
        g.strokeCircle(fx + Math.cos(a) * 5, fy + Math.sin(a) * 5, 3.6);
      }
      g.fillStyle(0xffa53d, 1);
      g.fillCircle(fx, fy, 3);
    }
  }

  // Score in the middle, hearts and berries on the left, speaker on the right.
  createHud() {
    this.scoreText = this.add.text(GAME_WIDTH / 2, 105, '0', {
      fontFamily: FONT, padding: { x: 10, y: 10 },
      fontSize: '84px',
      color: INK_CSS
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

    this.streakText = this.add.text(GAME_WIDTH / 2, 168, '', {
      fontFamily: FONT, padding: { x: 10, y: 10 },
      fontSize: '32px',
      color: '#e8345a'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

    this.heartIcons = [];
    for (let i = 0; i < HEARTS; i++) {
      const h = this.add.graphics().setScrollFactor(0).setDepth(1000);
      h.setPosition(62 + i * 30, 42);
      this.heartIcons.push(h);
    }
    this.drawHearts();

    const berryIcon = this.add.graphics().setScrollFactor(0).setDepth(1000);
    drawBerry(berryIcon, 9);
    berryIcon.setPosition(62, 84);
    this.berryText = this.add.text(78, 84, '0', {
      fontFamily: FONT, padding: { x: 10, y: 10 },
      fontSize: '30px',
      color: INK_CSS
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1000);

    // A hand-drawn speaker; tap it to turn the sound on or off.
    this.muteIcon = this.add.graphics().setScrollFactor(0).setDepth(1001).setPosition(GAME_WIDTH - 36, 42);
    this.muteZone = this.add.zone(GAME_WIDTH - 36, 42, 56, 56).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.drawMuteIcon();
    this.muteZone.on('pointerdown', () => {
      Sfx.muted = !Sfx.muted;
      try { localStorage.setItem('stackr-muted', Sfx.muted ? '1' : '0'); } catch (e) { /* ignore */ }
      this.drawMuteIcon();
      this.tweens.add({ targets: this.muteIcon, scale: { from: 1.3, to: 1 }, duration: 150 });
    });
  }

  drawHearts() {
    this.heartIcons.forEach((h, i) => {
      h.clear();
      const pts = heartPoints(0, 0, 24);
      h.fillStyle(i < this.hearts ? 0xef4f5f : 0xffffff, 1);
      h.fillPoints(pts, true);
      sketchOutline(h, pts, makeRandom(300 + i), true, 2.2);
      if (i < this.hearts) {
        h.fillStyle(0xffffff, 0.8);
        h.fillCircle(-5, -4, 2.2);
      }
    });
  }

  drawMuteIcon() {
    const g = this.muteIcon;
    const rand = makeRandom(5);
    g.clear();
    const box = [{ x: -12, y: -5 }, { x: -6, y: -5 }, { x: 2, y: -12 }, { x: 2, y: 12 }, { x: -6, y: 5 }, { x: -12, y: 5 }];
    g.fillStyle(0xffffff, 1);
    g.fillPoints(box, true);
    sketchOutline(g, box, rand, true, 2.4);
    g.lineStyle(2.4, INK, 1);
    if (Sfx.muted) {
      g.beginPath(); g.moveTo(7, -6); g.lineTo(16, 6); g.moveTo(16, -6); g.lineTo(7, 6); g.strokePath();
    } else {
      g.beginPath(); g.arc(4, 0, 7, -0.8, 0.8); g.strokePath();
      g.beginPath(); g.arc(4, 0, 13, -0.8, 0.8); g.strokePath();
    }
  }

  // Creates the next block. Blocks take turns sliding in from the left and from the right.
  // It floats a little above the tower so it passes over the fox's head.
  spawnMovingBlock() {
    const top = this.tower[this.tower.length - 1];
    const level = top.level + 1;
    const fromLeft = level % 2 === 1;

    const block = {
      cx: top.cx + (fromLeft ? -SLIDE_RANGE : SLIDE_RANGE),
      w: top.w,
      bottom: top.top + HOVER,
      top: top.top + HOVER + BLOCK_HEIGHT,
      level: level,
      dir: fromLeft ? 1 : -1,
      center: top.cx,
      speed: Math.min(SPEED_MAX, SPEED_START + SPEED_STEP * (level - 1)),
      colors: blockColors(level),
      seed: level * 7919
    };

    block.gfx = this.add.graphics().setDepth(level);
    drawBlock(block.gfx, block.w, BLOCK_HEIGHT, block.colors, block.seed);
    block.gfx.setPosition(ORIGIN_X + block.cx, ORIGIN_Y - block.bottom);
    // It pops in with a little stretch.
    block.gfx.setScale(0.6, 1.3);
    this.tweens.add({ targets: block.gfx, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });

    this.moving = block;
    this.spawnItems(block);
  }

  // Maybe put a berry and/or a bee just outside the tower edge, on the sliding block's path.
  spawnItems(block) {
    const wantBerry = block.level >= 2 && Math.random() < BERRY_CHANCE;
    const wantBee = block.level >= 4 && Math.random() < BEE_CHANCE;
    const berrySide = Math.random() < 0.5 ? -1 : 1;
    if (wantBerry) this.addItem('berry', block, berrySide);
    if (wantBee) this.addItem('bee', block, wantBerry ? -berrySide : (Math.random() < 0.5 ? -1 : 1));
  }

  addItem(kind, block, side) {
    const gap = Phaser.Math.Between(ITEM_GAP_MIN, ITEM_GAP_MAX);
    const along = block.center + side * (block.w / 2 + ITEM_RADIUS + gap);
    const x = ORIGIN_X + along;
    const y = ORIGIN_Y - (block.bottom + BLOCK_HEIGHT / 2);

    const item = this.add.container(x, y).setDepth(940);
    if (kind === 'berry') {
      const g = this.add.graphics();
      drawBerry(g, 11, block.level);
      item.add(g);
      this.tweens.add({ targets: item, angle: { from: -8, to: 8 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      item.add(this.makeBee(side));
    }

    item.setScale(0);
    this.tweens.add({ targets: item, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: item, y: y - 6, duration: kind === 'bee' ? 280 : 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (kind === 'bee') {
      this.tweens.add({ targets: item, x: x + 5, duration: 190, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    this.items.push({ kind, along, gfx: item });
  }

  // A round striped bee with flapping wings. It faces the tower.
  makeBee(side) {
    const rand = makeRandom(77);
    const bee = this.add.container(0, 0);
    const wings = this.add.graphics();
    wings.fillStyle(0xe6f6ff, 0.95);
    wings.fillEllipse(-4, -11, 11, 13);
    wings.fillEllipse(5, -12, 10, 12);
    sketchOutline(wings, ovalPoints(-4, -11, 5.5, 6.5, 12), rand, true, 1.8);
    sketchOutline(wings, ovalPoints(5, -12, 5, 6, 12), rand, true, 1.8);

    const body = this.add.graphics();
    body.fillStyle(INK, 1);
    body.fillTriangle(12, -2, 12, 2, 18, 0);
    body.fillStyle(0xffd23f, 1);
    body.fillEllipse(0, 0, 26, 18);
    body.fillStyle(INK, 1);
    body.fillRect(-2, -8, 4, 16);
    body.fillRect(5, -7, 3.5, 14);
    sketchOutline(body, ovalPoints(0, 0, 13, 9, 16), rand, true, 2.2);
    // eye and angry eyebrow
    body.fillStyle(0xffffff, 1);
    body.fillCircle(-7, -2, 3);
    body.fillStyle(INK, 1);
    body.fillCircle(-7.6, -1.6, 1.6);
    body.lineStyle(1.8, INK, 1);
    body.beginPath(); body.moveTo(-11, -7); body.lineTo(-4, -5); body.strokePath();

    bee.add([wings, body]);
    bee.scaleX = side > 0 ? 1 : -1; // the bee looks toward the tower
    this.tweens.add({ targets: wings, scaleY: 0.45, duration: 60, yoyo: true, repeat: -1 });
    return bee;
  }

  update(time, delta) {
    this.updateBackground(delta);
    this.updateFox(time);

    const b = this.moving;
    if (this.state !== 'playing' || !b) return;

    // Slide back and forth between the two ends of the path.
    let pos = b.cx + b.speed * (delta / 1000) * b.dir;
    if (pos > b.center + SLIDE_RANGE) { pos = b.center + SLIDE_RANGE; b.dir = -1; }
    if (pos < b.center - SLIDE_RANGE) { pos = b.center - SLIDE_RANGE; b.dir = 1; }
    b.cx = pos;
    b.gfx.x = ORIGIN_X + b.cx;
  }

  updateBackground(delta) {
    const scrollY = this.cameras.main.scrollY;
    // The paper moves a little as the tower climbs, so it feels like rising.
    this.paper.tilePositionY = scrollY * 0.5;

    // Clouds drift sideways, and slide down a little as the tower climbs.
    const rise = (this.lastScrollY - scrollY) * 0.3;
    this.lastScrollY = scrollY;
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * (delta / 1000);
      cloud.y += rise;
      if (cloud.x > GAME_WIDTH + 90) cloud.x = -90;
      if (cloud.y > GAME_HEIGHT + 60) {
        cloud.y = -60;
        cloud.x = Phaser.Math.Between(0, GAME_WIDTH);
      }
    }
  }

  // The fox breathes, blinks, twitches its ears, watches the sliding block,
  // and looks scared when a bee is close.
  updateFox(time) {
    const fox = this.fox;
    const breathe = 1 + Math.sin(time / 380) * 0.035;
    fox.rig.setScale(FOX_SCALE * fox.squash.x * fox.turn, FOX_SCALE * fox.squash.y * breathe);

    if (time > fox.nextBlink) {
      fox.blinkUntil = time + 130;
      fox.nextBlink = time + Phaser.Math.Between(1800, 4200);
    }
    if (time > fox.nextTwitch) {
      fox.nextTwitch = time + Phaser.Math.Between(2000, 5000);
      this.tweens.add({ targets: fox.ears, angle: Phaser.Math.Between(-10, 10), scaleY: 0.85, duration: 90, yoyo: true });
    }

    let mood = 'normal';
    if (this.state === 'over') mood = 'dizzy';
    else if (time < fox.moodUntil) mood = fox.mood;
    else if (this.items.some(it => it.kind === 'bee')) mood = 'scared';

    let look = 0;
    if (this.moving) look = Phaser.Math.Clamp((this.moving.gfx.x - fox.x) / 110, -1, 1);
    drawFoxFace(fox.face, mood, look, time < fox.blinkUntil);
  }

  setFoxMood(mood, duration) {
    this.fox.mood = mood;
    this.fox.moodUntil = this.time.now + duration;
  }

  handleTap() {
    if (this.state === 'over') {
      if (this.time.now >= this.restartAllowedAt) this.scene.restart();
      return;
    }
    if (this.state === 'playing' && this.moving) this.dropBlock();
  }

  // The heart of the game: decide what happens when the block is dropped.
  dropBlock() {
    const b = this.moving;
    const top = this.tower[this.tower.length - 1];
    const offset = b.cx - top.cx;          // how far off we are (+ = too far right)
    const overlap = b.w - Math.abs(offset);
    this.moving = null;
    this.tweens.killTweensOf(b.gfx);
    b.gfx.setScale(1);

    // Which berries and bees does the block touch where it was dropped?
    const touched = this.items.filter(it => it.along + ITEM_RADIUS > b.cx - b.w / 2 && it.along - ITEM_RADIUS < b.cx + b.w / 2);

    // Missed completely: the whole block falls and the round is over.
    if (overlap <= 0) {
      b.gfx.destroy();
      this.dropPiece(b.cx, b.w, b.bottom, b.colors, offset > 0 ? 1 : -1, b.seed);
      this.clearItems([]);
      this.gameOver();
      return;
    }

    let perfect = false;
    if (Math.abs(offset) <= PERFECT_TOLERANCE) {
      // Perfect: snap exactly on top.
      perfect = true;
      b.cx = top.cx;
    } else {
      // Cut off the part that hangs over the edge, and let it fall from where it was floating.
      const keptCenter = top.cx + offset / 2;
      const cutSize = Math.abs(offset);
      const cutCenter = keptCenter + Math.sign(offset) * (overlap / 2 + cutSize / 2);
      this.dropPiece(cutCenter, cutSize, b.bottom, b.colors, Math.sign(offset), b.seed + 1);
      b.cx = keptCenter;
      b.w = overlap;
    }

    // Points and perfect streak
    if (perfect) {
      this.streak += 1;
      this.score += 2 * this.streak;
      // After enough perfects in a row, the block grows back a little (never bigger than the first block).
      if (this.streak >= GROW_STREAK) b.w = Math.min(BASE_SIZE, b.w + GROW_AMOUNT);
    } else {
      this.streak = 0;
      this.score += 1;
    }

    // The block drops down from where it was floating and lands on the tower with a squash.
    b.bottom = top.top;
    b.top = top.top + BLOCK_HEIGHT;
    drawBlock(b.gfx, b.w, BLOCK_HEIGHT, b.colors, b.seed);
    b.gfx.setPosition(ORIGIN_X + b.cx, ORIGIN_Y - b.bottom - HOVER);
    this.tower.push(b);
    this.tweens.add({
      targets: b.gfx,
      y: ORIGIN_Y - b.bottom,
      duration: 110,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.tweens.add({ targets: b.gfx, scaleY: { from: 0.8, to: 1 }, scaleX: { from: 1.06, to: 1 }, duration: 200, ease: 'Back.easeOut' });
        this.dustPuff(b);
        if (perfect) {
          this.showPerfect(b);
          Sfx.ding(this.streak);
        } else {
          Sfx.thunk();
          Sfx.snip();
        }
      }
    });

    this.foxHop(b, perfect);
    this.resolveItems(touched, b);
    this.updateScoreDisplay();

    // Move the view up so the top of the tower stays in the same place on screen.
    this.tweens.add({
      targets: this.cameras.main,
      scrollY: -b.top,
      duration: 250,
      ease: 'Sine.easeOut'
    });

    if (this.hearts <= 0) {
      this.gameOver();
      return;
    }
    this.spawnMovingBlock();
  }

  // Little doodle dust clouds puff out from both bottom corners when a block lands.
  dustPuff(block) {
    const y = ORIGIN_Y - block.bottom;
    for (const side of [-1, 1]) {
      const x = ORIGIN_X + block.cx + side * block.w / 2;
      for (let i = 0; i < 3; i++) {
        const puff = this.add.graphics().setDepth(935);
        const r = Phaser.Math.Between(4, 7);
        puff.fillStyle(0xffffff, 1);
        puff.fillCircle(0, 0, r);
        puff.lineStyle(1.8, INK, 0.8);
        puff.strokeCircle(0, 0, r);
        puff.setPosition(x, y - 2);
        this.tweens.add({
          targets: puff,
          x: x + side * Phaser.Math.Between(12, 30),
          y: y - Phaser.Math.Between(2, 14),
          scale: 1.5,
          alpha: 0,
          duration: 380,
          ease: 'Quad.easeOut',
          onComplete: () => puff.destroy()
        });
      }
    }
  }

  // The fox jumps up in an arc and lands in the middle of the new top block.
  foxHop(block, perfect) {
    const fox = this.fox;
    const from = { x: fox.x, y: fox.y };
    const to = { x: ORIGIN_X + block.cx, y: ORIGIN_Y - block.top };
    const jump = perfect ? 80 : 50;
    const hop = { t: 0 };

    this.stopFoxWobble();
    Sfx.hop();
    // Stretch up when jumping.
    fox.squash.x = 0.85;
    fox.squash.y = 1.2;

    this.foxHopTween = this.tweens.add({
      targets: hop,
      t: 1,
      duration: 330,
      ease: 'Linear',
      onUpdate: () => {
        fox.x = from.x + (to.x - from.x) * hop.t;
        fox.y = from.y + (to.y - from.y) * hop.t - Math.sin(Math.PI * hop.t) * jump;
        if (perfect) fox.turn = Math.cos(hop.t * Math.PI * 2); // a happy twirl
      },
      onComplete: () => {
        fox.turn = 1;
        // Squash when landing, then spring back.
        fox.squash.x = 1.25;
        fox.squash.y = 0.75;
        this.tweens.add({ targets: fox.squash, x: 1, y: 1, duration: 260, ease: 'Back.easeOut' });
        if (perfect) this.setFoxMood('happy', 600);
        // On a narrow block the fox gets nervous and wobbles.
        if (block.w < NARROW && this.state === 'playing') this.startFoxWobble();
      }
    });
  }

  startFoxWobble() {
    this.stopFoxWobble();
    this.fox.angle = -7;
    this.foxWobble = this.tweens.add({ targets: this.fox, angle: 7, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  stopFoxWobble() {
    if (this.foxWobble) {
      this.foxWobble.stop();
      this.foxWobble = null;
    }
    this.fox.angle = 0;
  }

  // Berries the block touched are caught, bees it touched sting. The rest float away.
  resolveItems(touched, block) {
    const foxSpot = { x: ORIGIN_X + block.cx, y: ORIGIN_Y - block.top };

    for (const it of touched) {
      this.tweens.killTweensOf(it.gfx);
      if (it.kind === 'berry') {
        this.berries += 1;
        this.score += BERRY_POINTS;
        Sfx.pop();
        this.floatText('+' + BERRY_POINTS, it.gfx.x, it.gfx.y - 16, '#e8345a');
        this.tweens.add({
          targets: it.gfx,
          x: foxSpot.x,
          y: foxSpot.y - 36,
          scale: 0.3,
          duration: 300,
          ease: 'Quad.easeIn',
          onComplete: () => it.gfx.destroy()
        });
        this.time.delayedCall(300, () => this.setFoxMood('happy', 500));
        this.tweens.add({ targets: this.berryText, scale: { from: 1.6, to: 1 }, duration: 240, delay: 280, ease: 'Back.easeOut' });
      } else {
        this.hearts = Math.max(0, this.hearts - 1);
        Sfx.buzz();
        this.stingFox();
        this.tweens.add({
          targets: it.gfx,
          x: it.gfx.x + (it.gfx.x < GAME_WIDTH / 2 ? -220 : 220),
          y: it.gfx.y - 140,
          angle: 30,
          duration: 550,
          ease: 'Quad.easeIn',
          onComplete: () => it.gfx.destroy()
        });
      }
    }
    this.clearItems(touched);
    this.drawHearts();
    if (touched.some(it => it.kind === 'bee')) {
      const lost = this.heartIcons[this.hearts];
      if (lost) this.tweens.add({ targets: lost, scale: { from: 1.8, to: 1 }, angle: { from: -20, to: 0 }, duration: 320, ease: 'Back.easeOut' });
    }
  }

  // Items nobody touched fade away.
  clearItems(keep) {
    for (const it of this.items) {
      if (keep.includes(it)) continue;
      this.tweens.killTweensOf(it.gfx);
      this.tweens.add({ targets: it.gfx, alpha: 0, scale: 0.5, duration: 250, onComplete: () => it.gfx.destroy() });
    }
    this.items = [];
  }

  // The fox blinks and makes a painful face after a bee sting.
  stingFox() {
    const fox = this.fox;
    this.setFoxMood('hurt', 700);
    this.cameras.main.shake(150, 0.006);
    this.tweens.add({ targets: fox, alpha: 0.25, duration: 80, yoyo: true, repeat: 3, onComplete: () => fox.setAlpha(1) });
  }

  // A small number that floats up and fades, like "+2".
  floatText(label, x, y, color) {
    const t = this.add.text(x, y, label, {
      fontFamily: FONT, padding: { x: 10, y: 10 },
      fontSize: '30px',
      color: color
    }).setOrigin(0.5).setDepth(1000);
    this.tweens.add({ targets: t, y: y - 44, alpha: 0, duration: 750, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  // A cut-off piece (or a missed block) tumbles down, spinning, and fades away.
  dropPiece(cx, w, bottom, colors, side, seed) {
    const g = this.add.graphics();
    // Draw it around its own middle so it spins nicely.
    drawBlock(g, w, BLOCK_HEIGHT, colors, seed);
    g.y = BLOCK_HEIGHT / 2;
    const holder = this.add.container(ORIGIN_X + cx, ORIGIN_Y - bottom - BLOCK_HEIGHT / 2, [g]).setDepth(900);

    this.tweens.add({
      targets: holder,
      y: holder.y + 750,
      x: holder.x + side * Phaser.Math.Between(30, 70),
      angle: side * Phaser.Math.Between(60, 140),
      alpha: 0,
      duration: 1150,
      ease: 'Quad.easeIn',
      onComplete: () => holder.destroy()
    });
  }

  // White flash, doodle lines bursting out, star sparkles, and "Perfect!" text.
  showPerfect(block) {
    const x = ORIGIN_X + block.cx;
    const y = ORIGIN_Y - block.bottom;

    const flash = this.add.graphics().setDepth(block.level + 0.5);
    flash.fillStyle(0xffffff, 1);
    flash.fillRect(x - block.w / 2, y - BLOCK_HEIGHT, block.w, BLOCK_HEIGHT);
    this.tweens.add({ targets: flash, alpha: 0, duration: 350, onComplete: () => flash.destroy() });

    // Short pen strokes shooting out from the block's top corners, like in a comic.
    const burst = this.add.graphics().setDepth(945);
    const state = { t: 0 };
    this.tweens.add({
      targets: state,
      t: 1,
      duration: 380,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        burst.clear();
        burst.lineStyle(3, INK, 1 - state.t);
        for (const side of [-1, 1]) {
          const cx = x + side * block.w / 2;
          const cy = y - BLOCK_HEIGHT;
          for (const a of [-0.35, 0.25, 0.85]) {
            const ang = side > 0 ? -a : Math.PI + a;
            const r0 = 8 + state.t * 16;
            const r1 = 18 + state.t * 26;
            burst.beginPath();
            burst.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
            burst.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
            burst.strokePath();
          }
        }
      },
      onComplete: () => burst.destroy()
    });

    this.sparkles.explode(10 + this.streak * 2, x, y - BLOCK_HEIGHT);

    const text = this.add.text(GAME_WIDTH / 2, 290, 'Perfect!', {
      fontFamily: FONT, padding: { x: 10, y: 10 },
      fontSize: '48px',
      color: '#e8345a',
      stroke: '#ffffff',
      strokeThickness: 8
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setScale(0.4).setAngle(Phaser.Math.Between(-8, 8));

    this.tweens.add({ targets: text, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: text,
      y: 250,
      alpha: 0,
      delay: 450,
      duration: 400,
      onComplete: () => text.destroy()
    });
  }

  updateScoreDisplay() {
    this.scoreText.setText(String(this.score));
    this.scoreText.setAngle(Phaser.Math.Between(-4, 4));
    this.tweens.add({ targets: this.scoreText, scale: { from: 1.3, to: 1 }, duration: 220, ease: 'Back.easeOut' });

    this.streakText.setText(this.streak >= 2 ? 'x' + this.streak : '');
    if (this.streak >= 2) {
      this.tweens.add({ targets: this.streakText, scale: { from: 1.6, to: 1 }, duration: 240, ease: 'Back.easeOut' });
    }
    this.berryText.setText(String(this.berries));
  }

  // Simple game-over note for now (the zoom-out screen comes in a later stage).
  gameOver() {
    this.state = 'over';
    this.streakText.setText('');
    this.restartAllowedAt = this.time.now + 500; // ignore taps for half a second
    Sfx.fall();
    this.cameras.main.shake(200, 0.008);

    // The fox falls off the tower with a dizzy face (after finishing its hop, if it is mid-air).
    const hopping = this.foxHopTween && this.foxHopTween.isPlaying();
    this.time.delayedCall(hopping ? 340 : 0, () => {
      const fox = this.fox;
      this.stopFoxWobble();
      fox.setDepth(960);
      const side = Math.random() < 0.5 ? -1 : 1;
      this.tweens.add({ targets: fox, y: fox.y - 40, duration: 200, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: fox, y: fox.y + 750, x: fox.x + side * 90, angle: side * 540, duration: 1200, delay: 200, ease: 'Quad.easeIn' });
    });

    // A paper note taped to the screen.
    const note = this.add.container(GAME_WIDTH / 2, 350).setScrollFactor(0).setDepth(1000);
    const card = this.add.graphics();
    const rect = [{ x: -150, y: -80 }, { x: 150, y: -80 }, { x: 150, y: 80 }, { x: -150, y: 80 }];
    card.fillStyle(0xffffff, 1);
    card.fillPoints(rect, true);
    sketchOutline(card, rect, makeRandom(2024), true, 2.8);
    card.fillStyle(0xfff27a, 0.75);
    card.fillRect(-165, -92, 60, 20);
    card.fillRect(105, -92, 60, 20);
    const title = this.add.text(0, -32, 'Oops! Game over', { fontFamily: FONT, padding: { x: 10, y: 10 }, fontSize: '38px', color: INK_CSS }).setOrigin(0.5);
    const hint = this.add.text(0, 30, 'Tap to play again', { fontFamily: FONT, padding: { x: 10, y: 10 }, fontSize: '30px', color: '#e8345a' }).setOrigin(0.5);
    note.add([card, title, hint]);
    note.setAngle(-3).setScale(0);
    this.tweens.add({ targets: note, scale: 1, duration: 320, delay: 150, ease: 'Back.easeOut' });
    this.tweens.add({ targets: hint, scale: 1.08, duration: 600, delay: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#fdfaf0',
  scale: {
    mode: Phaser.Scale.FIT,               // keep the phone shape, as big as the window allows
    autoCenter: Phaser.Scale.CENTER_BOTH, // put it in the middle
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  scene: [GameScene]
};

// Wait for the hand-written font (at most 2 seconds), then start the game (only once).
let started = false;
function startGame() {
  if (started) return;
  started = true;
  window.stackr = new Phaser.Game(config);
}
if (document.fonts && document.fonts.load) {
  document.fonts.load('40px "Gochi Hand"').then(startGame, startGame);
  setTimeout(startGame, 2000);
} else {
  startGame();
}
