import { GROUPS, THRESHOLDS } from '../gait/rules';
import { Icon, type IconName } from './icons';

export function GuidePage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Guía</h1>
          <p>Cómo grabar para que el análisis sea fiable y qué mide cada métrica.</p>
        </div>
      </div>

      <div className="guide-grid">
        <section className="card">
          <div className="card-head">
            <div className="card-title">
              <div className="ico">
                <Icon name="camera" />
              </div>
              <h2>Protocolo de grabación</h2>
            </div>
          </div>
          <ul className="guide-list">
            <li>Cámara a la altura de la cadera, perpendicular al recorrido, a 3 o 5 metros. Sin zoom.</li>
            <li>60 fps si el móvil lo permite. 30 fps es el mínimo aceptable.</li>
            <li>Ropa ajustada y con contraste frente al fondo. Buena luz, sin sombras fuertes.</li>
            <li>Tramo de 15 a 20 segundos a ritmo estable. Anota el ritmo del reloj o de la cinta.</li>
            <li>Graba desde ambos lados para comparar la simetría.</li>
            <li>Cinta de correr con trípode es el escenario más repetible entre sesiones.</li>
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title">
              <div className="ico">
                <Icon name="info" />
              </div>
              <h2>Límites del método</h2>
            </div>
          </div>
          <ul className="guide-list">
            <li>Una sola cámara en 2D: lo que se sale del plano se distorsiona.</li>
            <li>A 30 fps cada frame son 33 ms. El tiempo de contacto tiene ese margen de error.</li>
            <li>Los ángulos se calculan solo en el lado cercano a la cámara.</li>
            <li>Los umbrales son orientativos, de bibliografía. Compara sobre todo contigo mismo.</li>
            <li>Compara sesiones a un ritmo parecido. La técnica cambia con la velocidad.</li>
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div className="card-title">
            <div className="ico">
              <Icon name="ruler" />
            </div>
            <h2>Métricas y rangos objetivo</h2>
          </div>
        </div>
        {GROUPS.map((g) => {
          const list = THRESHOLDS.filter((t) => t.group === g.id);
          if (list.length === 0) return null;
          return (
            <div key={g.id} className="metrics-group">
              <div className="group-head">
                <div className="ico">
                  <Icon name={g.icon as IconName} />
                </div>
                <h4>
                  {g.title}
                  <small>{g.blurb}</small>
                </h4>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Métrica</th>
                    <th>Qué mide</th>
                    <th>Verde</th>
                    <th>Amarillo</th>
                    <th>Plano</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <Icon name={t.icon as IconName} size={14} /> {t.label}
                        </strong>
                      </td>
                      <td className="muted">{t.description}</td>
                      <td>
                        {t.band.green[0]} a {t.band.green[1]} {t.unit}
                      </td>
                      <td className="muted">{t.band.yellow.map(([a, b]) => `${a} a ${b}`).join(', ')}</td>
                      <td className="muted">{t.planes.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </section>
    </>
  );
}
