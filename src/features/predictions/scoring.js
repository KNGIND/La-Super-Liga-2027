/* REGLAS DE PUNTUACIÓN (función pura).
   Es la MISMA regla que supabase/migrations/001_core.sql → lsl2_points().
   En modo nube el servidor calcula y guarda los puntos; esto solo se usa para
   (a) mostrar la regla en pantalla y (b) calcular puntos de pronósticos locales (modo sin cuenta). */
import { SCORING } from '../../core/config.js';
const outcome = (s) => Math.sign(s.home - s.away);
export function pointsFor(pred, real) {
    if (pred.home === real.home && pred.away === real.away)
        return SCORING.exact;
    if (outcome(pred) === outcome(real)) {
        return pred.home - pred.away === real.home - real.away ? SCORING.goalDiff : SCORING.outcome;
    }
    return 0;
}
export const rulesText = () => [
    `Resultado exacto: ${SCORING.exact} puntos`,
    `Ganador (o empate) y misma diferencia de goles: ${SCORING.goalDiff} puntos`,
    `Solo acertar ganador o empate: ${SCORING.outcome} puntos`,
    'Se cierra cuando empieza el partido. En copas cuenta el resultado de los 90 minutos (sin penales).',
];
