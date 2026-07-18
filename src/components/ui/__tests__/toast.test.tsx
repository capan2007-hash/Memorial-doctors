import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from '../Toast'

function TestButton({ message, kind }: { message: string; kind?: 'success' | 'error' }) {
  const { show } = useToast()
  return (
    <button onClick={() => show(message, kind)}>Tetikle</button>
  )
}

function NoProvider() {
  useToast()
  return null
}

describe('ToastProvider / useToast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('show() çağrıldığında mesaj görünür', () => {
    render(
      <ToastProvider>
        <TestButton message="Kaydedildi" />
      </ToastProvider>,
    )
    act(() => {
      screen.getByText('Tetikle').click()
    })
    expect(screen.getByText('Kaydedildi')).toBeTruthy()
  })

  it('kind=error verildiğinde bg-red-600 sınıfı taşır', () => {
    render(
      <ToastProvider>
        <TestButton message="Hata oluştu" kind="error" />
      </ToastProvider>,
    )
    act(() => {
      screen.getByText('Tetikle').click()
    })
    const toast = screen.getByText('Hata oluştu')
    expect(toast.className).toContain('bg-red-600')
  })

  it('kind belirtilmezse (success) bg-brand-700 sınıfı taşır', () => {
    render(
      <ToastProvider>
        <TestButton message="Kaydedildi" />
      </ToastProvider>,
    )
    act(() => {
      screen.getByText('Tetikle').click()
    })
    const toast = screen.getByText('Kaydedildi')
    expect(toast.className).toContain('bg-brand-700')
  })

  it('4000ms sonra otomatik kaldırılır', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <TestButton message="Geçici mesaj" />
      </ToastProvider>,
    )
    act(() => {
      screen.getByText('Tetikle').click()
    })
    expect(screen.getByText('Geçici mesaj')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText('Geçici mesaj')).toBeNull()
  })

  it('provider dışında useToast çağrılırsa anlaşılır bir hata fırlatır', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<NoProvider />)).toThrow()
    spy.mockRestore()
  })
})
