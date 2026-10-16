import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { useHost } from "../host/session";
import { useT } from "../i18n";
import { theme } from "../theme";

export function PagerScreen() {
  const { alerts, siren, playSample, dismissSiren } = useHost();
  const { t } = useT();

  useEffect(() => {
    void Notifications.requestPermissionsAsync();
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("pager.title")}</Text>
      {siren ? (
        <View style={styles.siren}>
          <Text style={styles.sirenText}>{t("pager.siren")}</Text>
          <Pressable onPress={dismissSiren}><Text style={styles.dismiss}>{t("pager.dismiss")}</Text></Pressable>
        </View>
      ) : (
        <Text style={styles.lead}>{t("pager.lead")}</Text>
      )}
      <Pressable style={styles.button} onPress={() => void playSample()}>
        <Text style={styles.buttonText}>{t("pager.sample")}</Text>
      </Pressable>
      {alerts.length === 0 ? <Text style={styles.lead}>{t("pager.empty")}</Text> : null}
      {alerts.map((alert) => (
        <View key={alert.id} style={styles.card}>
          <Text style={styles.cardTitle}>{alert.title}</Text>
          <Text style={styles.lead}>{t(`dim.${alert.dimension}`)} · {alert.detail}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { color: theme.text, fontSize: 28, fontWeight: "700" },
  lead: { color: theme.muted, lineHeight: 20 },
  siren: { backgroundColor: "rgba(127,29,29,0.85)", borderRadius: 16, padding: 16, gap: 8 },
  sirenText: { color: theme.text, fontSize: 22, fontWeight: "800", letterSpacing: 2 },
  dismiss: { color: theme.cyan },
  button: { minHeight: 48, borderRadius: 12, borderColor: theme.red, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  buttonText: { color: theme.text },
  card: { backgroundColor: theme.card, borderRadius: 12, padding: 12, borderColor: theme.line, borderWidth: 1 },
  cardTitle: { color: theme.amber, fontSize: 16, marginBottom: 4 },
});
