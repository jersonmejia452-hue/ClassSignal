import { ArrowLeft, Database, LockKeyhole, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Brand } from '../components/ui/Brand'

const processors = [
  {
    name: 'Supabase',
    purpose: 'autenticación docente, base de datos, tiempo real y funciones de servidor',
    href: 'https://supabase.com/privacy',
  },
  {
    name: 'Cloudflare Turnstile',
    purpose: 'detección de bots y protección de los envíos públicos',
    href: 'https://www.cloudflare.com/turnstile-privacy-policy/',
  },
  {
    name: 'OpenAI',
    purpose: 'análisis colectivo solicitado por el profesor',
    href: 'https://openai.com/policies/privacy-policy/',
  },
] as const

export function PrivacyPage() {
  return (
    <main className="signal-shell min-h-screen bg-[#f4f7fb] text-slate-700">
      <header className="border-b border-white/10 bg-[#071a2b] text-white shadow-[0_8px_25px_rgba(7,26,43,0.12)]">
        <div className="mx-auto flex min-h-[4.75rem] max-w-4xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Brand inverse to="/unirse" />
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-200 hover:bg-white/10 hover:text-white"
            to="/unirse"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-extrabold tracking-[0.12em] text-teal-800 uppercase">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Privacidad por diseño
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-[#071a2b] sm:text-5xl">
            Privacidad de ClassSignal
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            ClassSignal permite expresar el nivel de comprensión sin pedir al estudiante nombre,
            correo ni una cuenta. Este aviso describe el tratamiento de datos del MVP publicado.
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Última actualización: 18 de julio de 2026
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <PrivacySection
            icon={<LockKeyhole className="size-5" aria-hidden="true" />}
            title="Cuando participa un estudiante"
          >
            <ul className="space-y-3">
              <li>
                Se guarda el estado elegido, la duda opcional, la clase, el pulso y la hora del
                envío.
              </li>
              <li>
                El navegador conserva un UUID aleatorio y recuerda los pulsos ya respondidos en{' '}
                <code className="font-mono text-xs">localStorage</code>. El servidor transforma el
                UUID con HMAC en un identificador diferente para cada pulso, por lo que no permite
                relacionar a una persona entre rondas.
              </li>
              <li>
                No escribas nombres ni otros datos personales en la duda. El profesor puede leer el
                texto exactamente como fue enviado.
              </li>
              <li>
                Si el profesor activa el muro de dudas, el texto puede mostrarse de forma anónima a
                quienes tengan el enlace de la clase mientras ese pulso siga activo. Cada pulso
                comienza con el muro oculto. El muro no publica tu identificador ni tu estado de
                comprensión, y el profesor puede ocultar preguntas individuales.
              </li>
            </ul>
          </PrivacySection>

          <PrivacySection
            icon={<ShieldCheck className="size-5" aria-hidden="true" />}
            title="Protección contra abuso"
          >
            <p>
              Turnstile puede procesar señales técnicas como dirección IP, agente de usuario,
              huella TLS, site key y origen para distinguir personas de automatizaciones. Consulta
              el{' '}
              <a
                className="font-bold text-blue-700 underline underline-offset-3 hover:text-blue-900"
                href="https://www.cloudflare.com/turnstile-privacy-policy/"
                rel="noreferrer"
                target="_blank"
              >
                Anexo de Privacidad de Turnstile
              </a>
              . ClassSignal no guarda la IP sin procesar en sus tablas; conserva una huella HMAC
              diaria para aplicar límites de uso.
            </p>
          </PrivacySection>

          <PrivacySection
            icon={<Database className="size-5" aria-hidden="true" />}
            title="Profesores y análisis"
          >
            <p>
              Supabase gestiona el correo y la sesión del profesor. Cuando el profesor solicita un
              mapa de confusión, ClassSignal envía a OpenAI el contexto de la clase y únicamente las
              respuestas colectivas del pulso seleccionado necesarias para generar el análisis. La
              clave de OpenAI permanece en el servidor y nunca llega al navegador.
            </p>
          </PrivacySection>

          <PrivacySection
            icon={<ShieldCheck className="size-5" aria-hidden="true" />}
            title="Conservación y control"
          >
            <p>
              Las respuestas y análisis permanecen en el proyecto de Supabase hasta que el
              responsable de la instalación los elimine. El MVP aún no aplica un plazo automático
              de borrado. Para ejercer una solicitud sobre una clase, contacta al profesor o a la
              institución que opera esta instalación.
            </p>
          </PrivacySection>
        </div>

        <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_12px_38px_rgba(7,26,43,0.055)] sm:p-8">
          <h2 className="text-xl font-black tracking-tight text-[#071a2b]">Proveedores del servicio</h2>
          <div className="mt-5 divide-y divide-slate-100">
            {processors.map((processor) => (
              <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={processor.name}>
                <div>
                  <p className="font-extrabold text-slate-950">{processor.name}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{processor.purpose}</p>
                </div>
                <a
                  className="shrink-0 text-sm font-bold text-blue-700 underline-offset-4 hover:underline"
                  href={processor.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  Ver política
                </a>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-8 text-sm leading-6 text-slate-500">
          Este aviso documenta el comportamiento técnico del MVP y no sustituye la política de
          privacidad ni las obligaciones legales de la institución que lo publique.
        </p>
      </div>
    </main>
  )
}

function PrivacySection({
  children,
  icon,
  title,
}: {
  children: ReactNode
  icon: ReactNode
  title: string
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_12px_38px_rgba(7,26,43,0.055)] sm:p-8">
      <div className="flex items-center gap-3 text-teal-700">
        <span className="grid size-10 place-items-center rounded-xl bg-teal-50">{icon}</span>
        <h2 className="text-xl font-black tracking-tight text-[#071a2b]">{title}</h2>
      </div>
      <div className="mt-5 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  )
}
