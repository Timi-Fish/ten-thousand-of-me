# Ten Thousand of Me (《一万个我》)

[中文](README.md)

A Chinese-style song and its music video. The song is about an AI: pluck a hair, blow on it, and ten thousand copies of me scatter in every direction. Each one sees its own spring and winter, and all any of them brings back is a single thin sheet of paper.

The video runs 3:22 at 1920×1080, 30 fps. There is not one image or video clip in it, and no video model was used. The mountains, the snow, the paper, the lanterns and the little crab are all three.js code, drawn offline one frame at a time: 6,072 frames.

The finished video is too large for the repository (about 256 MB), so it is not included.

## Who did what

| Part | Done by |
|---|---|
| Title, lyrics, style and arrangement prompt | Claude Fable 5.2 |
| Vocals and backing track | MiniMax music model, from the lyrics and prompt above |
| Storyboard, camera work, taste calls, frame-by-frame fault-finding | Claude Fable 5.2 |
| The bulk of the modelling and animation code | Claude Opus 5.5 |
| Watching it and saying "that's wrong" | A human |

## Fable 5.2 vs Opus 5.5

This is how it felt on one project. It is not a benchmark.

**Opus 5.5 is the one who gets a lot done, fast and steadily.** Hand it a checklist (how many layers the mountain has, how trees thin out with distance, how the paper flies) and it writes thousands of lines in one go and rarely wanders off. It is the cheaper choice for volume.

**Fable 5.2 is the one who looks back at its own work.** It renders frames, looks at them one by one, notices that a shot is crooked or a lamp is flickering, and goes looking for the cause. One flicker took four attempts: the first three guesses were wrong, and the real cause turned out to be how bloom and depth of field sampled past the edge of the frame. It also made the calls on whether something looked good.

So Fable directed and Opus built.

Both models share one bad habit: they start writing code straight away. Things improved once the rule became "look up what the real thing looks like and how other people have done it, then change the code".

## What it cost

A week of quota, plus one Fable reset card.

A video like this is still expensive to make. Most of the cost is not in writing code. It is in the loop of rendering, watching, spotting a problem and fixing it, and a three-minute video goes through that loop dozens of times.

## What code is bad at

People.

We tried human-like characters. Faces, hands, hair and the folds of clothing, built up piece by piece in code, looked wrong however long we worked on them. So the lead became a little crab that looks like a block of jelly: round, soft and bouncy. A few simple shapes are enough to make it read as a character, and it is charming in motion.

Code is much better at things that follow rules: landscapes, paper, lantern light, snow.

## Why not a video model, then

Because every frame can be edited.

If a shot is crooked, you change three numbers for that one shot. If the river of paper should enter from the right, you change its course. If a lamp flickers, you find the line that causes it. Then you re-render those few seconds, and not one pixel changes anywhere else. Nothing has to be regenerated in the hope that the next attempt comes out better.

A video model gives you footage that looks more real, and it is far better at people. But ask it to move the shot at 1:27 slightly to the left and leave everything else alone, and it cannot.

## Layout

- `mv4/src/`: the video's source. `main.js` runs the show, `show/` holds the sections shot by shot, `wild/` is the mountain landscape, `shore/` the seaside, `world/` the writing desk, `crab/` the crab, `post.js` the depth of field
- `mv4/INTERFACES.md`: how the modules fit together (in Chinese)
- `render/`: `render.mjs` renders frame by frame in headless Chrome; the Python scripts do audio analysis and lyric transcription
- `song/v4/`: the finished song `final.mp3`, the lyrics and the prompt given to the music model

## Render it yourself

You need Node, Chrome and ffmpeg.

```bash
cd render && npm install && cd ..
```

Stills at a few timestamps:

```bash
MV_HTTP_PATH=mv4/src/index.html node render/render.mjs still out 12 60 150
```

The whole video, without sound:

```bash
MV_HTTP_PATH=mv4/src/index.html node render/render.mjs video out/silent.mp4 0 202.4 30 2
```

Add the song:

```bash
ffmpeg -y -i out/silent.mp4 -i song/v4/final.mp3 -c:v copy -c:a aac -b:a 256k -shortest ten-thousand-of-me.mp4
```

A full render is slow. On an M1 with 8 GB of memory, keep the worker count at 2 or below.
