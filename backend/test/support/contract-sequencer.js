// El test de cobertura del contrato debe correr al final, cuando ya se registraron
// todas las respuestas de los demás archivos.
const Sequencer = require('@jest/test-sequencer').default

const isCoverage = (test) => test.path.endsWith('openapi-coverage.contract.spec.ts')

class ContractSequencer extends Sequencer {
  sort(tests) {
    return [...tests].sort(
      (a, b) => Number(isCoverage(a)) - Number(isCoverage(b)) || a.path.localeCompare(b.path),
    )
  }
}

module.exports = ContractSequencer
