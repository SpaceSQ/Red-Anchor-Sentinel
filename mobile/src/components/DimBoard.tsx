import { StyleSheet, Text, View } from "react-native";
import { DIM_KEYS, type RadarFrame } from "../protocol";
import { useT } from "../i18n";
import { theme } from "../theme";

const levelColor = { SAFE: theme.green, WARNING: theme.amber, CRITICAL: theme.red };

export function DimBoard({ radar }: { radar: RadarFrame | null }) {
  const { t } = useT();
  return (
    <View style={styles.grid}>
      {DIM_KEYS.map((key) => {
        const row = radar?.dims[key];
        const level = row?.level ?? "SAFE";
        return (
          <View key={key} style={styles.cell}>
            <Text style={[styles.level, { color: levelColor[level] }]}>{level}</Text>
            <Text style={styles.name}>{t(`dim.${key}`)}</Text>
            <Text style={styles.value}>{row?.value ?? "—"}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: {
    width: "31%",
    minWidth: 96,
    backgroundColor: theme.card,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  level: { fontSize: 10, letterSpacing: 1 },
  name: { color: theme.text, fontSize: 16, marginTop: 4 },
  value: { color: theme.muted, fontSize: 12, marginTop: 2 },
});
