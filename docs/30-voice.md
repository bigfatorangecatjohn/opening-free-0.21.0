# 30 · 语音选型：一条序列里的同一个「系统」

> 目标：开机序列的五步口令与三语收尾，都用**清亮、透彻、机械感**的女声念出来。
> 本文件是选型调研与试听清单。定稿后按 §决定后的动作 执行。

## 硬约束（决定选型的三条）

1. **音色必须一致**。序列里只有「一个系统」在说话，中文、俄语、英语是同一个声音在切换语种 —— 三种不同音色的 TTS 一播就露馅（像三个人轮流念）。
2. **素材是离线的**。最终只产出 8 条短音频（5 步 + 3 收尾），一次性生成、烤进 bundle，运行时不需要模型、不需要 GPU、不需要联网。
3. **本机可用**：RTX 4070 Laptop 8 GB（驱动 610.62）、CPU 未知但够用；Python 3.12.14。0.5B 级模型本地生成 8 条短句是分钟级的事。

## 候选对比（2026-10 实查）

| 库 | 许可证 | 中 | 俄 | 英 | 音色一致 | 备注 |
|---|---|---|---|---|---|---|
| **Chatterbox Multilingual V3**（Resemble AI） | **MIT** | ✅ | ✅ | ✅ | **✅ 跨语言克隆** | 0.5B，23 语；自带不可听水印 PerTh；有中文专用微调包 |
| XTTS-v2（Coqui） | CPML，**非商用** | ✅ | ✅ | ✅ | ✅ 跨语言克隆 | 17 语；2023 年老模型，音质不如 V3；Coqui 已解散，无商用授权渠道 |
| Kokoro-82M | Apache-2.0 | ✅ 4 女声 | ❌ | ✅ `af_heart` 官方 A 级 | ❌ 无俄语 | 英文最像人；**中文官方评级只有 D**；俄语没有 |
| CosyVoice 2 | Apache-2.0 | ✅ 中文最强 | ❌ | ✅ | ❌ | 中文自然度天花板，无俄语 |
| Silero v5 | CC BY-NC-SA | ❌ | ✅ `baya`/`kseniya`/`xenia` @48k | ❌ | ❌ | 俄语事实标准，断句与重音很准，音色清亮 |
| Magpie TTS Multilingual（NVIDIA） | NVIDIA Open Model | ✅ | ❌ | ✅ | ❌ | 12 语，无俄语 |
| Piper | GPL-3.0 | ✅ huayan | ✅ irina | ✅ 多 | ❌ | 极快极轻，但「medium」档，够不上「最高评价」 |

**结论**：只要坚持「同一个声音说三种语言」，同时满足 MIT 且覆盖中/俄/英的**只有 Chatterbox Multilingual V3**。其余方案要么缺俄语，要么必须接受三种音色。

## 试听清单（你自己听，约 5 分钟）

### 1. 首推：Chatterbox Multilingual V3
- 空间：https://huggingface.co/spaces/ResembleAI/Chatterbox-Multilingual-TTS-V3
- 官方样音页：https://resemble-ai.github.io/chatterbox_demopage/
- 模型卡：https://huggingface.co/ResembleAI/chatterbox（MIT，V3 的 README 与语言表在这里）

**怎么听**：把下面五句依次粘进去，语言分别切 `en` / `zh` / `ru`，**听中俄英三个版本是不是同一个人、是不是你要的「清亮透彻」**。这一段就是序列的真实台词。

```
ACCESS PERMISSION REQUIRED
需要访问许可
Требует разрешения на доступ

IDENTITY VERIFICATION
身份资料确认
Проверка личности

ACCESS REQUEST ACCEPTED
接受访问需求
Запрос на доступ принят

PERMISSION READ STARTED
开始读取权限
Начинаю чтение прав

READ COMPLETE · VERIFIED
读取完毕 · 核验通过
Чтение завершено · Проверено
```

收尾三句（同一页试）：

```
ДОБРО ПОЖАЛОВАТЬ, ТОВАРИЩ
欢迎回来，指挥员
WELCOME BACK, COMMANDER
```

### 2. 中文专用微调包（如果 V3 的中文不够准）
- https://huggingface.co/spaces/ResembleAI/Chatterbox-Multilingual-TTS-zh-cmn
- 只解决中文；俄语/英语仍走 V3，会有音色漂移风险，慎用。

### 3. 对照听：各语种各自的「最好」
- 英文 `af_heart`（Kokoro，官方 A 级）：https://huggingface.co/spaces/hexgrad/Kokoro-TTS
- 中文 `zf_xiaoyi`（Kokoro，官方评级 D，听个参差）：同上空间切 `z`
- 俄语 `baya` / `kseniya`（Silero v5，48 kHz）：https://github.com/snakers4/silero-models 的 Colab `examples_tts.ipynb`

听完这组对照，大概就能判断「一致但略平」和「各自最好但像三个人」哪边更值。

## 决定后的动作（我来做）

1. 建独立虚拟环境 `D:\DSH\Opening Design\.venv-tts`（**不动** `D:\DSH\.venv`，那边是 pdf2md 的）
2. `pip install chatterbox-tts`（连带 torch CUDA 轮子，约 3–4 GB）+ 模型约 2 GB 落到缓存
3. **参考音**：先用模型自带 default 出一版；若要「清亮女声」，喂它一段 6–10 秒的干净女声（CC0/公有领域，或你自己录一句），三语都跟着这个音色走
4. 生成 8 条 wav → 去首尾静音 → 转 128 kbps mp3
5. 装进 bundle：`assets/` 目录 + 宿主半加静态路由 `/dsh-opening/asset/<文件名>`（照参考项目的白名单写法）；客户端每步停留时间改为 `max(视觉基准, 音频时长 + 240ms)`，终幕三语按音频长度排
6. **机械感是后期，不是模型**：EVA 那种「合成人声」味靠渲染时一次性烤进入 —— 轻度 ring-mod、1.2–2 kHz 带通、轻微降采样/量化噪声；不做的话 Chatterbox 出来是自然人声，不够「终端」

## 待定

- [x] 你 选库 → **各语种最优**（m00327：接受「像三个人」，先出样音再听）
- [x] 参考音来源 → 不克隆，直接用各库自带女声
- [ ] 机械感强度（0 = 纯自然人声，1 = 明显合成器）
- [ ] 语速（当前 zh 约 2.6 s/句，比 EVA 慢，可能需要 1.1–1.2 倍速重生成）

## 实际执行的路线（2026-10-29 落地，与上面「决定后的动作」有出入）

沙箱边界推翻了两条原计划：**python 子进程只能写工作区内**，且**工作区内不能依赖删除**（ACL 有 `DENY(DC)`）。所以 HF / torch.hub 的缓存机制全部不可用，改为：

- `tools/fetch-models.py` — 用 urllib + 本机代理把权重直接下到 `.models\`：Kokoro `config.json` / `kokoro-v1_0.pth` / `voices/af_heart.pt` / `voices/zf_xiaoyi.pt`（hf-mirror.com 优先），Silero `v5_5_ru.pt`（models.silero.ai，138.7 MiB）。**必须校验 Content-Length**：断流时 urllib 读到的就是干净的 EOF，只有比对数才能识别截断（第一次只落了 1.3 MiB 却报成功）。
- `tools/install-spacy-model.py` — misaki 的英文 G2P 依赖 `en_core_web_sm`，缺失时 `en.G2P()` 会卡住而不是报错；spaCy 的 `download` 命令走 pip/网络不可用，改为下 wheel 后用 `zipfile.extractall(site-packages)` 直接装。
- `tools/make-samples.py` — `patch_local_models()` 把 `hf_hub_download`（连同 `kokoro.model` / `kokoro.pipeline` 里的同名引用）指向 `.models\kokoro`；Silero 用 `torch.package.PackageImporter(...).load_pickle("tts_models", "model")` 加载，绕开 torch.hub。

环境：`.venv-tts`（Python 3.12.14）含 torch 2.14.1 / kokoro 0.9.4 / misaki 0.9.4 / transformers 5.21.0 / soundfile 0.14.0 / omegaconf 2.4.0 / spacy 3.8.18 + en_core_web_sm 3.8.0。

### 已出的样音（`samples\`，16-bit mono）

| 文件 | 时长 | 采样率 | 说明 |
|---|---|---|---|
| `zh-full.wav` | 18.55 s | 24 kHz | `zf_xiaoyi`，五步 + 「欢迎回来，指挥员」，约 2.6 s/句 |
| `en-full.wav` | 14.75 s | 24 kHz | `af_heart`（官方 A 级），约 2.1 s/句 |
| `ru-full.wav` | 14.07 s | 48 kHz | Silero `baya`，约 1.9 s/句 |

单句在 `samples\wav\<lang>-<n>-<slug>.wav`，句间 0.45 s 静音拼成整段，峰值统一归一化到 89%。

## 许可备注

- Chatterbox 权重 MIT；**输出音频带 PerTh 不可听水印**（作者为溯源加的，不影响听感，转 mp3 也在）
- XTTS-v2 的输出仅限非商用（CPML）；本项目个人使用不冲突，但不建议写进任何要发布的东西里
- Silero 模型 CC BY-NC-SA，非商用
