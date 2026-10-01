// Domino Rush (rough test version)
// A wave of falling dominoes is chasing you. A ghost domino slides in front of the chain:
// tap to place it. Too close or too far and the chain breaks. Too slow and the wave catches you.

// ---------- Settings (numbers we can tweak later) ----------

const GAME_WIDTH = 390;
const GAME_HEIGHT = 844;
const GROUND_Y = 600;          // where the dominoes stand

const DOMINO_W = 13;           // domino thickness
const DOMINO_H = 72;           // domino height

// Space between two dominoes (from one to the next), in pixels
const GAP_MIN = 20;            // closer than this: they jam
const GAP_MAX = 60;            // further than this: the falling one misses
const GAP_PERFECT = 40;        // the sweet spot...
const PERFECT_TOLERANCE = 4;   // ...give or take this much
const GHOST_NEAR = 5;          // the ghost slides between these two gaps
const GHOST_FAR = 84;

// Speeds
const GHOST_SPEED_START = 90;  // how fast the ghost slides at the start (pixels per second)
const GHOST_SPEED_STEP = 2;    // a bit faster with every domino...
const GHOST_SPEED_MAX = 270;   // ...up to this
const FALL_START = 0.6;        // seconds for one domino to fall onto the next, at the start
const FALL_STEP = 0.008;       // a bit faster with every domino...
const FALL_MIN = 0.22;         // ...up to this
const PERFECT_PAUSE = 200;     // a perfect drop holds the wave back this many milliseconds

const START_DOMINOES = 4;      // dominoes already standing when the round begins

const INK = 0x2b2340;
const FONT = 'Arial Black, Arial, sans-serif';

// ---------- Sounds (made by code, no sound files needed) ----------

const Sfx = {
  ctx: null,

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

  tone(type, fromHz, toHz, duration, volume, delay = 0) {
    if (!this.ctx) return;
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

  // A short "tick" of noise, shaped like wood hitting wood.
  knock(freq, volume) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * 0.04);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 4;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  },

  // Clack! Each domino in the chain sounds a little higher as the wave speeds up.
  clack(speedUp) {
    const f = 1500 + speedUp * 1200 + Math.random() * 200;
    this.knock(f, 0.9);
    this.tone('triangle', f * 0.5, f * 0.35, 0.05, 0.12);
  },

  place() {
    this.knock(900, 0.5);
  },

  perfect(streak) {
    const scale = [0, 2, 4, 5, 7, 9, 11, 12];
    const hz = 880 * Math.pow(2, scale[Math.min(streak - 1, scale.length - 1)] / 12);
    this.tone('sine', hz, hz, 0.45, 0.3);
    this.tone('sine', hz * 2, hz * 2, 0.2, 0.08);
  },

  fail() {
    this.tone('sawtooth', 220, 60, 0.45, 0.25);
    this.knock(300, 1);
  }
};

// ---------- The game ----------

class DominoScene extends Phaser.Scene {
  constructor() {
    super('DominoScene');
  }

  create() {
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setBackgroundColor('#f4efe4');

    this.dominoes = [];    // every domino placed, in order
    this.front = 0;        // the domino that is falling right now (the front of the wave)
    this.score = 0;
    this.streak = 0;       // perfect drops in a row
    this.state = 'ready';  // 'ready' → 'playing' → 'failing' → 'over'
    this.waveStarted = false;
    this.pauseBank = 0;    // extra waiting time earned with perfect drops
    try { this.best = Number(localStorage.getItem('domino-best')) || 0; } catch (e) { this.best = 0; }

    // The ground: a long line that scrolls with the dominoes.
    this.ground = this.add.graphics().setDepth(1);
    this.zone = this.add.graphics().setDepth(2);

    // Dominoes already standing at the start
    for (let i = 0; i < START_DOMINOES; i++) this.addDomino(60 + i * (GAP_PERFECT + DOMINO_W), 'ok');

    // The ghost domino (where the next one will go)
    this.ghost = this.add.graphics().setDepth(5);
    this.ghostGap = GHOST_NEAR;
    this.ghostDir = 1;
    this.drawGhost();

    this.scoreText = this.add.text(GAME_WIDTH / 2, 110, '0', {
      fontFamily: FONT, fontSize: '72px', color: '#2b2340'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.bestText = this.add.text(GAME_WIDTH / 2, 170, 'best ' + this.best, {
      fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#8a8299'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.hint = this.add.text(GAME_WIDTH / 2, 330, 'Tap when the ghost\nis in the green zone', {
      fontFamily: FONT, fontSize: '24px', color: '#2b2340', align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.tweens.add({ targets: this.hint, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    // How far ahead of the wave you are
    this.leadText = this.add.text(20, GROUND_Y + 60, '', {
      fontFamily: FONT, fontSize: '20px', color: '#e8345a'
    }).setScrollFactor(0).setDepth(100);

    this.input.on('pointerdown', () => { Sfx.unlock(); this.handleTap(); });
    this.input.keyboard.on('keydown-SPACE', () => { Sfx.unlock(); this.handleTap(); });
  }

  // ---------- Dominoes ----------

  // A domino is drawn around its bottom-right corner, so it tips over to the right.
  addDomino(x, gapState) {
    const g = this.add.graphics().setDepth(10);
    const bad = gapState !== 'ok';
    g.fillStyle(bad ? 0xffd6dc : 0xffffff, 1);
    g.fillRoundedRect(-DOMINO_W, -DOMINO_H, DOMINO_W, DOMINO_H, 3);
    g.lineStyle(3, INK, 1);
    g.strokeRoundedRect(-DOMINO_W, -DOMINO_H, DOMINO_W, DOMINO_H, 3);
    g.lineStyle(2, INK, 1);
    g.lineBetween(-DOMINO_W + 3, -DOMINO_H / 2, -3, -DOMINO_H / 2);
    g.fillStyle(INK, 1);
    g.fillCircle(-DOMINO_W / 2, -DOMINO_H * 0.75, 2.6);
    g.fillCircle(-DOMINO_W / 2, -DOMINO_H * 0.25, 2.6);
    g.setPosition(x + DOMINO_W / 2, GROUND_Y);

    const d = { x, gfx: g, gapState, fallen: false };
    this.dominoes.push(d);
    return d;
  }

  last() {
    return this.dominoes[this.dominoes.length - 1];
  }

  drawGhost() {
    const x = this.last().x + DOMINO_W + this.ghostGap;
    this.ghost.clear();
    this.ghost.lineStyle(3, INK, 0.45);
    this.ghost.strokeRoundedRect(x - DOMINO_W / 2, GROUND_Y - DOMINO_H, DOMINO_W, DOMINO_H, 3);
    this.ghost.fillStyle(INK, 0.08);
    this.ghost.fillRoundedRect(x - DOMINO_W / 2, GROUND_Y - DOMINO_H, DOMINO_W, DOMINO_H, 3);
  }

  // The green strip on the ground shows where the next domino is safe; the dark mark is perfect.
  drawZone() {
    const z = this.zone;
    z.clear();
    if (this.state !== 'ready' && this.state !== 'playing') return;
    const edge = this.last().x + DOMINO_W / 2;
    z.fillStyle(0x7fd77a, 0.55);
    z.fillRect(edge + GAP_MIN + DOMINO_W / 2, GROUND_Y + 2, GAP_MAX - GAP_MIN, 12);
    z.fillStyle(0x2f9e44, 1);
    z.fillRect(edge + GAP_PERFECT + DOMINO_W / 2 - 2, GROUND_Y + 2, 4, 16);
  }

  drawGround() {
    const cam = this.cameras.main;
    this.ground.clear();
    this.ground.fillStyle(0xe2d8c3, 1);
    this.ground.fillRect(cam.scrollX - 20, GROUND_Y, GAME_WIDTH + 40, 400);
    this.ground.lineStyle(3, INK, 1);
    this.ground.lineBetween(cam.scrollX - 20, GROUND_Y, cam.scrollX + GAME_WIDTH + 20, GROUND_Y);
  }

  // ---------- Input ----------

  handleTap() {
    if (this.state === 'over') {
      if (this.time.now >= this.restartAllowedAt) this.scene.restart();
      return;
    }
    if (this.state === 'ready') {
      this.state = 'playing';
      this.tweens.killTweensOf(this.hint);
      this.tweens.add({ targets: this.hint, alpha: 0, duration: 200 });
    }
    if (this.state !== 'playing') return;

    this.placeDomino();
    if (!this.waveStarted) {
      this.waveStarted = true;
      this.fallNext();
    }
  }

  placeDomino() {
    let gap = this.ghostGap;
    let gapState = 'ok';
    let perfect = false;
    if (Math.abs(gap - GAP_PERFECT) <= PERFECT_TOLERANCE) {
      gap = GAP_PERFECT;
      perfect = true;
    } else if (gap < GAP_MIN) {
      gapState = 'close';
    } else if (gap > GAP_MAX) {
      gapState = 'far';
    }

    const d = this.addDomino(this.last().x + DOMINO_W + gap, gapState);
    // It pops into place.
    d.gfx.setScale(1.2, 0.8);
    this.tweens.add({ targets: d.gfx, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
    Sfx.place();

    if (gapState !== 'ok') {
      // The chain will break here. Show it, and speed the wave up so we don't wait long.
      this.state = 'failing';
      this.showText(gapState === 'far' ? 'Too far!' : 'Too close!', d.x, '#e8345a');
      this.ghost.clear();
      this.drawZone();
      return;
    }

    this.score += perfect ? 3 : 1;
    if (perfect) {
      this.streak += 1;
      this.pauseBank += PERFECT_PAUSE;
      this.showText(this.streak >= 2 ? 'Perfect x' + this.streak : 'Perfect!', d.x, '#2f9e44');
      Sfx.perfect(this.streak);
    } else {
      this.streak = 0;
    }
    this.scoreText.setText(String(this.score));
    this.tweens.add({ targets: this.scoreText, scale: { from: 1.25, to: 1 }, duration: 180, ease: 'Back.easeOut' });

    // The ghost starts again right next to the new domino.
    this.ghostGap = GHOST_NEAR;
    this.ghostDir = 1;
  }

  // ---------- The falling wave ----------

  // How long the next domino takes to fall. The further ahead you are, the faster the wave
  // goes, so it always stays close behind you.
  fallTime() {
    const base = Math.max(FALL_MIN, FALL_START - FALL_STEP * this.dominoes.length);
    const lead = this.dominoes.length - 1 - this.front;
    let factor = 1;
    if (lead <= 2) factor = 1.3;
    else if (lead >= 7) factor = 0.25;
    else if (lead >= 6) factor = 0.4;
    else if (lead >= 4) factor = 0.7;
    if (this.state === 'failing') factor = 0.35;
    return base * factor * 1000;
  }

  // Tip over the domino at the front of the wave.
  fallNext() {
    const d = this.dominoes[this.front];
    const next = this.dominoes[this.front + 1];
    const speedUp = 1 - (this.fallTime() / 1000 - FALL_MIN) / (FALL_START * 1.3 - FALL_MIN);

    // Nothing in front: the wave caught you.
    if (!next) {
      this.tweens.add({ targets: d.gfx, angle: 90, duration: this.fallTime(), ease: 'Quad.easeIn' });
      this.time.delayedCall(this.fallTime(), () => this.gameOver('Caught!'));
      return;
    }

    // The next one is too far: this one falls flat and misses.
    if (next.gapState === 'far') {
      this.tweens.add({
        targets: d.gfx, angle: 90, duration: this.fallTime() * 1.2, ease: 'Quad.easeIn',
        onComplete: () => this.gameOver('Gap!')
      });
      return;
    }

    // The next one is too close: they jam and wobble.
    if (next.gapState === 'close') {
      this.tweens.add({
        targets: d.gfx, angle: 12, duration: this.fallTime() * 0.5, ease: 'Quad.easeIn',
        onComplete: () => {
          this.tweens.add({ targets: [d.gfx, next.gfx], x: '+=3', duration: 50, yoyo: true, repeat: 4 });
          this.gameOver('Jammed!');
        }
      });
      return;
    }

    // Normal: fall until touching the next one, then the next one starts falling.
    const gap = next.x - d.x - DOMINO_W;
    const contact = Phaser.Math.RadToDeg(Math.asin(Math.min(1, gap / DOMINO_H)));
    const wait = this.pauseBank;
    this.pauseBank = 0;
    this.tweens.add({
      targets: d.gfx,
      angle: contact,
      duration: this.fallTime(),
      delay: wait,
      ease: 'Quad.easeIn',
      onComplete: () => {
        Sfx.clack(Phaser.Math.Clamp(speedUp, 0, 1));
        d.fallen = true;
        // Keep leaning a bit more as the next one goes down.
        this.tweens.add({ targets: d.gfx, angle: Math.min(78, contact + 30), duration: this.fallTime(), ease: 'Sine.easeOut' });
        this.front += 1;
        this.fallNext();
      }
    });
  }

  // ---------- Every frame ----------

  update(time, delta) {
    // The ghost slides back and forth in front of the chain.
    if (this.state === 'ready' || this.state === 'playing') {
      const speed = Math.min(GHOST_SPEED_MAX, GHOST_SPEED_START + GHOST_SPEED_STEP * this.dominoes.length);
      this.ghostGap += speed * (delta / 1000) * this.ghostDir;
      if (this.ghostGap > GHOST_FAR) { this.ghostGap = GHOST_FAR; this.ghostDir = -1; }
      if (this.ghostGap < GHOST_NEAR) { this.ghostGap = GHOST_NEAR; this.ghostDir = 1; }
      this.drawGhost();
    }

    // The view shows both the front of the wave and the newest domino (with room for the ghost).
    const cam = this.cameras.main;
    const frontX = this.dominoes[Math.min(this.front, this.dominoes.length - 1)].x;
    const lastX = this.last().x;
    let target = (frontX + lastX) / 2 - GAME_WIDTH / 2 + 40;
    target = Math.max(target, lastX - (GAME_WIDTH - 110));
    cam.scrollX += (target - cam.scrollX) * Math.min(1, delta / 120);
    this.drawGround();
    this.drawZone();

    // Warn when the wave is close.
    const lead = this.dominoes.length - 1 - this.front;
    if (this.waveStarted && this.state === 'playing') {
      this.leadText.setText(lead <= 2 ? '⚠ the wave is right behind you!' : '');
    } else {
      this.leadText.setText('');
    }

    // Forget dominoes far behind the view, so the game stays fast.
    const first = this.dominoes[0];
    if (this.dominoes.length > 40 && first.fallen && first.x < cam.scrollX - 200) {
      first.gfx.destroy();
      this.dominoes.shift();
      this.front -= 1;
    }
  }

  // ---------- Messages ----------

  showText(label, worldX, color) {
    const t = this.add.text(worldX, GROUND_Y - DOMINO_H - 40, label, {
      fontFamily: FONT, fontSize: '26px', color: color, stroke: '#ffffff', strokeThickness: 6
    }).setOrigin(0.5).setDepth(50).setScale(0.5);
    this.tweens.add({ targets: t, scale: 1, duration: 150, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, delay: 500, duration: 400, onComplete: () => t.destroy() });
  }

  gameOver(reason) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.restartAllowedAt = this.time.now + 500; // ignore taps for half a second
    this.ghost.clear();
    this.zone.clear();
    Sfx.fail();
    this.cameras.main.shake(200, 0.01);

    const newBest = this.score > this.best;
    if (newBest) {
      this.best = this.score;
      try { localStorage.setItem('domino-best', String(this.best)); } catch (e) { /* ignore */ }
    }
    this.bestText.setText('best ' + this.best);

    const lines = [reason, 'Score ' + this.score + (newBest ? '  NEW BEST!' : ''), 'Tap to play again'];
    const t = this.add.text(GAME_WIDTH / 2, 320, lines.join('\n'), {
      fontFamily: FONT, fontSize: '30px', color: '#2b2340', align: 'center', lineSpacing: 12
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'domino-game',
  scale: {
    mode: Phaser.Scale.FIT,               // keep the phone shape, as big as the window allows
    autoCenter: Phaser.Scale.CENTER_BOTH, // put it in the middle
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  scene: [DominoScene]
};

window.dominoRush = new Phaser.Game(config);
