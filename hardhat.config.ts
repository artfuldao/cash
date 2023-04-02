import '@nomicfoundation/hardhat-toolbox'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-gas-reporter'
import { HardhatUserConfig } from 'hardhat/config'
import { NetworksUserConfig } from 'hardhat/types'

const networks: NetworksUserConfig = {
  hardhat: {
    chainId: 1337
  }
}

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000
      }
    }
  },
  networks,
  gasReporter: {
    enabled: !!process.env.COIN_MARKET_CAP_API_KEY,
    coinmarketcap: process.env.COIN_MARKET_CAP_API_KEY,
    currency: 'USD'
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
}

export default config
