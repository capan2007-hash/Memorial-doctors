import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { useAuth } from '../../lib/auth'
import { creatableRoles, canManageTarget } from '../../domain/userRoles'
import type { Role } from '../../types/domain'
import { useUsers, useCreateUser, useManageUser, type ManagedUser } from './useUsers'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Avatar } from '../../components/ui/Avatar'
import { useToast } from '../../components/ui/Toast'
import { Icon } from '../../components/ui/Icon'
import { UserPlus, KeyRound, Info, Search, Power } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/shadcn/dialog'
import { Input } from '@/components/shadcn/input'
import { Skeleton } from '@/components/shadcn/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'

function CreateUserDialog({ allowed, onClose }: { allowed: Role[]; onClose: () => void }) {
  const { t } = useTranslation('admin')
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
      toast.show(t('userAdmin.createDialog.createdToast'))
      onClose()
    } catch (e) {
      toast.show(t('userAdmin.createDialog.createFailedToast', { message: (e as Error).message }), 'error')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{t('userAdmin.createDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t('userAdmin.createDialog.emailLabel')}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('userAdmin.createDialog.emailPlaceholder')} />
          </Field>
          <Field label={t('userAdmin.createDialog.fullNameLabel')}>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label={t('userAdmin.createDialog.phoneLabel')}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={t('userAdmin.createDialog.roleLabel')}>
            <Select value={role || undefined} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue placeholder={t('userAdmin.createDialog.rolePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {allowed.map((r) => <SelectItem key={r} value={r}>{t(`userAdmin.roles.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('userAdmin.createDialog.tempPasswordLabel')}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('userAdmin.createDialog.tempPasswordPlaceholder')} />
          </Field>
          <p className="text-xs text-ink-muted">{t('userAdmin.createDialog.passwordNote')}</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>{t('userAdmin.createDialog.cancelButton')}</Button>
          <Button variant="primary" type="button" disabled={!canSubmit} loading={create.isPending} onClick={submit}>{t('userAdmin.createDialog.createButton')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const manage = useManageUser()
  const [password, setPassword] = useState('')
  const submit = async () => {
    if (password.length < 6) return
    try {
      await manage.mutateAsync({ userId: user.id, action: 'reset_password', password })
      toast.show(t('userAdmin.resetDialog.resetSuccessToast'))
      onClose()
    } catch (e) {
      toast.show(t('userAdmin.resetDialog.resetFailedToast', { message: (e as Error).message }), 'error')
    }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{t('userAdmin.resetDialog.title', { name: user.full_name })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t('userAdmin.resetDialog.newTempPasswordLabel')}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('userAdmin.resetDialog.tempPasswordPlaceholder')} />
          </Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>{t('userAdmin.resetDialog.cancelButton')}</Button>
          <Button variant="primary" type="button" disabled={password.length < 6} loading={manage.isPending} onClick={submit}>{t('userAdmin.resetDialog.resetButton')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatusPill({ active }: { active: boolean }) {
  const { t } = useTranslation('admin')
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        active ? 'bg-success-bg text-success-text' : 'bg-surface-3 text-ink-muted'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-success-text' : 'bg-ink-muted'}`} />
      {active ? t('userAdmin.activeLabel') : t('userAdmin.inactiveLabel')}
    </span>
  )
}

export function UserAdmin() {
  const { t } = useTranslation('admin')
  const { role: myRole, appUser } = useAuth()
  const toast = useToast()
  const users = useUsers()
  const manage = useManageUser()
  const [showCreate, setShowCreate] = useState(false)
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null)
  const [search, setSearch] = useState('')

  const allowed = myRole ? creatableRoles(myRole) : []

  const filteredUsers = (users.data ?? []).filter((u) => {
    const q = search.trim().toLocaleLowerCase('tr')
    if (!q) return true
    return (
      u.full_name.toLocaleLowerCase('tr').includes(q) ||
      (u.email ?? '').toLocaleLowerCase('tr').includes(q) ||
      t(`userAdmin.roles.${u.role}`).toLocaleLowerCase('tr').includes(q)
    )
  })

  const toggleActive = async (u: ManagedUser) => {
    try {
      await manage.mutateAsync({ userId: u.id, action: 'set_active', isActive: !u.is_active })
      toast.show(u.is_active ? t('userAdmin.deactivatedToast') : t('userAdmin.activatedToast'))
    } catch (e) {
      toast.show(t('userAdmin.actionFailedToast', { message: (e as Error).message }), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('userAdmin.title')} subtitle={t('userAdmin.subtitle')} />

      <div className="flex items-center gap-2 rounded-control border border-info-border bg-info-bg p-2 text-sm text-info-text">
        <Icon of={Info} size={16} />
        <span>
          <Trans i18nKey="userAdmin.doctorHint" t={t}>
            Doktor eklemek için <Link to="/admin/doctors" className="underline">Doktor Yönetimi</Link> ekranını kullanın.
          </Trans>
        </span>
      </div>

      <div className="flex justify-end">
        {allowed.length > 0 && (
          <Button variant="primary" type="button" onClick={() => setShowCreate(true)}>
            <Icon of={UserPlus} size={16} /> {t('userAdmin.newUserButton')}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 md:px-5">
          <h3 className="font-display text-base text-ink-primary">{t('userAdmin.usersCardTitle')}</h3>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} />
            <Input
              className="w-56 ps-9"
              placeholder={t('userAdmin.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {users.isLoading && (
          <div className="divide-y divide-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 md:px-5">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        )}
        {!users.isLoading && (users.data?.length ?? 0) === 0 && (
          <div className="p-4 md:p-5">
            <EmptyState title={t('userAdmin.emptyTitle')} description={t('userAdmin.emptyDescription')} />
          </div>
        )}
        {!users.isLoading && (users.data?.length ?? 0) > 0 && filteredUsers.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-muted">{t('userAdmin.emptySearch')}</p>
        )}
        {!users.isLoading && filteredUsers.length > 0 && (
          <div className="divide-y divide-line">
            {filteredUsers.map((u) => {
              const manageable = myRole ? canManageTarget(myRole, u.role) : false
              const isSelf = u.id === appUser?.id
              return (
                <div key={u.id} className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-surface-1 md:px-5">
                  <Avatar name={u.full_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-primary">{u.full_name}</p>
                    <p className="truncate text-sm text-ink-muted">{u.email ?? '—'}</p>
                  </div>
                  <span className="w-20 shrink-0 text-sm text-ink-secondary">{t(`userAdmin.roles.${u.role}`)}</span>
                  <StatusPill active={u.is_active} />
                  <div className="flex items-center gap-1">
                    {manageable && (
                      <>
                        <Button variant="ghost" type="button" onClick={() => setResetUser(u)}>
                          <Icon of={KeyRound} size={15} /> {t('userAdmin.passwordButton')}
                        </Button>
                        <Button variant="ghost" type="button" disabled={isSelf} onClick={() => toggleActive(u)}>
                          <Icon of={Power} size={15} />
                          {u.is_active ? t('userAdmin.deactivateButton') : t('userAdmin.activateButton')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCreate && <CreateUserDialog allowed={allowed} onClose={() => setShowCreate(false)} />}
      {resetUser && <ResetDialog user={resetUser} onClose={() => setResetUser(null)} />}
    </div>
  )
}
