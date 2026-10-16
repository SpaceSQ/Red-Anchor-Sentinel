import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Network from "expo-network";
import { AccessDeniedModal } from "../components/AccessDeniedModal";
import { DesktopDownload } from "../components/DesktopDownload";
import { useT } from "../i18n";
import { theme } from "../theme";

export function LocalScanScreen() {
  const { t } = useT();
  const [denied, setDenied] = useState(false);
  const [info, setInfo] = useState("");

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("scan.title")}</Text>
      <Text style={styles.lead}>{t("scan.lead")}</Text>
      <DesktopDownload />
      <Pressable
        style={styles.button}
        onPress={async () => {
          const state = await Network.getNetworkStateAsync();
          const ip = await Network.getIpAddressAsync();
          setInfo(`${state.type ?? "unknown"} · ${state.isConnected ? t("scan.on") : t("scan.off")} · ${ip || t("scan.noip")}`);
        }}
      >
        <Text style={styles.buttonText}>{t("scan.read")}</Text>
      </Pressable>
      <Text style={styles.info}>{info || t("scan.unread")}</Text>
      {(["scan.audit", "scan.patch", "scan.fuse"] as const).map((label) => (
        <Pressable key={label} style={styles.locked} onPress={() => setDenied(true)}>
          <Text style={styles.lockedText}>{t(label)}</Text>
        </Pressable>
      ))}
      <AccessDeniedModal visible={denied} onClose={() => setDenied(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { color: theme.text, fontSize: 28, fontWeight: "700" },
  lead: { color: theme.muted, lineHeight: 20 },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: "rgba(8,47,73,0.9)", alignItems: "center", justifyContent: "center" },
  buttonText: { color: theme.cyan, fontWeight: "700" },
  info: { color: theme.text },
  locked: { minHeight: 52, borderRadius: 12, borderColor: theme.red, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  lockedText: { color: theme.red, letterSpacing: 1 },
});
