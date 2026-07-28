import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConsentShare } from '../ConsentShare'

const show = vi.fn()
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => ({ show }) }))

describe('ConsentShare', () => {
  beforeEach(() => {
    show.mockClear()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('kopyalanan metin seçilen dilin ?lang= linkini içerir', async () => {
    render(<ConsentShare value="ar" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /copy|kopyala|نسخ/i }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]
    expect(copied).toContain('/aydinlatma?lang=ar')
    expect(copied).not.toContain('{{link}}')
  })

  it('kopyalama sonrası onay toast gösterir', async () => {
    render(<ConsentShare value="tr" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /copy|kopyala/i }))
    await waitFor(() => expect(show).toHaveBeenCalled())
  })
})
