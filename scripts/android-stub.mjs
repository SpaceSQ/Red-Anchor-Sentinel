import { writeFile } from "node:fs/promises";

const note = `红锚哨兵 Android 网关是控制面板，不是完整物理主机。
移动端非完整物理主机，深度扫描与补丁注入受限，请使用 PC 端进行 L0 级防御。
1 级本机穿透、串口和 USB 下位机重置不会在 APK 中启用。

生成 APK 需要本机安装 Android SDK、JDK，并在完成桌面静态导出后执行：
  npm install @capacitor/core @capacitor/cli @capacitor/android
  npx cap add android
  npx cap copy android
  cd android && ./gradlew assembleDebug

配置见 capacitor.config.ts。当前脚本只核对这份边界，不在缺少 SDK 时伪造安装包。
`;

await writeFile("android-gateway.txt", note);
process.stdout.write(note);
