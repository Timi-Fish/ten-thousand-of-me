# 《一万个我》

[English](README.en.md)

一首国风歌，和它的 MV。歌讲的是 AI：拔下毫毛吹一口气，一万个我落向四方，各看各的春秋冬夏，回来只交一张薄纸。

这是一次纯代码生成的测试：看只靠写代码，能不能做出一支完整的 MV。全长 3 分 22 秒，1920×1080，30 帧。画面里没有一张图片、一段视频素材——山、雪、纸、灯、那只小蟹，全是 three.js 代码，一帧一帧离线画出来的，一共 6072 帧。

**[看成片（Release 下载，约 256 MB）](https://github.com/Timi-Fish/ten-thousand-of-me/releases/tag/v1.0)**

![片名](docs/shot-1.jpg)

| | |
|---|---|
| ![小蟹在书案上](docs/shot-2.jpg) | ![万张纸绕山回故乡](docs/shot-3.jpg) |
| ![雨里的瀑布](docs/shot-4.jpg) | ![冬夜下山的路](docs/shot-5.jpg) |
| ![云雾里的山](docs/shot-6.jpg) | |

## 谁做了什么

| 部分 | 谁做的 |
|---|---|
| 歌名、歌词、曲风与编曲提示词 | Claude Fable 5.2 |
| 人声和伴奏的合成 | MiniMax 音乐模型（照着上面的歌词和提示词生成） |
| 分镜、运镜、审美判断、逐帧挑毛病 | Claude Fable 5.2 |
| 大段的建模和动画代码 | Claude Opus 5.5 |
| 看片、提意见、说"这里不对" | 人 |

## Fable 5.2 和 Opus 5.5 差在哪

只是这一个项目里的体感，不是评测。

**Opus 5.5 是那个干活又快又稳的人。** 给它一份清单——这座山要几层、树怎么分远近、纸怎么飞——它能一口气写出几千行，照着做，很少跑偏。量大的活交给它最划算。

**Fable 5.2 是那个会回头看的人。** 它会把自己渲出来的帧截下来一张张看，发现"这个镜头歪了""这盏灯在闪"，然后去找原因。有一处灯光闪烁，前三次猜的原因都是错的，最后追到是泛光和景深在画面边缘取样的问题，才真修好。需要判断"好不好看"的地方，也是它拿主意。

所以分工就成了：Fable 当导演，Opus 当施工队。

两个模型都有同一个毛病：容易一上来就动手写。后来定了规矩，先去查真实的东西长什么样、别人怎么做的，再改，效果好很多。

## 花了多少

一周的额度，外加一张 Fable 重置卡。

现在做这样一支片子还很贵。大头不在写代码，在"渲出来、看、发现不对、再改"的来回上——一支三分多钟的片子，这样的来回有几十轮。

## 代码做不好什么

人。

试过做人形角色，脸、手、头发、衣服的褶子，用代码一点点搭出来，怎么看怎么别扭。所以主角换成了一只果冻块似的小蟹：圆的、软的、会弹，几个简单形状就能立住，动起来也讨喜。

山水、纸、灯火、雪这些有规律可循的东西，代码就拿手得多。
## 目录

- `mv4/src/`：MV 源码。`main.js` 总调度，`show/` 是一段一段的分镜，`wild/` 山水外景，`shore/` 海边，`world/` 书案，`crab/` 小蟹，`post.js` 景深
- `mv4/INTERFACES.md`：模块之间怎么对接
- `render/`：`render.mjs` 用无头 Chrome 逐帧渲染；几个 Python 脚本做音频分析和歌词转写
- `song/v4/`：成品歌曲 `final.mp3`、歌词和提交给音乐模型的提示词

## 自己渲一遍

要 Node、Chrome 和 ffmpeg。

```bash
cd render && npm install && cd ..
```

看某几秒的静帧：

```bash
MV_HTTP_PATH=mv4/src/index.html node render/render.mjs still out 12 60 150
```

渲整支（没有声音）：

```bash
MV_HTTP_PATH=mv4/src/index.html node render/render.mjs video out/silent.mp4 0 202.4 30 2
```

配上歌：

```bash
ffmpeg -y -i out/silent.mp4 -i song/v4/final.mp3 -c:v copy -c:a aac -b:a 256k -shortest 一万个我_MV.mp4
```

整支渲下来很慢，8 GB 内存的 M1 上并行数别开超过 2。
