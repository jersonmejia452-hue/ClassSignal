interface PulseOption {
  id: string
  isActive: boolean
  ordinal: number
  responseCount: number
}

interface PulseSelectorProps {
  onChange: (pulseId: string) => void
  options: PulseOption[]
  value: string
}

export function PulseSelector({
  onChange,
  options,
  value,
}: PulseSelectorProps) {
  return (
    <section
      aria-labelledby="pulse-selector-title"
      className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5"
    >
      <div>
        <p
          className="text-sm font-extrabold text-[#071a2b]"
          id="pulse-selector-title"
        >
          Pulso que estás revisando
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          El resumen, el mapa, el muro y las respuestas usan este pulso.
        </p>
      </div>

      <label className="mt-4 block shrink-0 sm:mt-0" htmlFor="pulse-selector">
        <span className="sr-only">Seleccionar pulso</span>
        <select
          className="form-input min-w-56 bg-white py-2.5 text-sm font-extrabold"
          id="pulse-selector"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              Pulso {option.ordinal}{option.isActive ? ' · activo' : ''} · {option.responseCount}{' '}
              {option.responseCount === 1 ? 'señal' : 'señales'}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
