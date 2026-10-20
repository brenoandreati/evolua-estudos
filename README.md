# Evolua Meus Estudos

Painel de estudos para várias pessoas: cada uma cria a própria conta, organiza disciplinas, acompanha prazos,
conclui atividades e vê o progresso do curso — de qualquer aparelho. Ao abrir, a pessoa vê na hora o que
precisa fazer hoje, o que está perto de vencer, o que está atrasado e quanto do curso já concluiu.

Publicado em **https://evolua-meus-estudos.pages.dev**.

## Como funciona

| Parte | Tecnologia |
| --- | --- |
| Site | React + TypeScript + Vite, publicado na **Cloudflare Pages** |
| Servidor | **Pages Functions** (pasta `functions/` e código comum em `server/`) |
| Banco de dados | **Cloudflare D1** (`evolua-meus-estudos`), tabelas em `migrations/` |

- Contas com **nome de usuário, e-mail e senha**, ou **Continuar com o Google** (quando ativado).
- A sessão fica num cookie `HttpOnly` e `Secure`; no banco fica só o hash do token.
- A senha nunca sai do aparelho em texto puro: o site aplica PBKDF2-SHA-256 (200 mil iterações) e o servidor
  aplica mais uma camada PBKDF2 com sal aleatório antes de guardar.
- Depois de 8 senhas erradas em 15 minutos, o e-mail fica bloqueado por 15 minutos.
- Cada conta tem os próprios dados. Cada gravação informa a versão que o aparelho conhecia: se outro aparelho
  salvou antes, o servidor recusa e o painel mostra a versão mais nova, sem apagar nada.
- Alterações de dados só são aceitas vindas do próprio site (origem conferida e corpo JSON).

## Como rodar

Requer Node.js 20 ou mais recente.

```bash
npm install
npm run dev:api    # servidor local da Cloudflare (site + funções + banco D1 local) em http://127.0.0.1:8788
npm run dev        # em outro terminal: site com recarga automática em http://localhost:5173
```

O `npm run dev` encaminha as chamadas `/api` para o servidor local. O banco local fica em `.wrangler/local`.

### Publicação

```bash
export CLOUDFLARE_API_TOKEN=...   # token com permissão de editar Pages e D1
npm run db:migrate                # aplica migrações novas no banco de produção (quando houver)
npm run deploy                    # gera o site e publica site + funções
```

A configuração (projeto, banco D1) fica em `wrangler.toml`. O arquivo `public/_headers` define o cache dos
arquivos gerados e cabeçalhos básicos de segurança.

## Acesso

Ao abrir o painel, aparece a tela de acesso com a marca Evolua. Na primeira vez, a pessoa clica em
**Criar acesso** e escolhe:

- **Continuar com o Google** (quando ativado, veja abaixo): a conta é criada com o nome e o e-mail do Google; ou
- **E-mail e senha**: informa o **nome de usuário** (como a plataforma vai chamá-la), o e-mail e uma senha
  (mínimo de 8 caracteres, com letras e números).

Ao entrar, uma **abertura animada** apresenta a marca: as barras do “E” da Evolua Meu Negócio crescem, o nome
se revela e o painel Evolua Meus Estudos dá as boas-vindas pelo nome. Ela aparece uma vez por visita (recarregar
a página não repete) e pode ser pulada com o botão **Pular**, clicando na tela ou com Esc/Enter. Para quem
prefere menos movimento no sistema, a abertura é reduzida a um esmaecer rápido.

Depois disso, a Visão geral cumprimenta pelo nome: *“Bom dia, Maria! Você tem 8 atividades a serem feitas…”*.
O nome de usuário pode ser alterado em **Configurações**.

**Toda conta começa vazia.** Enquanto não há atividades, a Visão geral mostra o guia **“Vamos montar seu
painel”**: criar as disciplinas, cadastrar as atividades e acompanhar o progresso.

- **Manter conectado neste aparelho:** marcado, o acesso continua ao fechar o navegador; desmarcado, vale
  só até fechar a aba.
- **Sair da conta:** no rodapé do menu lateral (computador) e em Configurações (celular).
- Cada conta tem os próprios dados. Se alguém já usava o painel antes do acesso existir, a primeira conta
  criada no aparelho fica com esses dados.

### Ativar o “Continuar com o Google”

O botão só aparece quando o servidor tem um **Client ID** do Google configurado — não precisa gerar o site
de novo:

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie (ou escolha) um projeto.
2. Em **APIs e serviços › Tela de consentimento OAuth**, configure o app como **Externo**, com o nome
   “Evolua Meus Estudos”, e-mail de suporte e logo. Publique o app (status **Em produção**).
3. Em **APIs e serviços › Credenciais › Criar credenciais › ID do cliente OAuth**, escolha
   **Aplicativo da Web** e, em **Origens JavaScript autorizadas**, adicione
   `https://evolua-meus-estudos.pages.dev` (e `http://localhost:5173` para testes locais).
4. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`).
5. Na Cloudflare: **Workers e Pages › evolua-meus-estudos › Configurações › Variáveis e segredos**, crie a
   variável `GOOGLE_CLIENT_ID` com esse valor (ambiente **Produção**) e publique de novo (`npm run deploy`).

A pessoa **não precisa** ter conta Google: o Google é só uma segunda forma de entrar. Se alguém criou a conta
com e-mail e senha usando um Gmail e depois clica em “Continuar com o Google” com o mesmo Gmail, entra na mesma
conta, com os mesmos dados.

### Limites desta versão

- **Redefinição de senha por e-mail:** ainda não existe. Para enviar e-mails é preciso um domínio próprio
  (ex.: `evoluameusestudos.com.br`) e um serviço de envio (ex.: Resend). Quem usa Gmail pode entrar pelo
  botão do Google.
- **Confirmação de e-mail no cadastro:** ainda não existe; depende do mesmo envio de e-mails. Até lá, alguém
  poderia criar uma conta com o e-mail de outra pessoa. Antes de divulgar amplamente, vale ativar a
  confirmação de e-mail.

## O que o sistema faz

| Página | Para que serve |
| --- | --- |
| **Visão geral** | Saudação, data, resumo, contadores (pendentes, atrasadas, prazo próximo, concluídas), “Meu progresso”, “Precisa da minha atenção”, “Próximas atividades” e os cards das disciplinas. |
| **Minhas disciplinas** | Cards com progresso, pendentes, concluídas e próximo prazo. Clique para abrir a página da disciplina, com todas as atividades dela. |
| **Todas as atividades** | Abas Pendentes, Em andamento, Atrasadas, Prazo próximo, Concluídas e Todas; filtros por disciplina, tipo e período; busca pelo nome. |
| **Calendário** | Visão mensal com prazos e datas de início, nas cores de urgência. Clique em um dia para ver as atividades e abrir os detalhes. |
| **Atividades concluídas** | Histórico com disciplina e data de conclusão. Desmarque para reabrir uma atividade. |

No topo de todas as páginas, o **sino de avisos** mostra quantas atividades estão atrasadas ou vencem em até
5 dias, com a lista e acesso direto aos detalhes de cada uma.

Também é possível criar, editar e excluir disciplinas e atividades (sempre com confirmação antes de excluir),
marcar uma atividade como “em andamento”, desfazer uma conclusão pelo aviso que aparece na tela e, em
**Configurações**, apagar todos os dados para começar do zero.

### Cores de urgência

Calculadas automaticamente a partir da data de hoje e da data limite:

| Cor | Situação | Regra |
| --- | --- | --- |
| 🔴 Vermelho | Atrasada | A data limite já passou e a atividade não foi concluída |
| 🟠 Laranja | Urgente | Faltam de 0 a 2 dias |
| 🟡 Amarelo | Atenção | Faltam de 3 a 5 dias |
| 🔵 Azul | No prazo | Faltam mais de 5 dias |
| 🟢 Verde | Concluída | Atividade finalizada, independentemente do prazo |

O azul aparece como **“No prazo”** para não confundir com o status **“Em andamento”**, que é marcado por você
quando começa uma atividade.

### Datas

- “Hoje” é sempre a data no **horário de Brasília** (`America/Sao_Paulo`), seja qual for o fuso do aparelho.
- As datas são guardadas sem horário (`AAAA-MM-DD`), então não há erro de fuso ao comparar prazos.
- A contagem (“Vence hoje”, “Faltam 2 dias”, “Vence em 12 dias”, “Atrasada há 3 dias”) e as cores se
  atualizam sozinhas na virada do dia, ao abrir ou atualizar a página, sem precisar editar nada.
- Atividades com data de início no futuro aparecem como “Ainda não iniciada”.

### Progresso

- **Disciplina:** atividades concluídas ÷ total de atividades da disciplina × 100.
- **Curso:** total de concluídas ÷ total de atividades de todas as disciplinas × 100.
- A tela mostra o percentual arredondado (ex.: 38%), mas o cálculo é exato (37,5%, exibido ao lado do total).
- Atividades excluídas não entram no cálculo. Sem atividades, o progresso é 0%.

## Onde ficam os dados

Tudo fica no banco D1 da Cloudflare, separado por conta, e é salvo automaticamente a cada alteração. Ao voltar
para a aba, o painel busca alterações feitas em outro aparelho. Sem internet, o painel avisa que as últimas
alterações ainda não foram salvas e as envia quando a conexão volta.

Cada conta começa sem nenhuma disciplina ou atividade. Quem usou a primeira versão (dados só no navegador)
tem esses dados levados para a nuvem automaticamente ao entrar com o mesmo e-mail.

Em **Configurações**, a pessoa pode **apagar todos os dados** (a conta continua) ou **excluir a conta**
(apaga tudo, permanentemente).

## Estrutura do código

```
src/
├── api/           Cliente HTTP usado para falar com o servidor
├── auth/          Acesso: cadastro, entrada com e-mail/senha ou Google e tela de acesso
├── domain/        Regras puras: tipos, datas, urgência, filtros e progresso
├── data/          Persistência (interface StudyRepository + implementação no servidor)
├── state/         Estado da aplicação (reducer), ações com confirmação/avisos e janelas
├── components/    Componentes reutilizáveis (atividades, disciplinas, layout, interface)
├── pages/         Uma tela por item do menu
├── hooks/         Relógio (data de hoje)
└── styles/        Tokens de design e estilos
functions/api/     Rotas do servidor (Cloudflare Pages Functions)
server/            Código comum do servidor: contas, sessões, senhas, Google
migrations/        Tabelas do banco D1
e2e/               Testes de ponta a ponta no navegador
```

## Testes

```bash
npm test           # testes unitários (datas, urgência, progresso, filtros, dados, servidor, acesso)
npm run test:e2e   # testes no navegador, em tela de computador e de celular, com o servidor local da Cloudflare
```

Os testes de ponta a ponta sobem o site com as funções do servidor e um banco D1 local recriado do zero. Eles
simulam datas diferentes para conferir prazos vencidos e a virada do dia, e cobrem cadastro, edição, exclusão,
conclusão e reabertura de atividades, porcentagens, filtros, calendário e o acesso (cadastro, senha errada,
contas separadas, “manter conectado”, sair em outra aba, excluir conta). Também simulam dois aparelhos na
mesma conta e a migração dos dados que estavam só no navegador. A conferência do login com Google (assinatura,
destinatário, validade) é coberta por testes unitários. Na primeira execução local, instale o navegador do
Playwright com `npx playwright install chromium`.
