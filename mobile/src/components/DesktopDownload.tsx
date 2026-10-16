import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "../i18n";
import { DESKTOP_URL, theme } from "../theme";

export function DesktopDownload() {
  const { t } = useT();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("download.title")}</Text>
      <Text style={styles.body}>{t("download.body")}</Text>
      <Pressable style={styles.button} onPress={() => void Linking.openURL(DESKTOP_URL)}>
        <Text style={styles.buttonText}>{t("download.open")}</Text>
      </Pressable>
      <Text style={styles.url}>{DESKTOP_URL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: theme.red, borderWidth: 1, borderRadius: 14, padding: 14, gap: 8, backgroundColor: theme.card },
  title: { color: theme.text, fontSize: 18, fontWeight: "700" },
  body: { color: theme.muted, lineHeight: 20 },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: theme.red, alignItems: "center", justifyContent: "center" },
  buttonText: { color: theme.text, fontWeight: "700" },
  url: { color: theme.cyan },
});
