import { StyleSheet, Text, View } from "react-native";
import type { NeuroAxes } from "../protocol";
import { theme } from "../theme";

const AXES: Array<[keyof NeuroAxes, string]> = [
  ["energy", "Energy"],
  ["appetite", "Appetite"],
  ["bravery", "Bravery"],
  ["intel", "Intel"],
  ["affection", "Affection"],
];

export function NeuroRadarChart({ axes }: { axes: NeuroAxes | null }) {
  return (
    <View style={styles.wrap}>
      {AXES.map(([key, label]) => {
        const value = axes?.[key] ?? 0;
        const color = value >= 80 ? theme.green : value >= 40 ? theme.amber : theme.red;
        return (
          <View key={key} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
            </View>
            <Text style={[styles.value, { color }]}>{axes ? value : "—"}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { color: theme.muted, width: 84 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: theme.line, overflow: "hidden" },
  fill: { height: 8 },
  value: { width: 32, textAlign: "right" },
});
