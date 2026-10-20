import { expect, test, type Page } from '@playwright/test';

/** Fixa "hoje" no horário de Brasília para os testes serem previsíveis. */
async function openAt(page: Page, isoDateTime: string, hash = '#/') {
  await page.clock.setFixedTime(new Date(isoDateTime));
  await page.goto(`/${hash}`);
  await expect(page.getByText('Carregando seu painel…')).toHaveCount(0);
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

test.describe('Dados iniciais', () => {
  test('carrega as duas disciplinas e as oito atividades uma única vez', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/atividades?ver=todas');
    await expect(page.getByTestId('activity-item')).toHaveCount(8);

    await page.reload();
    await expect(page.getByTestId('activity-item')).toHaveCount(8);

    await page.goto('/#/disciplinas');
    await expect(page.getByTestId('discipline-card')).toHaveCount(2);
    await expect(page.getByText('Hidráulica e Pneumática').first()).toBeVisible();
    await expect(page.getByText('Segurança em Eletricidade').first()).toBeVisible();
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
    await openAt(page, DAY_ONE, '#/disciplinas/seed-hidraulica-pneumatica');
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
    await expect(done).toContainText('Hidráulica e Pneumática');
    await expect(done).toContainText('em 20/10/2026');
  });

  test('desfazer pelo aviso e reabrir pela lista de concluídas', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/atividades');
    await completeActivity(page, 'Avaliação online', 'Segurança em Eletricidade');
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByTestId('activity-item')).toHaveCount(8);

    await completeActivity(page, 'Avaliação online', 'Segurança em Eletricidade');
    await page.goto('/#/concluidas');
    await expect(page.getByTestId('activity-item')).toHaveCount(1);
    await activityRow(page, 'Avaliação online').getByRole('checkbox').click();
    await expect(page.getByTestId('activity-item')).toHaveCount(0);
    await expect(page.getByText('Nenhuma atividade concluída ainda')).toBeVisible();
  });

  test('progresso geral 6 de 16 = 38% (37,5%)', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/disciplinas/seed-hidraulica-pneumatica');
    // Mais 4 atividades em cada disciplina → 8 por disciplina, 16 no total.
    for (const disciplineId of ['seed-hidraulica-pneumatica', 'seed-seguranca-eletricidade']) {
      await page.goto(`/#/disciplinas/${disciplineId}`);
      for (let i = 1; i <= 4; i++) {
        await page.locator('.page-header').getByRole('button', { name: 'Nova atividade' }).click();
        await page.getByLabel('Nome da atividade').fill(`Extra ${i}`);
        await page.getByLabel('Data limite').fill('2026-12-01');
        await page.getByRole('button', { name: 'Cadastrar atividade' }).click();
      }
    }
    await page.goto('/#/disciplinas/seed-hidraulica-pneumatica');
    for (const title of ['Extra 1', 'Extra 2', 'Extra 3', 'Extra 4']) await completeActivity(page, title);
    await expect(page.getByTestId('discipline-detail-percent')).toHaveText('50%');

    await page.goto('/#/disciplinas/seed-seguranca-eletricidade');
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
    await dialog.getByLabel('Disciplina').selectOption({ label: 'Hidráulica e Pneumática' });
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
    await activityRow(page, 'Videoaulas e exercícios', 'Hidráulica').getByRole('button', { name: /Videoaulas/ }).first().click();
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
    await completeActivity(page, 'Exercício avaliativo online', 'Hidráulica e Pneumática');
    await expect(page.getByTestId('stat-atrasada')).toContainText('1');
    await page.goto('/#/atividades?ver=atrasadas');
    await expect(page.getByTestId('activity-item')).toHaveCount(1);
    await page.goto('/#/concluidas');
    await expect(activityRow(page, 'Exercício avaliativo online')).toContainText('Concluída');
    await expect(activityRow(page, 'Exercício avaliativo online')).not.toContainText('Atrasada');
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

    await page.getByLabel('Disciplina').selectOption({ label: 'Segurança em Eletricidade' });
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

  test('restaurar dados iniciais pede confirmação e substitui os dados', async ({ page }) => {
    await openAt(page, DAY_ONE, '#/atividades');
    await completeActivity(page, 'Recuperação online', 'Hidráulica');
    await page.getByRole('button', { name: 'Configurações' }).locator('visible=true').first().click();
    await page.getByRole('button', { name: 'Restaurar dados iniciais' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('serão substituídas');
    await confirm.getByRole('button', { name: 'Substituir e restaurar' }).click();

    await expect(page.getByTestId('overall-percent')).toHaveText('0%');
    await page.goto('/#/atividades?ver=todas');
    await expect(page.getByTestId('activity-item')).toHaveCount(8);
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
  await expect(page.getByRole('heading', { level: 1, name: 'Hidráulica e Pneumática' })).toBeVisible();
});
