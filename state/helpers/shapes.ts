import { Color, Ellipse, Line, Rectangle, Rotation, Shape } from './types'

export const hexToColor = (str: string): Color => {
  const bigint = parseInt(str.slice(1), 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return { r, g, b }
}

const hexify2x = (n: number): string => {
  const s = Math.min(511, n).toString(16).padStart(4, '0')
  if (s.length !== 4) throw Error('Invalid string length')
  return s
}

const hexify = (n: number): string => {
  const s = Math.min(255, Math.floor(n)).toString(16).padStart(2, '0')
  if (s.length !== 2) throw Error('Invalid string length')
  return s
}

export const colorToHex = (color: Color): string => {
  return `#${hexify(color.r)}${hexify(color.g)}${hexify(color.b)}`
}

export const encodeShapeCode = (shape: Shape): string => {
  let code = 0

  // 0 ellipse,    fill  no stroke, no rotate
  // 1 ellipse,    fill     stroke, no rotate
  // 2 ellipse,    fill, no stroke,    rotate
  // 3 ellipse,    fill,    stroke,    rotate
  // 4 ellipse, no fill,    stroke, no rotate
  // 5 ellipse, no fill,    stroke,    rotate

  if ('fill' in shape) {
    if ('stroke' in shape) {
      if ('rotation' in shape) {
        code = 3
      } else {
        code = 1
      }
    } else if ('rotation' in shape) {
      code = 2
    } else {
      code = 0
    }
  } else {
    if ('stroke' in shape) {
      if ('rotation' in shape) {
        code = 5
      } else {
        code = 4
      }
    } else {
      throw new Error('Invalid shape')
    }
  }

  if ('cx' in shape && 'cy' in shape) {
    code += 0
  } else if ('x' in shape && 'h' in shape) {
    code += 8
  } else if ('x1' in shape && 'y1' in shape) {
    code += 16
  } else {
    throw new Error('Invalid shape')
  }

  return hexify(code)
}

export const encodeColor = (color: Color): string => {
  return `${hexify(color.r)}${hexify(color.g)}${hexify(color.b)}${hexify(color.a ?? 255)}`
}

export const encodeRotate = (rotation: Rotation): string => {
  return `${hexify2x(rotation.angle)}${hexify(rotation.x)}${hexify(rotation.y)}`
}

export const encodeShape = (s: Shape): string => {
  let c = ''

  if ('cx' in s && 'cy' in s) {
    c = `${hexify(s.cx)}${hexify(s.cy)}${hexify(s.rx)}${hexify(s.ry)}`
  } else if ('x' in s && 'h' in s) {
    c = `${hexify(s.w)}${hexify(s.h)}${hexify(s.x)}${hexify(s.y)}`
  } else if ('x1' in s && 'y1' in s) {
    c = `${hexify(s.x1)}${hexify(s.y1)}${hexify(s.x2)}${hexify(s.y2)}`
  } else {
    throw new Error('Invalid shape')
  }

  if ('fill' in s && s.fill) {
    c += encodeColor(s.fill)
  }

  if ('stroke' in s && s.stroke) {
    c += encodeColor(s.stroke)
    c += hexify(s.stroke.thickness)
  }

  if ('rotation' in s && s.rotation) {
    c += encodeRotate(s.rotation)
  }

  return encodeShapeCode(s) + c
}

export const encodeRectangle = (r: Rectangle): string => {
  return encodeShape(r)
}

export const encodeEllipse = (e: Ellipse): string => {
  return encodeShape(e)
}

export const encodeLine = (l: Line): string => {
  return encodeShape(l)
}

export const encodeSVG = (shapes: Shape[]): string => {
  return '0x' + shapes.map(encodeShape).join('')
}