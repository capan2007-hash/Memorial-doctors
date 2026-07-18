import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhotoGrid } from '../PhotoGrid'

describe('PhotoGrid', () => {
  it('urls boşsa ve emptyText verilmişse metni gösterir', () => {
    render(<PhotoGrid urls={[]} emptyText="Fotoğraf yok" />)
    expect(screen.getByText('Fotoğraf yok')).toBeTruthy()
  })

  it('urls boşsa ve emptyText verilmemişse hiçbir şey render etmez', () => {
    const { container } = render(<PhotoGrid urls={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('her url için bir görsel butonu render eder', () => {
    render(<PhotoGrid urls={['a.jpg', 'b.jpg']} title="Yara fotoğrafı" />)
    const imgs = screen.getAllByAltText('Yara fotoğrafı')
    expect(imgs.length).toBe(2)
  })

  it('title verilmemişse alt="Fotoğraf" olur', () => {
    render(<PhotoGrid urls={['a.jpg']} />)
    expect(screen.getByAltText('Fotoğraf')).toBeTruthy()
  })

  it('bir fotoğrafa tıklayınca lightbox açılır', () => {
    render(<PhotoGrid urls={['a.jpg', 'b.jpg']} title="Foto" />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    const lightboxImgs = screen.getAllByAltText('Foto')
    // grid'deki img + lightbox'taki img
    expect(lightboxImgs.length).toBe(3)
  })

  it('ESC tuşuna basınca lightbox kapanır', () => {
    render(<PhotoGrid urls={['a.jpg']} title="Foto" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getAllByAltText('Foto').length).toBe(2)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getAllByAltText('Foto').length).toBe(1)
  })
})
