import Interface from "../components/interface.js";
import Script from "next/script";

const Index = () => {
  return (
    <div>
      <Script src="js/snarkjs.min.js" />
      <Interface />
    </div>
  );
};

export default Index;
