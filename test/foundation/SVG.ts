import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { capitalCase } from 'change-case'
import { Contract } from 'ethers'
import { writeFileSync } from 'fs'
import { ethers } from 'hardhat'
import { encodeEllipse, encodeLine, encodeRectangle } from '../../state/helpers/shapes'
import { ArtParams } from '../helpers'

describe('SVG', async () => {
  let origin: SignerWithAddress
  let governance: SignerWithAddress
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let sue: SignerWithAddress

  let canvas: Contract
  let examples: ArtParams[] = []

  const randomArt = () => {
    const example = examples[Math.floor(Math.random() * examples.length)]
    return {
      webUrl: '',
      dataUrl: '',
      imageUrl: '',
      mediaUrl: '',
      shapes: example.image.shapes.slice(0, 3),
      title: capitalCase(example.name),
      credit: example.name.toUpperCase(),
      script: example.script,
      // TODO: move these params to the encoder?
    }
  }

  beforeEach(async () => {
    [origin, governance, alice, bob, sue] = await ethers.getSigners();

    const SVG = await ethers.getContractFactory('SVG1')
    canvas = await SVG.connect(origin).deploy()
  })

  it('Encodes SVG correctly', async () => {

    let bytes = '0x'

    bytes += encodeRectangle({
      w: 255,
      h: 255,
      x: 0,
      y: 0,
      fill: { r: 255, g: 0, b: 100, a: 10 },
      stroke: { thickness: 10, r: 255, g: 0, b: 100 },
    })

    bytes += encodeEllipse({
      cx: 100,
      cy: 100,
      rx: 100,
      ry: 25,
      fill: { r: 0, g: 0, b: 255, a: 10 },
      // stroke: { thickness: 10, r: 0, g: 255, b: 100 },
      rotation: {
        angle: 225,
        x: 100,
        y: 100
      }
    })

    bytes += encodeRectangle({
      w: 100,
      h: 30,
      x: 100,
      y: 100,
      fill: { r: 0, g: 0, b: 255, a: 10 },
      rotation: {
        angle: 25,
        x: 100,
        y: 100
      },
      stroke: { thickness: 10, r: 0, g: 255, b: 100 },
    })

    bytes += encodeEllipse({
      cx: 100,
      cy: 100,
      rx: 30,
      ry: 10,
      fill: { r: 255, g: 0, b: 255, a: 10 },
      stroke: { thickness: 10, r: 0, g: 255, b: 100 },
      rotation: {
        angle: 25,
        x: 100,
        y: 100
      },
    })

    bytes += encodeLine({
      x1: 10,
      y1: 10,
      x2: 245,
      y2: 245,
      stroke: { thickness: 10, r: 0, g: 255, b: 100 },
    })

    bytes += encodeLine({
      x1: 30,
      y1: 200,
      x2: 200,
      y2: 30,
      stroke: { thickness: 10, r: 0, g: 0, b: 0 },
    })

    const svg = await canvas.encodeSVG(bytes)
    writeFileSync('test/test1.svg', svg)
  })

})
