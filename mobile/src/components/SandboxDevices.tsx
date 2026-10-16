import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useT } from "../i18n";
import { theme } from "../theme";

const KEY = "ras.sandbox.removed";
const TOYS = [
  { id: "husky", name: "sandbox.husky", kind: "sandbox.huskyKind", note: "sandbox.sound", unit: "dB", wave: (tick: number) => 36 + Math.sin(tick / 700) * 8 },
  { id: "nest", name: "sandbox.nest", kind: "sandbox.nestKind", note: "sandbox.heat", unit: "°C", wave: () => 24 },
  { id: "hue", name: "sandbox.hue", kind: "sandbox.hueKind", note: "sandbox.light", unit: "lx", wave: () => 500 },
] as const;

async function readRemoved(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function SandboxDevices() {
  const { t } = useT();
  const [removed, setRemoved] = useState<string[]>([]);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    void readRemoved().then(setRemoved);
    const timer = setInterval(() => setTick(Date.now()), 400);
    return () => clearInterval(timer);
  }, []);

  async function save(next: string[]) {
    setRemoved(next);
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  }

  const live = TOYS.filter((toy) => !removed.includes(toy.id));

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("sandbox.title")}</Text>
      <Text style={styles.lead}>{t("sandbox.lead")}</Text>
      {live.length === 0 ? <Text style={styles.lead}>{t("sandbox.empty")}</Text> : null}
      {live.map((toy) => {
        const value = toy.wave(tick);
        const width = Math.max(12, Math.min(100, toy.id === "hue" ? value / 4 : toy.id === "husky" ? value * 1.6 : value * 3));
        return (
          <View key={toy.id} style={styles.card}>
            <Text style={styles.name}>{t(toy.name)} · {t(toy.kind)}</Text>
            <Text style={styles.value}>{value.toFixed(toy.id === "nest" ? 1 : 0)} {toy.unit}</Text>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${width}%` }]} />
            </View>
            <Text style={styles.lead}>{t(toy.note)}</Text>
            <Pressable onPress={() => void save([...removed, toy.id])} style={styles.remove}>
              <Text style={styles.removeText}>{t("sandbox.remove")}</Text>
            </Pressable>
          </View>
        );
      })}
      {removed.length ? (
        <Pressable onPress={() => void save([])} style={styles.remove}>
          <Text style={styles.removeText}>{t("sandbox.restore")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 16 },
  title: { color: theme.text, fontSize: 20, fontWeight: "700" },
  lead: { color: theme.muted, lineHeight: 20 },
  card: { borderColor: theme.line, borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: theme.card, gap: 6 },
  name: { color: theme.text, fontSize: 16 },
  value: { color: theme.cyan, fontSize: 22, fontVariant: ["tabular-nums"] },
  track: { height: 8, backgroundColor: "#05080A", borderRadius: 4, overflow: "hidden" },
  bar: { height: 8, backgroundColor: theme.red },
  remove: { minHeight: 40, alignItems: "center", justifyContent: "center", borderColor: theme.line, borderWidth: 1, borderRadius: 10 },
  removeText: { color: theme.text },
});
