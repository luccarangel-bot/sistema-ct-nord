// Gera o valor de ADMIN_SENHA_HASH para uma senha.
// Uso: npm run senha -- "sua senha aqui"
import { gerarHash } from '../api/_lib.js';

const senha = process.argv[2];
if (!senha || senha.length < 10) {
  console.error('Informe uma senha com pelo menos 10 caracteres: npm run senha -- "sua senha"');
  process.exit(1);
}
console.log(await gerarHash(senha));
