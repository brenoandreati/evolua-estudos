# Evolua Meus Estudos

Painel pessoal para organizar disciplinas, acompanhar prazos, concluir atividades e ver o progresso do curso.
Ao abrir, você vê na hora o que precisa fazer hoje, o que está perto de vencer, o que está atrasado e quanto
do curso já foi concluído.

## Como rodar

Requer Node.js 20 ou mais recente.

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

Para gerar a versão de produção:

```bash
npm run build      # gera a pasta dist/
npm run preview    # serve a pasta dist/ localmente
```

A pasta `dist/` pode ser publicada em qualquer hospedagem de site estático (GitHub Pages, Netlify, Vercel…),
inclusive em subpastas: os caminhos são relativos e a navegação usa `#/` no endereço, então não é preciso
configurar o servidor.

## Acesso

Ao abrir o painel, aparece a tela de acesso com a marca Evolua. Na primeira vez, a pessoa clica em
**Criar acesso** e informa e-mail, CPF (validado pelos dígitos verificadores) e uma senha (mínimo de 8
caracteres, com letras e números). Depois, entra com **e-mail ou CPF** e a senha.

- **Manter conectado neste aparelho:** marcado, o acesso continua ao fechar o navegador; desmarcado, vale
  só até fechar a aba.
- **Esqueci minha senha:** cria uma nova senha conferindo o e-mail e o CPF cadastrados.
- **Sair da conta:** fica no rodapé do menu lateral (computador) e em Configurações (celular).
- Cada conta tem os próprios dados. Se alguém já usava o painel antes do acesso existir, a primeira conta
  criada no aparelho fica com esses dados.

**Como funciona por baixo:** as contas ficam guardadas neste navegador. A senha e o CPF são salvos apenas
como *hash* PBKDF2-SHA-256 com sal aleatório, nunca em texto puro. Isso organiza o acesso de quem usa o
mesmo aparelho, mas **não é um controle de acesso pela internet**: qualquer pessoa pode criar uma conta no
próprio navegador, e quem tem conhecimento técnico consegue contornar a tela. Para liberar o acesso só a
pessoas autorizadas, e para entrar de qualquer aparelho, é preciso um servidor (veja abaixo).

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
marcar uma atividade como “em andamento”, desfazer uma conclusão pelo aviso que aparece na tela e restaurar
os dados iniciais em **Configurações**.

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

Nesta versão, tudo é salvo automaticamente no **armazenamento local do navegador** (`localStorage`), separado
por conta. Os dados continuam lá ao fechar ou atualizar a página, mas **ficam só naquele navegador, naquele
aparelho**: não aparecem no celular se você usou no computador, e são apagados se você limpar os dados de
navegação. Não há servidor nem banco de dados.

Os dados iniciais (duas disciplinas com quatro atividades cada) são gravados uma única vez para cada conta e
nunca são duplicados. O botão **Restaurar dados iniciais**, em Configurações, volta a esse estado depois de pedir
confirmação.

### Preparado para servidor e banco de dados

- **Dados de estudo:** toda leitura e gravação passa pela interface `StudyRepository`
  (`src/data/repository.ts`). Para guardar em um servidor, crie outra implementação e troque-a em
  `src/data/index.ts`.
- **Acesso:** cadastro, entrada, saída e redefinição de senha passam pela interface `AuthService`
  (`src/auth/types.ts`). Para contas na internet (por exemplo, com Supabase ou Firebase), crie outra
  implementação e troque-a em `src/auth/index.ts`.

Telas e regras de negócio não precisam mudar.

## Estrutura do código

```
src/
├── auth/          Acesso: cadastro, entrada, CPF, senha protegida e tela de acesso
├── domain/        Regras puras: tipos, datas, urgência, filtros, progresso, dados iniciais
├── data/          Persistência (interface StudyRepository + implementação localStorage)
├── state/         Estado da aplicação (reducer), ações com confirmação/avisos e janelas
├── components/    Componentes reutilizáveis (atividades, disciplinas, layout, interface)
├── pages/         Uma tela por item do menu
├── hooks/         Relógio (data de hoje)
└── styles/        Tokens de design e estilos
e2e/               Testes de ponta a ponta no navegador
```

## Testes

```bash
npm test           # testes unitários (datas, urgência, progresso, filtros, persistência, acesso)
npm run test:e2e   # testes no navegador, em tela de computador e de celular
```

Os testes de ponta a ponta simulam datas diferentes para conferir prazos vencidos e a virada do dia, e cobrem
cadastro, edição, exclusão, conclusão e reabertura de atividades, cálculo de porcentagens, filtros, calendário,
persistência e o acesso (cadastro, entrada por e-mail ou CPF, senha errada, contas separadas e redefinição
de senha). Na primeira execução local, instale o navegador do Playwright com
`npx playwright install chromium`.
