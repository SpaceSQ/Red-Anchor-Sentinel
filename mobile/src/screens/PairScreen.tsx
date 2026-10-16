import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { BONJOUR_SERVICE, parseTicket } from "../protocol";
import { cachedHosts } from "../storage";
import { useHost } from "../host/session";
import { useT } from "../i18n";
import { DesktopDownload } from "../components/DesktopDownload";
import { theme } from "../theme";

export function PairScreen() {
  const host = useHost();
  const { t } = useT();
  const [permission, request] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [address, setAddress] = useState("");
  const [port, setPort] = useState("8787");
  const [nonce, setNonce] = useState("");
  const [message, setMessage] = useState("");
  const [found, setFound] = useState<{ name: string; host: string; port: number }[]>([]);
  const [saved, setSaved] = useState<{ name: string; host: string; port: number }[]>([]);

  useEffect(() => {
    void cachedHosts()
      .then((rows) => setSaved(rows.map((row) => ({ name: row.name, host: row.host, port: row.port }))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let scanner: { stop: () => void } | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const mod = await import("react-native-zeroconf");
        if (cancelled) return;
        const Zeroconf = mod.default;
        const browser = new Zeroconf();
        scanner = browser;
        browser.on("resolved", (service: { name?: string; host?: string; port?: number; addresses?: string[] }) => {
          const host = (service.addresses || []).find((item) => /^\d+\.\d+\.\d+\.\d+$/.test(item) && !item.startsWith("127.")) || service.host || "";
          if (!host || !service.port) return;
          setFound((list) => {
            const next = { name: service.name || "Red Anchor", host, port: service.port as number };
            return [next, ...list.filter((item) => item.host !== host || item.port !== next.port)].slice(0, 6);
          });
        });
        browser.scan("ras", "tcp", "local.");
      } catch {
        if (!cancelled) setMessage(t("pair.bonjour"));
      }
    })();
    return () => {
      cancelled = true;
      scanner?.stop();
    };
  }, []);

  async function accept(raw: string) {
    try {
      const ticket = parseTicket(raw);
      await host.pair(ticket);
      setScanning(false);
      setMessage(t("pair.connected", { name: ticket.name }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("pair.failed"));
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("pair.title")}</Text>
      <Text style={styles.lead}>{t("pair.lead", { service: BONJOUR_SERVICE })}</Text>
      <DesktopDownload />
      {saved.map((item) => (
        <Pressable
          key={`saved-${item.host}:${item.port}`}
          style={styles.ghost}
          onPress={() => {
            setAddress(item.host);
            setPort(String(item.port));
            setMessage(t("pair.filled", { name: item.name }));
          }}
        >
          <Text style={styles.ghostText}>{t("pair.saved", { name: item.name, host: item.host, port: item.port })}</Text>
        </Pressable>
      ))}
      {found.map((item) => (
        <Pressable
          key={`${item.host}:${item.port}`}
          style={styles.ghost}
          onPress={() => {
            setAddress(item.host);
            setPort(String(item.port));
            setMessage(t("pair.found", { name: item.name }));
          }}
        >
          <Text style={styles.ghostText}>{item.name} · {item.host}:{item.port}</Text>
        </Pressable>
      ))}
      {host.grant ? <Text style={styles.ok}>{t("pair.granted", { name: host.grant.hostName, scope: host.grant.scope.join(" / ") })}</Text> : null}
      {host.linkError ? <Text style={styles.err}>{host.linkError}</Text> : null}
      {message ? <Text style={styles.lead}>{message}</Text> : null}
      {scanning && permission?.granted ? (
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => {
            if (scanning) void accept(data);
          }}
        />
      ) : null}
      <Pressable
        style={styles.button}
        onPress={async () => {
          if (!permission?.granted) {
            const next = await request();
            if (!next.granted) {
              setMessage(t("pair.noCamera"));
              return;
            }
          }
          setScanning(true);
        }}
      >
        <Text style={styles.buttonText}>{t("pair.scan")}</Text>
      </Pressable>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder={t("pair.host")} placeholderTextColor={theme.muted} autoCapitalize="none" />
      <TextInput style={styles.input} value={port} onChangeText={setPort} placeholder={t("pair.port")} placeholderTextColor={theme.muted} keyboardType="number-pad" />
      <TextInput style={styles.input} value={nonce} onChangeText={setNonce} placeholder={t("pair.nonce")} placeholderTextColor={theme.muted} autoCapitalize="none" />
      <Pressable
        style={styles.button}
        onPress={() => {
          void accept(JSON.stringify({ v: 1, name: "Red Anchor", host: address, port: Number(port), nonce }));
        }}
      >
        <Text style={styles.buttonText}>{t("pair.connect")}</Text>
      </Pressable>
      <Pressable style={styles.ghost} onPress={() => void accept(JSON.stringify({ v: 1, name: "Demo host", host: "demo", port: 9, nonce: "demo-nonce-0001" }))}>
        <Text style={styles.ghostText}>{t("pair.demo")}</Text>
      </Pressable>
      {host.grant ? (
        <Pressable onPress={host.disconnect}>
          <Text style={styles.ghostText}>{t("pair.drop")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  title: { color: theme.text, fontSize: 28, fontWeight: "700" },
  lead: { color: theme.muted, lineHeight: 20 },
  ok: { color: theme.green },
  err: { color: theme.red },
  camera: { height: 220, borderRadius: 16, overflow: "hidden" },
  input: { minHeight: 46, borderWidth: 1, borderColor: theme.line, borderRadius: 12, color: theme.text, paddingHorizontal: 12 },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: "rgba(127,29,29,0.9)", alignItems: "center", justifyContent: "center" },
  buttonText: { color: theme.text, fontWeight: "700" },
  ghost: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  ghostText: { color: theme.cyan, textAlign: "center" },
});
