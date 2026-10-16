import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { confirmResetCode, confirmSignupCode, loginWithPassword, registerAccount, resetAccountPassword, sendResetCode, sendSignupCode } from "../account-cloud";
import { useHost } from "../host/session";
import { CopyrightLine } from "../components/CopyrightLine";
import { DesktopDownload } from "../components/DesktopDownload";
import { useT } from "../i18n";
import { theme } from "../theme";

const SESSION = "ras.mobile.session";

const AccountSession = createContext<{ email: string; signOut: () => void } | null>(null);

export function useAccount() {
  const value = useContext(AccountSession);
  if (!value) throw new Error("Account session is only available after sign-in.");
  return value;
}

type Notice = { kind: "info" | "ok" | "err"; text: string };
type Busy = "" | "send" | "verify" | "register" | "login" | "reset";

function emailOk(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120 ? email : "";
}

function accountError(reason: unknown, t: (key: string) => string) {
  const message = reason instanceof Error ? reason.message : "";
  if (message === "CONFIG") return t("account.unconfigured");
  if (!message || message === "UNREACHABLE" || message === "NO_SESSION" || /fetch failed|network request failed|failed to fetch/i.test(message)) {
    return t("account.offline");
  }
  return message;
}

export function AccountGate({ children }: { children: ReactNode }) {
  const { openReview, disconnect, ticket } = useHost();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    void SecureStore.getItemAsync(SESSION).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as { email?: string; token?: string };
          if (saved.email === "apple@robot0.com" && saved.token === "apple-review") openReview();
          setEmail(saved.email || "");
        } catch {
          setEmail("");
        }
      }
      setReady(true);
    });
  }, [openReview]);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <Text style={styles.brand}>Red Anchor Sentinel</Text>
      </View>
    );
  }
  function signOut() {
    if (ticket?.host === "demo" && ticket.nonce === "review") disconnect();
    void SecureStore.deleteItemAsync(SESSION).finally(() => setEmail(""));
  }

  if (!email) return <AccountScreen onReady={setEmail} />;
  return <AccountSession.Provider value={{ email, signOut }}>{children}</AccountSession.Provider>;
}

function AccountScreen({ onReady }: { onReady: (email: string) => void }) {
  const { openReview } = useHost();
  const { t, lang, setLang } = useT();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"register" | "login" | "reset">("register");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [proof, setProof] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<Busy>("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => (value <= 1 ? 0 : value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  async function remember(accountEmail: string, token: string) {
    await SecureStore.setItemAsync(SESSION, JSON.stringify({ email: accountEmail, token }));
    onReady(accountEmail);
  }

  async function send() {
    const accountEmail = emailOk(email);
    if (!privacy) {
      setNotice({ kind: "err", text: t("account.needPrivacy") });
      return;
    }
    if (!accountEmail) {
      setNotice({ kind: "err", text: t("account.badEmail") });
      return;
    }
    if (cooldown > 0) {
      setNotice({ kind: "err", text: t("account.wait", { seconds: cooldown }) });
      return;
    }
    setBusy("send");
    setNotice({ kind: "info", text: t("account.sending") });
    try {
      await sendSignupCode(accountEmail, { privacy: true, locale: lang });
      setCooldown(60);
      setNotice({ kind: "ok", text: t("account.sent") });
    } catch (reason) {
      const message = accountError(reason, t);
      const wait = Number(message.match(/\d+/)?.[0] || 0);
      if (wait > 0 && wait <= 60) setCooldown(wait);
      setNotice({ kind: "err", text: message });
    } finally {
      setBusy("");
    }
  }

  async function verify() {
    const accountEmail = emailOk(email);
    const digits = code.replace(/\D/g, "");
    if (!privacy) {
      setNotice({ kind: "err", text: t("account.needPrivacy") });
      return;
    }
    if (!accountEmail) {
      setNotice({ kind: "err", text: t("account.badEmail") });
      return;
    }
    if (digits.length !== 6) {
      setNotice({ kind: "err", text: t("account.needCode") });
      return;
    }
    setBusy("verify");
    setNotice({ kind: "info", text: t("account.checking") });
    try {
      setProof(await confirmSignupCode(accountEmail, digits, { privacy: true, locale: lang }));
      setNotice({ kind: "ok", text: t("account.confirmed") });
    } catch (reason) {
      setNotice({ kind: "err", text: accountError(reason, t) });
    } finally {
      setBusy("");
    }
  }

  async function register() {
    const accountEmail = emailOk(email);
    if (password.length < 8 || password.length > 72) {
      setNotice({ kind: "err", text: t("account.passwordRule") });
      return;
    }
    if (password !== confirm) {
      setNotice({ kind: "err", text: t("account.passwordMismatch") });
      return;
    }
    if (accountEmail && password.toLowerCase() === accountEmail) {
      setNotice({ kind: "err", text: t("account.passwordEmail") });
      return;
    }
    setBusy("register");
    setNotice({ kind: "info", text: t("account.saving") });
    try {
      const data = await registerAccount({
        email: accountEmail || email.trim().toLowerCase(),
        proof,
        password,
        confirm,
        privacy: true,
        locale: lang,
      });
      await remember(data.email, data.token);
    } catch (reason) {
      setNotice({ kind: "err", text: accountError(reason, t) });
    } finally {
      setBusy("");
    }
  }

  function switchMode(next: "register" | "login" | "reset") {
    setMode(next);
    setNotice(null);
    setProof("");
  }

  async function sendReset() {
    const accountEmail = emailOk(email);
    if (!privacy) {
      setNotice({ kind: "err", text: t("account.needPrivacy") });
      return;
    }
    if (!accountEmail) {
      setNotice({ kind: "err", text: t("account.badEmail") });
      return;
    }
    if (cooldown > 0) {
      setNotice({ kind: "err", text: t("account.wait", { seconds: cooldown }) });
      return;
    }
    setBusy("send");
    setNotice({ kind: "info", text: t("account.sending") });
    try {
      await sendResetCode(accountEmail, { privacy: true, locale: lang });
      setCooldown(60);
      setNotice({ kind: "ok", text: t("account.resetSent") });
    } catch (reason) {
      const message = accountError(reason, t);
      const wait = Number(message.match(/\d+/)?.[0] || 0);
      if (wait > 0 && wait <= 60) setCooldown(wait);
      setNotice({ kind: "err", text: message });
    } finally {
      setBusy("");
    }
  }

  async function verifyReset() {
    const accountEmail = emailOk(email);
    const digits = code.replace(/\D/g, "");
    if (!privacy) {
      setNotice({ kind: "err", text: t("account.needPrivacy") });
      return;
    }
    if (!accountEmail) {
      setNotice({ kind: "err", text: t("account.badEmail") });
      return;
    }
    if (digits.length !== 6) {
      setNotice({ kind: "err", text: t("account.needCode") });
      return;
    }
    setBusy("verify");
    setNotice({ kind: "info", text: t("account.checking") });
    try {
      setProof(await confirmResetCode(accountEmail, digits, { privacy: true, locale: lang }));
      setNotice({ kind: "ok", text: t("account.resetConfirmed") });
    } catch (reason) {
      setNotice({ kind: "err", text: accountError(reason, t) });
    } finally {
      setBusy("");
    }
  }

  async function saveReset() {
    const accountEmail = emailOk(email);
    if (password.length < 8 || password.length > 72) {
      setNotice({ kind: "err", text: t("account.passwordRule") });
      return;
    }
    if (password !== confirm) {
      setNotice({ kind: "err", text: t("account.passwordMismatch") });
      return;
    }
    if (accountEmail && password.toLowerCase() === accountEmail) {
      setNotice({ kind: "err", text: t("account.passwordEmail") });
      return;
    }
    setBusy("reset");
    setNotice({ kind: "info", text: t("account.resetSaving") });
    try {
      const data = await resetAccountPassword({
        email: accountEmail || email.trim().toLowerCase(),
        proof,
        password,
        confirm,
        privacy: true,
        locale: lang,
      });
      await remember(data.email, data.token);
    } catch (reason) {
      setNotice({ kind: "err", text: accountError(reason, t) });
    } finally {
      setBusy("");
    }
  }

  async function login() {
    if (email === "apple@robot0.com" && password === "AppleReview123") {
      openReview();
      await remember("apple@robot0.com", "apple-review");
      return;
    }
    const accountEmail = emailOk(email);
    if (!accountEmail) {
      setNotice({ kind: "err", text: t("account.badEmail") });
      return;
    }
    if (password.length < 8) {
      setNotice({ kind: "err", text: t("account.passwordRule") });
      return;
    }
    setBusy("login");
    setNotice({ kind: "info", text: t("account.signing") });
    try {
      const data = await loginWithPassword(accountEmail, password, lang);
      await remember(data.email, data.token);
    } catch (reason) {
      setNotice({ kind: "err", text: accountError(reason, t) });
    } finally {
      setBusy("");
    }
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 54) }]} keyboardShouldPersistTaps="handled">
      <View style={styles.row}>
        <Pressable onPress={() => setLang("en")} style={[styles.mode, lang === "en" && styles.modeOn]}><Text style={styles.modeText}>EN</Text></Pressable>
        <Pressable onPress={() => setLang("zh")} style={[styles.mode, lang === "zh" && styles.modeOn]}><Text style={styles.modeText}>CN</Text></Pressable>
      </View>
      <Text style={styles.title}>{t("account.title")}</Text>
      <Text style={styles.lead}>{t("app.role")}</Text>
      <Text style={styles.lead}>{t("account.lead")}</Text>
      <Text style={styles.lead}>{t("geo.note")}</Text>
      <NoticeBanner notice={notice} />
      <View style={styles.row}>
        <Pressable onPress={() => switchMode("register")} style={[styles.mode, mode === "register" && styles.modeOn]}><Text style={styles.modeText}>{t("account.register")}</Text></Pressable>
        <Pressable onPress={() => switchMode("login")} style={[styles.mode, mode === "login" && styles.modeOn]}><Text style={styles.modeText}>{t("account.login")}</Text></Pressable>
        <Pressable onPress={() => switchMode("reset")} style={[styles.mode, mode === "reset" && styles.modeOn]}><Text style={styles.modeText}>{t("account.reset")}</Text></Pressable>
      </View>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={t("account.email")} placeholderTextColor={theme.muted} autoCapitalize="none" keyboardType="email-address" />
      {mode === "login" ? (
        <>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder={t("account.password")} placeholderTextColor={theme.muted} secureTextEntry />
          <Pressable style={[styles.button, busy !== "" && styles.buttonBusy]} disabled={busy !== ""} onPress={() => void login()}>
            <Text style={styles.buttonText}>{busy === "login" ? t("account.signing") : t("account.login")}</Text>
          </Pressable>
        </>
      ) : mode === "reset" ? (
        <>
          <Text style={styles.lead}>{t("account.resetLead")}</Text>
          <Pressable onPress={() => setPrivacy((value) => !value)} style={styles.check}>
            <Text style={styles.lead}>{privacy ? "☑ " : "☐ "}{t("account.privacy")}</Text>
          </Pressable>
          <Pressable style={[styles.button, (busy !== "" || cooldown > 0) && styles.buttonBusy]} disabled={busy !== "" || cooldown > 0} onPress={() => void sendReset()}>
            <Text style={styles.buttonText}>{busy === "send" ? t("account.sending") : cooldown > 0 ? t("account.wait", { seconds: cooldown }) : t("account.resetSend")}</Text>
          </Pressable>
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor={theme.muted} keyboardType="number-pad" maxLength={6} />
          {!proof ? (
            <Pressable style={[styles.button, busy !== "" && styles.buttonBusy]} disabled={busy !== ""} onPress={() => void verifyReset()}>
              <Text style={styles.buttonText}>{busy === "verify" ? t("account.checking") : t("account.verify")}</Text>
            </Pressable>
          ) : (
            <>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder={t("account.password")} placeholderTextColor={theme.muted} secureTextEntry />
              <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} placeholder={t("account.confirm")} placeholderTextColor={theme.muted} secureTextEntry />
              <Pressable style={[styles.button, busy !== "" && styles.buttonBusy]} disabled={busy !== ""} onPress={() => void saveReset()}>
                <Text style={styles.buttonText}>{busy === "reset" ? t("account.resetSaving") : t("account.resetApply")}</Text>
              </Pressable>
            </>
          )}
        </>
      ) : (
        <>
          <Pressable onPress={() => setPrivacy((value) => !value)} style={styles.check}>
            <Text style={styles.lead}>{privacy ? "☑ " : "☐ "}{t("account.privacy")}</Text>
          </Pressable>
          <Pressable style={[styles.button, (busy !== "" || cooldown > 0) && styles.buttonBusy]} disabled={busy !== "" || cooldown > 0} onPress={() => void send()}>
            <Text style={styles.buttonText}>{busy === "send" ? t("account.sending") : cooldown > 0 ? t("account.wait", { seconds: cooldown }) : t("account.send")}</Text>
          </Pressable>
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor={theme.muted} keyboardType="number-pad" maxLength={6} />
          {!proof ? (
            <Pressable style={[styles.button, busy !== "" && styles.buttonBusy]} disabled={busy !== ""} onPress={() => void verify()}>
              <Text style={styles.buttonText}>{busy === "verify" ? t("account.checking") : t("account.verify")}</Text>
            </Pressable>
          ) : (
            <>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder={t("account.password")} placeholderTextColor={theme.muted} secureTextEntry />
              <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} placeholder={t("account.confirm")} placeholderTextColor={theme.muted} secureTextEntry />
              <Pressable style={[styles.button, busy !== "" && styles.buttonBusy]} disabled={busy !== ""} onPress={() => void register()}>
                <Text style={styles.buttonText}>{busy === "register" ? t("account.saving") : t("account.apply")}</Text>
              </Pressable>
            </>
          )}
        </>
      )}
      <DesktopDownload />
      <CopyrightLine />
    </ScrollView>
  );
}

function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const color = notice.kind === "ok" ? theme.green : notice.kind === "err" ? theme.amber : theme.cyan;
  return (
    <View style={[styles.notice, { borderColor: color }]}>
      <Text style={[styles.noticeText, { color }]}>{notice.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" },
  brand: { color: theme.text, letterSpacing: 1 },
  wrap: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, gap: 10, paddingBottom: 40 },
  title: { color: theme.text, fontSize: 28, fontWeight: "700" },
  lead: { color: theme.muted, lineHeight: 20 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: theme.card },
  noticeText: { fontSize: 16, lineHeight: 22 },
  input: { minHeight: 46, borderWidth: 1, borderColor: theme.line, borderRadius: 12, color: theme.text, paddingHorizontal: 12 },
  row: { flexDirection: "row", gap: 8 },
  mode: { minHeight: 40, paddingHorizontal: 12, borderColor: theme.line, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modeOn: { backgroundColor: theme.red, borderColor: theme.red },
  modeText: { color: theme.text },
  check: { minHeight: 44, justifyContent: "center" },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: theme.red, alignItems: "center", justifyContent: "center" },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: theme.text, fontWeight: "700" },
});
