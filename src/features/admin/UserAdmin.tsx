import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { creatableRoles, canManageTarget, roleLabel } from '../../domain/userRoles'
import type { Role } from '../../types/domain'
import { useUsers, useCreateUser, useManageUser, type ManagedUser } from './useUsers'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { Icon } from '../../components/ui/Icon'
import { UserPlus, KeyRound, Info } from 'lucide-react'

const inputClass = 'w-full rounded-control border border-line bg-surface-1 text-ink-primary p-2 focus:outline-none focus:border-brand-fill focus:ring-2 focus:ring-brand-fill/20'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-card border border-line bg-surface-2 p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 font-display text-lg text-ink-primary">{title}</h3>
        {children}
      </div>
    </div>
  )
}

function CreateUserDialog({ allowed, onClose }: { allowed: Role[]; onClose: () => void }) {
  const toast = useToast()
  const create = useCreateUser()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [password, setPassword] = useState('')
  const canSubmit = !!email && !!fullName && !!role && password.length >= 6

  const submit = async () => {
    if (!canSubmit) return
    try {
      await create.mutateAsync({ email, fullName, phone: phone || undefined, role: role as Role, password })
      toast.show('Kullanıcı oluşturuldu')
      onClose()
    } catch (e) {
      toast.show('Oluşturulamadı: ' + (e as Error).message, 'error')
    }
  }

  return (
    <Modal title="Yeni Kullanıcı" onClose={onClose}>
      <div className="space-y-3">
        <Field label="E-posta">
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@rememore.test" />
        </Field>
        <Field label="Ad Soyad">
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Telefon (opsiyonel)">
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Rol">
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="">Seçin</option>
            {allowed.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </Field>
        <Field label="Geçici şifre">
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="En az 6 karakter" />
        </Field>
        <p className="text-xs text-ink-muted">Kullanıcı bu şifreyle giriş yapar; dilerse "Şifremi unuttum" ile değiştirebilir.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" type="button" disabled={!canSubmit} loading={create.isPending} onClick={submit}>Oluştur</Button>
        </div>
      </div>
    </Modal>
  )
}

function ResetDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const toast = useToast()
  const manage = useManageUser()
  const [password, setPassword] = useState('')
  const submit = async () => {
    if (password.length < 6) return
    try {
      await manage.mutateAsync({ userId: user.id, action: 'reset_password', password })
      toast.show('Şifre sıfırlandı')
      onClose()
    } catch (e) {
      toast.show('Sıfırlanamadı: ' + (e as Error).message, 'error')
    }
  }
  return (
    <Modal title={`Şifre sıfırla — ${user.full_name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Yeni geçici şifre">
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="En az 6 karakter" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" type="button" disabled={password.length < 6} loading={manage.isPending} onClick={submit}>Sıfırla</Button>
        </div>
      </div>
    </Modal>
  )
}

function RoleChip({ role }: { role: Role }) {
  return <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-secondary">{roleLabel(role)}</span>
}

export function UserAdmin() {
  const { role: myRole, appUser } = useAuth()
  const toast = useToast()
  const users = useUsers()
  const manage = useManageUser()
  const [showCreate, setShowCreate] = useState(false)
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null)

  const allowed = myRole ? creatableRoles(myRole) : []

  const toggleActive = async (u: ManagedUser) => {
    try {
      await manage.mutateAsync({ userId: u.id, action: 'set_active', isActive: !u.is_active })
      toast.show(u.is_active ? 'Kullanıcı pasifleştirildi' : 'Kullanıcı aktifleştirildi')
    } catch (e) {
      toast.show('İşlem başarısız: ' + (e as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Kullanıcı Yönetimi" subtitle="Personel hesaplarını oluşturun, şifre sıfırlayın ve aktif/pasif yönetin." />

      <div className="flex items-center gap-2 rounded-control border border-info-border bg-info-bg p-2 text-sm text-info-text">
        <Icon of={Info} size={16} />
        <span>Doktor eklemek için <Link to="/admin/doctors" className="underline">Doktor Yönetimi</Link> ekranını kullanın.</span>
      </div>

      <div className="flex justify-end">
        {allowed.length > 0 && (
          <Button variant="primary" type="button" onClick={() => setShowCreate(true)}>
            <Icon of={UserPlus} size={16} /> Yeni Kullanıcı
          </Button>
        )}
      </div>

      <Card title="Kullanıcılar">
        {users.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
        {!users.isLoading && (users.data?.length ?? 0) === 0 && (
          <EmptyState title="Kullanıcı yok" description="Henüz kayıtlı kullanıcı bulunmuyor." />
        )}
        {!users.isLoading && (users.data?.length ?? 0) > 0 && (
          <div className="divide-y divide-line">
            {users.data!.map((u) => {
              const manageable = myRole ? canManageTarget(myRole, u.role) : false
              const isSelf = u.id === appUser?.id
              return (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-primary">{u.full_name}</p>
                    <p className="truncate text-sm text-ink-muted">{u.email ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleChip role={u.role} />
                    {u.is_active
                      ? <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text">Aktif</span>
                      : <span className="rounded-full bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger-text">Pasif</span>}
                    {manageable && (
                      <>
                        <Button variant="ghost" type="button" onClick={() => setResetUser(u)}>
                          <Icon of={KeyRound} size={15} /> Şifre
                        </Button>
                        <Button variant="ghost" type="button" disabled={isSelf} onClick={() => toggleActive(u)}>
                          {u.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {showCreate && <CreateUserDialog allowed={allowed} onClose={() => setShowCreate(false)} />}
      {resetUser && <ResetDialog user={resetUser} onClose={() => setResetUser(null)} />}
    </div>
  )
}
