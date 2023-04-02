import { capitalCase } from 'change-case'
import { Contract } from 'ethers'
import { readFileSync } from 'fs'

export type Contracts = Record<string, Contract>



export interface ArtParams {
  name: string
  credit: string
  script: string
  image: { shapes: any[] }
}

export const loadArt = (count: number): ArtParams[] => {
  const data: any[] = JSON.parse(readFileSync('assets/data.json', 'utf8'))
  const shuffled = data.sort(() => 0.5 - Math.random())
  const items = shuffled.slice(0, count)

  return items.map(item => {
    return {
      name: capitalCase(item.name),
      credit: capitalCase(item.symbol).toUpperCase(),
      script: `${item.name} is creative commons art`,
      image: {
        imageUrl: '',
        shapes: item.shapes
      }
    }
  })
}

