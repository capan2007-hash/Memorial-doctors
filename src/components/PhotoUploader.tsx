export function PhotoUploader({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  return (
    <div>
      <input type="file" accept="image/*" multiple
        onChange={(e) => onChange(Array.from(e.target.files ?? []))} />
      <p className="text-sm text-slate-500">{files.length} fotoğraf seçili</p>
    </div>
  )
}
