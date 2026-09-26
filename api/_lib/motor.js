import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

// Reaproveita o mesmo motor de cálculo do navegador (js/imt.js e js/engine.js),
// para que o servidor nunca calcule diferente do que o usuário viu na tela.
let calcular = null;

export function calcularZFlip(inputs) {
  if (!calcular) {
    const raiz = process.cwd();
    const codigo = ['js/imt.js', 'js/engine.js']
      .map(f => readFileSync(join(raiz, f), 'utf8'))
      .join('\n');
    const ctx = vm.createContext({ Infinity });
    vm.runInContext(codigo + '\n;globalThis.__calcular = calcularZFlip;', ctx);
    calcular = ctx.__calcular;
  }
  // O resultado vem de outro contexto do vm; serializar garante objetos simples.
  return JSON.parse(JSON.stringify(calcular(inputs)));
}
