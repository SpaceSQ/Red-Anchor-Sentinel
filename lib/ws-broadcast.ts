import { writeTightenedConfig, type LocalConfig, type LocalThresholds, type RadarSnapshot } from "./local-vault.ts";

export interface HostVault {
  home: string;
  config(): LocalConfig;
  onChange(listener: (config: LocalConfig) => void): () => void;
  recordScan(frame: RadarSnapshot): boolean;
}

export function bindHostBroadcast(vault: HostVault, send: (body: unknown) => void) {
  const stop = vault.onChange((config) => {
    send({
      type: "state",
      rules: config.thresholds,
      laws: config.laws,
    });
  });

  return {
    stop,
    publishScan(frame: RadarSnapshot): boolean {
      if (!vault.recordScan(frame)) return false;
      send({ type: "radar_update", data: frame });
      return true;
    },
    tightenRule(key: string, max: number): LocalThresholds {
      return writeTightenedConfig(vault.home, key, max);
    },
  };
}
