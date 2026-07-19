import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Field } from '../Field'
import { Button } from '../Button'
import { StatusPill } from '../StatusPill'
import { Avatar } from '../Avatar'
import type { RequestStatus } from '../../../types/domain'

describe('Field', () => {
  it('associates label with input via implicit wrapping (getByLabelText)', () => {
    render(
      <Field label="Yaş">
        <input />
      </Field>,
    )
    expect(screen.getByLabelText('Yaş').tagName).toBe('INPUT')
  })

  it('shows error message in red when error is provided', () => {
    render(
      <Field label="Yaş" error="Zorunlu alan">
        <input />
      </Field>,
    )
    const error = screen.getByText('Zorunlu alan')
    expect(error.className).toContain('text-danger-text')
  })

  it('shows hint when no error is provided', () => {
    render(
      <Field label="Yaş" hint="Yıl cinsinden">
        <input />
      </Field>,
    )
    expect(screen.getByText('Yıl cinsinden')).toBeTruthy()
  })
})

describe('Button', () => {
  it('is disabled and shows a spinner when loading', () => {
    render(<Button loading>Kaydet</Button>)
    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByTestId('spinner')).toBeTruthy()
  })

  it('is not disabled by default', () => {
    render(<Button>Kaydet</Button>)
    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.disabled).toBe(false)
  })
})

describe('StatusPill', () => {
  it('renders Turkish label for offers_ready', () => {
    render(<StatusPill status="offers_ready" />)
    expect(screen.getByText('Teklif hazır')).toBeTruthy()
  })

  it('renders Turkish label for escalated', () => {
    render(<StatusPill status="escalated" />)
    expect(screen.getByText('Eskalasyon')).toBeTruthy()
  })

  it('renders Turkish label for every known status', () => {
    const cases: Array<[RequestStatus, string]> = [
      ['draft', 'Taslak'],
      ['submitted', 'Gönderildi'],
      ['assigned', 'Atandı'],
      ['in_review', 'Yanıtlanıyor'],
      ['closed', 'Kapandı'],
    ]
    for (const [status, label] of cases) {
      const { unmount } = render(<StatusPill status={status} />)
      expect(screen.getByText(label)).toBeTruthy()
      unmount()
    }
  })
})

describe('Avatar', () => {
  it('renders initials from the first two words when no src is given', () => {
    render(<Avatar name="Op. Dr. Plastik" />)
    expect(screen.getByText('OD')).toBeTruthy()
  })

  it('renders an image when src is given', () => {
    render(<Avatar name="Test Kullanıcı" src="https://example.com/a.png" />)
    const img = screen.getByAltText('Test Kullanıcı')
    expect(img.tagName).toBe('IMG')
  })
})
