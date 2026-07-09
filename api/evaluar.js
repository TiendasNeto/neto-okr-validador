module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { nombre, puesto, area, nivel, nivelLabel, obj, krs } = req.body;

  if (!nombre || !area || !nivel || !obj || !krs?.length) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const SYSTEM = `Eres el evaluador oficial del Programa de Certificación ORC de Tiendas Neto (México).

TERMINOLOGÍA OBLIGATORIA — usa SIEMPRE estos términos, nunca los equivalentes en inglés:
- ORC (nunca OKR)
- Objetivo (nunca Objective)
- Resultado Clave o RC (nunca Key Result ni KR)
- Tarea (nunca Initiative)

CRITERIOS DE EVALUACIÓN (100 puntos):

OBJETIVO (40 pts):
- Aspiracional y motivador, no descripción del puesto (0-15)
- Cualitativo — sin números ni porcentajes (0-10)
- Dirección clara y propósito estratégico (0-15)

RESULTADOS CLAVE (60 pts — 20 pts por RC):
- Baseline y meta explícitos con brecha real y ambiciosa (0-8)
- Mide RESULTADO, NO actividad. Verbos de actividad: crear, implementar, lanzar, hacer, generar, actualizar, desarrollar, diseñar, elaborar, gestionar (0-7)
- Ambicioso pero alcanzable en un trimestre (0-5)

TAREAS (evaluación cualitativa, sin puntaje):
- ¿Son actividades concretas o resultados disfrazados?
- ¿Coherencia entre RC y sus tareas?

ERRORES DE RECHAZO AUTOMÁTICO (puntaje RC = 0):
- RC que empieza con verbo de actividad sin métrica de impacto
- RC sin baseline definido
- Meta igual o casi igual al baseline
- Objetivo con números

NIVELES:
- N2 Gerentes: RCs operativos aceptables, buena redacción, brecha real
- N3 Directores: Objetivo debe conectar con estrategia corporativa; al menos 1 RC de iniciativa nueva

SEMÁFORO: Verde 80-100 (Aprobado), Amarillo 60-79 (Condicional), Rojo 0-59 (No aprobado)

Para cada RC con problema:
- Propón una version_mejorada (descripción completa lista para usar)
- Si el baseline o meta también necesitan cambiar, indícalo en baseline_sugerido y meta_sugerida
- Si recomiendas agregar un RC adicional, inclúyelo en rc_adicional con descripción, baseline y meta

Responde ÚNICAMENTE JSON válido sin backticks ni texto extra:
{"puntaje":<0-100>,"semaforo":"verde|amarillo|rojo","estado":"Aprobado|Condicional|No aprobado","resumen":"2-3 oraciones en español usando ORC/Objetivo/RC","fortalezas":["..."],"problemas":["..."],"kr_feedback":[{"kr":1,"puntaje":<0-20>,"comentario":"...en español usando RC/Objetivo...","tareas_ok":true,"tareas_comentario":"...","version_mejorada":"descripción completa o vacío si está bien","baseline_sugerido":"nuevo baseline o vacío","meta_sugerida":"nueva meta o vacío"},{"kr":2,"puntaje":<0-20>,"comentario":"...","tareas_ok":true,"tareas_comentario":"...","version_mejorada":"","baseline_sugerido":"","meta_sugerida":""},{"kr":3,"puntaje":<0-20>,"comentario":"...","tareas_ok":true,"tareas_comentario":"...","version_mejorada":"","baseline_sugerido":"","meta_sugerida":""}],"rc_adicional":{"sugerido":false,"descripcion":"","baseline":"","meta":"","razon":""},"guia_mejora":"instrucción concreta en español"}`;

  const userMsg = `Evalúa este ORC del programa de certificación de Tiendas Neto:

PERSONA: ${nombre} | ${puesto} | ${area}
NIVEL: ${nivelLabel}

OBJETIVO: ${obj}

${krs.map(k => `RESULTADO CLAVE ${k.n}:
  Descripción: ${k.desc}
  Baseline: ${k.base}
  Meta: ${k.meta}
  Tareas: ${k.tareas && k.tareas.length ? k.tareas.map((t, i) => `${i + 1}. ${t}`).join(' | ') : '(no ingresadas)'}`).join('\n\n')}`;

  try {
    const https = require('https');

    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }]
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve({ status: response.statusCode, body: data }));
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });

    if (result.status !== 200) {
      return res.status(502).json({ error: 'Error de la IA', detail: result.body });
    }

    const data = JSON.parse(result.body);
    const raw = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    const json = JSON.parse(raw);
    return res.status(200).json(json);

  } catch (e) {
    return res.status(500).json({ error: 'Error interno', detail: e.message });
  }
};
