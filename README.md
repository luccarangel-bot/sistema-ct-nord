# CT NORD — Sistema de gestão

Site com login para a equipe do CT NORD: alunos e graduações, planos e contratos, financeiro, agenda e check-in, captação e ficha de matrícula online.

- `/` — sistema (pede e-mail e senha)
- `/ficha` — ficha de matrícula pública, para mandar aos alunos

## Como publicar no Vercel

1. **GitHub:** crie um repositório privado (por exemplo `ct-nord-sistema`) e envie todos os arquivos desta pasta. Pelo site do GitHub, use *Add file → Upload files* e arraste o conteúdo da pasta.
2. **Vercel:** em vercel.com, entre com a conta do GitHub, clique em *Add New → Project* e importe o repositório.
3. **Variáveis**, antes de clicar em *Deploy*, em *Environment Variables*:
   - `ADMIN_EMAIL`: e-mail do primeiro administrador
   - `ADMIN_NOME`: nome que aparece no sistema
   - `ADMIN_SENHA_HASH`: senha criptografada (veja abaixo)
4. **Banco de dados:** no projeto, abra *Storage → Create Database*, escolha *Neon* (Postgres), plano gratuito, e conecte ao projeto. Isso cria `DATABASE_URL`. As tabelas `ct_hash` e `ct_str` são criadas sozinhas no primeiro acesso.
5. **Publicar de novo:** em *Deployments*, abra o menu (⋯) da última publicação e clique em *Redeploy*.
6. Abra o endereço do site e entre com o e-mail e a senha do administrador.

No primeiro login, o sistema cria o administrador e carrega os planos, as turmas e os dados do CT.

## Senha do administrador

`ADMIN_SENHA_HASH` guarda a senha criptografada, nunca a senha em si. Para gerar outra (precisa de Node.js 20+):

```
npm run senha -- "sua senha com pelo menos 10 caracteres"
```

Depois do primeiro login, a senha passa a ficar no banco. Para trocá-la, use **Ajustes → Seu acesso** no sistema. Para dar acesso a outras pessoas, use **Ajustes → Equipe**.

## Teste local

```
ADMIN_EMAIL=voce@email.com ADMIN_SENHA_HASH='...' npm run local
```

Abre em http://localhost:3000 com um banco em memória. Nada é gravado.

## Estrutura

- `public/` — páginas (sistema e ficha)
- `api/` — rotas do servidor: login, dados, equipe e ficha
- `api/_lib.js` — banco (Postgres do Neon), senhas e sessão
- `api/_seed.js` — planos, turmas e dados do CT carregados no primeiro acesso
- `scripts/` — gerar senha e servidor de teste local
