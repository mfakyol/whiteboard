export type Tool =
  | 'select'
  | 'hand'
  | 'pen'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'text'
  | 'sticky'

export interface Shape {
  id: string
  type: Exclude<Tool, 'select' | 'hand'>
  stroke: string
  strokeWidth: number
  // pen / arrow
  points?: number[]
  // rect / ellipse / sticky / text
  x?: number
  y?: number
  width?: number
  height?: number
  // text / sticky
  text?: string
  fill?: string
  fontSize?: number
}

export interface User {
  id: string
  name: string
  color: string
}

export interface Cursor {
  x: number
  y: number
}
