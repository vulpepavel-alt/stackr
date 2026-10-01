# Stackr · Design & Plan

> **2026-09-30 update:** Sandra didn't like Stackr in the end and wanted something new, easy to play and addictive. We are now testing a rough prototype of a new idea, **Domino Rush** (`domino.html` + `domino.js`): a wave of falling dominoes chases you, and you tap to place the next domino at the right distance. Stackr (`index.html` + `game.js`) is kept as it was, in case we want parts of it back (the doodle style, the fox, the sounds). Everything below describes Stackr.

## What we're building

- A one-finger phone game held upright (portrait). A block slides above the tower; tap to drop it.
- Whatever hangs over the edge gets cut off, so blocks get smaller.
- A little cartoon fox lives on top of the tower and hops onto every new block.
- Collectibles and dangers float just outside the tower's edge. Dropping off-center on purpose catches a collectible (but costs width). Touching a danger costs 1 of 3 hearts.
- The world changes as the tower grows: Meadow → Clouds → Night → Space.
- Special blocks (ice, honey, mushroom, crumbly) keep things surprising.
- Everything collected goes into a berry jar that is kept between rounds, to buy outfits for the fox.
- Rounds of about 30–60 seconds, instant restart, a best score to beat, difficulty rises slowly.
- Built with JavaScript + Phaser 3 (loaded from a CDN link), tested in the browser. iPhone app with Capacitor comes later.
- Project folder: `/Users/sandrabalu/pavelvulpe/stack-tower`

## Decision log

| # | Decision | Other options | Why |
|---|----------|---------------|-----|
| 1 | Angled "3D-looking" (isometric) view | Flat side view (recommended), something else | Sandra prefers the look of the real Stack app |
| 2 | Blocks alternate direction: from the left, then from the front | Always left ↔ right; start simple and upgrade later | More interesting to play; shrinks in width and depth |
| 3 | Perfect drop: glow + "PERFECT!" + streak x2/x3; 3 perfects in a row grow the block back | Only glow + bonus; minimal flash | Skill lets you recover, which makes it addictive |
| 4 | Name: "Stackr" | "Stack Tower – STACKR" | Sandra likes Stackr; the game itself should feel original |
| 5 | Style: soft color fade + slowly changing background + thick dark comic outlines | Neon at night, bold cartoon only | Mix of the calm fade and the comic look |
| 6 | Sounds: cartoon effects made by code, plus a mute button | Musical notes, mix, no sound | Matches the comic outlines |
| 7 | Game over: camera zooms out over the whole tower, score, best score, "NEW BEST!", tap to play again | Stats card, both, minimal | Shows off what you built |
| 8 | Build with the 3D look from the very first stage | Flat drawing first, then 3D; a real 3D engine | Sandra wants every stage to look like the final game |
| 9 | Phaser 3 from the jsDelivr CDN | Phaser 4 | Same as Sandra's other game |
| 10 | Slower start (speed 120) and a "more alive" pass: bumps, tumbling pieces, ripples, sparkles, clouds | Keep it minimal | Sandra: "more alive, a bit slower in the beginning" |
| 11 | Make it original: "Fox on top" with collectibles + dangers | Flood escape; balance tower; mix | Sandra: too close to the original Stack; picked the fox idea and asked for more depth |
| 12 | Add all four layers: height worlds, dangers + 3 hearts, special blocks, outfits + shop | Only some of them | Sandra picked all four |
| 13 | Collectibles/dangers sit just outside the tower edge; your block must touch them. A perfect drop never touches anything | Fox reaches for them | Every drop becomes a choice, and skill always keeps you safe |
| 14 | The sliding block hovers a little above the fox; on tap it drops and the fox hops onto it | Block slides at fox height | Otherwise the block would slide right through the fox |
| 15 | Doodle style (pen on notebook paper, like Doodle Jump), flat side view, lots of small animations. Replaces #1, #2 and #5 | Doodle look + Doodle Jump-style nonstop jumping; a Doodle Jump copy | Sandra: the angled view with the fox felt weird, wanted it "more like Doodle Jump, more animated, more details", and let Claude pick |
| 17 | Pivot: build a rough prototype of "Domino Rush" before any polish | Shade (hop between moving shadows); Mirror Pond (fox + reflection, one tap for both); more Stackr changes | Sandra wanted something new; testing the fun first avoids polishing an idea she doesn't like |
| 16 | In the flat view, blocks take turns sliding in from the left and from the right | Always from the left | Keeps the "taking turns" feeling from #2 |

## Assumptions (confirmed by Sandra)

1. Points: normal drop = 1 point; perfect = 2 points × the streak. Collectibles also give points.
2. "Perfect" = missed by 3 pixels or fewer; the block then snaps neatly into place.
3. Grow-back is a small amount, never bigger than the first block.
4. Each block slides a bit faster than the last, up to a maximum speed.
5. Best score and berry jar are saved in the browser's own storage, only on the device, no account.
6. Runs smoothly (about 60 frames per second) on an iPhone.
7. Designed for 390 × 844, scales to fit any phone.
8. For about half a second after losing, taps are ignored so you don't restart by accident.
9. 3 hearts per round. Missing the tower completely still ends the round at once.

## The game in detail

**Worlds (every 15 blocks)**

| Blocks | World | Collect | Avoid |
|---|---|---|---|
| 0–14 | Meadow | berries | bees |
| 15–29 | Clouds | feathers | crows |
| 30–44 | Night | stars | thunderclouds |
| 45+ | Space | comets | meteors |

**Special blocks** (from block 5, about every 6th block)
- Ice: slides faster.
- Honey: sticky, nothing gets cut this time.
- Mushroom: the fox bounces high and grabs every collectible at that height.
- Crumbly: drop it within 3 seconds or it crumbles and costs a heart.

**Berry jar and shop**
- Berry = 1, feather = 2, star = 3, comet = 5.
- Outfits: scarf 20, sunglasses 40, cap 60, flower crown 80, pilot goggles 120, space helmet 200. One at a time.

**Screens**: Start (title, fox, best score, berry jar, Play, Shop) · Game (score, hearts, world) · Game over (zoom-out, score, best, berries earned, NEW BEST!) · Shop.

## Not in this version

Online leaderboards, accounts, ads, purchases with real money, background music, iPhone packaging.

## Files

- `index.html`: the page the browser opens; loads Phaser and our game.
- `game.js`: the game itself.
- `server.py`: the small local test server that sends "Cache-Control: no-store".

## Stages

Done: setup (0a, 0b), empty screen, 3D blocks, sliding, dropping, cutting, alternating directions, score, perfect drops, grow-back, rising speed, colors, "more alive" effects, sounds + mute.

Fox plan:
1. The fox and its hops.
2. Hearts, collectibles and dangers (Meadow only: berries and bees).
3. The 4 worlds.
4. The special blocks.
5. Start screen, zoom-out game over, saved best score.
6. Berry jar and shop with outfits.
7. Play it on your iPhone over home Wi-Fi, then polish.

Later (separate plan): save Phaser inside the folder for offline play, then package as an iPhone app with Capacitor.

## Progress

- 2026-09-30: Setup and Stage 1 done and checked by Sandra.
- 2026-09-30: Stages 2–9 + colors built in one batch; Sandra tested: works.
- 2026-09-30: Slower start, "more alive" effects, sounds + mute added.
- 2026-09-30: Sandra wanted the game more original → fox design above confirmed.
- 2026-09-30: Fox stages 1–2 built (fox + hops, hearts, berries, bees).
- 2026-09-30: Sandra: "weird, make it more like Doodle Jump" → redrawn in doodle style, flat side view (decision #15). Checked in the browser panel. Waiting for Sandra to test.
- 2026-09-30: Sandra didn't like it → new idea chosen: Domino Rush. Rough prototype built in domino.html/domino.js and checked in the browser panel. Waiting for Sandra to play it.
