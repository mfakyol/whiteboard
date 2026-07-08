import { Schema, model, type InferSchemaType } from 'mongoose'

// A shape is a free-form object drawn on the board. We keep it schemaless so
// the drawing tools on the client can evolve without server migrations; the
// only contract is a stable string `id` used to update/delete it.
export interface Shape {
  id: string
  type: string
  [key: string]: unknown
}

// Schema is left untyped (Mixed shapes) and the document type is inferred.
const boardSchema = new Schema(
  {
    _id: { type: String, required: true },
    shapes: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
)

export type BoardDoc = InferSchemaType<typeof boardSchema>

export const Board = model('Board', boardSchema)
