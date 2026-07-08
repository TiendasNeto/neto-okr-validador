export default async function handler(req, res) {
  // CORS headers — permite acceso desde cualquier origen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { nombre, puesto, area, nivel, nivelLabel, obj, krs } = req.body;

  if (!nombre || !area || !nivel || !obj || !krs?.length) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const SYSTEM = `Eres el evaluador oficial del Programa de Certificación OKR de Tiendas Neto (México). Sé estricto en metodología pero constructivo en el feedback.

CRITERIOS DE EVALUACIÓN (100 puntos):

OBJECTIVE (40 pts):
- Aspiracional y motivador, no descripción del puesto (0-15)
- Cualitativo — sin números ni porcentajes (0-10)
- Dirección clara y propósito estratégico (0-15)

KEY RESULTS (60 pts — 20 pts por KR):
- Baseline y meta explícitos con brecha real y ambiciosa (0-8)
- Mide RESULTADO, NO actividad. Verbos de actividad: crear, implementar, lanzar, hacer, generar, actualizar, desarrollar, diseñar, elaborar, gestionar (0-7)
- Ambicioso pero alcanzable en un trimestre (0-5)

TAREAS (evaluación cualitativa, sin puntaje):
- ¿Son actividades concretas o resultados disfrazados?
- ¿Coherencia entre KR y sus tareas?

ERRORES DE RECHAZO AUTOMÁTICO (puntaje KR = 0):
- KR que empieza con verbo de actividad sin métrica de impacto
- KR sin baseline definido
- Meta igual o casi igual al baseline
- Objective con números

NIVELES:
- N2 Gerentes: KRs operativos aceptables, buena redacción, brecha real
- N3 Directores: Objective debe conectar con estrategia corporativa; al menos 1 KR de iniciativa nueva

SEMÁFORO: Verde 80-100 (Aprobado), Amarillo 60-79 (Condicional), Rojo 0-59 (No aprobado)

Para cada KR con problema propón una version_mejorada concreta y completa lista para usar.

Responde ÚNICAMENTE JSON válido sin backticks ni texto extra:
{"puntaje":<0-100>,"semaforo":"verde|amarillo|rojo","estado":"Aprobado|Condicional|No aprobado","resumen":"2-3 oraciones directas","fortalezas":["..."],"problemas":["..."],"kr_feedback":[{"kr":1,"puntaje":<0-20>,"comentario":"...","tareas_ok":true,"tareas_comentario":"...","version_mejorada":"oración completa o vacío si el KR está bien"}],"guia_mejora":"instrucción concreta"}`;

  const userMsg = `Evalúa este OKR del programa de certificación de Tiendas Neto:

PERSONA: ${nombre} | ${puesto} | ${area}
NIVEL: ${nivelLabel}

OBJECTIVE: ${obj}

${krs.map(k => `KEY RESULT ${k.n}:
  Descripción: ${k.desc}
  Baseline: ${k.base}
  Meta: ${k.meta}
  Tareas: ${k.tareas?.length ? k.tareas.map((t, i) => `${i + 1}. ${t}`).join(' | ') : '(no ingresadas)'}`).join('\n\n')}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1800,
        system: SYSTEM,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'Error al conectar con la IA', detail: err });
    }

    const data = await response.json();
    const raw = data.content
      ?.filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    const json = JSON.parse(raw);
    return res.status(200).json(json);

  } catch (e) {
    return res.status(500).json({ error: 'Error interno', detail: e.message });
  }
}
