# RTX Video Unblock（原型）

[English](README.md) | 中文

适用于 Windows + NVIDIA RTX 显卡的 Chrome / Edge 扩展。网页里有些看不见的元素，会让 NVIDIA RTX Video（VSR 超分 / RTX HDR）对浏览器里的视频不起作用。这个扩展会把它们清掉；如果挡住视频的是看得见的东西，它会提醒你。

原理和实测数据见 Framegen 的
[docs/rtx_video.md](https://github.com/zizhenliu0427/Framegen/blob/main/docs/rtx_video.md)（英文）。

## 为什么会不生效

只有 Chromium 把视频交给系统、以 DirectComposition overlay 方式显示时，驱动才能增强它。下面两种情况，Chromium 会放弃 overlay：

- 同一帧里有第二个视频（判定码 `DCLayerResult` 8）。比如网站用来解锁自动播放的 1×1 像素 `<video>`。
- 视频上方有带 `backdrop-filter`（毛玻璃）的元素（判定码 11）。比如藏在 `overflow: hidden` 播放器外侧、被裁到看不见的毛玻璃抽屉。

这两种元素在页面上都看不到，所以表现出来就是 RTX Video 莫名其妙不生效。窗口宽度变了、开了 DevTools、或者换了一种进入页面的方式，结果都可能不一样。

## 它做了什么

在每个有视频（至少 200×112 CSS 像素）的 frame 里，每 250 毫秒检查一次：

- 把面积不超过 16 平方 CSS 像素的其他视频隐藏（`visibility: hidden`）；
- 对贴着视频（一个设备像素以内）、但可见部分不到一个设备像素的元素（已经算上视口和 overflow 裁剪），去掉它的 `backdrop-filter`；它一旦滑出来变得可见，马上恢复；
- 看得见的遮挡（比如盖在画面上的毛玻璃控制栏、另一个可见的视频）只报告，不处理。

视频消失或扩展被移除时，所有改动都会还原。

## 工具栏图标

| 图标 | 含义 |
|---|---|
| 绿色数字 | 本页清掉了几个看不见的遮挡（鼠标悬停可看列表） |
| 橙色 `!` | 有看得见的东西挡住了 RTX Video，悬停可看是什么 |
| 无 | 页面上没有视频，或者没有遮挡 |

详细信息也会输出到 DevTools 控制台，前缀是 `[RTX Video Unblock]`。

想确认视频到底有没有走 overlay：打开 `edge://histograms/#DirectComposition`（Chrome 里是 `chrome://`），找 `GPU.DirectComposition.DCLayerResult.Video.Clear`，桶 0 就表示成功。

## 安装

打开 `edge://extensions`（或 `chrome://extensions`）→ 开启开发者模式 → 加载解压缩的扩展 → 选择本文件夹。

## 测试结果（屏幕外 Chromium，2552×1313，150% 缩放，未登录）

| 页面 | 原样 | 装上扩展后 | 图标 |
|---|---|---|---|
| yifan.tv《雷神3》 | 8 + 11 | 0 | 2 |
| yifan.tv《名侦探柯南》（直接打开） | 8 | 0 | 2 |
| B 站、YouTube、Twitch、AcFun | 0 | 0 | 无 |
| 在 B 站视频上人为盖一个可见毛玻璃 | 11 | 11 | ! |

## 局限

- 只清除看不见的遮挡；看得见的属于网站的设计，不去改。
- 每个 frame 单独处理：如果视频在 iframe 里，而遮挡在外层页面上，是检测不到的。
- 扩展读不到 `chrome://histograms`，所以图标只是根据页面结构判断的；以直方图为准。
- 和 Framegen 里的"RTX Video 页面修复"做的是同一件事，两者不要同时开。

## 许可证

[MIT](LICENSE)
