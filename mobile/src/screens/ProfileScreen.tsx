import { Pressable, StyleSheet, Text, View } from "react-native";
import { CopyrightLine } from "../components/CopyrightLine";
import { useT } from "../i18n";
import { useAccount } from "./AccountScreen";
import { theme } from "../theme";

export function ProfileScreen() {
  const { t } = useT();
  const { email, signOut } = useAccount();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("account.title")}</Text>
      <Text style={styles.lead}>{t("app.role")}</Text>
      <Text style={styles.lead}>{t("geo.note")}</Text>
      <Text style={styles.lead}>{t("account.profileLead")}</Text>
      <Text style={styles.email}>{t("account.in", { email })}</Text>
      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>{t("account.out")}</Text>
      </Pressable>
      <CopyrightLine />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { color: theme.text, fontSize: 28, fontWeight: "700" },
  lead: { color: theme.muted, lineHeight: 20 },
  email: { color: theme.text, fontSize: 16 },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: theme.red, alignItems: "center", justifyContent: "center" },
  buttonText: { color: theme.text, fontWeight: "700" },
});
