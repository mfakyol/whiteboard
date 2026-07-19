// Short, collision-resistant client id for shapes and guest identities.
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
