import { expect, test, type Page } from '@playwright/test';
import { sampleStudyData } from '../src/test/fixtures';

const ANA = { name: 'Ana', email: 'ana@email.com', password: 'estudos2026' };
const BIA = { name: 'Bia', email: 'bia@email.com', password: 'aprender123' };
type TestUser = typeof ANA;

async function waitForPanel(page: Page) {
  await expect(page.locator('.content')).toBeVisible();
  await expect(page.getByText('Carregando seu painel…')).toHaveCount(0);
}

/** Pula a abertura animada que aparece logo depois de entrar. */
async function skipIntro(page: Page) {
  await page.getByRole('button', { name: 'Pular abertura' }).click();
  await expect(page.getByTestId('welcome-splash')).toHaveCount(0);
}

async function signUp(
  page: Page,
  user: TestUser = ANA,
  options: { remember?: boolean; watchIntro?: boolean } = {},
) {
  await page.getByRole('tab', { name: 'Criar acesso' }).click();
  await page.getByLabel(/^Nome de usuário/).fill(user.name);
  await page.getByLabel(/^E-mail/).fill(user.email);
  await page.getByLabel(/^Senha/).fill(user.password);
  await page.getByLabel(/^Confirme a senha/).fill(user.password);
  if (options.remember === false) await page.getByLabel('Manter conectado neste aparelho').uncheck();
  await page.getByRole('button', { name: 'Criar acesso e entrar' }).click();
  if (!options.watchIntro) await skipIntro(page);
  await waitForPanel(page);
}

/** Contas novas começam vazias; aqui a conta recebe as 8 atividades fictícias dos testes. */
async function loadSampleData(page: Page) {
  await page.evaluate((data) => {
    const raw = localStorage.getItem('evolua-estudos:sessao:v1') ?? sessionStorage.getItem('evolua-estudos:sessao:v1');
    const { userId } = JSON.parse(raw ?? '{}') as { userId: string };
    localStorage.setItem(`evolua-estudos:dados:v1:${userId}`, JSON.stringify(data));
  }, sampleStudyData());
  await page.reload();
  await waitForPanel(page);
}

async function logIn(page: Page, email: string, password: string) {
  await page.getByLabel(/^E-mail/).fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

async function logOut(page: Page) {
  const direct = page.getByRole('button', { name: 'Sair da conta' }).locator('visible=true');
  if ((await direct.count()) === 0) {
    await page.getByRole('button', { name: 'Configurações' }).locator('visible=true').first().click();
  }
  await page.getByRole('button', { name: 'Sair da conta' }).locator('visible=true').first().click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
}

/** Fixa "hoje" no horário de Brasília, cria uma conta com os dados de teste e abre a página pedida. */
async function openAt(page: Page, isoDateTime: string, hash = '#/') {
  await page.clock.setFixedTime(new Date(isoDateTime));
  await page.goto(`/${hash}`);
  await signUp(page);
  await loadSampleData(page);
}

const DAY_ONE = '2026-10-20T10:00:00-03:00';

function activityRow(page: Page, title: string, discipline?: string) {
  let rows = page.getByTestId('activity-item').filter({ hasText: title });
  if (discipline) rows = rows.filter({ hasText: discipline });
  return rows.first();
}

async function completeActivity(page: Page, title: string, discipline?: string) {
  // Clique (e não check()): a atividade concluída sai da lista de pendências na hora.
  await activityRow(page, title, discipline).getByRole('checkbox').click();
}

test.describe('Conta nova e dados salvos', () => {
  test('conta nova começa vazia e o guia leva até a primeira atividade', async ({ page }) => {
    await page.clock.setFixedTime(new Date(DAY_ONE));
    await page.goto('/');
    await signUp(page);

    const guide = page.getByTestId('getting-started');
    await expect(guide).toBeVisible();
    await expect(page.getByText('Você ainda não tem atividades cadastradas')).toBeVisible();
    await expect(page.getByTestId('stats')).toHaveCount(0);

    await guide.getByRole('button', { name: 'Criar minha primeira disciplina' }).click();
    await page.getByLabel(/^Nome da disciplina/).fill('Gestão de Pessoas');
    await page.getByRole('button', { name: 'Criar disciplina' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Gestão de Pessoas' })).toBeVisible();

    await page.goto('/#/');
    await expect(guide.getByText('Crie suas disciplinas')).toBeVisible();
    await guide.getByRole('button', { name: 'Cadastrar primeira atividade' }).click();
    await page.getByLabel('Nome da atividade').fill('Estudo de caso');
    await page.getByLabel('Data limite').fill('2026-10-30');
    await page.getByRole('button', { name: 'Cadastrar atividade' }).click();

    await expect(page.getByTestId('getting-started')).toHaveCount(0);
    await expect(page.getByTestId('stat-brand')).toContainText('1');
    await expect(page.getByText('Você tem 1 atividade a ser feita')).toBeVisible();
    await expect(activityRow(page, 'Estudo de caso')).toContainText('Vence em 10 dias');
  });

  test('os dados ficam salvos ao recarregar, sem duplicar', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/atividades?ver=todas');
    await expect(page.getByTestId('activity-item')).toHaveCount(8);

    await page.reload();
    await expect(page.getByTestId('activity-item')).toHaveCount(8);

    await page.goto('/#/disciplinas');
    await expect(page.getByTestId('discipline-card')).toHaveCount(2);
    await expect(page.getByText('Matemática Aplicada').first()).toBeVisible();
    await expect(page.getByText('Física Geral').first()).toBeVisible();
  });

  test('mostra o resumo do dia e a contagem regressiva', async ({ page }) => {
    await openAt(page, DAY_ONE);
    await expect(page.getByText('Terça-feira, 20 de outubro de 2026')).toBeVisible();
    await expect(page.getByTestId('stat-brand')).toContainText('8');
    await expect(page.getByTestId('stat-atrasada')).toContainText('0');
    await expect(page.getByTestId('overall-percent')).toHaveText('0%');
    await expect(activityRow(page, 'Exercício avaliativo online')).toContainText('Vence em 20 dias');
    await expect(activityRow(page, 'Exercício avaliativo online')).toContainText('Ainda não iniciada');
  });
});

test.describe('Conclusão e progresso', () => {
  test('concluir atualiza percentuais, listas e permanece após recarregar', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/disciplinas/teste-matematica');
    await completeActivity(page, 'Videoaulas e exercícios');

    await expect(page.getByRole('status').filter({ hasText: 'concluída!' })).toBeVisible();
    await expect(page.getByTestId('discipline-detail-percent')).toHaveText('25%');
    // Sai das pendências da disciplina
    await expect(page.getByTestId('activity-item')).toHaveCount(3);

    await page.goto('/#/');
    await expect(page.getByTestId('overall-percent')).toHaveText('13%'); // 1 de 8 = 12,5%
    await expect(page.getByTestId('overall-caption')).toContainText('1 de 8 atividades concluídas (12,5%)');
    await expect(page.getByTestId('stat-concluida')).toContainText('1');
    await expect(page.getByTestId('stat-brand')).toContainText('7');

    await page.reload();
    await expect(page.getByTestId('overall-percent')).toHaveText('13%');

    await page.goto('/#/concluidas');
    const done = activityRow(page, 'Videoaulas e exercícios');
    await expect(done).toContainText('Matemática Aplicada');
    await expect(done).toContainText('em 20/10/2026');
  });

  test('desfazer pelo aviso e reabrir pela lista de concluídas', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/atividades');
    await completeActivity(page, 'Avaliação online', 'Física Geral');
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByTestId('activity-item')).toHaveCount(8);

    await completeActivity(page, 'Avaliação online', 'Física Geral');
    await page.goto('/#/concluidas');
    await expect(page.getByTestId('activity-item')).toHaveCount(1);
    await activityRow(page, 'Avaliação online').getByRole('checkbox').click();
    await expect(page.getByTestId('activity-item')).toHaveCount(0);
    await expect(page.getByText('Nenhuma atividade concluída ainda')).toBeVisible();
  });

  test('progresso geral 6 de 16 = 38% (37,5%)', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/disciplinas/teste-matematica');
    // Mais 4 atividades em cada disciplina → 8 por disciplina, 16 no total.
    for (const disciplineId of ['teste-matematica', 'teste-fisica']) {
      await page.goto(`/#/disciplinas/${disciplineId}`);
      for (let i = 1; i <= 4; i++) {
        await page.locator('.page-header').getByRole('button', { name: 'Nova atividade' }).click();
        await page.getByLabel('Nome da atividade').fill(`Extra ${i}`);
        await page.getByLabel('Data limite').fill('2026-12-01');
        await page.getByRole('button', { name: 'Cadastrar atividade' }).click();
      }
    }
    await page.goto('/#/disciplinas/teste-matematica');
    for (const title of ['Extra 1', 'Extra 2', 'Extra 3', 'Extra 4']) await completeActivity(page, title);
    await expect(page.getByTestId('discipline-detail-percent')).toHaveText('50%');

    await page.goto('/#/disciplinas/teste-fisica');
    for (const title of ['Extra 1', 'Extra 2']) await completeActivity(page, title);
    await expect(page.getByTestId('discipline-detail-percent')).toHaveText('25%');

    await page.goto('/#/');
    await expect(page.getByTestId('overall-percent')).toHaveText('38%');
    await expect(page.getByTestId('overall-caption')).toContainText('6 de 16 atividades concluídas (37,5%)');
  });
});

test.describe('Cadastro, edição e exclusão de atividades', () => {
  test('cria, edita e exclui uma atividade com tipo livre', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/atividades?ver=todas');

    await page.getByRole('button', { name: 'Nova atividade' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Cadastrar atividade' }).click();
    await expect(dialog.getByText('Informe o nome da atividade.')).toBeVisible();

    await dialog.getByLabel('Nome da atividade').fill('Seminário de válvulas');
    await dialog.getByLabel('Disciplina').selectOption({ label: 'Matemática Aplicada' });
    await dialog.getByLabel('Tipo de atividade').selectOption('outro');
    await dialog.getByLabel('Qual é o tipo?').fill('Seminário');
    await dialog.getByLabel('Data de início').fill('2026-10-20');
    await dialog.getByLabel('Data limite').fill('2026-10-10');
    await dialog.getByRole('button', { name: 'Cadastrar atividade' }).click();
    await expect(dialog.getByText('A data limite não pode ser anterior à data de início.')).toBeVisible();

    await dialog.getByLabel('Data limite').fill('2026-10-22');
    await dialog.getByRole('button', { name: 'Cadastrar atividade' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const row = activityRow(page, 'Seminário de válvulas');
    await expect(row).toContainText('Seminário');
    await expect(row).toContainText('Faltam 2 dias');
    await expect(row).toContainText('Urgente');
    await expect(page.getByTestId('activity-item')).toHaveCount(9);

    // Editar
    await row.getByRole('button', { name: /Ações de/ }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    await page.getByLabel('Nome da atividade').fill('Seminário de válvulas (revisado)');
    await page.getByLabel('Data limite').fill('2026-10-24');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    const edited = activityRow(page, 'Seminário de válvulas (revisado)');
    await expect(edited).toContainText('Faltam 4 dias');
    await expect(edited).toContainText('Atenção');

    // Excluir (cancelar primeiro, depois confirmar)
    await edited.getByRole('button', { name: /Ações de/ }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('activity-item')).toHaveCount(9);

    await edited.getByRole('button', { name: /Ações de/ }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir atividade' }).click();
    await expect(page.getByTestId('activity-item')).toHaveCount(8);
  });

  test('status "em andamento" pelos detalhes da atividade', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/atividades');
    await activityRow(page, 'Videoaulas e exercícios', 'Matemática').getByRole('button', { name: /Videoaulas/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Em andamento', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Fechar' }).click();

    await page.getByRole('tab', { name: /Em andamento/ }).click();
    await expect(page.getByTestId('activity-item')).toHaveCount(1);
    await expect(activityRow(page, 'Videoaulas e exercícios')).toContainText('Em andamento');
  });
});

test.describe('Prazos vencidos', () => {
  test('atividades vencidas ficam vermelhas e aparecem em destaque', async ({ page }) => {
    // 12/11/2026: exercícios avaliativos (prazo 09/11) estão atrasados há 3 dias.
    await openAt(page, '2026-11-12T09:00:00-03:00');
    await expect(page.getByTestId('stat-atrasada')).toContainText('2');
    await expect(page.getByTestId('stat-urgente')).toContainText('4'); // vencem em 3 dias (15/11)

    const attention = page.getByRole('list', { name: 'Precisa da minha atenção' });
    const late = attention.getByTestId('activity-item').first();
    await expect(late).toContainText('Exercício avaliativo online');
    await expect(late).toContainText('Atrasada há 3 dias');
    await expect(late).toHaveClass(/activity-item--atrasada/);

    // Concluída nunca aparece como atrasada.
    await completeActivity(page, 'Exercício avaliativo online', 'Matemática Aplicada');
    await expect(page.getByTestId('stat-atrasada')).toContainText('1');
    await page.goto('/#/atividades?ver=atrasadas');
    await expect(page.getByTestId('activity-item')).toHaveCount(1);
    await page.goto('/#/concluidas');
    await expect(activityRow(page, 'Exercício avaliativo online')).toContainText('Concluída');
    await expect(activityRow(page, 'Exercício avaliativo online')).not.toContainText('Atrasada');
  });

  test('sino de avisos lista atrasadas e prazos próximos', async ({ page }) => {
    await openAt(page, '2026-11-12T09:00:00-03:00');
    const bell = page.getByRole('button', { name: 'Avisos de prazo (6)' });
    await bell.click();
    const panel = page.getByRole('dialog', { name: 'Avisos de prazo' });
    await expect(panel.getByRole('listitem')).toHaveCount(6);
    await expect(panel.getByRole('listitem').first()).toContainText('Atrasada há 3 dias');

    await panel.getByRole('button', { name: /Exercício avaliativo online/ }).first().click();
    await expect(page.getByRole('dialog', { name: 'Exercício avaliativo online' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Concluir' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Avisos de prazo (5)' })).toBeVisible();
  });

  test('vence hoje e virada do dia sem editar nada', async ({ page }) => {
    await openAt(page, '2026-11-09T08:00:00-03:00', '#/atividades?ver=prazo_proximo');
    await expect(activityRow(page, 'Exercício avaliativo online')).toContainText('Vence hoje');
    await expect(activityRow(page, 'Exercício avaliativo online')).toContainText('Urgente');

    // Um dia depois, ao abrir/atualizar o sistema, a urgência muda sozinha.
    await page.clock.setFixedTime(new Date('2026-11-10T08:00:00-03:00'));
    await page.reload();
    await page.goto('/#/atividades?ver=atrasadas');
    await expect(activityRow(page, 'Exercício avaliativo online')).toContainText('Atrasada há 1 dia');
  });
});

test.describe('Filtros e busca', () => {
  test('filtra por disciplina, tipo, período e nome', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/atividades');
    await expect(page.getByTestId('activity-item')).toHaveCount(8);

    await page.getByLabel('Disciplina').selectOption({ label: 'Física Geral' });
    await expect(page.getByTestId('activity-item')).toHaveCount(4);

    await page.getByLabel('Tipo').selectOption({ label: 'Recuperação' });
    await expect(page.getByTestId('activity-item')).toHaveCount(1);
    await expect(activityRow(page, 'Recuperação online')).toBeVisible();

    await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
    await expect(page.getByTestId('activity-item')).toHaveCount(8);

    await page.getByLabel('Período do prazo').selectOption({ label: 'Próximos 30 dias' });
    await expect(page.getByTestId('activity-item')).toHaveCount(6); // 09/11 e 15/11

    await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
    await page.getByRole('searchbox', { name: 'Buscar atividade pelo nome' }).locator('visible=true').fill('avaliacao');
    await expect(page.getByTestId('activity-item')).toHaveCount(2);
  });
});

test.describe('Calendário', () => {
  test('mostra prazos do dia e abre os detalhes', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/calendario');
    await expect(page.getByRole('heading', { name: 'Outubro de 2026', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(page.getByRole('heading', { name: 'Novembro de 2026', exact: true })).toBeVisible();

    await page.locator('[data-date="2026-11-15"]').click();
    const panel = page.getByTestId('day-panel');
    await expect(panel).toContainText('Domingo, 15 de novembro de 2026');
    await expect(panel.getByRole('listitem')).toHaveCount(4);

    await panel.getByRole('button', { name: /Avaliação online/ }).first().click();
    await expect(page.getByRole('dialog', { name: 'Avaliação online' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Concluir' }).click();
    await page.keyboard.press('Escape');
    await expect(panel.locator('.badge--concluida')).toHaveCount(1);

    await page.getByRole('button', { name: 'Hoje' }).click();
    await expect(page.getByRole('heading', { name: 'Outubro de 2026', exact: true })).toBeVisible();
  });
});

test.describe('Disciplinas', () => {
  test('cria, edita e exclui disciplina com confirmação', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/disciplinas');
    await page.getByRole('button', { name: 'Nova disciplina' }).click();
    await page.getByLabel('Nome da disciplina').fill('Eletrônica Digital');
    await page.getByLabel('Período letivo ou módulo').fill('Módulo 3');
    await page.getByRole('button', { name: 'Criar disciplina' }).click();

    await expect(page.getByRole('heading', { name: 'Eletrônica Digital' })).toBeVisible();
    await expect(page.getByTestId('discipline-detail-percent')).toHaveText('0%');
    await expect(page.getByText('Nenhuma atividade nesta disciplina')).toBeVisible();

    await page.getByRole('button', { name: 'Cadastrar primeira atividade' }).click();
    await page.getByLabel('Nome da atividade').fill('Lista 1');
    await page.getByLabel('Data limite').fill('2026-11-05');
    await page.getByRole('button', { name: 'Cadastrar atividade' }).click();
    await expect(page.getByTestId('activity-item')).toHaveCount(1);

    await page.getByRole('button', { name: 'Editar disciplina' }).click();
    await page.getByLabel('Nome da disciplina').fill('Eletrônica Digital I');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('heading', { name: 'Eletrônica Digital I' })).toBeVisible();

    await page.getByRole('button', { name: 'Excluir disciplina' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('A atividade vinculada a ela também será apagada.');
    await confirm.getByRole('button', { name: 'Excluir disciplina' }).click();

    await expect(page).toHaveURL(/#\/disciplinas$/);
    await expect(page.getByTestId('discipline-card')).toHaveCount(2);
    await page.goto('/#/atividades?ver=todas');
    await expect(page.getByTestId('activity-item')).toHaveCount(8);
  });

  test('apagar todos os dados pede confirmação e deixa o painel vazio', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/atividades');
    await page.getByRole('button', { name: 'Configurações' }).locator('visible=true').first().click();
    await page.getByRole('button', { name: 'Apagar todos os dados' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('8 atividades');
    await confirm.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeVisible();

    await page.getByRole('button', { name: 'Apagar todos os dados' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Apagar tudo' }).click();

    await expect(page.getByTestId('getting-started')).toBeVisible();
    await page.reload();
    await waitForPanel(page);
    await expect(page.getByTestId('getting-started')).toBeVisible();
    await page.goto('/#/atividades?ver=todas');
    await expect(page.getByTestId('activity-item')).toHaveCount(0);
  });
});

test('navegação principal funciona em todas as páginas', async ({ page }) => {
  await openAt(page, DAY_ONE);
  const nav = page.getByRole('navigation').locator('visible=true').first();
  for (const [label, heading] of [
    [/^(Minhas disciplinas|Disciplinas)$/, 'Minhas disciplinas'],
    [/^(Todas as atividades|Atividades)$/, 'Todas as atividades'],
    [/^Calendário$/, 'Calendário'],
    [/concluídas$/i, 'Atividades concluídas'],
  ] as const) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }

  await page.goto('/#/');
  await page.getByTestId('discipline-card').first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Matemática Aplicada' })).toBeVisible();
});

test.describe('Acesso', () => {
  test('tela de acesso com a marca, validação do cadastro e saudação com o nome de usuário', async ({ page }) => {
    await page.clock.setFixedTime(new Date(DAY_ONE));
    await page.goto('/');
    await expect(page.getByText('Evolua Meus Estudos').locator('visible=true').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
    // Sem Client ID do Google configurado, o botão do Google não aparece.
    await expect(page.getByText('ou com e-mail')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Criar acesso' }).click();
    await page.getByLabel(/^E-mail/).fill('ana@email');
    await page.getByLabel(/^Senha/).fill('abc');
    await page.getByLabel(/^Confirme a senha/).fill('abcd');
    await page.getByRole('button', { name: 'Criar acesso e entrar' }).click();
    await expect(page.getByText('Informe como você quer ser chamado(a).')).toBeVisible();
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
    await expect(page.getByText('Mínimo de 8 caracteres, com letras e números.')).toBeVisible();
    await expect(page.getByText('As senhas não conferem.')).toBeVisible();

    await page.getByRole('tab', { name: 'Entrar' }).click();
    await signUp(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Bom dia, Ana!' })).toBeVisible();
    await expect(page.getByText('Você ainda não tem atividades cadastradas')).toBeVisible();
  });

  test('abertura animada com a Evolua ao entrar, uma vez por visita', async ({ page }) => {
    await page.clock.setFixedTime(new Date(DAY_ONE));
    await page.goto('/');
    await signUp(page, ANA, { watchIntro: true });

    const splash = page.getByTestId('welcome-splash');
    await expect(splash).toBeVisible();
    await expect(splash.getByRole('img', { name: 'Evolua Meu Negócio' })).toBeVisible();
    await expect(splash.getByText('Evolua Meus Estudos')).toBeVisible();
    await expect(splash.getByText('Que bom ter você aqui, Ana!')).toBeVisible();
    // Termina sozinha e revela o painel.
    await expect(splash).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Bom dia, Ana!' })).toBeVisible();

    // Recarregar não repete a abertura; sair e entrar de novo, sim.
    await page.reload();
    await waitForPanel(page);
    await expect(splash).toHaveCount(0);
    await logOut(page);
    await logIn(page, ANA.email, ANA.password);
    await expect(splash).toBeVisible();
    await skipIntro(page);
  });

  test('sair, senha errada, entrar de novo e manter os dados', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/atividades');
    await completeActivity(page, 'Videoaulas e exercícios', 'Matemática');
    await logOut(page);

    await logIn(page, ANA.email, 'senhaErrada1');
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();

    await logIn(page, ANA.email, ANA.password);
    await skipIntro(page);
    await waitForPanel(page);
    await expect(page.getByTestId('overall-percent')).toHaveText('13%');
    await expect(page.getByText('Você tem 7 atividades a serem feitas')).toBeVisible();

    // Recarregar não pede login de novo ("manter conectado")
    await page.reload();
    await waitForPanel(page);
    await expect(page.getByTestId('overall-percent')).toHaveText('13%');
  });

  test('cada conta tem os próprios dados e o nome de usuário pode ser alterado', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/atividades');
    await completeActivity(page, 'Videoaulas e exercícios', 'Matemática');
    await logOut(page);

    await signUp(page, BIA);
    await expect(page.getByTestId('getting-started')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Bom dia, Bia!' })).toBeVisible();

    await page.getByRole('button', { name: 'Configurações' }).locator('visible=true').first().click();
    await page.getByLabel('Nome de usuário').fill('Bia Lima');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Bom dia, Bia Lima!' })).toBeVisible();
    await logOut(page);

    await page.getByRole('tab', { name: 'Criar acesso' }).click();
    await page.getByLabel(/^Nome de usuário/).fill('Outra');
    await page.getByLabel(/^E-mail/).fill(ANA.email);
    await page.getByLabel(/^Senha/).fill('qualquer123');
    await page.getByLabel(/^Confirme a senha/).fill('qualquer123');
    await page.getByRole('button', { name: 'Criar acesso e entrar' }).click();
    await expect(page.getByText('Já existe uma conta com este e-mail neste aparelho.')).toBeVisible();

    await page.getByRole('tab', { name: 'Entrar' }).click();
    await logIn(page, ANA.email, ANA.password);
    await skipIntro(page);
    await waitForPanel(page);
    await expect(page.getByTestId('overall-percent')).toHaveText('13%');
  });

  test('esqueci minha senha explica como voltar a acessar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Esqueci minha senha' })).toBeVisible();
    await expect(page.getByText('ainda não é possível enviar um e-mail')).toBeVisible();
    await page.getByRole('button', { name: 'Voltar para entrar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  });

  test('sem "manter conectado", uma nova aba pede login', async ({ page, context }) => {
    await page.clock.setFixedTime(new Date(DAY_ONE));
    await page.goto('/');
    await signUp(page, ANA, { remember: false });

    const other = await context.newPage();
    await other.goto('/');
    await expect(other.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  });
});
