export type Tool =
  | 'select'
  | 'hand'
  | 'pen'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'text'
  | 'sticky'

export type ShapeType = Exclude<Tool, 'select' | 'hand'> | 'image'

export interface Shape {
  id: string
  type: ShapeType
  stroke: string
  strokeWidth: number
  // pen / arrow
  points?: number[]
  // rect / ellipse / sticky / text / image
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  // text / sticky
  text?: string
  fill?: string
  fontSize?: number
  // image
  src?: string
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

// Discriminated result returned by every service call, so callers handle
// errors explicitly and type-safely instead of catching thrown exceptions.
export type Result<T> = { success: true; data: T } | { success: false; error: string }
