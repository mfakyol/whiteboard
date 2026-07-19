// Read an image File, downscale it to a max dimension, and return a PNG data URL
// plus its final size. Pure/framework-free so it's easy to reuse and test.
const MAX_DIMENSION = 900

export function fileToShapeImage(
  file: File,
): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
        width = Math.round(width * scale)
        height = Math.round(height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve({ src: canvas.toDataURL('image/png'), width, height })
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
