import { Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { DESKTOP_URL, GLASS_EN, theme } from "../theme";
import { useT } from "../i18n";

export function AccessDeniedModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useT();
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>ACCESS DENIED</Text>
          <Text style={styles.title}>{t("deny.title")}</Text>
          <Text style={styles.body}>{t("deny.body")}</Text>
          <Text style={styles.english}>{GLASS_EN}</Text>
          <Pressable
            style={styles.primary}
            onPress={() => {
              void Share.share({ message: GLASS_EN, url: DESKTOP_URL });
            }}
          >
            <Text style={styles.primaryText}>{t("deny.share")}</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>{t("deny.close")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 22 },
  card: { backgroundColor: theme.card, borderColor: theme.red, borderWidth: 1, borderRadius: 18, padding: 20 },
  kicker: { color: theme.red, letterSpacing: 3, fontSize: 12, marginBottom: 8 },
  title: { color: theme.text, fontSize: 22, fontWeight: "700", marginBottom: 10 },
  body: { color: "#d1d5db", fontSize: 15, lineHeight: 22, marginBottom: 12 },
  english: { color: theme.cyan, fontSize: 13, lineHeight: 20, marginBottom: 16 },
  primary: { backgroundColor: "rgba(127,29,29,0.85)", borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center" },
  primaryText: { color: theme.text, fontWeight: "700" },
  close: { color: theme.muted, textAlign: "center", marginTop: 14 },
});
