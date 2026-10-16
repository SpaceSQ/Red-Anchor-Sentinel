#!/bin/sh
# Red Anchor Sentinel mobile — EAS project id and APNs auth key.
# Bundle id: com.robot0.ras.mobile
# This script does not download or upload a key. Apple shows the .p8 file once.
# Do not commit AuthKey_*.p8.

set -eu
cd "$(dirname "$0")/.."

if ! command -v npx >/dev/null 2>&1; then
  echo "需要 Node.js 22+ 和 npm，才能运行 npx eas-cli。"
  exit 1
fi

cat <<'EOF'
1. 登录 Expo
   npx eas-cli login

2. 在 mobile/ 目录生成 EAS 项目，并把 projectId 写进 app.json 的 extra.eas.projectId
   npx eas-cli build:configure

   选择 iOS。完成后 app.json 里应出现：
   "extra": { "eas": { "projectId": "<uuid>" } }
   同时会生成 eas.json。

3. 在 Apple Developer 生成 APNs Auth Key（.p8）
   https://developer.apple.com/account/resources/authkeys/list
   - Keys → + 
   - 名称例如 RAS Mobile Push
   - 勾选 Apple Push Notifications service (APNs)
   - Register，下载 AuthKey_<KeyID>.p8（只能下载一次）
   - 记下 Key ID，以及 Membership 页上的 Team ID
   - Identifiers 里确认 App ID com.robot0.ras.mobile 已启用 Push Notifications

4. 把这把钥匙交给 EAS，绑定 com.robot0.ras.mobile
   npx eas-cli credentials -p ios

   选择 production（危机告警用正式推送）
   → Push Notifications: Manage your Apple Push Notifications Key
   → Set up a new push notification key
   → 上传 AuthKey_<KeyID>.p8，填入 Key ID 和 Team ID

   后台模式已经写在 app.json：
   UIBackgroundModes = fetch, remote-notification
   开发构建（npx expo run:ios）才会带上这些权限。Expo Go 不能接收这条远程推送。

5. 手机配对成功后，会用 extra.eas.projectId 向苹果登记 ExponentPushToken。
   主机在局域网之外通过 https://exp.host/--/api/v2/push/send 转发告警。
   推送正文只有标题、维度和等级，不包含局域网设备清单。

不要把 .p8、Key ID 以外的私钥，或 SMTP 口令放进仓库。
EOF

if [ "${1:-}" = "--configure" ]; then
  npx eas-cli build:configure
fi
