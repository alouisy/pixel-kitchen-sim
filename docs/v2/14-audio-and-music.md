# 14 · Audio and Music

Sound carries half of the "juice" and most of the comedy. V1's procedural WebAudio synth (`audioManager.js`: pop, place, chop noise bursts, fry, ding) is charming and costs nothing to download. V2 keeps it as a layer and builds a full, adaptive soundscape around it.

---

## 1. Pillars

1. **Food sounds delicious:** sizzles, crunches and pops are the most polished sounds in the game.
2. **Everything is readable by ear:** each hazard telegraph, doneness band and partner ping has a distinct sound. You can play by ear with your eyes on the food.
3. **The music follows the Giant:** the music *is* the Giant's mood and the belly's urgency.
4. **Giants sing:** each Giant has a vocal identity (made-up language hums and grumbles), the emotional core of the Big Bite.

## 2. Mixer architecture

```
SFX (sampled, spatial) ──┐
SFX (procedural, V1)  ───┤──▶ SFX Bus ──┐
Giant Vocals ────────────┤──▶ Giant Bus ┤
Music stems ─────────────┴──▶ Music Bus ┼──▶ Master (limiter) ──▶ out
Voice chat (11) ─────────────▶ Voice Bus┘         │
                                                  └──▶ Clip recorder tap
```

- Every bus has its own volume setting. **Ducking:** voice ducks music by −4 dB; the Big Bite ducks the SFX bus by −6 dB for the drumroll.
- **Spatial SFX:** `PannerNode` (equal-power for most sounds, HRTF for close hazards) positioned from simulation events. The listener follows the local chef, not the camera, so the sound is "where I am".
- **Voice limiting:** at most 32 simultaneous SFX voices, prioritized (hazard telegraphs > tools > food > ambience).

## 3. Sound design by category

| Category | Approach | Examples |
|---|---|---|
| **Cooking** | Sampled loops whose layers are driven by the simulation: sizzle intensity follows the average surface temperature, pitch rises slightly toward char | Sizzle, bubble, crackle, *the "about to burn" hiss* (a warning cue) |
| **Cutting** | Sampled one-shots, chosen by material hardness (soft, crisp, hard, squishy), ±8% pitch | Chop, slice, squelch, crunch |
| **Tools** | A signature sound per tool, with an analog loop driven by the trigger | Torch roar, Frost Fan whoosh, Ladle splat |
| **Chefs** | Gibberish voices (procedural babble with a per-player pitch), footsteps by ground material | Quick-chat phrases, efforts, "oof" |
| **UI** | **V1's procedural synth**, kept: pop, place, ding, error | Menu blips, pickup pop |
| **Giants** | Recorded vocal performances in an invented language, layered with a low synthesized "body" rumble | Hums, grumbles, sniff, chew, reactions |
| **Ambience** | Biome beds plus randomized one-shots | Meadow birds, glacier creaks, dune wind |
| **Hazards** | Every hazard has a *telegraph* sound 0.8–1.5 s before it | Stomp rumble, sneeze inhale, tail whoosh |

## 4. Adaptive music

- **Per chapter:** one theme in **4 stems** (bed, rhythm, melody, "panic" layer). Instruments match the biome (marimba and ocarina for the Meadow, celesta and strings for Sorbet Peaks…).
- **Vertical layering** (stems fade in and out), driven by simulation values:
  | Stem | Driven by |
  |---|---|
  | Bed | Always on |
  | Rhythm | Director intensity > 0.35 |
  | Melody | Giant mood > −20 (a happy Giant gets the full tune) |
  | Panic | Belly in Hungry or HANGRY: a doubled tempo feel and percussion |
- **Horizontal transitions** on musical bars (quantized to the next downbeat) for the Big Bite call (a key change), the Set Pieces (a stinger) and Results.
- **The Big Bite** uses a fixed scored cue: a build-up, a drumroll during the chew, and one of 4 resolution stingers by tier (Perfect fanfare, Great jingle, Okay "meh" trombone, Yuck tuba).
- **Tempo** targets 100–128 BPM for service music: energetic, not stressful.

## 5. Production and formats

- **All music is original** and commissioned or composed for the project, so it's stream-safe with no content-ID claims. This is important for streamer virality.
- Formats: Opus in WebM (Chrome, Firefox, modern Safari) with an AAC fallback. Stems are 48 kHz, around 96 kbps, streamed per chapter (about 3–5 MB per chapter).
- SFX are about 220 one-shots and loops, roughly 4 MB total, in a lazy-loaded sprite per category.
- **Budget:** under 400 KB of core audio in the lobby bundle (V1 synth plus UI and lobby ambience).

## 6. Accessibility

- Separate volume sliders (master, music, SFX, Giant, voice).
- A **visual sound indicators** option: on-screen directional markers for hazard telegraphs and off-screen fire.
- A **mono audio** option.
- Subtitles for Giant vocals (they're nonsense words, but subtitles give the *intent*, such as "*grumbles hungrily*").
