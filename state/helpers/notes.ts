import { DAY_DURATION } from "../utils"
import { calculateCollectionWindow, calculateInterest, calculatePenalty, TIME_DILATION } from "./interest"
export * from './interest'

export const calculateNoteDuration = (duration: number) => {
  const window = calculateCollectionWindow(duration)
  let totalTime = duration + window + duration / TIME_DILATION
  totalTime += Math.max(duration / 10, DAY_DURATION * 3)

  const totalDays = Math.max(1, totalTime / DAY_DURATION)
  const labelCount = Math.min(120, totalDays)
  const labelDays = Math.ceil(totalDays / labelCount)

  return { window, totalTime, totalDays, labelCount, labelDays }
}

export function calculateInterestRate(staked: number, supply: number): number {
  if (supply == 0) return 33333
  let rate = Math.floor(33000 * staked / supply);
  rate = Math.floor(rate * staked / supply);
  return rate + 333;
}

export function calculateTotalValue(rate: number, amount: number, duration: number, time: number): number {
  const interest = calculateInterest(rate, amount, duration, time)
  const penalty = calculatePenalty(amount, duration, time)
  return Math.max(0, interest + amount - penalty)
}

export function calculateDailyInterest(rate: number, amount: number, duration: number, time: number): number {
  const interest = calculateInterest(rate, amount, duration, time)
  const days = time / DAY_DURATION
  return interest / days
}