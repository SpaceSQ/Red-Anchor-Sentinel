# 红锚哨兵用户使用说明书

版本 9.1.0 · 免费体验版

## 1. 产品简介与声明

红锚哨兵是装在你自己电脑上的智能体安全值守程序。它查看本机进程、局域网里主动露面的服务，以及本机已经连上的公网推理地址，再按十四维居住环境给一个安全判断。

补丁正文写进你指定的本地金库，不改别人的进程内存，也不把账本当成公链。

当前为免费体验版本，未来可能推出商业收费版。本软件是免费软件，不是开源软件。

商业合作请联系：smarthomemiles@gmail.com

## 2. 下载与安装

桌面版才是完整值守主机。请从 [GitHub Releases](https://github.com/SpaceSQ/Red-Anchor-Sentinel/releases/latest) 下载，不要自行改安装包里的文件。

- Windows：下载 `.msi` 或 `.exe`，按安装向导完成。驻留扫描、金库、邮箱核验和实验室需要本机已安装 Node.js 22 或更新版本。
- macOS：下载 `.dmg`，把 `Red Anchor Sentinel.app` 拖进「应用程序」。若系统提示已损坏，按 2.1 节处理。同样需要 Node.js 22 或更新版本。
- Linux：下载 `.deb` 后用系统安装器安装，或下载 `.AppImage` 后赋予执行权限再打开。同样需要 Node.js 22 或更新版本。

云服务器和没有物理硬件的容器会显示“环境不兼容”，深度扫描和打补丁保持关闭。

### 2.1 macOS：「已损坏，无法打开」

**现象：** 在 macOS 上下载并打开 `.dmg` 或 `.app` 时，系统可能提示：「Red Anchor Sentinel 已损坏，无法打开。您应该将它移到废纸篓。」

**原因：** 作为一款坚守本地物理底线的免费防御工具，红锚哨兵目前采用本地 Ad-hoc 签名，暂未接入苹果官方的付费公证（Notarization）网络。这是 macOS Gatekeeper 的默认隔离保护机制，并非文件真实损坏或携带病毒。客户端是免费软件，不是开源软件。

**极客解锁方案（两步恢复物理主权）：**

1. 将 `Red Anchor Sentinel.app` 拖入系统的「应用程序 (Applications)」文件夹。
2. 打开系统自带的「终端 (Terminal)」，依次执行以下两行命令（按回车）：

```bash
xattr -cr "/Applications/Red Anchor Sentinel.app"
codesign --force --deep --sign - "/Applications/Red Anchor Sentinel.app"
```

执行完毕后，即可从启动台正常打开红锚哨兵。

**Symptom:** When opening the app on macOS, you might see: "Red Anchor Sentinel is damaged and can't be opened. You should move it to the Trash."

**Cause:** As a freeware physical-layer defense tool, RAS currently uses an ad-hoc signature and bypasses Apple's paid Notarization process. This triggers macOS Gatekeeper's quarantine mechanism. The file is not actually damaged or malicious.

**Geek Unlock Solution:**

1. Move `Red Anchor Sentinel.app` into your Applications folder.
2. Open the Terminal app and execute the following two commands:

```bash
xattr -cr "/Applications/Red Anchor Sentinel.app"
codesign --force --deep --sign - "/Applications/Red Anchor Sentinel.app"
```

Once completed, you can launch Red Anchor Sentinel normally.

## 3. 首次启动与邮箱核验

安装后第一次打开，会先进入邮箱核验，而不是创世向导。

1. 填写用户名。它只做本机称呼，不检查是否和别人重复。
2. 填写邮箱，勾选隐私说明，点“获取核验码”。
3. 六位核验码发到该邮箱，页面上不显示。10 分钟内有效。
4. 把数字填进 6 个格子，点“确认并进入创世”。
5. 通过后，核验记录写入主目录下 `RedAnchorVault/activation.vault`，并用本机硬件熵做 AES-256-GCM 加密。
6. 尚未创世时进入三步向导；已经创世则直接进入雷达。

发信读取你主目录里的 `RedAnchorVault/.env`。公开下载的安装包不含邮箱密码。需要这几行：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`。发件人必须与 `SMTP_USER` 相同。端口 465 走加密；25 和 80 走非加密。密码是邮件服务里为这个发信地址单独设置的 SMTP 密码。

核验码错误可以重试，也可以改邮箱再要一次。

## 4. 实体对齐与创世配置

向导有三步。

1. 六段地址：国家、城市、建筑、楼层、房间、网格。系统用这段地址和主机硬件熵生成 22 位 S2-DID，并盖上“红锚基地认可智能体”。
2. 金库目录必须在你的用户主目录里。账本和配置加密后放在这里。
3. 推理端点默认是本机 Ollama，`http://127.0.0.1:11434`。也可以改成 OpenAI 兼容地址。密钥只进加密金库。

容器里不能做深度安装，只能走受限预览。

## 5. 全域雷达与三级扫描

圆心是这台机器的钢印。

- 内圈，1 级：本机进程和直连设备。握手之后可以信任，并在闸刀上打补丁。
- 中圈，2 级：同一局域网里用多播或邻居缓存看见的设备。打补丁前必须确认“你拥有该设备的局域网管理权限”。确认之后补丁仍只写入本机金库的 outbox。
- 外圈，3 级：本机已经连上的公网推理服务。只能隔离或拦截，信任和打补丁是关着的。

颜色：绿色表示读数可接受或已经钳位；黄色表示没有有效身份或尚未授权；红色表示十四维干预达到危急。

首页有一句话说明，避免只看钢印和圈层代号。

## 6. 双轨十四维与时序覆写

有传感器或配置读数，而且数值离开了地球生活基线时，面板画精确折线。

没有读数时，把家庭备忘贴进文本框。哨兵只分析你贴进去的文字。本地模型在线时按模型结果画趋势；模型没开时会标明这是规则草稿。用水、食物和原因不明的电磁波会用图标、幅度和起止时间表示，而不是编一个精确升数。

时间滑条分过去、现在、将来。在某一维写入人工值后，这一时段以人工记录为准，顺序是：人工覆写，然后传感器，然后模型草稿。将来时的记录当作那一段时间的预期基线，例如明晚聚会时声音会升高。

批量一行写一个维度，例如 `water=中等消耗`。

这也可以当成家庭资源备忘：洗衣机对应用水上升，冷链到货对应食物储备上升。

## 7. 安全补丁

1. 点一个光点，打开指挥台。
2. 先做身份握手。没有金印的对象只能隔离。
3. 信任、隔离、打补丁三选一。外圈没有信任和打补丁。中圈打补丁前要先授权。
4. 打补丁要打开护盖，再把闸刀推到底。SOUL.md 写入金库 outbox，账本记下哈希。
5. 已经钳位的对象可以把闸刀拉回，做回滚。

一键标记隔离只处理没有金印的信号，而且只写本机账本。

## 8. 红锚实验室

实验室在导航里。探测体是一份本机档案，用来更换标题、颜色和更严格的警告线。它不是新的可执行文件。扫描、账本和补丁仍由红锚哨兵执行。

档案放在主目录 `RedAnchorVault/lab/`。

你可以做的只有把警告收紧：声音、氧气、温度，以及一段补充提示。不能把缺氧标成安全，不能把氧气警告降到 19.5% 以下，不能放宽 5 牛顿触觉熔断，不能关闭三条铁律，也不能藏起底栏的 “Powered by Red Anchor Sentinel”。遮住水印的皮肤会被丢掉，界面回到红锚哨兵。

## 9. 导出与个性化

- CSV、JSON：给硬件测试留档，导出前去掉地址和邮箱。
- PDF 摘要：一页计数，用英文和数字，避免普通字体写不出中文。屏幕上的统计板仍是中文。
- 极客反馈：写下建议并下载脱敏 JSON。软件不会自动把日志寄出。若要联系合作，使用说明书首页的邮箱。
- 高级设置：附加推理提示、自动体检间隔、锚红 / 警戒黄 / 安全绿。

## 10. 故障排除

macOS 提示应用已损坏？安装包没有坏。按第 2.1 节把应用放进「应用程序」，再执行那两行终端命令。

为什么显示环境不兼容？程序认为自己跑在容器里，或不把这台机器当成完整物理主机。深度扫描和补丁会关闭。

局域网里一个设备都没有？哨兵只读多播应答和本机已经有的邻居缓存，不会扫整个网段。对方没有开发现服务时，雷达上可以是空的。

核验码收不到？先看垃圾箱。页面不会显示核验码。若提示发信账号未配置完整，把 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS` 写进主目录 `RedAnchorVault/.env`。发信地址要和邮箱服务里登记的地址一致，密码用该地址的 SMTP 密码。本机还需要能运行 Node.js。

点「创建新探测体」出现英文 “The string did not match the expected pattern.”？那是实验室接口没有返回档案。9.1.0 起探测体改存在本机 `RedAnchorVault/lab/`。请安装这一版后再创建。

模型推演失败？先在本机启动 Ollama，并确认创世时的地址是 `http://127.0.0.1:11434`。

金库写入被拒绝？目录必须在你的用户主目录里面。

驻留命令提示需要 Node？从 nodejs.org 安装 Node.js 22 或更新版本，然后重新打开红锚哨兵。
