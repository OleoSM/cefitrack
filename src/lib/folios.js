// Nomenclatura de folios para simulacros:
//   EX  → examen simulacro presencial (EX-01, EX-02, …)
//   EXD → examen digital / en línea   (EXD-01, EXD-02, …)
export const folioEX  = n => `EX-${String(n).padStart(2, '0')}`
export const folioEXD = n => `EXD-${String(n).padStart(2, '0')}`

// Folio de un registro de simulacro de mockData (usa su campo folio si existe)
export const folioSimulacro = (sim, index = 0) =>
  sim?.folio ?? (sim?.modalidad === 'digital' ? folioEXD(index + 1) : folioEX(index + 1))
