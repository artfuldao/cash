import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { parseEther } from 'ethers/lib/utils.js'
import { ethers } from 'hardhat'
import { ArtParams, loadArt } from '../helpers'
import { vmException } from '../utils'

describe('Cash', async () => {
  let origin: SignerWithAddress
  let alice: SignerWithAddress
  let minter: SignerWithAddress
  let bob: SignerWithAddress
  let sue: SignerWithAddress

  let cash: Contract
  let examples: ArtParams[] = []

  beforeEach(async () => {
    [origin, minter, alice, bob, sue] = await ethers.getSigners();
    examples = loadArt(100)

    const Cash = await ethers.getContractFactory('Cash1')
    cash = await Cash.connect(origin).deploy(minter.address)
  })

  it('All cash functions have correct permissions', async () => {
    await expect(
      cash.connect(alice).inflate(alice.address, 100)
    ).to.eventually.rejectedWith(vmException('Cash: caller is not the reserve'))

    await expect(
      cash.connect(alice).deflate(100)
    ).to.eventually.rejectedWith(vmException('Cash: caller is not the reserve'))

    await expect(
      cash.connect(alice).collect(alice.address, 100)
    ).to.eventually.rejectedWith(vmException('Cash: caller is not the owner or delegate'))

    await cash.connect(origin).mint(origin.address, { value: parseEther('1') })
    await cash.connect(origin).configure({
      name: 'Test',
      symbol: 'TEST',
      delegate: alice.address,
    })
    await cash.connect(alice).collect(alice.address, 100)
  })

  it('The exchange rate works correctly', async () => {
    let a1 = parseEther('1')
    let b1 = await ethers.provider.getBalance(cash.address)
    let s1 = await cash.totalSupply()
    let r1 = await cash.rate(a1)

    expect(b1).to.equal(0)
    expect(s1).to.equal(0)
    expect(r1).to.equal(0)

    await cash.connect(alice).mint(alice.address, { value: a1 })

    b1 = await ethers.provider.getBalance(cash.address)
    s1 = await cash.totalSupply()
    r1 = await cash.rate(a1)

    expect(r1).to.equal(a1.mul(b1).div(s1))
  })

  it('Pulling cash works', async () => {
    let a1 = parseEther('1')
    let c1 = await cash.found()
    let s1 = await cash.totalSupply()

    await cash.connect(alice).mint(alice.address, { value: a1 })

    s1 = await cash.totalSupply()
    expect(s1).to.equal(a1.mul(10000))

    const max = a1.mul(2000)
    const b1 = await cash.balanceOf(origin.address)
    await cash.connect(origin).collect(origin.address, max.sub(1))
    const b2 = await cash.balanceOf(origin.address)

    c1 = await cash.found()
    s1 = await cash.totalSupply()
    expect(s1).to.equal(a1.mul(10000).add(max).sub(1))
    expect(c1).to.equal(max.sub(1))
    expect(b2.sub(b1)).to.equal(max.sub(1))

    await expect(
      cash.connect(origin).collect(origin.address, 2)
    ).to.eventually.rejectedWith(vmException('Cash: not enough avaliable'))

    await cash.connect(origin).collect(origin.address, 1)

    await expect(
      cash.connect(origin).collect(origin.address, 1)
    ).to.eventually.rejectedWith(vmException('Cash: not enough avaliable'))
  })

  it('Cash has read functions', async () => {
    const payee = await cash.reserve()
    const name = await cash.name()
    const symbol = await cash.symbol()

    const delegate = await cash.delegate()
    const origin = await cash.found()

    expect(payee).to.be.a('string')
    expect(name).to.be.a('string')
    expect(symbol).to.be.a('string')
    expect(delegate).to.be.a('string')
    expect(BigNumber.isBigNumber(origin)).to.equal(true)
  })

  it('Cash has write functions', async () => {
    const name1 = await cash.name()
    const symbol1 = await cash.symbol()
    const delegate1 = await cash.delegate()

    await cash.connect(origin).configure({
      name: 'Test',
      symbol: 'TEST',
      delegate: alice.address,
    })

    await expect(
      cash.connect(bob).configure({
        name: 'asdf',
        symbol: 'asdf',
        delegate: bob.address,
      })
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    const name2 = await cash.name()
    const symbol2 = await cash.symbol()
    const delegate2 = await cash.delegate()

    expect(name1).to.not.equal(name2)
    expect(symbol1).to.not.equal(symbol2)
    expect(delegate1).to.not.equal(delegate2)
    expect(await cash.paused()).to.equal(false)

    await cash.connect(alice).mint(alice.address, { value: 1 })

    await cash.connect(origin).pause()
    expect(await cash.paused()).to.equal(true)

    await expect(
      cash.connect(alice).mint(alice.address, { value: 1 })
    ).to.eventually.rejectedWith(vmException('Pausable: paused'))

    await expect(
      cash.connect(alice).pause()
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    await cash.connect(origin).unpause()
    expect(await cash.paused()).to.equal(false)
    await cash.connect(alice).mint(alice.address, { value: 1 })

    await expect(
      cash.connect(alice).unpause()
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

  })

  it('Cash mints and burns with the correct exchange rate', async () => {
    const Cash = await ethers.getContractFactory('Cash1')
    const c = await Cash.connect(bob).deploy(bob.address)

    const a0 = parseEther('1')
    const a1 = parseEther(`${Math.random() + 0.1}`)

    let e1 = await c.rate(a0)
    expect(e1).to.equal(0)

    await c.connect(origin).mint(alice.address, { value: a1 })
    let e2 = await c.rate(a0)
    expect(e2).to.equal(a0.div(10000))

    let b1 = await bob.getBalance()
    await c.connect(alice).burn(bob.address, a1.mul(100))
    let b2 = await bob.getBalance()

    expect(b1.add(a1.div(100))).to.equal(b2)
    let e3 = await c.rate(a0)
    expect(e3).to.equal(a0.div(10000))

    let c1 = await c.totalSupply()
    let b0 = await ethers.provider.getBalance(c.address)
    await c.inflate(bob.address, a0)

    let e4 = await c.rate(a0)
    expect(e4).to.equal(a0.mul(b0).div(c1.add(a0)))
  })

  it('Cash deflate and inflate work correctly', async () => {
    const Cash = await ethers.getContractFactory('Cash1')
    const c = await Cash.connect(bob).deploy(bob.address)

    const a0 = parseEther('1')
    const a1 = parseEther(`${Math.random() + 0.1}`)
    await c.connect(origin).mint(alice.address, { value: a1 })

    let c1 = await c.totalSupply()
    let b0 = await ethers.provider.getBalance(c.address)
    await c.inflate(bob.address, a0)

    let e4 = await c.rate(a0)
    expect(e4).to.equal(a0.mul(b0).div(c1.add(a0)))

    await c.deflate(a0.div(2))
    let e5 = await c.rate(a0)
    expect(e5).to.equal(a0.mul(b0).div(c1.add(a0.div(2))))

    await expect(
      c.connect(alice).inflate(alice.address, a0)
    ).to.eventually.rejectedWith(vmException('Cash: caller is not the reserve'))

    await expect(
      c.connect(alice).deflate(a0)
    ).to.eventually.rejectedWith(vmException('Cash: caller is not the reserve'))
  })

  it('Cash allowance works correctly', async () => {
    const Cash = await ethers.getContractFactory('Cash1')
    const c = await Cash.connect(bob).deploy(bob.address)

    const a0 = parseEther('1')
    await c.connect(origin).mint(alice.address, { value: a0 })

    await c.connect(bob).transferFrom(alice.address, bob.address, a0)

    await expect(
      c.connect(sue).transferFrom(alice.address, bob.address, a0)
    ).to.eventually.rejectedWith(vmException('ERC20: insufficient allowance'))
  })

  it('Cash claim works correctly', async () => {
    const Cash = await ethers.getContractFactory('Cash1')
    const c = await Cash.connect(origin).deploy(bob.address)

    await c.connect(origin).transferOwnership(alice.address)
    await c.connect(alice).configure({
      name: 'Test',
      symbol: 'TEST',
      delegate: sue.address,
    })

    expect(await c.delegate()).to.equal(sue.address)

    const a0 = parseEther('1')
    await c.connect(bob).inflate(bob.address, a0)

    await expect(
      c.connect(sue).collect(sue.address, a0)
    ).to.eventually.rejectedWith(vmException('Cash: not enough avaliable'))

    await c.connect(sue).collect(sue.address, a0.div(5))

    await expect(
      c.connect(alice).collect(alice.address, 1)
    ).to.eventually.rejectedWith(vmException('Cash: not enough avaliable'))

    await c.connect(bob).inflate(bob.address, a0)

    await c.connect(alice).collect(sue.address, a0.div(5))
  })
})
