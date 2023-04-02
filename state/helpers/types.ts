export const BLACK: Color = {
  r: 0, g: 0, b: 0
}

export const WHITE: Color = {
  r: 255, g: 255, b: 255
}

export interface Rotation {
  angle: number
  x: number
  y: number
}

export interface Color {
  r: number
  g: number
  b: number
  a?: number
}

export interface Stroke extends Color {
  thickness: number
}

export interface Ellipse {
  id?: string
  cx: number
  cy: number
  rx: number
  ry: number
  fill?: Color
  stroke?: Stroke
  rotation?: Rotation
}

export interface Line {
  id?: string
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: Stroke
}

export interface Rectangle {
  id?: string
  x: number
  y: number
  w: number
  h: number
  fill?: Color
  stroke?: Stroke
  rotation?: Rotation
}

export type Shape = Ellipse | Rectangle | Line

export interface NoteParams {
  from?: string
  to?: string
  amount?: number
  duration?: number
  payee?: string
  delegate?: string
  art?: number
  value?: number
  target?: number
}

export interface ArtParams extends NoteParams {
  mode?: 'vector' | 'raster'
  title?: string | undefined
  credit?: string | undefined
  script?: string | undefined
  webUrl?: string | undefined
  dataUrl?: string | undefined
  mediaUrl?: string | undefined
  imageUrl?: string | undefined
  shapes: Shape[]
}
