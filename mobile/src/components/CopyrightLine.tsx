import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "../i18n";
import { theme } from "../theme";

export function CopyrightLine() {
  const { t } = useT();
  return (
    <View style={styles.wrap}>
      <Text style={styles.holder}>{t("copyright.holder")}</Text>
      <Pressable onPress={() => void Linking.openURL("https://www.robot0.com/RAS")}>
        <Text style={styles.link}>www.robot0.com/RAS</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2, paddingVertical: 8 },
  holder: { color: theme.muted, lineHeight: 18 },
  link: { color: theme.cyan },
});
