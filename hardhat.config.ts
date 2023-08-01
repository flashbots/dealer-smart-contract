import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: { 
    compilers: [
      {
        version: "0.8.21",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100000,
          },   
          viaIR: true,
        }    
      },
      {
        version: "0.5.16"
      },
      {
        version: "0.8.0"
      },
      {
        version: "0.6.6"
      },
    ],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true 
    },
  }
};

export default config;
