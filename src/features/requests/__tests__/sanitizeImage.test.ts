import { describe, it, expect, vi, afterEach } from 'vitest'
import { safeExt, sanitizeImage, buildPhotoPath } from '../sanitizeImage'

function makeFile(type: string, name = 'photo.bin'): File {
  return new File(['x'], name, { type })
}

describe('safeExt', () => {
  it('image/jpeg -> jpg', () => {
    expect(safeExt(makeFile('image/jpeg'))).toBe('jpg')
  })
  it('image/png -> png', () => {
    expect(safeExt(makeFile('image/png'))).toBe('png')
  })
  it('image/webp -> webp', () => {
    expect(safeExt(makeFile('image/webp'))).toBe('webp')
  })
  it('bilinmeyen tür -> jpg', () => {
    expect(safeExt(makeFile('application/octet-stream'))).toBe('jpg')
  })
})

describe('sanitizeImage hata yolu', () => {
  const originalCreateImageBitmap = (globalThis as any).createImageBitmap

  afterEach(() => {
    if (originalCreateImageBitmap === undefined) {
      delete (globalThis as any).createImageBitmap
    } else {
      (globalThis as any).createImageBitmap = originalCreateImageBitmap
    }
    vi.restoreAllMocks()
  })

  it('createImageBitmap desteklenmiyorsa/hata verirse orijinal dosyayı döner', async () => {
    ;(globalThis as any).createImageBitmap = vi.fn(() => {
      throw new Error('desteklenmiyor')
    })
    const file = makeFile('image/jpeg')
    const result = await sanitizeImage(file)
    expect(result).toBe(file)
  })

  it('canvas.toBlob null dönerse orijinal dosyayı döner', async () => {
    ;(globalThis as any).createImageBitmap = vi.fn(async () => ({
      width: 10,
      height: 10,
      close: vi.fn(),
    }))
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (cb: (b: Blob | null) => void) => cb(null),
        } as unknown as HTMLCanvasElement
      }
      return document.createElement(tag)
    })

    const file = makeFile('image/jpeg')
    const result = await sanitizeImage(file)
    expect(result).toBe(file)
  })
})

describe('buildPhotoPath', () => {
  it('orijinal dosya adını içermez ve doğru uzantıyla biter', () => {
    const file = makeFile('image/png', 'gizli-hasta-adi-soyadi.png')
    const path = buildPhotoPath('tenant-1', 'req-1', file)

    expect(path).toMatch(/^tenant-1\/req-1\/[0-9a-f-]+\.png$/)
    expect(path).not.toContain('gizli-hasta-adi-soyadi')
    expect(path.endsWith('.png')).toBe(true)
  })

  it('bilinmeyen mime için jpg uzantısı üretir', () => {
    const file = makeFile('application/octet-stream', 'x-ray-export.dat')
    const path = buildPhotoPath('t', 'r', file)
    expect(path.endsWith('.jpg')).toBe(true)
    expect(path).not.toContain('x-ray-export')
  })
})
