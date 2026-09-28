# Luis OS — MVP

Aplicación web personal para ordenar el día y ver progreso sin saturarse.
Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Auth + Postgres con RLS) · PWA.

## Qué incluye el MVP

| Módulo | Qué hace |
|---|---|
| **Login** | Correo + contraseña (Supabase Auth). Todas las rutas protegidas. |
| **Hoy (dashboard)** | Saludo, fecha, frase diaria, tipo de día según tu horario, 3 prioridades (máximo impuesto por la base de datos), Mi día (trabajo, entreno, tarea principal, inglés, filmmaking, lectura, meditación, higiene, alimentación, agua, sueño) y progreso semanal con % de consistencia. |
| **Hábitos** | Checklist de higiene mañana/noche, hábitos de crecimiento por días, cuadrícula semanal para corregir días pasados, crear/editar/pausar hábitos. |
| **Entreno** | Plan por día (L pecho/hombro/tríceps, X espalda/bíceps, J pierna, S full body), registrar entrenamientos y series (ejercicio, reps, peso, notas), historial y gráfica de progreso por ejercicio. |
| **Finanzas** | Ingresos/gastos por categoría, tarjetas (corte, límite, saldo, MSI activos, meses restantes), compras MSI, total comprometido y % del ingreso mensual, metas de ahorro, pantalla **¿Vale la pena?** antes de comprar. |
| **Content Studio** | Ideas para Luis o Monse en YouTube/Instagram/TikTok, pipeline IDEA → PUBLICADO, hook/guion/shot list/caption/CTA/hashtags, métricas y engagement calculado en la base de datos, resumen de "qué funciona". |
| **Weekly Reset** | Calcula solo lo que ya registraste (sueño, entrenos, comida, higiene, inglés, filmmaking, videos, lectura, meditación, dinero) y te pide lo cualitativo. Wins / Problems / Lessons / Next week y Top 3 de la próxima semana, que aparecen en Hoy. |
| **Monse × DAZN** | Mini agencia y portafolio: campañas (marca, contacto, brief, entregables, fecha límite, pago, estado Contactada → Pagada), producciones con checklist antes/durante/después (plantillas: deportiva completa, sesión rápida, entregable de campaña), piezas ligadas a cada producción, calendario independiente, portafolio con roles y resultados, y ruta aspiracional hacia el Super Bowl 2027. |
| **Skills** | Skill tree de 107 skills en 8 áreas (Filmmaking, Postproduction, Photography, Content, English, Mechatronics, Business, Leadership). Niveles No iniciado → Avanzado que **solo suben con evidencia** (lo impone la base de datos). Evidencia aprender / practicar / aplicar / reflexión, horas, recursos (máx. 3 activos), 6 rutas de aprendizaje, proyectos en secuencia (30-second Sports Film → 60-second Athlete Story → Full Match Story → Mini Documentary) que se inician como producciones, y Skill of the Week (aprender 15 · practicar 30 · aplicar · revisar 10). |
| **Libertad financiera (F1)** | Home (dinero total, comprometido, disponible real, deuda, ahorro, patrimonio), plan semanal que lee tus ingresos registrados, estrategia "primera semana = tarjetas" (solo planifica), ahorro semanal con historial y gráfica, fondo de emergencia por niveles, sobres y metas con historial y préstamos internos por reponer (no cuentan como ingreso), Credit Card Hub (solo últimos 4 dígitos), MSI Manager con compromiso futuro, Debt Center con escenarios, simulador de compra 12/18/24 y Money scorecard en el Reset. Los saldos solo cambian registrando movimientos o pagos reales. |
| **Idiomas + Mechatronics Academy (F1)** | Perfil de idiomas (English Primary; French, German, Japanese, Mandarin en Future), nivel A1–C2 solo con evidencia, Focus Seasons, Knowledge Map de 23 áreas (188 skills) dentro de Skills, Lab con 20 proyectos en 4 niveles, evidencia de competencia (teoría, ejercicio, código, esquema…), engineering skill of the week, software activable y Knowledge Profile. |
| **Carrera** | Pipeline de 7 etapas (Servicio social → Titulación → Repaso Mecatrónica → CV → LinkedIn → Portafolio → Empleo). Registro de horas de servicio (meta configurable, 480 h por defecto, horas previas, firmadas) con ritmo de 4 semanas y fecha estimada solo si hay ritmo; marca el hábito de servicio/titulación. Pendientes por etapa (checklist base, "confirmar con tu universidad"), documentos con archivo privado (PDF/imagen/Word, 10 MB, se abren con link temporal de 60 s), contactos, vacantes por estado, Interview Lab (tu respuesta → versión mejorada, práctica) y próximas fechas. Suma horas, aplicaciones y preguntas practicadas al Weekly Reset. |
| **Modo agotado** | Un botón oculta todo lo no esencial y deja: higiene, comer decente, agua, 5 min de meditación, 5 páginas, dormir. Cuenta para tu progreso semanal. |

**No construido todavía** (aparece como "Próximamente" en *Más*): Vocabulary Bank, Troubleshooting Lab / Engineering Notebook, Finanzas F2–F4 (beneficios, recompensas, suscripciones, calendario, patrimonio, ingresos), Chilli Wings, Espiritualidad, Cuerpo con fotos, barbería, Mente y analíticas avanzadas (fase 4).

## Decisiones de diseño

- **Tu día empieza a las 4:00** (configurable). Lo que registres a la 1:30 después del turno cuenta para ese día.
- **Semana domingo → sábado**; el sábado es el Weekly Reset.
- Los días de **mantenimiento o doble turno** esconden inglés, filmmaking y entrenamiento (puedes marcarlos igual con "Lo hice igual").
- **Higiene cumplida** = 7 de 10 pasos, o higiene básica en modo agotado.
- Cada métrica semanal se topa en 100 % y el total es un promedio: una mala semana se ve como poca consistencia, no como fracaso.
- Nada se guarda en localStorage: todo vive en Supabase. El tema claro/oscuro se guarda en una cookie.

## Puesta en marcha (≈10 minutos)

1. **Supabase**: crea un proyecto en <https://supabase.com> (plan gratis).
2. **Base de datos**: *SQL Editor → New query*, pega `supabase/migrations/0001_init.sql` y dale *Run*. Después, en orden: `0002_monse.sql`, `0003_skills.sql`, `0004_finance.sql`, `0005_knowledge.sql`, `0006_career.sql` (esta última también crea el bucket privado `private` de Storage con acceso solo a tu carpeta).
3. **Auth** (*Authentication → Sign In / Providers → Email*):
   - Crea tu cuenta desde la app (o desde *Authentication → Users → Add user*).
   - Cuando ya tengas tu cuenta, desactiva *Allow new users to sign up* para que nadie más se registre.
   - En *Authentication → URL Configuration* pon tu dominio de Vercel como *Site URL* y agrega `https://TU-DOMINIO/auth/callback` en *Redirect URLs*.
4. **Local**:
   ```bash
   cp .env.example .env.local   # llena URL y publishable key (Project Settings → API)
   npm install
   npm run dev                  # http://localhost:3000
   ```
5. **Deploy en Vercel**: importa el repo, agrega las dos variables de `.env.example` y despliega.
6. **Instalar en iPhone**: abre la URL en Safari → Compartir → *Agregar a pantalla de inicio*.

## Scripts

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm test           # pruebas de lógica (fechas, MSI, progreso semanal)
npm run typecheck  # tipos
npm run lint
```

## Estructura

```
supabase/migrations/0001_init.sql   Esquema, RLS, triggers, datos iniciales por usuario
src/proxy.ts                        Refresca la sesión y protege rutas (Next 16 "proxy")
src/lib/                            Lógica pura (dates, progress, finance, schedule) + consultas
src/components/                     UI reutilizable (Card, Button, formularios, gráfica)
src/app/login                       Login / registro
src/app/(app)/                      Hoy, hábitos, entreno, finanzas, contenido, reset, ajustes, más
tests/                              Vitest
```

### Base de datos

`profiles` (metas y zona horaria) · `week_template` (horario) · `daily_logs` (sueño, agua, comida, lectura, meditación, modo agotado) · `habits` + `habit_logs` · `priorities` (máx. 3 por día, `check position between 1 and 3` + `unique`) · `workouts` + `workout_sets` · `transactions` · `cards` · `msi_purchases` (mensualidad y fecha final generadas) · `savings_goals` · `content_items` (engagement generado) · `weekly_reviews` (máx. 3 prioridades).

Todas las tablas tienen `user_id` y políticas RLS `user_id = auth.uid()`, así que la app ya soporta varios usuarios. Un trigger crea perfil, horario y hábitos por defecto cuando se registra alguien.

## Cómo se probó

- Migración aplicada sobre Postgres 18 con el servicio real de Supabase Auth (GoTrue) y PostgREST: RLS aísla usuarios, el 4.º registro de prioridades se rechaza, las funciones internas no son invocables por API.
- 9 pruebas unitarias de lógica (`npm test`).
- Recorrido completo en navegador (Chromium, tamaño iPhone 13 y desktop): registro, prioridades, Mi día con persistencia tras recargar, modo agotado, hábitos, entreno con series y gráfica, movimientos, tarjeta, compra MSI vía ¿Vale la pena?, contenido publicado con engagement, Weekly Reset, tema oscuro, sin scroll horizontal en ninguna pantalla y sin errores de consola.

### Reglas de nivel (Skills)

| Nivel | Evidencia mínima |
|---|---|
| Fundamentos | 1 aprender |
| Aprendiendo | + 1 práctica |
| Practicando | 3 prácticas + 1 aplicación real |
| Competente | 3 aplicaciones + 1 reflexión |
| Avanzado | 6 aplicaciones + 3 reflexiones + 10 h de práctica |

"Aplicación real" exige prueba: una pieza, una producción, un proyecto o un link. La evidencia se genera sola al guardar la revisión post-producción de una producción (una aplicación + una reflexión por skill practicada) y al publicar una pieza con "Skills demonstrated". El Weekly Reset muestra output contra consumo, y la skill que elijas ahí se vuelve la Skill of the Week siguiente. En el dashboard solo aparece una card pequeña con la skill de la semana.
