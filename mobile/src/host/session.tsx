import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import {
  demoAlert,
  demoRadar,
  snapshotToRadar,
  tightenPatch,
  toNeuroAxes,
  type AlertFrame,
  type HostRules,
  type NeuroAxes,
  type PairGrant,
  type PairTicket,
  type RadarFrame,
} from "../protocol";
import { cacheAlert, cacheHost } from "../storage";

const TOKEN_KEY = "ras.mobile.token";

async function readExpoPushToken() {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) return "";
  try {
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return "";
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data || "";
  } catch {
    return "";
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface HostApi {
  ticket: PairTicket | null;
  grant: PairGrant | null;
  radar: RadarFrame | null;
  neuro: NeuroAxes | null;
  alerts: AlertFrame[];
  rules: HostRules;
  siren: boolean;
  fuseArmed: boolean;
  linkError: string;
  pair: (ticket: PairTicket) => Promise<void>;
  disconnect: () => void;
  playSample: () => Promise<void>;
  openReview: () => void;
  tighten: (next: HostRules) => void;
  tightenRule: (key: "noise" | "oxygen" | "heat", max: number) => void;
  requestFuse: () => void;
  dismissSiren: () => void;
}

const HostContext = createContext<HostApi | null>(null);

const EMPTY_RULES: HostRules = { soundDb: null, o2Percent: null, heatCelsius: null };

export function HostProvider({ children }: { children: ReactNode }) {
  const [ticket, setTicket] = useState<PairTicket | null>(null);
  const [grant, setGrant] = useState<PairGrant | null>(null);
  const [radar, setRadar] = useState<RadarFrame | null>(null);
  const [neuro, setNeuro] = useState<NeuroAxes | null>(null);
  const [alerts, setAlerts] = useState<AlertFrame[]>([]);
  const [rules, setRules] = useState<HostRules>(EMPTY_RULES);
  const [siren, setSiren] = useState(false);
  const [fuseArmed, setFuseArmed] = useState(false);
  const [linkError, setLinkError] = useState("");
  const socket = useRef<WebSocket | null>(null);

  const pushAlert = useCallback(async (alert: AlertFrame) => {
    setAlerts((list) => [alert, ...list].slice(0, 40));
    setSiren(true);
    void cacheAlert(alert).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: alert.title,
        body: alert.detail,
        sound: true,
      },
      trigger: null,
    });
  }, []);

  const pair = useCallback(async (next: PairTicket) => {
    setLinkError("");
    socket.current?.close();
    socket.current = null;
    if (next.host === "demo") {
      const granted: PairGrant = { token: `demo.${next.nonce}`, hostName: next.name, scope: ["radar", "control"] };
      setTicket(next);
      setGrant(granted);
      setRadar(demoRadar());
      setNeuro(toNeuroAxes(demoRadar().dims));
      await SecureStore.setItemAsync(TOKEN_KEY, granted.token);
      return;
    }
    const url = `ws://${next.host}:${next.port}/ras`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      let settled = false;
      let timer = setTimeout(() => {
        ws.close();
        reject(new Error("The host did not answer in time"));
      }, 90000);
      const fail = (detail: string) => {
        if (settled) {
          setLinkError(detail);
          return;
        }
        settled = true;
        clearTimeout(timer);
        ws.close();
        reject(new Error(detail));
      };
      ws.onmessage = (event) => {
        let message: { op?: string; type?: string; token?: string; scope?: PairGrant["scope"]; rules?: HostRules; detail?: string; fuseArmed?: boolean; data?: unknown };
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const kind = message.type || message.op;
        if (kind === "state" && message.rules) {
          setRules(message.rules);
          if (typeof message.fuseArmed === "boolean") setFuseArmed(message.fuseArmed);
        }
        if (kind === "radar" || kind === "radar_update") {
          const frame = kind === "radar_update" ? snapshotToRadar((message.data || {}) as Parameters<typeof snapshotToRadar>[0]) : message as unknown as RadarFrame;
          setRadar(frame);
          setNeuro(toNeuroAxes(frame.dims));
        }
        if (kind === "alert") void pushAlert(message as unknown as AlertFrame);
        if (kind === "pending") {
          clearTimeout(timer);
          timer = setTimeout(() => {
            ws.close();
            fail("Confirm this phone on the computer, then try again");
          }, 90000);
          return;
        }
        if (kind === "deny" || kind === "reject") {
          fail(message.detail || "The host refused this request");
          return;
        }
        if (kind === "grant" && message.token) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          const granted: PairGrant = {
            token: message.token,
            hostName: next.name,
            scope: message.scope?.includes("control") ? ["radar", "control"] : ["radar"],
          };
          setTicket(next);
          setGrant(granted);
          socket.current = ws;
          void SecureStore.setItemAsync(TOKEN_KEY, granted.token);
          void cacheHost(next).catch(() => undefined);
          void readExpoPushToken().then((expoPushToken) => {
            if (expoPushToken) ws.send(JSON.stringify({ op: "registerPush", token: granted.token, expoPushToken }));
          });
          resolve();
        }
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Cannot reach that host"));
      };
      ws.onopen = () => {
        ws.send(JSON.stringify({ op: "pair", nonce: next.nonce }));
      };
    }).catch((error: Error) => {
      setLinkError(error.message);
      throw error;
    });
  }, [pushAlert]);

  const openReview = useCallback(() => {
    const frame = demoRadar();
    socket.current?.close();
    socket.current = null;
    setTicket({ v: 1, name: "Apple Review", host: "demo", port: 0, nonce: "review" });
    setGrant({ token: "apple-review", hostName: "Apple Review", scope: ["radar", "control"] });
    setRadar(frame);
    setNeuro(toNeuroAxes(frame.dims));
    setAlerts([]);
    setSiren(false);
    setFuseArmed(false);
    setLinkError("");
    void SecureStore.setItemAsync(TOKEN_KEY, "apple-review");
  }, []);

  const disconnect = useCallback(() => {
    socket.current?.close();
    socket.current = null;
    setGrant(null);
    setTicket(null);
    setRadar(null);
    setNeuro(null);
    void SecureStore.deleteItemAsync(TOKEN_KEY);
  }, []);

  const playSample = useCallback(async () => {
    await pushAlert(demoAlert());
  }, [pushAlert]);

  const tightenRule = useCallback((key: "noise" | "oxygen" | "heat", max: number) => {
    const draft: HostRules = { ...rules };
    if (key === "noise") draft.soundDb = max;
    if (key === "oxygen") draft.o2Percent = max;
    if (key === "heat") draft.heatCelsius = max;
    tightenPatch(rules, draft);
    setRules((current) => {
      const next: HostRules = { ...current };
      if (key === "noise") next.soundDb = max;
      if (key === "oxygen") next.o2Percent = max;
      if (key === "heat") next.heatCelsius = max;
      return tightenPatch(current, next);
    });
    socket.current?.send(JSON.stringify({ type: "tighten_rule", key, max, token: grant?.token }));
  }, [grant?.token, rules]);

  const tighten = useCallback((next: HostRules) => {
    const patch = tightenPatch(rules, next);
    if (patch.soundDb != null && patch.soundDb !== rules.soundDb) tightenRule("noise", patch.soundDb);
    if (patch.o2Percent != null && patch.o2Percent !== rules.o2Percent) tightenRule("oxygen", patch.o2Percent);
    if (patch.heatCelsius != null && patch.heatCelsius !== rules.heatCelsius) tightenRule("heat", patch.heatCelsius);
  }, [rules, tightenRule]);

  const requestFuse = useCallback(() => {
    socket.current?.send(JSON.stringify({ op: "fuse", reason: "mobile-steer", token: grant?.token }));
    if (ticket?.host === "demo") {
      void pushAlert({
        type: "alert",
        id: `fuse-${Date.now()}`,
        at: new Date().toISOString(),
        severity: "critical",
        dimension: "power",
        title: "Fuse requested",
        detail: "The demo host recorded the request. On a real computer, the circuit stays there.",
      });
    }
  }, [grant?.token, pushAlert, ticket?.host]);

  const value = useMemo<HostApi>(() => ({
    ticket,
    grant,
    radar,
    neuro,
    alerts,
    rules,
    siren,
    fuseArmed,
    linkError,
    pair,
    disconnect,
    playSample,
    openReview,
    tighten,
    tightenRule,
    requestFuse,
    dismissSiren: () => setSiren(false),
  }), [alerts, fuseArmed, grant, linkError, neuro, openReview, pair, playSample, radar, requestFuse, rules, siren, ticket, tighten, tightenRule, disconnect]);

  return <HostContext.Provider value={value}>{children}</HostContext.Provider>;
}

export function useHost(): HostApi {
  const value = useContext(HostContext);
  if (!value) throw new Error("The host session is not ready");
  return value;
}
