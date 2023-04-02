import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { capitalCase } from 'change-case'
import { BigNumber, Contract } from 'ethers'
import { parseEther } from 'ethers/lib/utils.js'
import { ethers } from 'hardhat'
import { calculateInterest, calculatePenalty } from '../../state/helpers/interest'
import { calculateInterestRate } from '../../state/helpers/notes'
import { encodeSVG } from '../../state/helpers/shapes'
import { DAY_DURATION, parseBigNumber } from '../../state/utils'
import { ArtParams, loadArt } from '../helpers'
import { increaseHardhatTime, loadHardhatBlock, vmException } from '../utils'

describe('Reserve', async () => {
  let origin: SignerWithAddress
  let governance: SignerWithAddress
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let sue: SignerWithAddress

  let reward = 1200
  let bonus = 11000

  let canvas: Contract
  let block: Contract
  let reserve: Contract
  let cash: Contract
  let examples: ArtParams[] = []

  const randomArt = () => {
    const example = examples[Math.floor(Math.random() * examples.length)]
    return {
      webUrl: '',
      dataUrl: '',
      imageUrl: '',
      mediaUrl: '',
      svgData: encodeSVG(example.image.shapes.slice(0, 3)),
      title: capitalCase(example.name),
      credit: example.name.toUpperCase(),
      script: example.script,
      encoder: canvas.address,
      target: 0,
    }
  }

  beforeEach(async () => {
    [origin, governance, alice, bob, sue] = await ethers.getSigners();
    examples = loadArt(100)

    const Reserve = await ethers.getContractFactory('Reserve1')
    reserve = await Reserve.connect(origin).deploy()

    const Cash = await ethers.getContractFactory('Cash1')
    cash = await Cash.attach(await reserve.cash())

    const Canvas1 = await ethers.getContractFactory('Canvas1')
    canvas = await Canvas1.deploy(reserve.address)

    const Block1 = await ethers.getContractFactory('Block1')
    block = await Block1.deploy(reserve.address)
  })

  it('Admin functions work: configure', async () => {
    const tName1 = await reserve.name()
    const tSymbol1 = await reserve.symbol()
    const cName1 = await cash.name()
    const cSymbol1 = await cash.symbol()

    await reserve.connect(origin).configure({
      name: 'hello',
      symbol: 'world',
      commission: 1200,
      bonus: 11000,
      maxDuration: 5550 * DAY_DURATION,
      maxCollection: 333 * DAY_DURATION,
      minCollection: 3 * DAY_DURATION,
      timeDilation: 3,
      reserve: ethers.constants.AddressZero
    })

    await cash.connect(origin).configure({
      name: 'need',
      symbol: 'money :p',
      delegate: alice.address,
    })

    await expect(
      reserve.connect(alice).configure({
        name: 'hello',
        symbol: 'world',
        commission: 1200,
        bonus: 11000,
        maxDuration: 5550 * DAY_DURATION,
        maxCollection: 333 * DAY_DURATION,
        minCollection: 3 * DAY_DURATION,
        timeDilation: 3,
        reserve: ethers.constants.AddressZero
      })
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    await expect(
      cash.connect(alice).configure({
        name: 'Test',
        symbol: 'TEST',
        delegate: alice.address,
      })
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    const tName2 = await reserve.name()
    const tSymbol2 = await reserve.symbol()
    const cName2 = await cash.name()
    const cSymbol2 = await cash.symbol()

    expect(tName1).to.not.equal(tName2)
    expect(tSymbol1).to.not.equal(tSymbol2)
    expect(cName1).to.not.equal(cName2)
    expect(cSymbol1).to.not.equal(cSymbol2)
  })

  it('Print and update art', async () => {
    expect(await reserve.tokenCount()).to.equal(0)

    const art = randomArt()
    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION
    })

    expect(await reserve.tokenCount()).to.equal(1)

    await canvas.connect(alice).print(randomArt(), {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION
    })

    const raw = await reserve.tokenData(1)
    const data = JSON.parse(raw)

    expect(data.imageUrl).to.equal('')
  })

  it('Print and update modify all the correct values', async () => {
    let params = randomArt()
    let tx = await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION
    })

    let { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    let art = await reserve.getNote(1)

    expect(art.id).to.equal(1)
    expect(art.createdAt).to.equal(timestamp)
    expect(art.encoder).to.equal(canvas.address)

    let params2 = randomArt()
    expect(params.title).to.not.equal(params2.title)



    await canvas.connect(alice).update(1, params2);
    tx = await reserve.connect(alice).secure({
      id: 1,
      encoder: canvas.address,
      delegate: bob.address,
      payee: bob.address
    });
    ({ timestamp } = await ethers.provider.getBlock(tx.blockHash))
    let art1 = await reserve.getNote(1)

    expect(art1.id).to.equal(1)
    expect(art1.createdAt).to.equal(art.createdAt)
    expect(art1.encoder).to.equal(canvas.address)
  })


  it('Secure updates payee and delegate', async () => {
    let params = randomArt()
    let a1 = parseEther('1')

    await cash.connect(alice).mint(alice.address, { value: a1 })
    // await cash.connect(alice).approve(reserve.address, ethers.constants.MaxUint256)

    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: a1,
      duration: DAY_DURATION
    })

    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: alice.address,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: a1,
      duration: DAY_DURATION * 8
    })

    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      delegate: bob.address,
      amount: a1,
      duration: DAY_DURATION * 8
    })

    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })

    await expect(
      reserve.connect(bob).withdraw({ id: 1, to: alice.address, limit: 0 })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))

    await reserve.connect(alice).withdraw({ id: 2, to: alice.address, limit: 0 })
    await expect(
      reserve.connect(bob).withdraw({ id: 2, to: bob.address, limit: 0 })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))

    await reserve.connect(bob).withdraw({ id: 3, to: bob.address, limit: 0 })
    await increaseHardhatTime(DAY_DURATION)

    await reserve.connect(alice).secure({
      id: 1,
      encoder: canvas.address,
      delegate: ethers.constants.AddressZero,
      payee: alice.address
    })

    await reserve.connect(alice).secure({
      id: 2,
      encoder: canvas.address,
      delegate: bob.address,
      payee: alice.address
    })

    await reserve.connect(alice).secure({
      id: 3,
      encoder: canvas.address,
      delegate: ethers.constants.AddressZero,
      payee: ethers.constants.AddressZero
    })

    await expect(
      reserve.connect(bob).withdraw({ id: 1, to: bob.address, limit: 0 })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))
    await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })

    await expect(
      reserve.connect(sue).withdraw({ id: 2, to: bob.address, limit: 0 })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))
    await reserve.connect(alice).withdraw({ id: 2, to: alice.address, limit: 0 })

    await reserve.connect(alice).withdraw({ id: 3, to: alice.address, limit: 0 })
    await reserve.connect(alice).withdraw({ id: 3, to: bob.address, limit: 0 })
    await expect(
      reserve.connect(bob).withdraw({ id: 3, to: bob.address, limit: 0 })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))


    await reserve.connect(alice).secure({
      id: 1,
      encoder: canvas.address,
      delegate: ethers.constants.AddressZero,
      payee: ethers.constants.AddressZero
    })

    await reserve.connect(alice).secure({
      id: 2,
      encoder: canvas.address,
      delegate: ethers.constants.AddressZero,
      payee: alice.address
    })

    await reserve.connect(alice).secure({
      id: 3,
      encoder: canvas.address,
      delegate: ethers.constants.AddressZero,
      payee: bob.address
    })

    await increaseHardhatTime(DAY_DURATION * 6)
    await reserve.connect(alice).collect({ id: 1, principalTo: alice.address, interestTo: alice.address })
    await reserve.connect(bob).collect({ id: 2, principalTo: alice.address, interestTo: alice.address })
    await reserve.connect(bob).collect({ id: 3, principalTo: bob.address, interestTo: bob.address })
  })

  it('Secure function works', async () => {
    let params = randomArt()

    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 8
    })

    await canvas.connect(bob).print(params, {
      to: bob.address,
      from: bob.address,
      payee: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      delegate: alice.address,
      amount: 0,
      duration: DAY_DURATION * 8
    })

    await increaseHardhatTime(DAY_DURATION)

    await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })
    await reserve.connect(alice).withdraw({ id: 2, to: alice.address, limit: 0 })


    await reserve.connect(alice).secure({
      id: 1,
      encoder: canvas.address,
      delegate: bob.address,
      payee: ethers.constants.AddressZero
    })

    await reserve.connect(bob).secure({
      id: 2,
      encoder: canvas.address,
      delegate: ethers.constants.AddressZero,
      payee: ethers.constants.AddressZero
    })

    await expect(
      reserve.connect(alice).withdraw({ id: 2, to: alice.address, limit: 0 })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))

    await reserve.connect(bob).withdraw({ id: 1, to: bob.address, limit: 0 })


    await reserve.connect(bob).secure({
      id: 1,
      encoder: canvas.address,
      delegate: ethers.constants.AddressZero,
      payee: ethers.constants.AddressZero
    })

    await expect(
      reserve.connect(bob).withdraw({ id: 1, to: bob.address, limit: 0 })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))
  })

  it('Encodes note meta data', async () => {
    const art = randomArt()
    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: bob.address,
      delegate: sue.address,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION
    })

    const res = await reserve.tokenData(1)
    const data = JSON.parse(res)

    expect(data.rate).to.greaterThan(0)
    expect(data.amount).to.equal(0)
    expect(data.duration).to.equal(DAY_DURATION)
    expect(data.payee).to.equal(bob.address.toLowerCase())
    expect(data.delegate).to.equal(sue.address.toLowerCase())

    await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })
    await reserve.connect(alice).stake(1, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION
    })
  })

  it('Encodes art data correctly', async () => {
    let params = randomArt()
    let tx = await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION
    }, { value: parseEther('1') })

    let { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    let raw = await reserve.tokenData(1)
    let t1 = JSON.parse(raw)
    let r1 = await reserve.interestRate()
    let s1 = await cash.balanceOf(reserve.address)

    expect(t1.id).to.equal(1)
    expect(t1.art).to.equal(1)
    expect(t1.rate).to.approximately(r1, 1000)
    expect(parseEther(`${t1.amount}`)).to.approximately(s1, 1000)
    expect(t1.duration).to.equal(DAY_DURATION)
    expect(t1.createdAt).to.equal(timestamp)
    expect(t1.collectedAt).to.equal(0)
    expect(t1.title).to.equal(params.title)
    expect(t1.credit).to.equal(params.credit)
    expect(t1.script).to.equal(params.script)
  })

  it('Cash admin functions and permissions correct', async () => {
    await cash.connect(alice).mint(alice.address, { value: parseEther('1') })

    await expect(
      cash.connect(alice).configure({
        name: 'Test',
        symbol: 'TEST',
        delegate: alice.address,
      })
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    await expect(
      cash.connect(alice).configure({
        name: 'cash',
        symbol: 'ola',
        delegate: alice.address,
      })
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    await expect(
      cash.connect(alice).collect(alice.address, parseEther('1'))
    ).to.eventually.rejectedWith(vmException('Cash: caller is not the owner or delegate'))

    await cash.connect(origin).configure({
      name: 'Test',
      symbol: 'TEST',
      delegate: alice.address,
    })

    let name1 = await cash.name()
    let symbol1 = await cash.symbol()

    await cash.connect(origin).configure({
      name: 'notable',
      symbol: 'cash',
      delegate: alice.address,
    })

    let name2 = await cash.name()
    let symbol2 = await cash.symbol()
    expect(name1).to.not.equal(name2)
    expect(symbol1).to.not.equal(symbol2)

    await cash.connect(alice).collect(alice.address, parseEther('1'))
  })

  it('Reserve admin functions and permissions correct', async () => {
    const params = randomArt()
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 8
    })

    await expect(
      reserve.connect(alice).pause()
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    await expect(
      reserve.connect(alice).unpause()
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    await expect(
      reserve.connect(alice).configure({
        name: 'hello',
        symbol: 'world',
        commission: 1200,
        bonus: 11000,
        maxDuration: 5550 * DAY_DURATION,
        maxCollection: 333 * DAY_DURATION,
        minCollection: 3 * DAY_DURATION,
        timeDilation: 3,
        reserve: ethers.constants.AddressZero
      })
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    await expect(
      reserve.connect(alice).assign([1], block.address)
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    await reserve.connect(origin).pause()

    // todo: check all paused functions

    await expect(
      canvas.connect(alice).print(params, {
        to: alice.address,
        from: alice.address,
        payee: ethers.constants.AddressZero,
        delegate: ethers.constants.AddressZero,
        encoder: canvas.address,
        target: 0,
        amount: 0,
        duration: DAY_DURATION * 8
      })
    ).to.eventually.rejectedWith(vmException('Pausable: paused'))

    await expect(
      reserve.connect(alice).stake(1, {
        to: alice.address,
        from: alice.address,
        payee: ethers.constants.AddressZero,
        delegate: ethers.constants.AddressZero,
        encoder: canvas.address,
        target: 0,
        amount: 0,
        duration: DAY_DURATION * 8
      })
    ).to.eventually.rejectedWith(vmException('Pausable: paused'))

    await expect(
      reserve.connect(alice).rollover({
        target: 0,
        id: 1,
        noteTo: alice.address,
        interestTo: ethers.constants.AddressZero,
        encoder: canvas.address,
        payee: ethers.constants.AddressZero,
        delegate: ethers.constants.AddressZero,
      })
    ).to.eventually.rejectedWith(vmException('Pausable: paused'))

    await reserve.connect(origin).unpause()

    let data1 = JSON.parse(await reserve.tokenData(1))
    await reserve.connect(origin).assign([1], block.address)
    let data2 = JSON.parse(await reserve.tokenData(1))
    expect(data1.title).to.not.equal(data2.title)

    let name1 = await reserve.name()
    let symbol1 = await reserve.symbol()

    await reserve.connect(origin).configure({
      name: 'notable',
      symbol: 'note',
      commission: 1200,
      bonus: 11000,
      maxDuration: 5550 * DAY_DURATION,
      maxCollection: 333 * DAY_DURATION,
      minCollection: 3 * DAY_DURATION,
      timeDilation: 3,
      reserve: governance.address
    })

    let name2 = await reserve.name()
    let symbol2 = await reserve.symbol()
    expect(name1).to.not.equal(name2)
    expect(symbol1).to.not.equal(symbol2)
  })

  it('Assigns encoder', async () => {
    let params = randomArt()
    let a1 = parseEther('1')

    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION
    }, { value: a1 })

    let d1 = JSON.parse(await reserve.tokenData(1))
    await reserve.connect(origin).assign([1], block.address)
    let d2 = JSON.parse(await reserve.tokenData(1))

    expect(d1.duration).to.equal(d2.duration)
    expect(d1.image).to.not.equal(d2.image)
    expect(d2.image).to.equal('')

    await reserve.connect(origin).assign([1], ethers.constants.AddressZero)
    let d3 = JSON.parse(await reserve.tokenData(1))

    expect(d3.duration).to.equal(d1.duration)
    expect(d3.image).to.equal(d1.image)
    expect(d3.image).to.not.equal(d2.image)
  })

  it('Stakes on art thats not yours then pays credit', async () => {
    await canvas.connect(alice).print(randomArt(), {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION
    })

    await reserve.connect(bob).stake(1, {
      to: bob.address,
      from: bob.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION
    }, { value: parseEther('1') })

    await increaseHardhatTime(DAY_DURATION)
    const tx = await reserve.connect(bob).withdraw({ id: 2, to: bob.address, limit: 0 })
    const block = await ethers.provider.getBlock(tx.blockHash)

    const note1 = JSON.parse(await reserve.tokenData(1))
    const note2 = JSON.parse(await reserve.tokenData(2))
    const duration = block.timestamp - note2.createdAt;

    const credit1 = await reserve.getReward(1)
    let interest = await reserve.calculateInterest(
      note2.rate,
      parseEther(`${note2.amount}`),
      note2.duration,
      duration
    );

    const released = await reserve.getReleased(2)
    expect(released).to.equal(interest)
    expect(credit1).to.equal(interest.mul(reward).div(10000))

    const b1 = await cash.balanceOf(alice.address)
    await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })
    const b2 = await cash.balanceOf(alice.address)
    expect(b1.add(interest.mul(reward).div(10000))).to.equal(b2)

    const interest1 = await reserve.calculateInterest(
      parseEther(`${note1.rate}`),
      parseEther(`${note1.amount}`),
      note1.duration,
      duration
    );

    expect(interest1).to.equal(0)
    expect(await reserve.getReward(1)).to.equal(await reserve.getReleased(1))
  })

  it('Withdraws yield early and updates meta data', async () => {
    // alice prints a reserve note
    await canvas.connect(alice).print(randomArt(), {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 7
    }, { value: parseEther('1') })
    let note = JSON.parse(await reserve.tokenData(1))

    // on the first day she withdraws the total avaliable
    let b1 = await cash.balanceOf(alice.address)
    await increaseHardhatTime(DAY_DURATION)
    let tx = await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })
    let block = await ethers.provider.getBlock(tx.blockHash)
    let duration = block.timestamp - note.createdAt
    let i1 = await reserve.calculateInterest(
      note.rate, parseEther(`${note.amount}`), note.duration, duration)
    let b2 = await cash.balanceOf(alice.address)

    // we expect the released amount to be equal to the interest
    expect(i1).to.equal(b2.sub(b1))
    note = JSON.parse(await reserve.tokenData(1))
    expect(parseEther(`${note.released}`)).to.approximately(i1, 10000)

    // in four days she withdraws again
    b1 = await cash.balanceOf(alice.address)
    await increaseHardhatTime(DAY_DURATION * 4)
    tx = await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })
    block = await ethers.provider.getBlock(tx.blockHash)
    duration = block.timestamp - note.createdAt
    i1 = await reserve.calculateInterest(
      note.rate, parseEther(`${note.amount}`), note.duration, duration)
    b2 = await cash.balanceOf(alice.address)

    // again, the interest should be the avaliable
    expect(i1).to.equal(b2)
    note = JSON.parse(await reserve.tokenData(1))
    expect(parseEther(`${note.released}`)).to.approximately(i1, 100000)

    // three days after that she withdraws up to the maximum
    b1 = await cash.balanceOf(alice.address)
    await increaseHardhatTime(DAY_DURATION * 3)
    tx = await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })
    block = await ethers.provider.getBlock(tx.blockHash)
    duration = block.timestamp - note.createdAt
    i1 = await reserve.calculateInterest(
      note.rate, parseEther(`${note.amount}`), note.duration, duration)
    b2 = await cash.balanceOf(alice.address)

    let i2 = await reserve.calculateInterest(
      note.rate, parseEther(`${note.amount}`), note.duration, note.duration)
    note = JSON.parse(await reserve.tokenData(1))

    // interest is equal to the note duration
    expect(i1).to.equal(i2)
    expect(parseEther(`${note.released}`)).to.approximately(i1, 100000)

    // no more is withdrawn
    await increaseHardhatTime(DAY_DURATION * 2)
    await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })

    note = JSON.parse(await reserve.tokenData(1))
    expect(parseEther(`${note.released}`)).to.approximately(i1, 100000)
    expect(await reserve.getReleased(note.id)).to.equal(i1)
  })

  it('Withdraw with various configurations and cash still adds up', async () => {
    const a1 = parseEther('1')
    const params = randomArt()

    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: alice.address,
      delegate: alice.address,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 7
    }, { value: a1 })

    await increaseHardhatTime(DAY_DURATION)
    await cash.connect(alice).mint(alice.address, { value: a1 })
    // await cash.connect(alice).approve(reserve.address, ethers.constants.MaxUint256)

    let note1 = await reserve.getNote(1)

    await reserve.connect(alice).stake(1, {
      to: alice.address,
      from: alice.address,
      payee: alice.address,
      delegate: bob.address,
      encoder: canvas.address,
      target: 0,
      amount: a1,
      duration: DAY_DURATION * 7
    })

    let note2 = await reserve.getNote(2)

    // 10000 CASH was minted but only 1 was deposited,
    // more outstanding than staked, thus a lower rate
    expect(note2.rate).to.be.lessThan(note1.rate)

    await increaseHardhatTime(DAY_DURATION)
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 33333,
      amount: a1.mul(10000).sub(a1),
      duration: DAY_DURATION * 7
    })

    let note3 = await reserve.getNote(3)

    // staked the remainder of the CASH so maximum rate
    expect(note1.rate).to.equal(note3.rate)

    await increaseHardhatTime(DAY_DURATION)

    // test withdraw with payee unset
    await reserve.connect(bob).withdraw({ id: 2, to: alice.address, limit: 0 })
    await increaseHardhatTime(300)
    await reserve.connect(alice).withdraw({ id: 2, to: alice.address, limit: 0 })
    await increaseHardhatTime(300)
    await reserve.connect(bob).withdraw({ id: 2, to: bob.address, limit: 0 })
    await reserve.connect(alice).withdraw({ id: 3, to: bob.address, limit: 0 })

    await expect(
      reserve.connect(sue).withdraw({ id: 2, to: bob.address, limit: 0 })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))
    await expect(
      reserve.connect(sue).withdraw({ id: 2, to: sue.address, limit: 0 })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))

    await increaseHardhatTime(300)
    await reserve.connect(alice).withdraw({ id: 2, to: alice.address, limit: 0 })
    await increaseHardhatTime(300)

    const tx = await reserve.connect(alice).withdraw(({ id: 1, to: sue.address, limit: 0 }));
    const { timestamp } = await ethers.provider.getBlock(tx.blockHash)

    let b0 = await cash.balanceOf(reserve.address)
    let b1 = await cash.balanceOf(alice.address)
    let b2 = await cash.balanceOf(bob.address)
    let b3 = await cash.balanceOf(sue.address)

    const rate = await reserve.interestRate()
    const supply = b0.add(b1).add(b2).add(b3)
    const calc = calculateInterestRate(parseBigNumber(b0), parseBigNumber(supply))
    expect(rate).to.equal(calc)

    let r2 = await reserve.getReleased(2)
    let c2 = await reserve.getReward(1)
    let [i2, p2] = await reserve.calculateValue(note1.rate, note1.amount, note1.duration, timestamp - note1.createdAt)

    expect(r2.mul(reward).div(10000)).to.approximately(c2, 10)
    expect(b3).to.equal(c2.add(i2))
  })

  it('Reward payment works', async () => {
    const a1 = parseEther('1')
    const params = randomArt()
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 8
    })

    await reserve.connect(bob).stake(1,  {
      to: alice.address,
      from: alice.address,
      payee: bob.address,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 8
    }, { value: a1 })

    await increaseHardhatTime(DAY_DURATION * 8)

    await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })

    let b1 = await cash.balanceOf(alice.address)
    expect(b1).to.equal(0)

    await reserve.connect(bob).collect({ id: 2, principalTo: bob.address, interestTo: bob.address})

    await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })
    let b2 = await cash.balanceOf(bob.address)
    b1 = await cash.balanceOf(alice.address)
    expect(b1).to.equal(b2.sub(a1.mul(10000)).mul(reward).div(10000))
  })

  it('Pays penalty and yield when withdrawn early', async () => {
    // alice prints a reserve note
    await canvas.connect(alice).print(randomArt(), {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 7
    }, { value: parseEther('1') })

    let note = JSON.parse(await reserve.tokenData(1))
    await increaseHardhatTime(DAY_DURATION * 3)

    const a1 = await cash.balanceOf(alice.address)
    const b1 = await cash.balanceOf(bob.address)

    let tx = await reserve.connect(alice).collect({ id: 1, principalTo: bob.address, interestTo: alice.address})
    let block = await ethers.provider.getBlock(tx.blockHash)
    let duration = block.timestamp - note.createdAt

    const a2 = await cash.balanceOf(alice.address)
    const b2 = await cash.balanceOf(bob.address)

    const n = await reserve.getNote(1)
    note = JSON.parse(await reserve.tokenData(1))
    const maturity = note.collectedAt - note.createdAt
    expect(duration).to.equal(maturity)

    const solPrincipal = parseEther('10000')
    const solInterest = await reserve.calculateInterest(n.rate, solPrincipal, DAY_DURATION * 7, maturity)
    const solPenalty = await reserve.calculatePenalty(solPrincipal, DAY_DURATION * 7, maturity)
    const jsInterest = calculateInterest(note.rate, 10000, DAY_DURATION * 7, maturity)
    const jsPenalty = calculatePenalty(10000, DAY_DURATION * 7, maturity)

    const interestPayment = a2.sub(a1)
    const principalPayment = b2.sub(b1)

    expect(solInterest).to.approximately(parseEther(`${jsInterest}`), 1000000)
    expect(solPenalty).to.approximately(parseEther(`${jsPenalty}`), 1000000)

    expect(solInterest).to.equal(interestPayment)
    expect(solPrincipal.sub(solPenalty)).to.equal(principalPayment)
  })

  it('Pays no penalty and yield when withdrawn on time', async () => {
    const value = parseEther('1')

    await canvas.connect(alice).print(randomArt(), {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 7
    }, { value })

    await canvas.connect(bob).print(randomArt(), {
      to: bob.address,
      from: bob.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 7
    }, { value })

    await reserve.connect(bob).withdraw({ id: 2, to: bob.address, limit: 0 })
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).withdraw({ id: 2, to: bob.address, limit: 0 })
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).withdraw({ id: 2, to: bob.address, limit: 0 })
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).withdraw({ id: 2, to: bob.address, limit: 0 })
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).withdraw({ id: 2, to: bob.address, limit: 0 })
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).withdraw({ id: 2, to: bob.address, limit: 0 })
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).withdraw({ id: 2, to: bob.address, limit: 0 })
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).collect({ id: 2, principalTo: bob.address, interestTo: bob.address})
    await reserve.connect(alice).collect({ id: 1, principalTo: alice.address, interestTo: alice.address})

    const note1 = await reserve.getNote(1)
    const note2 = await reserve.getNote(2)

    const interest1 = await reserve.calculateInterest(note1.rate, note1.amount, note1.duration, note1.duration)
    const interest2 = await reserve.calculateInterest(note2.rate, note2.amount, note2.duration, note2.duration)

    const balanceBob = await cash.balanceOf(bob.address)
    const balanceAlice = await cash.balanceOf(alice.address)

    expect(balanceAlice).to.equal(value.mul(10000).add(interest1.mul(bonus).div(10000)))
    expect(balanceBob).to.equal(value.mul(10000).add(interest2.mul(bonus).div(10000)))
    expect(balanceBob).to.equal(balanceAlice)
    expect(interest1).to.equal(interest2)
  })

  it('Pays penalty and yield when withdraw late', async () => {
    const value = parseEther('1')

    await canvas.connect(alice).print(randomArt(), {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 7
    }, { value })

    await increaseHardhatTime(DAY_DURATION * 7)
    await increaseHardhatTime(DAY_DURATION * 4)
    let { timestamp } = await loadHardhatBlock()

    await reserve.connect(alice).collect({ id: 1, principalTo: alice.address, interestTo: alice.address})

    let note1 = await reserve.getNote(1)
    let duration = timestamp - note1.createdAt
    let interest1 = await reserve.calculateInterest(note1.rate, note1.amount, note1.duration, duration)
    let penalty1 = await reserve.calculatePenalty(note1.amount, note1.duration, duration)

    expect(interest1).gt(0)
    expect(penalty1).gt(0)

    await increaseHardhatTime(DAY_DURATION * 4);
    ({ timestamp } = await loadHardhatBlock())

    duration = timestamp - note1.createdAt
    interest1 = await reserve.calculateInterest(note1.rate, note1.amount, note1.duration, duration)
    penalty1 = await reserve.calculatePenalty(note1.amount, note1.duration, duration)

    expect(penalty1).to.equal(note1.amount)
    expect(interest1).to.equal(0)
  })

  it('Pays reserve penalties if reserve set', async () => {
    const a1 = parseEther('1')
    const params = randomArt()
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION
    }, { value: a1 })

    let n1 = await reserve.getNote(1)

    await reserve.connect(origin).configure({
      name: 'hello',
      symbol: 'world',
      commission: 1200,
      bonus: 11000,
      maxDuration: 5550 * DAY_DURATION,
      maxCollection: 333 * DAY_DURATION,
      minCollection: 3 * DAY_DURATION,
      timeDilation: 3,
      reserve: governance.address
    })

    const tx = await reserve.connect(alice).collect({ id: 1, principalTo: alice.address, interestTo: alice.address })
    const { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    const p1 = await reserve.calculatePenalty(n1.amount, n1.duration, timestamp - n1.createdAt)

    let b1 = await cash.balanceOf(governance.address)
    expect(b1).to.equal(p1)
  })

  it('Capture late stake as anyone', async () => {
    const value = parseEther('1')
    await canvas.connect(alice).print(randomArt(), {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 7
    }, { value })
    let note1 = await reserve.getNote(1)

    await increaseHardhatTime(DAY_DURATION * 11)
    let b1 = await cash.balanceOf(reserve.address)

    let tx = await reserve.capture([1])
    let { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    let duration = timestamp - note1.createdAt

    let b2 = await cash.balanceOf(reserve.address)
    let penalty1 = await reserve.calculatePenalty(note1.amount, note1.duration, duration)

    expect(penalty1).gt(0)
    expect(b1).to.not.equal(b2)
    expect(b1.sub(penalty1)).to.equal(b2)

    const cap1 = await reserve.getCaptured(1)
    tx = await reserve.capture(1);
    ({ timestamp } = await ethers.provider.getBlock(tx.blockHash))
    duration = timestamp - note1.createdAt
    const cap2 = await reserve.getCaptured(1)
    let b3 = await cash.balanceOf(reserve.address)

    let penalty2 = await reserve.calculatePenalty(note1.amount, note1.duration, duration)

    expect(b2.sub(b3)).to.equal(cap2.sub(cap1))
    expect(penalty2.sub(penalty1)).to.equal(cap2.sub(cap1))
  })

  it('Collects with various configurations and cash still adds up', async () => {
    const a1 = parseEther('1')
    const params = randomArt()

    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: alice.address,
      delegate: alice.address,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 7
    }, { value: a1 })

    await increaseHardhatTime(DAY_DURATION)
    await cash.connect(alice).mint(alice.address, { value: a1 })
    // await cash.connect(alice).approve(reserve.address, ethers.constants.MaxUint256)

    let note1 = await reserve.getNote(1)
    await reserve.connect(alice).stake(1, {
      to: alice.address,
      from: alice.address,
      payee: alice.address,
      delegate: bob.address,
      encoder: canvas.address,
      target: 0,
      amount: a1,
      duration: DAY_DURATION * 7
    })

    let note2 = await reserve.getNote(2)
    expect(note2.rate).to.be.lessThan(note1.rate)

    await increaseHardhatTime(DAY_DURATION)
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 33333,
      amount: a1.mul(10000).sub(a1),
      duration: DAY_DURATION * 7
    })
    await increaseHardhatTime(DAY_DURATION)
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 33333,
      amount: 0,
      duration: DAY_DURATION * 7
    }, { value: a1 })

    let note3 = await reserve.getNote(3)
    let note4 = await reserve.getNote(4)

    // 4 7 day notes, 1 today, 1 yesterday, 1 the day before

    await increaseHardhatTime(DAY_DURATION * 3)

    let b0 = await cash.balanceOf(reserve.address)
    let b1 = await cash.balanceOf(alice.address)
    let b2 = await cash.balanceOf(bob.address)
    let b3 = await cash.balanceOf(sue.address)

    expect(b1).to.equal(0)
    expect(b2).to.equal(0)
    expect(b3).to.equal(0)

    // on day 6 collect the 2nd note early
    let tx = await reserve.connect(alice).collect({ id: 2, principalTo: alice.address, interestTo: alice.address })
    let { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    let [i2, p2] = await reserve.calculateValue(note2.rate, note2.amount, note2.duration, timestamp - note2.createdAt)

    b1 = await cash.balanceOf(alice.address)
    expect(b1).to.equal(note2.amount.add(i2).sub(p2))
    expect(p2).to.be.greaterThan(0)

    // on day 9 collect the 1st note on time
    await increaseHardhatTime(DAY_DURATION * 3)
    tx = await reserve.connect(alice).collect({ id: 1, principalTo: bob.address, interestTo: bob.address });
    ({ timestamp } = await ethers.provider.getBlock(tx.blockHash))

    let [i1, p1] = await reserve.calculateValue(note1.rate, note1.amount, note1.duration, timestamp - note1.createdAt)
    let c1 = await reserve.getReward(1)

    expect(i1).to.be.greaterThan(0)
    expect(c1).to.be.greaterThan(0)
    expect(p1).to.equal(0)

    b2 = await cash.balanceOf(bob.address)
    expect(b2).to.equal(i1.mul(bonus).div(10000).add(note1.amount).add(c1))

    // on day 15 collect the 3rd note on late
    await increaseHardhatTime(DAY_DURATION)
    await increaseHardhatTime(DAY_DURATION)
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).capture(3)
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).capture(3)
    await increaseHardhatTime(DAY_DURATION)

    tx = await reserve.connect(alice).collect({ id: 3, principalTo: sue.address, interestTo: sue.address });
    ({ timestamp } = await ethers.provider.getBlock(tx.blockHash))

    let [i3, p3] = await reserve.calculateValue(note3.rate, note3.amount, note3.duration, timestamp - note3.createdAt)
    let c3 = await reserve.getReward(3)

    expect(c3).to.equal(0)
    expect(i3).to.be.greaterThan(0)
    expect(p3).to.be.greaterThan(0)

    b3 = await cash.balanceOf(sue.address)
    expect(b3).to.equal(i3.add(note3.amount).sub(p3))

    // collect the 4th note very late
    await reserve.connect(bob).capture(4)
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).capture(4)
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).capture(4)
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).capture(4)
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).capture(4)
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).capture(4)
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).capture(4)
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).capture(4)
    await increaseHardhatTime(DAY_DURATION)

    tx = await reserve.connect(alice).collect({ id: 4, principalTo: origin.address, interestTo: origin.address });
    ({ timestamp } = await ethers.provider.getBlock(tx.blockHash))

    let [i4, p4] = await reserve.calculateValue(note4.rate, note4.amount, note4.duration, timestamp - note4.createdAt)

    expect(i4).to.equal(0)
    expect(p4).to.equal(note4.amount)

    let b5 = await cash.balanceOf(origin.address)
    expect(b5).to.equal(0)
  })

  it('Rollover functions works', async () => {
    const a1 = parseEther('1')
    const params = randomArt()
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 8
    }, { value: a1 })

    await increaseHardhatTime(DAY_DURATION * 9)

    await reserve.connect(alice).rollover({
      id: 1,
      noteTo: alice.address,
      interestTo: ethers.constants.AddressZero,
      payee: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      delegate: bob.address,
    })

    const note2 = await reserve.getNote(2)
    expect(note2.delegate).to.equal(bob.address)
  })

  it('Rollover accounting on time', async () => {
    const a1 = parseEther('1')
    const params = randomArt()
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 8
    }, { value: a1 })

    await increaseHardhatTime(DAY_DURATION * 8)

    let note1 = await reserve.getNote(1)
    let b1 = await cash.balanceOf(reserve.address)
    expect(b1).to.equal(note1.amount)

    await reserve.connect(alice).rollover({
      target: 0,
      id: 1,
      noteTo: alice.address,
      interestTo: ethers.constants.AddressZero,
      encoder: note1.encoder,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
    })

    note1 = await reserve.getNote(1)
    let note2 = await reserve.getNote(2)

    b1 = await cash.balanceOf(reserve.address)
    expect(b1).to.equal(note2.amount)

    expect(note2.encoder).to.equal(note1.encoder)
    expect(note2.id).to.equal(2)
    expect(note2.art).to.equal(note1.art)
    expect(note2.rate).to.equal(note1.rate)

    let i1 = await reserve.calculateInterest(note1.rate, note1.amount, note1.duration, note1.duration)
    expect(note2.amount).to.equal(note1.amount.add(i1.mul(bonus).div(10000)))
    expect(note2.duration).to.equal(note1.duration)
    expect(note2.delegate).to.equal(note1.delegate)
    expect(note2.payee).to.equal(note1.payee)
    expect(note2.collectedAt).to.equal(0)
    expect(note1.collectedAt).to.greaterThan(0)

    let b2 = await cash.balanceOf(reserve.address)
    expect(b2).to.equal(note2.amount)
  })

  it('Rollover accounting late', async () => {
    const a1 = parseEther('1')
    const params = randomArt()
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 8
    }, { value: a1 })

    await increaseHardhatTime(DAY_DURATION * 12)

    let note1 = await reserve.getNote(1)
    let b1 = await cash.balanceOf(reserve.address)

    expect(b1).to.equal(note1.amount)

    const tx = await reserve.connect(alice).rollover({
      target: 0,
      id: 1,
      noteTo: alice.address,
      interestTo: ethers.constants.AddressZero,
      encoder: note1.encoder,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
    })
    const { timestamp } = await ethers.provider.getBlock(tx.blockHash)

    note1 = await reserve.getNote(1)
    let note2 = await reserve.getNote(2)

    expect(note2.encoder).to.equal(note1.encoder)
    expect(note2.id).to.equal(2)
    expect(note2.art).to.equal(note1.art)
    expect(note2.rate).to.equal(note1.rate)

    let i1 = await reserve.calculateInterest(note1.rate, note1.amount, note1.duration, timestamp - note1.createdAt)
    let p1 = await reserve.calculatePenalty(note1.amount, note1.duration, timestamp - note1.createdAt)

    expect(i1).to.greaterThan(0)
    expect(note2.amount).to.equal(note1.amount.add(i1).sub(p1))
    expect(note2.duration).to.equal(note1.duration)
    expect(note2.delegate).to.equal(note1.delegate)
    expect(note2.payee).to.equal(note1.payee)
    expect(note2.collectedAt).to.equal(0)
    expect(note1.collectedAt).to.greaterThan(0)

    let b2 = await cash.balanceOf(reserve.address)
    expect(b2).to.equal(note2.amount)
  })

  it('Rollover with various configurations and cash still adds up', async () => {
    const a1 = parseEther('1')
    const params = randomArt()

    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: alice.address,
      delegate: alice.address,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 7
    }, { value: a1 })

    await increaseHardhatTime(DAY_DURATION)
    await cash.connect(alice).mint(alice.address, { value: a1 })
    // await cash.connect(alice).approve(reserve.address, ethers.constants.MaxUint256)

    let note1 = await reserve.getNote(1)
    await reserve.connect(alice).stake(1, {
      to: alice.address,
      from: alice.address,
      payee: alice.address,
      delegate: bob.address,
      encoder: canvas.address,
      target: 0,
      amount: a1,
      duration: DAY_DURATION * 7
    })

    let note2 = await reserve.getNote(2)
    expect(note2.rate).to.be.lessThan(note1.rate)

    await increaseHardhatTime(DAY_DURATION)
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 33333,
      amount: a1.mul(10000).sub(a1),
      duration: DAY_DURATION * 7
    })
    await increaseHardhatTime(DAY_DURATION)
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 33333,
      amount: 0,
      duration: DAY_DURATION * 7
    }, { value: a1 })

    let note3 = await reserve.getNote(3)
    let note4 = await reserve.getNote(4)

    await increaseHardhatTime(DAY_DURATION * 4)

    let t0 = await cash.balanceOf(reserve.address)
    let b1 = await cash.balanceOf(alice.address)
    let b2 = await cash.balanceOf(bob.address)
    let b3 = await cash.balanceOf(sue.address)

    expect(b1).to.equal(0)
    expect(b2).to.equal(0)
    expect(b3).to.equal(0)

    // on day 7 rollover the 1st note
    let tx = await reserve.connect(alice).rollover({
      id: 1,
      noteTo: alice.address,
      interestTo: ethers.constants.AddressZero,
      encoder: note1.encoder,
      delegate: note1.delegate,
      payee: note1.payee,
      target: 0,
    })

    let { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    let [i1, p1] = await reserve.calculateValue(note1.rate, note1.amount, note1.duration, timestamp - note1.createdAt)

    let b0 = await cash.balanceOf(reserve.address)
    b1 = await cash.balanceOf(alice.address)
    expect(b1).to.equal(0)
    expect(p1).to.equal(0)
    expect(b0).to.equal(t0.add(i1.mul(bonus).div(10000)))

    await increaseHardhatTime(DAY_DURATION * 4)

    // on day 10 rollover the 2nd note, expect a penalty
    tx = await reserve.connect(alice).rollover({
      id: 2,
      noteTo: alice.address,
      interestTo: ethers.constants.AddressZero,
      encoder: note2.encoder,
      delegate: note2.delegate,
      payee: note2.payee,
      target: 0,
    });

    ({ timestamp } = await ethers.provider.getBlock(tx.blockHash))
    let [i2, p2] = await reserve.calculateValue(note2.rate, note2.amount, note2.duration, timestamp - note2.createdAt)

    t0 = await cash.balanceOf(reserve.address)
    b1 = await cash.balanceOf(alice.address)

    expect(b1).to.equal(0)
    expect(p2).to.greaterThan(0)
    expect(t0).to.equal(b0.add(i2).sub(p2))
  })

  it('Rollover interest goes to correct address', async () => {
    const art = randomArt()
    const a0 = parseEther('1')

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 33333,
      duration: DAY_DURATION * 8
    }, { value: a0 })

    await increaseHardhatTime(DAY_DURATION * 8)

    const n1 = await reserve.getNote(1)

    const tx = await reserve.connect(alice).rollover({
      id: n1.id,
      noteTo: alice.address,
      interestTo: bob.address,
      payee: n1.payee,
      delegate: n1.delegate,
      encoder: n1.encoder,
      target: 0,
    })

    const { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    const i1 = await reserve.calculateInterest(n1.rate, n1.amount, n1.duration, timestamp - n1.createdAt)
    const b1 = await cash.balanceOf(reserve.address)
    const b2 = await cash.balanceOf(bob.address)

    expect(b1).to.equal(a0.mul(10000))
    expect(b2).to.equal(i1.mul(11).div(10))
  })

  it('Rollover acconting works given already released payments', async () => {
    const art = randomArt()
    const a0 = parseEther('1')

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 33333,
      duration: DAY_DURATION * 8
    }, { value: a0 })
    const n1 = await reserve.getNote(1)

    let tx = await reserve.connect(alice).withdraw({
      to: bob.address,
      limit: 0,
      id: 1,
    })

    let { timestamp } = await ethers.provider.getBlock(tx.blockHash)

    const i0 = await reserve.calculateInterest(n1.rate, n1.amount, n1.duration, timestamp - n1.createdAt)
    expect(await cash.balanceOf(bob.address)).to.equal(i0)

    await increaseHardhatTime(DAY_DURATION * 8)

    tx = await reserve.connect(alice).rollover({
      id: n1.id,
      noteTo: alice.address,
      interestTo: ethers.constants.AddressZero,
      payee: n1.payee,
      delegate: n1.delegate,
      encoder: n1.encoder,
      target: 0,
    });

    ({ timestamp } = await ethers.provider.getBlock(tx.blockHash));
    const i1 = await reserve.calculateInterest(n1.rate, n1.amount, n1.duration, timestamp - n1.createdAt)
    const b1 = await cash.balanceOf(reserve.address)
    const b2 = await cash.balanceOf(bob.address)

    expect(b1).to.equal(a0.mul(10000).add(i1.mul(11).div(10).sub(i0)))
    expect(b2).to.equal(i0)
  })

  it('Rollover acconting works given captures', async () => {
    const art = randomArt()
    const a0 = parseEther('1')

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 33333,
      duration: DAY_DURATION * 30
    }, { value: a0 })
    const n1 = await reserve.getNote(1)

    await increaseHardhatTime(DAY_DURATION * 20)

    let tx = await reserve.connect(alice).withdraw({
      to: bob.address,
      limit: 1000,
      id: 1,
    })

    let { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    expect(await cash.balanceOf(bob.address)).to.equal(1000)

    await increaseHardhatTime(DAY_DURATION * 20)
    await reserve.connect(bob).captureMany([1])
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).captureMany([1])
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).captureMany([1])
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).captureMany([1])
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).captureMany([1])
    await increaseHardhatTime(DAY_DURATION)

    tx = await reserve.connect(alice).rollover({
      id: n1.id,
      noteTo: alice.address,
      interestTo: ethers.constants.AddressZero,
      payee: n1.payee,
      delegate: n1.delegate,
      encoder: n1.encoder,
      target: 0,
    });

    const n2 = await reserve.getNote(2);

    ({ timestamp } = await ethers.provider.getBlock(tx.blockHash));
    const i1 = await reserve.calculateInterest(n1.rate, n1.amount, n1.duration, timestamp - n1.createdAt)
    const p1 = await reserve.calculatePenalty(n1.amount, n1.duration, timestamp - n1.createdAt)
    const b1 = await cash.balanceOf(reserve.address)

    expect(p1).to.be.greaterThan(0)
    expect(i1).to.be.greaterThan(0)
    expect(b1).to.equal(n1.amount.sub(p1).sub(1000).add(i1))
    expect(n2.amount).to.equal(b1)
  })

  it('Cash flows correctly for no penalty stake', async () => {
    let params = randomArt()
    let a1 = parseEther('1')

    // alice depoists 1 eth for 8 days
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 8
    }, { value: a1 })

    let c1 = await cash.balanceOf(reserve.address)
    let e1 = await ethers.provider.getBalance(cash.address)

    expect(c1).to.equal(a1.mul(10000))
    expect(e1).to.equal(a1)

    await increaseHardhatTime(DAY_DURATION * 8)

    const tx = await reserve.connect(alice).collect({ id: 1, principalTo: alice.address, interestTo: alice.address})
    const { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    const note = await reserve.getNote(1)
    const interest = await reserve.calculateInterest(note.rate, note.amount, note.duration, timestamp - note.createdAt)

    c1 = await cash.balanceOf(reserve.address)
    let b1 = await cash.balanceOf(alice.address)
    expect(b1).to.equal(a1.mul(10000).add(interest.mul(bonus).div(10000)))
    expect(c1).to.equal(0)
  })

  it('Cash flows correctly for early penalty stake', async () => {
    let params = randomArt()
    let a1 = parseEther('1')

    // alice depoists 1 eth for 8 days
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 8
    }, { value: a1 })

    let c1 = await cash.balanceOf(reserve.address)
    let e1 = await ethers.provider.getBalance(cash.address)

    expect(c1).to.equal(a1.mul(10000))
    expect(e1).to.equal(a1)

    await increaseHardhatTime(DAY_DURATION * 4)

    const tx = await reserve.connect(alice).collect({ id: 1, principalTo: alice.address, interestTo: alice.address})
    const { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    const note = await reserve.getNote(1)
    const interest = await reserve.calculateInterest(note.rate, note.amount, note.duration, timestamp - note.createdAt)
    const penalty = await reserve.calculatePenalty(note.amount, note.duration, timestamp - note.createdAt)

    c1 = await cash.balanceOf(reserve.address)
    let b1 = await cash.balanceOf(alice.address)
    expect(b1).to.equal(a1.mul(10000).add(interest).sub(penalty))
    expect(penalty).to.be.lessThan(a1.mul(10000))
    expect(penalty).to.be.greaterThan(0)
    expect(c1).to.equal(0)
  })

  it('Cash flows correctly for late penalty stake', async () => {
    let params = randomArt()
    let a1 = parseEther('1')

    // alice depoists 1 eth for 8 days
    await canvas.connect(alice).print(params, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
      amount: 0,
      duration: DAY_DURATION * 8
    }, { value: a1 })

    let c1 = await cash.balanceOf(reserve.address)
    let e1 = await ethers.provider.getBalance(cash.address)

    expect(c1).to.equal(a1.mul(10000))
    expect(e1).to.equal(a1)

    await increaseHardhatTime(DAY_DURATION * 12)
    await reserve.connect(bob).capture(1)
    await increaseHardhatTime(DAY_DURATION)
    await reserve.connect(bob).capture(1)

    const tx = await reserve.connect(alice).collect({ id: 1, principalTo: alice.address, interestTo: alice.address})
    const { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    const note = await reserve.getNote(1)
    const interest = await reserve.calculateInterest(note.rate, note.amount, note.duration, timestamp - note.createdAt)
    const penalty = await reserve.calculatePenalty(note.amount, note.duration, timestamp - note.createdAt)

    c1 = await cash.balanceOf(reserve.address)
    let b1 = await cash.balanceOf(alice.address)
    expect(b1).to.equal(a1.mul(10000).add(interest).sub(penalty))
    expect(penalty).to.be.lessThan(a1.mul(10000))
    expect(penalty).to.be.greaterThan(0)
    expect(c1).to.equal(0)
  })

  it('Reward: Longer stakes always pay better', async () => {
    const totalDuration = 21
    const policies = [3, 6, 9]
    let accounts = await ethers.getSigners()

    // lets run it as a full test with the full functions first
    accounts = accounts.slice(0, 3)
    const totalCount = totalDuration

    await Promise.all(
      accounts.map(a => cash.connect(a).approve(reserve.address, ethers.constants.MaxUint256))
    )

    // start by minting
    await Promise.all(
      accounts.map(a => cash.connect(a).mint(a.address, { value: parseEther('1') }))
    )

    let totalNotes = 0;

    type Note = {
      id: BigNumber
      amount: BigNumber
      createdAt: BigNumber
      duration: BigNumber
    }

    let states: Record<string, {
      address: string
      notes: Note[]
      policy: number,
      value: BigNumber
    }> = {}

    const step = totalDuration / totalCount;

    for (let i = 0; i <= totalDuration; i += step) {
      const blockNum = await ethers.provider.getBlockNumber()
      let { timestamp } = await ethers.provider.getBlock(blockNum)

      for (let j = 0; j < accounts.length; j += 1) {

        const account = accounts[j]
        const policy = policies[j]

        if (states[account.address] == null) {
          states[account.address] = {
            address: account.address,
            notes: [],
            policy,
            value: BigNumber.from(0)
          }
        }

        let ns = [...states[account.address].notes]
        for (let n of ns) {
          if (n.createdAt.add(n.duration).lte(timestamp)) {
            const tx = await reserve.connect(account).collect({
              id: n.id,
              principalTo: account.address,
              interestTo: account.address
            })
            await tx.wait()
            states[account.address].notes = states[account.address].notes.filter(n1 => n1.id !== n.id)
          } else if (Math.random() < 0.1) {
            const tx = await reserve.connect(account).withdraw(({ id: n.id, to: account.address, limit: 0 }))
            await tx.wait()
          }
        }

        const balance = await cash.balanceOf(account.address)

        if (parseBigNumber(balance) > 1) {
          let params = randomArt()

          const tx = await canvas.connect(account).print(params, {
            to: account.address,
            from: account.address,
            payee: ethers.constants.AddressZero,
            delegate: ethers.constants.AddressZero,
            encoder: canvas.address,
            target: 0,
            amount: balance,
            duration: Math.floor(DAY_DURATION * policy)
          })
          await tx.wait()

          totalNotes += 1
          let note = await reserve.getNote(totalNotes)
          states[account.address].notes.push(note)
        }

        const value = states[account.address].notes.reduce((acc, cur) => {
          return acc.add(cur.amount)
        }, BigNumber.from(0))

        const b1 = await cash.balanceOf(account.address)

        states[account.address].value = value.add(b1)
      }

      // console.log('DAY', i, rate / 100)
      await ethers.provider.send('evm_mine', [Math.floor(timestamp + step * DAY_DURATION)])
    }

    const sorted = Object.values(states).sort((a, b) => {
      return parseBigNumber(a.value.sub(b.value))
    }).map(a => ({
      address: a.address,
      policy: a.policy,
      value: parseBigNumber(a.value)
    }))

    const ps = sorted.map(s => s.policy)
    expect(JSON.stringify(ps)).to.equal(JSON.stringify(policies))
  })

  it('Reward: Interest rate returns the same values as javascript always', async () => {
    for (let r = 333; r <= 33333; r += 10000) {
      for (let d = 1; d <= 5550; d += 550) {
        for (let t = 1; t <= 5550; t += 365) {

          const amount = 100000000

          const js = calculateInterest(
            r,
            amount,
            d * DAY_DURATION,
            t * DAY_DURATION
          )

          const sol = parseBigNumber(
            await reserve.calculateInterest(
              r,
              parseEther(`${amount}`),
              d * DAY_DURATION,
              t * DAY_DURATION
            )
          )

          expect(js).to.approximately(sol, 0.00001)
        }
      }
    }
  })


  it('Reserve has read functions', async () => {
    const cash = await reserve.cash()
    const config = await reserve.config()
    expect(cash).to.be.a('string')
    expect(config.reserve).to.be.a('string')
    expect(config.name).to.be.a('string')
    expect(config.symbol).to.be.a('string')
    expect(config.bonus).to.be.a('number')
    expect(config.commission).to.be.a('number')
  })

  it('Reserve has write functions', async () => {
    const config1 = await reserve.config()
    const paused1 = await reserve.paused()

    expect(paused1).to.equal(false)
    await reserve.connect(origin).configure({
      name: 'Test',
      symbol: 'TEST',
      commission: 100,
      bonus: 10100,
      maxDuration: 5550 * DAY_DURATION,
      maxCollection: 333 * DAY_DURATION,
      minCollection: 3 * DAY_DURATION,
      timeDilation: 3,
      reserve: bob.address
    })

    await expect(
      reserve.connect(bob).configure({
        name: 'Test',
        symbol: 'TEST',
        commission: 101,
        bonus: 10101,
        maxDuration: 5550 * DAY_DURATION,
        maxCollection: 333 * DAY_DURATION,
        minCollection: 3 * DAY_DURATION,
        timeDilation: 3,
        reserve: bob.address
      })
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    await expect(
      reserve.connect(bob).pause()
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    await reserve.connect(origin).pause()

    const config2 = await reserve.config()
    const paused2 = await reserve.paused()

    expect(paused2).to.equal(true)
    expect(config1.reserve).to.not.equal(config2.reserve)
    expect(config1.name).to.not.equal(config2.name)
    expect(config1.symbol).to.not.equal(config2.symbol)
    expect(config1.commission).to.not.equal(config2.commission)
    expect(config1.bonus).to.not.equal(config2.bonus)

    await expect(
      reserve.connect(bob).unpause()
    ).to.eventually.rejectedWith(vmException('Ownable: caller is not the owner'))

    await reserve.connect(origin).unpause()
    const paused3 = await reserve.paused()
    expect(paused3).to.equal(false)
  })

  it('Reserve maximum length stakes pay correctly', async () => {
    const a0 = parseEther('1')
    const art = randomArt()

    await expect(
      canvas.connect(alice).print(art, {
        to: alice.address,
        from: alice.address,
        payee: ethers.constants.AddressZero,
        delegate: ethers.constants.AddressZero,
        amount: 0,
        encoder: canvas.address,
        target: 0,
        duration: DAY_DURATION * 5550 + 1
      }, { value: a0 })
    ).to.eventually.rejectedWith(vmException('Reserve: duration is too long'))

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 5550
    }, { value: a0 })

    let n1 = await reserve.getNote(1)

    await increaseHardhatTime(DAY_DURATION * 5550)

    await reserve.connect(alice).collect({
      id: 1,
      interestTo: alice.address,
      principalTo: alice.address,
    })

    let b1 = await cash.balanceOf(alice.address)
    expect(b1.gt(n1.amount)).to.eq(true)
  })

  it('Reserve minimum length stakes pay correctly', async () => {
    const a0 = parseEther('1')
    const art = randomArt()

    let tx = await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: 0
    }, { value: a0 })
    await tx.wait()

    tx = await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: 1
    }, { value: a0 })
    await tx.wait()

    tx = await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: 0
    })
    await tx.wait()

    tx = await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: 1
    })
    await tx.wait()

    let n1 = await reserve.getNote(1)
    let n2 = await reserve.getNote(2)
    let n3 = await reserve.getNote(3)
    let n4 = await reserve.getNote(4)

    await increaseHardhatTime(DAY_DURATION)

    await reserve.connect(alice).collect({
      id: 1,
      interestTo: origin.address,
      principalTo: origin.address,
    })

    await reserve.connect(alice).collect({
      id: 2,
      interestTo: alice.address,
      principalTo: alice.address,
    })

    await reserve.connect(alice).collect({
      id: 3,
      interestTo: bob.address,
      principalTo: bob.address,
    })

    await reserve.connect(alice).collect({
      id: 4,
      interestTo: sue.address,
      principalTo: sue.address,
    })

    let b1 = await cash.balanceOf(origin.address)
    let b2 = await cash.balanceOf(alice.address)
    let b3 = await cash.balanceOf(bob.address)
    let b4 = await cash.balanceOf(sue.address)

    expect(b1).to.equal(a0.mul(10000))
    expect(b2.gt(n2.amount)).to.eq(true)
    expect(b3).to.equal(0)
    expect(b4).to.equal(0)
  })

  it('Reserve can withdraw stakes with security', async () => {
    const a0 = parseEther('1')
    const art = randomArt()

    // only the owner or delegate can withdraw stakes
    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: bob.address,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 8
    }, { value: a0 })

    await increaseHardhatTime(DAY_DURATION)
    let b1 = await cash.balanceOf(alice.address)
    await reserve.connect(alice).withdraw({ id: 1, to: alice.address, limit: 0 })
    let b2 = await cash.balanceOf(alice.address)
    expect(b2).to.be.greaterThan(b1)

    let r1 = await reserve.getReleased(1)
    expect(r1).to.equal(b2)

    await increaseHardhatTime(DAY_DURATION)
    b1 = await cash.balanceOf(bob.address)
    await reserve.connect(bob).withdraw({ id: 1, to: bob.address, limit: 0 })
    b2 = await cash.balanceOf(bob.address)
    expect(b2).to.be.greaterThan(b1)

    await increaseHardhatTime(DAY_DURATION)
    b1 = await cash.balanceOf(bob.address)
    await reserve.connect(bob).withdraw(({ id: 1, to: bob.address, limit: 1000 }))
    b2 = await cash.balanceOf(bob.address)
    expect(b2.sub(b1)).to.be.equal(1000)

    r1 = await reserve.getReleased(1)
    let b3 = await cash.balanceOf(alice.address)
    expect(r1).to.equal(b1.add(1000).add(b3))

    await expect(
      reserve.connect(sue).withdraw({ id: 1, to: alice.address, limit: 0 })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))
  })

  it('Reserve can withdraw commission with security', async () => {
    const a0 = parseEther('1')
    const art = randomArt()

    // only the owner or delegate can withdraw stakes
    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: 0
    })

    await reserve.connect(bob).stake(1, {
      to: bob.address,
      from: bob.address,
      payee: ethers.constants.AddressZero,
      delegate: bob.address,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 8
    }, { value: a0 })

    await increaseHardhatTime(DAY_DURATION * 4)
    await reserve.connect(bob).withdraw(({ id: 2, to: bob.address, limit: 10000 }))

    expect(await cash.balanceOf(bob.address)).to.equal(10000)
    expect(await reserve.getReleased(2)).to.equal(10000)
    expect(await reserve.getReward(2)).to.equal(0)
    expect(await reserve.getReward(1)).to.equal(1200)
    expect(await reserve.getReleased(1)).to.equal(0)

    await reserve.connect(alice).withdraw(({ id: 1, to: alice.address, limit: 10000 }))
    expect(await cash.balanceOf(alice.address)).to.equal(1200)
    expect(await reserve.getReward(1)).to.equal(1200)
    expect(await reserve.getReleased(1)).to.equal(1200)

    await reserve.connect(alice).withdraw(({ id: 1, to: alice.address, limit: 10000 }))
    expect(await cash.balanceOf(alice.address)).to.equal(1200)
  })

  it('Reserve can collect stakes with security', async () => {
    const a0 = parseEther('1')
    const art = randomArt()

    // only the owner can collect stakes early
    // anyone can collect stakes after expiration to the payee (if set)
    // the owner or delegate can collect stakes early or late
    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 8
    }, { value: a0 })

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: bob.address,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 8
    }, { value: a0 })

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: alice.address,
      delegate: bob.address,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 8
    }, { value: a0 })

    await increaseHardhatTime(DAY_DURATION * 4)

    await expect(
      reserve.connect(bob).collect({ id: 1, interestTo: alice.address, principalTo: alice.address })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))

    await expect(
      reserve.connect(bob).collect({ id: 2, interestTo: alice.address, principalTo: alice.address })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))

    await expect(
      reserve.connect(bob).collect({ id: 3, interestTo: alice.address, principalTo: alice.address })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))

    // alice can collect note 1 early.
    await reserve.connect(alice).collect({ id: 1, interestTo: alice.address, principalTo: alice.address })

    await increaseHardhatTime(DAY_DURATION * 4)

    // bob can collect note 2 to himself.
    await reserve.connect(bob).collect({ id: 2, interestTo: bob.address, principalTo: bob.address })

    // sue can collect note 3 but only to alice.
    await expect(
      reserve.connect(sue).collect({ id: 3, interestTo: sue.address, principalTo: sue.address })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))
    await reserve.connect(sue).collect({ id: 3, interestTo: alice.address, principalTo: alice.address })
  })

  it('Reserve rolls over stakes correctly', async () => {
    const a0 = parseEther('1')
    const art = randomArt()

    // only the owner or delegate can rollover stakes
    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 8
    }, { value: a0 })

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: bob.address,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION * 8
    }, { value: a0 })

    await increaseHardhatTime(DAY_DURATION * 4)
    await expect(
      reserve.connect(alice).rollover({
        id: 1,
        target: 0,
        noteTo: alice.address,
        interestTo: ethers.constants.AddressZero,
        payee: ethers.constants.AddressZero,
        delegate: ethers.constants.AddressZero,
        encoder: canvas.address,
      })
    ).to.eventually.rejectedWith(vmException('Reserve: note is not ready for rollover'))

    const n1 = await reserve.getNote(1)
    await increaseHardhatTime(DAY_DURATION * 4)
    const tx = await reserve.connect(alice).rollover({
      id: 1,
      target: 0,
      noteTo: alice.address,
      interestTo: ethers.constants.AddressZero,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
    })
    await tx.wait()
    const { timestamp } = await ethers.provider.getBlock(tx.blockHash)

    let i1 = await reserve.calculateValue(
      n1.rate, n1.amount, n1.duration, timestamp - n1.createdAt
    )

    let balance1 = a0.mul(20000).add(i1.interest.mul(11).div(10))
    expect(await cash.balanceOf(reserve.address)).to.equal(balance1)

    await expect(
      reserve.connect(sue).rollover({
        id: 2,
        target: 0,
        noteTo: alice.address,
        interestTo: ethers.constants.AddressZero,
        payee: ethers.constants.AddressZero,
        delegate: ethers.constants.AddressZero,
        encoder: canvas.address,
      })
    ).to.eventually.rejectedWith(vmException('Reserve: caller does not have permission'))

    const n2 = await reserve.getNote(2)
    await increaseHardhatTime(DAY_DURATION * 4)
    const tx2 = await reserve.connect(bob).rollover({
      id: 2,
      target: 0,
      noteTo: alice.address,
      interestTo: ethers.constants.AddressZero,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
    })
    await tx2.wait()
    const { timestamp: timestamp2 } = await ethers.provider.getBlock(tx2.blockHash)

    let i2 = await reserve.calculateValue(
      n2.rate, n2.amount, n2.duration, timestamp2 - n2.createdAt
    )

    expect(i2.interest).to.be.greaterThan(0)
    expect(i2.penalty).to.be.greaterThan(0)
    expect(i2.penalty).to.be.greaterThan(i2.interest)
    expect(await cash.balanceOf(reserve.address)).to.equal(balance1.add(i2.interest).sub(i2.penalty))
  })

  it('Reserve captures stakes correctly', async () => {
    const a0 = parseEther('1')
    const art = randomArt()

    // create stakes lasting 1 through 15 years then
    // every month capture them if they are overdue
    // the reserve balance should deflate to zero

    let timestamp: number = 0;

    for (let i = 1; i <= 15; i += 1) {
      const tx = await canvas.connect(alice).print(art, {
        to: alice.address,
        from: alice.address,
        payee: ethers.constants.AddressZero,
        delegate: ethers.constants.AddressZero,
        amount: 0,
        encoder: canvas.address,
        target: 0,
        duration: DAY_DURATION * 370 * i
      }, { value: a0 })
      await tx.wait();
      ({ timestamp } = await ethers.provider.getBlock(tx.blockHash));
    }

    const ids = Array.from({ length: 15 }).fill(0).map((_, i) => i + 1)
    const notes = await Promise.all(
      ids.map(async i => await reserve.getNote(i))
    )

    let step = 300

    for (let i = 1; i <= 10000; i += step) {
      await increaseHardhatTime(DAY_DURATION * step)
      timestamp += (DAY_DURATION * step)

      const penalties = await Promise.all(
        notes.map(async n => {
          const time = timestamp - n.createdAt

          if (time <= n.duration) return BigNumber.from(0)

          const p = await reserve.calculatePenalty(
            n.amount,
            n.duration,
            time,
          )

          const c = await reserve.getCaptured(n.id)

          return p.sub(c)
        })
      )


      const capture = penalties.reduce((acc, cur, idx) => {
        if (cur.gt(0)) acc.push(idx + 1)
        return acc
      }, [])

      if (capture.length > 0) {
        let b1 = await cash.balanceOf(reserve.address)
        const tx2 = await reserve.connect(bob).captureMany(capture)
        await tx2.wait()
        let b2 = await cash.balanceOf(reserve.address)
        expect(b2).to.be.lessThan(b1)
      }
    }

    expect(await cash.balanceOf(reserve.address)).to.equal(0)
  })

  it('Interest rate target works correctly', async () => {
    const a0 = parseEther('1')
    const art = randomArt()

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 33333,
      duration: DAY_DURATION * 8
    }, { value: a0 })

    await cash.connect(alice).mint(alice.address, { value: a0 })

    await expect(
      canvas.connect(alice).print(art, {
        to: alice.address,
        from: alice.address,
        payee: ethers.constants.AddressZero,
        delegate: ethers.constants.AddressZero,
        amount: 0,
        encoder: canvas.address,
        target: 33333,
        duration: DAY_DURATION * 8
      }, { value: a0 })
    ).to.rejectedWith(vmException('Reserve: interest rate was below the goal'))
  })

  it('Rollover interest goes to the reserve', async () => {
    const art = randomArt()
    const a0 = parseEther('1')

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 33333,
      duration: DAY_DURATION * 365
    }, { value: a0 })

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 33333,
      duration: DAY_DURATION * 365
    }, { value: a0 })

    await increaseHardhatTime(DAY_DURATION * 365)

    let n1 = await reserve.getNote(1)
    let n2 = await reserve.getNote(2)

    let tx = await reserve.connect(alice).rollover({
      id: 1,
      noteTo: alice.address,
      interestTo: ethers.constants.AddressZero,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
    })

    let { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    let i1 = await reserve.calculateInterest(n1.rate, n1.amount, n1.duration, timestamp - n1.createdAt)
    let p1 = await reserve.calculatePenalty(n1.amount, n1.duration, timestamp - n1.createdAt)

    expect(p1).to.be.equal(0)
    expect(i1).to.be.greaterThan(0)
    expect(await cash.balanceOf(reserve.address)).to.equal(a0.mul(20000).add(i1.mul(11).div(10)))

    await increaseHardhatTime(DAY_DURATION * 160)

    tx = await reserve.connect(alice).rollover({
      id: 2,
      noteTo: alice.address,
      interestTo: ethers.constants.AddressZero,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
    });

    ({ timestamp } = await ethers.provider.getBlock(tx.blockHash))

    let i2 = await reserve.calculateInterest(n2.rate, n2.amount, n2.duration, timestamp - n2.createdAt)
    let p2 = await reserve.calculatePenalty(n2.amount, n2.duration, timestamp - n2.createdAt)

    expect(i2).to.be.greaterThan(0)
    expect(p2).to.be.greaterThan(0)
    expect(await cash.balanceOf(reserve.address)).to.equal(a0.mul(20000).add(i1.mul(11).div(10)).sub(p2).add(i2))
  })

  it('Rollover interest goes to correct address', async () => {
    const art = randomArt()
    const a0 = parseEther('1')

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 33333,
      duration: DAY_DURATION * 365
    }, { value: a0 })

    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      amount: 0,
      encoder: canvas.address,
      target: 33333,
      duration: DAY_DURATION * 365
    }, { value: a0 })

    await increaseHardhatTime(DAY_DURATION * 365)

    let n1 = await reserve.getNote(1)
    let n2 = await reserve.getNote(2)

    let tx = await reserve.connect(alice).rollover({
      id: 1,
      noteTo: alice.address,
      interestTo: bob.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
    })

    let { timestamp } = await ethers.provider.getBlock(tx.blockHash)
    let i1 = await reserve.calculateInterest(n1.rate, n1.amount, n1.duration, timestamp - n1.createdAt)
    let p1 = await reserve.calculatePenalty(n1.amount, n1.duration, timestamp - n1.createdAt)

    expect(p1).to.be.equal(0)
    expect(i1).to.be.greaterThan(0)
    expect(await cash.balanceOf(bob.address)).to.equal(i1.mul(11).div(10))
    expect(await cash.balanceOf(reserve.address)).to.equal(a0.mul(20000))

    await increaseHardhatTime(DAY_DURATION * 190)

    tx = await reserve.connect(alice).rollover({
      id: 2,
      noteTo: alice.address,
      interestTo: bob.address,
      payee: ethers.constants.AddressZero,
      delegate: ethers.constants.AddressZero,
      encoder: canvas.address,
      target: 0,
    });

    ({ timestamp } = await ethers.provider.getBlock(tx.blockHash));
    let i2 = await reserve.calculateInterest(n2.rate, n2.amount, n2.duration, timestamp - n2.createdAt)
    let p2 = await reserve.calculatePenalty(n2.amount, n2.duration, timestamp - n2.createdAt)

    expect(p2).to.be.greaterThan(0)
    expect(i2).to.be.greaterThan(0)
    expect(p2).to.be.greaterThan(i2)
    expect(await cash.balanceOf(bob.address)).to.equal(i1.mul(11).div(10))
    expect(await cash.balanceOf(reserve.address)).to.equal(a0.mul(20000).sub(p2.sub(i2)))
  })

  it('Transfer resets payee and delegate', async () => {
    const art = randomArt()
    await canvas.connect(alice).print(art, {
      to: alice.address,
      from: alice.address,
      payee: bob.address,
      delegate: bob.address,
      amount: 0,
      encoder: canvas.address,
      target: 0,
      duration: DAY_DURATION
    })

    let note = JSON.parse(await reserve.tokenData(1))
    expect(note.payee).to.equal(bob.address.toLowerCase())
    expect(note.delegate).to.equal(bob.address.toLowerCase())

    await reserve.connect(alice).transferFrom(alice.address, bob.address, 1)

    note = JSON.parse(await reserve.tokenData(1))
    expect(note.payee).to.equal(null)
    expect(note.delegate).to.equal(null)

    note = await reserve.getNote(1)
    expect(note.payee).to.equal(ethers.constants.AddressZero)
    expect(note.delegate).to.equal(ethers.constants.AddressZero)
  })
})
