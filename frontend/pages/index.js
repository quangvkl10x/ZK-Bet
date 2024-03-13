import Interface from "../components/interface";
import Script from "next/script";
import { http, createConfig, WagmiProvider } from "wagmi";
import { klaytnBaobab } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const config = createConfig({
  chains: [klaytnBaobab],
  connectors: [injected()],
  transports: { [klaytnBaobab.id]: http() },
});
const queryClient = new QueryClient();
const Index = () => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <div>
          <Script src="js/snarkjs.min.js" />
          <Interface />
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default Index;
