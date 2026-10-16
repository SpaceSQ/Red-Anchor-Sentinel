import { HostProvider } from "./src/host/session";
import { MobileI18n } from "./src/i18n";
import { AppShell } from "./src/navigation/AppShell";
import { AccountGate } from "./src/screens/AccountScreen";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <MobileI18n>
        <HostProvider>
          <AccountGate>
            <AppShell />
          </AccountGate>
        </HostProvider>
      </MobileI18n>
    </SafeAreaProvider>
  );
}
