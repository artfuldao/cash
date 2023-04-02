export interface Account {
  address: string
  name?: string
  image?: string
}

export interface Profile extends Account {
  ether?: number
  cash?: number
}

export interface Art {
  id: number
  title: string
  credit: string
  script: string
  image: string
  createdAt: number
  owner: Account
}

export interface Note extends Art {
  art: number
  encoder: string
  released: number
  rate: number
  claim: number
  amount: number
  duration: number
  collectedAt: number
  payee?: Account
  delegate?: Account
}