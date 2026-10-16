import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AccessDeniedModal } from "../components/AccessDeniedModal";
import { useHost } from "../host/session";
import { useT } from "../i18n";
import { tightenPatch } from "../protocol";
import { theme } from "../theme";

export function TacticalScreen() {
  const host = useHost();
  const { t } = useT();
  const [sound, setSound] = useState("");
  const [oxygen, setOxygen] = useState("");
  const [heat, setHeat] = useState("");
  const [note, setNote] = useState("");
  const [denied, setDenied] = useState(false);
  const armed = host.grant?.scope.includes("control");

  function gate(action: () => void) {
    if (!armed) {
      setDenied(true);
      return;
    }
    action();
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("steer.title")}</Text>
      <Text style={styles.lead}>{t("steer.lead")}</Text>
      <Text style={styles.law}>{t("steer.laws")}</Text>
      <Text style={styles.lead}>{t("steer.now", { sound: host.rules.soundDb ?? t("steer.unset"), oxygen: host.rules.o2Percent ?? t("steer.unset"), heat: host.rules.heatCelsius ?? t("steer.unset") })}</Text>
      {host.fuseArmed ? <Text style={styles.err}>{t("steer.fuse")}</Text> : null}
      <TextInput style={styles.input} value={sound} onChangeText={setSound} placeholder={t("steer.sound")} placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
      <TextInput style={styles.input} value={oxygen} onChangeText={setOxygen} placeholder={t("steer.oxygen")} placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
      <TextInput style={styles.input} value={heat} onChangeText={setHeat} placeholder={t("steer.heat")} placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
      {note ? <Text style={styles.err}>{note}</Text> : null}
      <Pressable
        style={styles.button}
        onPress={() => gate(() => {
          try {
            const patch = tightenPatch(host.rules, {
              soundDb: sound.trim() ? Number(sound) : host.rules.soundDb,
              o2Percent: oxygen.trim() ? Number(oxygen) : host.rules.o2Percent,
              heatCelsius: heat.trim() ? Number(heat) : host.rules.heatCelsius,
            });
            if (sound.trim() && patch.soundDb != null) host.tightenRule("noise", patch.soundDb);
            if (oxygen.trim() && patch.o2Percent != null) host.tightenRule("oxygen", patch.o2Percent);
            if (heat.trim() && patch.heatCelsius != null) host.tightenRule("heat", patch.heatCelsius);
            setNote(t("steer.sent"));
          } catch (error) {
            setNote(error instanceof Error ? error.message : t("steer.rejected"));
          }
        })}
      >
        <Text style={styles.buttonText}>{t("steer.apply")}</Text>
      </Pressable>
      <Pressable style={styles.fuse} onPress={() => gate(host.requestFuse)}>
        <Text style={styles.buttonText}>{t("steer.break")}</Text>
      </Pressable>
      <Text style={styles.lead}>{t("steer.note")}</Text>
      <AccessDeniedModal visible={denied} onClose={() => setDenied(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  title: { color: theme.text, fontSize: 28, fontWeight: "700" },
  lead: { color: theme.muted, lineHeight: 20 },
  law: { color: theme.cyan, letterSpacing: 1 },
  input: { minHeight: 46, borderWidth: 1, borderColor: theme.line, borderRadius: 12, color: theme.text, paddingHorizontal: 12 },
  err: { color: theme.amber },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: "rgba(8,47,73,0.95)", alignItems: "center", justifyContent: "center" },
  fuse: { minHeight: 48, borderRadius: 12, backgroundColor: "rgba(127,29,29,0.95)", alignItems: "center", justifyContent: "center" },
  buttonText: { color: theme.text, fontWeight: "700" },
});
