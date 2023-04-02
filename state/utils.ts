import { BigNumber, ethers } from 'ethers'
import { formatEther, parseEther } from 'ethers/lib/utils'
import { Account } from './types'

export const vmException = (message: string): string => (
  `VM Exception while processing transaction: reverted with reason string '${message}'`
)

export const DAY_DURATION = 24 * 3600
export const YEAR_DURATION = DAY_DURATION * 365

export const SECONDS_IN_MINUTE = 60;
export const SECONDS_IN_HOUR = 3600;
export const SECONDS_IN_DAY = 86400;
export const SECONDS_IN_YEAR = 31536000;

export const timeToString = (seconds: number): string => {
  return new Date(seconds * 1000).toLocaleString()
}

export const durationToString = (seconds: number): string => {
  const SECONDS_IN_MINUTE = 60;
  const SECONDS_IN_HOUR = 3600;
  const SECONDS_IN_DAY = 86400;
  const SECONDS_IN_YEAR = 31536000;

  let remainingSeconds = seconds;

  const years = Math.floor(remainingSeconds / SECONDS_IN_YEAR);
  remainingSeconds -= years * SECONDS_IN_YEAR;

  const months = Math.floor(remainingSeconds / (SECONDS_IN_DAY * 30));
  remainingSeconds -= months * SECONDS_IN_DAY * 30;

  const days = Math.floor(remainingSeconds / SECONDS_IN_DAY);
  remainingSeconds -= days * SECONDS_IN_DAY;

  const hours = Math.floor(remainingSeconds / SECONDS_IN_HOUR);
  remainingSeconds -= hours * SECONDS_IN_HOUR;

  const minutes = Math.floor(remainingSeconds / SECONDS_IN_MINUTE);
  remainingSeconds -= minutes * SECONDS_IN_MINUTE;

  const secondsString = remainingSeconds.toString().padStart(2, '0');
  const minutesString = minutes.toString().padStart(2, '0');
  const hoursString = hours.toString().padStart(2, '0');
  const daysString = days.toString();
  const monthsString = months.toString();

  const yearString = years > 0 ? `${years} year${years > 1 ? 's' : ''}` : '';
  const monthString = months > 0 ? `${monthsString} month${months > 1 ? 's' : ''}` : '';
  const dayString = days > 0 ? `${daysString} day${days > 1 ? 's' : ''}` : '';

  const timeString = hours && minutes && seconds ? `${hoursString}:${minutesString}:${secondsString}` : '';

  const durationParts = [yearString, monthString, dayString, timeString].filter((part) => part !== '');

  if (durationParts.length === 0) {
    return '0 seconds';
  } else {
    return durationParts.join(' and ');
  }
}

export const formatOrdinal = (i: number): string => {
  const j = i % 10
  const k = i % 100
  if (j === 1 && k !== 11) return `${i}st`
  if (j === 2 && k !== 12) return `${i}nd`
  if (j === 3 && k !== 13) return `${i}rd`
  return `${i}th`
}

export const slugify = (s: string): string => {
  return s.toLowerCase().replaceAll(' ', '-')
}

export const getTimestamp = (): number => Math.floor(new Date().getTime() / 1000)

export const validAddress = (address: string | null | undefined): string | boolean => {
  if (address == null) return true
  try {
    return ethers.utils.getAddress(address)
  } catch {
    return false
  }
}

export const isValidAddress = (address: string | null | undefined): boolean => {
  if (!address) return false
  try {
    ethers.utils.getAddress(address)
    return true
  } catch {
    return false
  }
}

export const formatNumber = (
  num: BigNumber | number,
  opts?: Intl.NumberFormatOptions): string => {
  const s = typeof num === 'number' ? `${num}` : formatEther(num)
  const n = parseFloat(s)

  const formatter = Intl.NumberFormat('en-us', opts)

  return formatter.format(n)
}

export const compactNumber = (num: number | undefined): string => (
  num != null ? formatNumber(num, { notation: 'compact' }) : ''
)

export const parseBigNumber = (num: BigNumber | undefined): number => {
  return num == null ? 0 : parseFloat(formatEther(num))
}


export const parseFound = (found: number): BigNumber => {
  return parseEther(`${found / 10000}`)
}

type Data = Record<string, any>

export const cleanDataItem = (obj: any): Data => {
  if (obj == null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanDataItem)
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (typeof obj === 'object' && '_isBigNumber' in obj) {
    return { type: 'BigNumber', hex: obj.toHexString() }
  }

  return Object.entries(obj).reduce<Data>((acc, [k, v]) => {
    acc[k] = cleanDataItem(v)
    return acc
  }, {})
}

export const cleanBigNumber = (obj: any): Data => {
  if (obj == null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanBigNumber)
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if ('type' in obj && obj.type === 'BigNumber') {
    return BigNumber.from(obj)
  }

  return Object.entries(obj).reduce<Data>((acc, [k, v]) => {
    acc[k] = cleanBigNumber(v)
    return acc
  }, {})
}

export const stringifyAddress = (address: string): string => {
  const start = address.slice(0, 7)
  const end = address.slice(-5)
  return `${start}...${end}`
}

export const COLOR_MAP = {
  red: '#f44336',
  pink: '#FFC0CB',
  purple: '#9c27b0',
  blue: '#2196f3',
  green: '#4caf50',
  yellow: '#ffeb3b',
  orange: '#ff9800',
  brown: '#795548',
  black: '#333333',
  white: '#eeeeee'
}

export const setOpacity = (hex: string, alpha: number): string => (
  `${hex}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`
)

export const COLORS = Object.values(COLOR_MAP)

export const encodeQueryString = (params: Record<string, string | number>): string => {
  return Object.entries(params).reduce((acc, [key, val], idx) => {
    acc += idx === 0 ? '?' : '&'
    acc += key
    acc += '='
    acc += encodeURIComponent(val)
    return acc
  }, '')
}

export const isOwner = (address: string | undefined, item?: {
  owner: Account
} | undefined | null): boolean => {
  if (item == null) return false

  const { owner } = item

  if (address == null || address !== owner.address) {
    return false
  }
  return true
}

export const isOwnerOrDelegate = (address: string | undefined, item?: {
  owner: Account
  delegate?: Account
} | undefined | null): boolean => {
  if (item == null) return false

  const {
    owner,
    delegate
  } = item

  if (address == null || (address !== owner.address && address !== delegate?.address)) {
    return false
  }
  return true
}
