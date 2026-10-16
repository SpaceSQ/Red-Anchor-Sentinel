declare module "react-native-zeroconf" {
  export default class Zeroconf {
    constructor();
    scan(type: string, protocol: string, domain: string): void;
    stop(): void;
    on(
      event: "resolved",
      listener: (service: { name?: string; host?: string; addresses?: string[]; port?: number }) => void,
    ): void;
  }
}
