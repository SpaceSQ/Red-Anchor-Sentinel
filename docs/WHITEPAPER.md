# 桃花源世界模型白皮书 V2.1

S2-Layer 动态图层协议与十四维张量数据标准

发布日期：2026年4月5日  
提出者：Miles Xiang & S2 Open Research Team  
领域：世界模型、空间计算、图层协议、十四维全息张量

## 摘要

本白皮书在 S2 动态图层（S2-Layer）的基础上，深度融合了 S2-SWM 十四维度全息参数矩阵。我们将智慧空间的要素精确划分为 6 大核心显性要素与 8 大隐性/极限环境要素。通过统一的张量化封装与“环境感知开关（Context-Aware Toggle）”，S2-Layer 不仅能向下兼容地球民用智能家居的可视化需求，更能向上支撑深空定居点、元宇宙物理引擎的数据流呈现。14 个维度的物理参数注入到 4 平方米的 SSSU 网格中时，空间不再是建筑学意义上的钢筋水泥，而是一台永不停歇的物理状态计算器。

## 1. 核心显性要素（Core 6）

核心六要素是全屋智能家居场景功能实现所需的基本要素，它们是人类在地球日常居住空间中感知最强烈、交互最高频的物理变量。在 S2-Layer 中，它们被转化为高频刷新的基础数据流。

### 光（Lumina）

包含阳光直射与漫反射光、人造光（智能照明）。

- 图层参数：`illuminance`（照度, Lux）、`color_temperature`（色温, K）、`sunlight_vector`（自然光入射向量）。
- UI 映射：在 BIM 图层中表现为动态的光斑渲染；在智能家居中映射为色温拾色器与光强数值。

### 空气（Atmos）

空气温湿度、风力与颗粒物。人体皮肤可感知的空气物理状态，决定空间的热力学舒适度。

- 图层参数：`temperature`（温度, °C）、`humidity`（相对湿度, %）、`wind_force`（风力/风速, m/s）、`particulate_matter`（颗粒物, μg/m³，如 PM2.5）。
- UI 映射：GIS 图层中的风场流线；智能建筑图层中的冷热等温线。

### 声音（Acoustic）

靠空气振动传播的声波。

- 图层参数：`noise_level`（声压级, dB，含环境白噪声与设备运行声）、`audio_stream`（音频流）。

### 电磁波（Wave）

智慧空间的设备联网离不开无线电波。

- 图层参数：`network_band`（频段，包括 WiFi、5G 等）、`signal_strength`（信号强度, dBm）。

### 电源（Energy）

建筑物空间的主要能源供应方式。

- 图层参数：`power_draw`（实时功率, W）、`voltage`（电压, V）。

### 视觉影像（Vision）

人对视觉感知的物质再现，分为静态图像和动态图像。

- 图层参数：`first_person_stream`（第一视角影像）、`broadcast_display`（空间内播放视频）。

## 2. 隐性 / 极限环境要素（Implicit 8）

隐性要素源自人类空间感知时获得的信息，但在地球大部分常规容器中表现为均一的恒量，或被局限在特定功能区。系统默认在“地球民用模式”下自动隐藏后 8 项隐性要素，将其静默锚定为地球物理常数。

- **基础空气（Base Air）：** 无色无味，维生必需。`nitrogen_ratio`（约 78%）、`oxygen_ratio`（约 21%）、`co2_ratio`（约 1%）。
- **气压（Atmospheric Pressure）：** `pressure_value`（绝对气压, kPa）。地球正常标准气压为 101.325 kPa。飞机舱等高度变化极大的移动空间需特别关注。
- **气味（Odor）：** 通过空气传播。`scent_vector`（如花香、食物香气）与 `concentration`（浓度等级）。
- **触觉感知（Tactile）：** 通过触碰获得环境信息。`haptic_feedback`（机械与温度反馈）。
- **磁场（Magnetic Field）：** 为生物提供定位和导航信息。`geomagnetic_vector`（地磁方位角）。
- **重力（Gravity）：** 地球对物体的引力。`g_force`（重力加速度, m/s²），地球上为 9.8 m/s²。在火星等星球上，重力不同。
- **水（Water）：** 生命的源泉。`water_supply`（供水可及性）。
- **食物（Food / Biomass）：** 维持身体活动所需能量的来源。`nutrient_availability`（营养补给可及性）。

第 15 种要素“暗物质”作为理论上存在的不可见物质，基本不参与电磁相互作用，当前版本暂不纳入张量计算。

## 3. 场景联动：客房睡眠模式的原始数据流

在 S2-Layer 中，宏观的“生活场景”被解构为 14 维张量的动态指令流。当第三方应用软件（如智慧社区 App）向 S2 图层请求“开启睡眠模式”时，S2 引擎会自动将其解析为底层数据矩阵。

存档原稿在这一节只留下了标题，JSON 正文是空的。下面这块按同一节已经定义的字段名补上，用来展示调用逻辑：应用层只提交目标张量，不直接去拧空调或关灯。

```json
{
  "scene": "guest_room.sleep_mode",
  "layer": "S2-Layer",
  "grid_m2": 4,
  "lumina": {
    "illuminance": 8,
    "color_temperature": 2700,
    "sunlight_vector": [0, 0, 0]
  },
  "atmos": {
    "temperature": 22,
    "humidity": 50,
    "wind_force": 0.05,
    "particulate_matter": 8
  },
  "acoustic": {
    "noise_level": 28,
    "audio_stream": "off"
  },
  "wave": {
    "network_band": "WiFi",
    "signal_strength": -62
  },
  "energy": {
    "power_draw": 40,
    "voltage": 220
  },
  "vision": {
    "first_person_stream": "off",
    "broadcast_display": "off"
  },
  "base_air": {
    "nitrogen_ratio": 78,
    "oxygen_ratio": 21,
    "co2_ratio": 1
  },
  "atmospheric_pressure": {
    "pressure_value": 101.325
  },
  "odor": {
    "scent_vector": "neutral",
    "concentration": 1
  },
  "tactile": {
    "haptic_feedback": 0.2
  },
  "magnetic_field": {
    "geomagnetic_vector": 0
  },
  "gravity": {
    "g_force": 9.8
  },
  "water": {
    "water_supply": "available"
  },
  "food": {
    "nutrient_availability": "idle"
  }
}
```

解析逻辑：应用层软件无需关心空调怎么开、灯怎么关，只需调用 S2-Layer 的目标张量状态。S2 智能体接收数据流后，会自动调度物理空间的要素供应源，使 SSSU 网格逼近上述的 14 维绝对参数，并在图层 UI 上反馈状态变迁。

---

# Taohuayuan World Model Whitepaper V2.1

S2-Layer dynamic layer protocol and the fourteen-dimension tensor standard

Published: 5 April 2026  
Authors: Miles Xiang & S2 Open Research Team  
Fields: world models, spatial computing, layer protocols, fourteen-dimension holographic tensors

## Abstract

This whitepaper sets the S2-SWM fourteen-dimension holographic matrix onto the S2 dynamic layer (S2-Layer). A wise space is split into 6 explicit core elements and 8 implicit or extreme-environment elements. One tensor envelope, plus a context-aware toggle, lets the layer serve an ordinary Earth home and still carry the data stream of a deep-space habitat or a physical engine for a metaverse. When those 14 physical parameters are poured into a 4-square-meter SSSU grid, the room is no longer only rebar and concrete. It is a physical-state calculator that does not stop.

## 1. The six explicit elements

These six are what a whole-home scene actually needs. They are the physical variables a person feels most often. On S2-Layer they become a high-rate base stream.

### Lumina

Direct sun, diffuse daylight, and artificial light.

- Layer fields: `illuminance` (lux), `color_temperature` (K), `sunlight_vector`.
- UI: moving light patches on a BIM layer; a color-temperature picker and a brightness number in the home.

### Atmos

Temperature, humidity, wind, and particles. This is the air a person’s skin can feel.

- Layer fields: `temperature` (°C), `humidity` (%), `wind_force` (m/s), `particulate_matter` (μg/m³, such as PM2.5).
- UI: wind-field lines on a GIS layer; hot and cold contours in a building layer.

### Acoustic

Sound carried by vibrating air.

- Layer fields: `noise_level` (dB, room noise and machine noise), `audio_stream`.

### Wave

Radios that keep the devices on the network.

- Layer fields: `network_band` (Wi-Fi, 5G, and the rest), `signal_strength` (dBm).

### Energy

The supply that keeps the building running.

- Layer fields: `power_draw` (W), `voltage` (V).

### Vision

A still image or a moving image of what a person sees.

- Layer fields: `first_person_stream`, `broadcast_display`.

## 2. The eight implicit elements

These are real to a person, yet in an ordinary Earth room they sit almost still, or they only matter in one corner of the plan. In Earth-residential mode the layer hides the last eight and pins them to Earth constants.

- **Base Air.** Breathable, and usually unnoticed. `nitrogen_ratio` (about 78%), `oxygen_ratio` (about 21%), `co2_ratio` (about 1% in this document’s Earth anchor).
- **Atmospheric Pressure.** `pressure_value` in kPa. The Earth standard here is 101.325 kPa. A cabin that changes altitude has to watch it.
- **Odor.** Carried in the air. `scent_vector` and `concentration`.
- **Tactile.** What touch reports. `haptic_feedback`.
- **Magnetic Field.** A cue for direction. `geomagnetic_vector`.
- **Gravity.** `g_force` in m/s². On Earth, 9.8. On Mars it is different.
- **Water.** `water_supply`.
- **Food / Biomass.** `nutrient_availability`.

A fifteenth element, dark matter, does not take part in ordinary electromagnetic interaction. This version leaves it out of the tensor.

## 3. Sleep mode as a raw stream

A life scene is a stream of 14-dimension orders. When an app asks S2-Layer to open sleep mode, the engine turns that request into the matrix below. The archived source named this scene and left the JSON body empty. The block uses the field names defined in this same paper, so an app can submit a target tensor without touching the air conditioner or the lamp itself.

The JSON block in the Chinese section is the call. The app does not decide how the hardware moves. The S2 agent reads the target state, drives the supplies in the room, pulls the 4 m² SSSU grid toward those fourteen numbers, and paints the change back on the layer.
