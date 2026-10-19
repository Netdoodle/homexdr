// Parameter form generated from an ArtifactDef (shared/api/artifacts.go).

import type { ArtifactDef } from '../api/types'

export function ArtifactParamsForm({
  def,
  values,
  onChange,
  errors,
  idPrefix = 'ap',
}: {
  def: ArtifactDef
  values: Record<string, string>
  onChange: (v: Record<string, string>) => void
  errors: Record<string, string>
  idPrefix?: string
}) {
  const params = def.params ?? []
  if (params.length === 0) return <p className="muted small">This artifact takes no parameters.</p>
  const set = (k: string, v: string) => onChange({ ...values, [k]: v })
  return (
    <div className="form-grid">
      {params.map((p) => {
        const id = `${idPrefix}-${def.name}-${p.name}`
        const err = errors[p.name]
        return (
          <div className="field" key={p.name}>
            <label htmlFor={id}>
              <span className="mono">{p.name}</span>
              {p.required ? <span className="danger-text"> *</span> : null}
              <span className="faint xsmall"> {p.type}</span>
            </label>
            {p.type === 'bool' ? (
              <select id={id} className="select" value={values[p.name] ?? p.default ?? 'false'} onChange={(e) => set(p.name, e.target.value)}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                id={id}
                className={err ? 'input mono invalid' : 'input mono'}
                type={p.type === 'int' ? 'number' : 'text'}
                inputMode={p.type === 'int' ? 'numeric' : undefined}
                step={p.type === 'int' ? 1 : undefined}
                value={values[p.name] ?? ''}
                placeholder={p.default}
                onChange={(e) => set(p.name, e.target.value)}
                aria-invalid={!!err}
              />
            )}
            {err ? <span className="error">{err}</span> : <span className="help">{p.description}</span>}
          </div>
        )
      })}
    </div>
  )
}
