import { useTranslation } from 'react-i18next'

export function PhotoUploader({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const { t } = useTranslation('common')
  return (
    <div>
      <input type="file" accept="image/*" multiple
        onChange={(e) => onChange(Array.from(e.target.files ?? []))} />
      <p className="text-sm text-slate-500">{t('photoUploader.selectedCount', { count: files.length })}</p>
    </div>
  )
}
