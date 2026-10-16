import { StyleSheet, Text, View } from "react-native";
import { DimBoard } from "../components/DimBoard";
import { NeuroRadarChart } from "../components/NeuroRadarChart";
import { SandboxDevices } from "../components/SandboxDevices";
import { useHost } from "../host/session";
import { useT } from "../i18n";
import { theme } from "../theme";

export function RadarScreen({ wide }: { wide: boolean }) {
  const { radar, neuro, grant, siren } = useHost();
  const { t } = useT();
  const rings = (
    <View style={styles.rings}>
      {(["host", "lan", "cloud"] as const).map((ring) => (
        <View key={ring} style={styles.ring}>
          <Text style={styles.ringLabel}>{ring === "host" ? t("radar.host") : ring === "lan" ? t("radar.lan") : t("radar.cloud")}</Text>
          {(radar?.points ?? []).filter((point) => point.ring === ring).map((point) => (
            <Text key={point.id} style={{ color: point.level === "CRITICAL" ? theme.red : point.level === "WARNING" ? theme.amber : theme.green }}>
              {point.label}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
  return (
    <View style={wide ? styles.wide : undefined}>
      <View style={wide ? styles.column : undefined}>
        <Text style={styles.title}>{t("radar.title")}</Text>
        <Text style={styles.lead}>{t("app.role")}</Text>
        <Text style={styles.note}>{t("geo.note")}</Text>
        <Text style={styles.lead}>{grant ? t("radar.connected", { name: grant.hostName }) : t("radar.offline")}{siren ? ` · ${t("radar.siren")}` : ""}</Text>
        {rings}
      </View>
      <View style={wide ? styles.column : styles.stack}>
        <DimBoard radar={radar} />
        <NeuroRadarChart axes={neuro} />
        <SandboxDevices />
        <Text style={styles.note}>Powered by Red Anchor Sentinel</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wide: { flexDirection: "row", gap: 16 },
  column: { flex: 1 },
  stack: { marginTop: 16 },
  title: { color: theme.text, fontSize: 28, fontWeight: "700" },
  lead: { color: theme.cyan, marginBottom: 12 },
  rings: { gap: 8 },
  ring: { borderColor: theme.line, borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: theme.card },
  ringLabel: { color: theme.muted, marginBottom: 4 },
  note: { color: theme.muted, marginTop: 12, letterSpacing: 0.4 },
});
