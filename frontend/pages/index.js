import Interface from "../components/interface";
import Script from "next/script";
import { http, createConfig, WagmiProvider } from "wagmi";
import { klaytnBaobab, localhost } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const config = createConfig({
  chains: [klaytnBaobab, localhost],
  transports: { [klaytnBaobab.id]: http(), [localhost.id]: http() },
  connectors: [injected()],
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
