import { Block } from "@ethersproject/providers"
import { ethers } from "hardhat"

export const vmException = (message: string): string => (
  `VM Exception while processing transaction: reverted with reason string '${message}'`
)

export const loadHardhatBlock = async (): Promise<Block> => {
  const blockNum = await ethers.provider.getBlockNumber()
  const block = await ethers.provider.getBlock(blockNum)
  return block
}

export const setHardhatTime = async (time: number): Promise<void> => {
  await ethers.provider.send("evm_mine", [time])
}

export const increaseHardhatTime = async (seconds: number): Promise<void> => {
  await ethers.provider.send('evm_increaseTime', [seconds])
  await ethers.provider.send("evm_mine", [])
}
