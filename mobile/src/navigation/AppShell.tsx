import { useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LocalScanScreen } from "../screens/LocalScanScreen";
import { PagerScreen } from "../screens/PagerScreen";
import { PairScreen } from "../screens/PairScreen";
import { CopyrightLine } from "../components/CopyrightLine";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RadarScreen } from "../screens/RadarScreen";
import { TacticalScreen } from "../screens/TacticalScreen";
import { useT } from "../i18n";
import { theme } from "../theme";

const TABS = [
  { id: "radar", label: "tab.radar" },
  { id: "pager", label: "tab.pager" },
  { id: "pair", label: "tab.pair" },
  { id: "scan", label: "tab.scan" },
  { id: "tactical", label: "tab.steer" },
  { id: "account", label: "tab.account" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AppShell() {
  const { t, lang, setLang } = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = Math.min(width, height) >= 700;
  const [tab, setTab] = useState<TabId>("radar");
  const top = insets.top > 0 ? insets.top : Platform.OS === "ios" && !wide ? 54 : 20;
  const body = tab === "pager" ? <PagerScreen /> : tab === "pair" ? <PairScreen /> : tab === "scan" ? <LocalScanScreen /> : tab === "tactical" ? <TacticalScreen /> : tab === "account" ? <ProfileScreen /> : <RadarScreen wide={wide} />;

  const menu = (
    <View style={wide ? styles.rail : styles.tabs}>
      {TABS.map((item) => (
        <Pressable key={item.id} onPress={() => setTab(item.id)} style={[styles.tab, tab === item.id && styles.tabOn]}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabText, tab === item.id && styles.tabTextOn]}>
            {t(item.label)}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: top, paddingBottom: Math.max(insets.bottom, 8), paddingLeft: insets.left, paddingRight: insets.right }]}>
      <StatusBar style="light" />
      <View style={styles.langRow}>
        <View style={styles.brandRow}>
          <Image source={require("../../assets/icon.png")} style={styles.mark} />
          <View>
            <Text style={styles.brand}>Red Anchor</Text>
            <Text style={styles.role}>{t("app.role")}</Text>
          </View>
        </View>
        <View style={styles.lang}>
          <Pressable onPress={() => setLang("en")} style={[styles.langButton, lang === "en" && styles.langOn]}>
            <Text style={styles.langText}>EN</Text>
          </Pressable>
          <Pressable onPress={() => setLang("zh")} style={[styles.langButton, lang === "zh" && styles.langOn]}>
            <Text style={styles.langText}>CN</Text>
          </Pressable>
        </View>
      </View>
      <View style={wide ? styles.wide : styles.phone}>
        {wide ? menu : menu}
        <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
          {body}
        </ScrollView>
      </View>
      <CopyrightLine />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  langRow: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  mark: { width: 36, height: 36, borderRadius: 8 },
  brand: { color: theme.text, letterSpacing: 1, fontWeight: "700" },
  role: { color: theme.muted, fontSize: 11, maxWidth: 220 },
  lang: { flexDirection: "row", borderColor: theme.line, borderWidth: 1 },
  langButton: { minHeight: 32, minWidth: 40, alignItems: "center", justifyContent: "center" },
  langOn: { backgroundColor: theme.red },
  langText: { color: theme.text, fontSize: 12 },
  phone: { flex: 1 },
  wide: { flex: 1, flexDirection: "row" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.line, backgroundColor: theme.bg, zIndex: 2 },
  rail: { width: 128, borderRightWidth: 1, borderRightColor: theme.line, paddingTop: 8 },
  tab: { flex: 1, minHeight: 48, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  tabOn: { borderBottomWidth: 2, borderBottomColor: theme.red },
  tabText: { color: theme.muted, fontSize: 13 },
  tabTextOn: { color: theme.text },
  main: { flex: 1 },
  mainContent: { padding: 16, paddingBottom: 48 },
});
