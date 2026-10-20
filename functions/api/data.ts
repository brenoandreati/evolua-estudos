import { parseStudyData } from '../../src/data/schema';
import { requireUser } from '../../server/accounts';
import type { Env } from '../../server/env';
import { HttpError, json, readJson } from '../../server/http';

interface DataRow {
  data: string;
  version: number;
}

async function currentData(db: D1Database, userId: string) {
  const row = await db.prepare('SELECT data, version FROM study_data WHERE user_id = ?').bind(userId).first<DataRow>();
  return row ? { data: parseStudyData(JSON.parse(row.data)), version: row.version } : { data: null, version: 0 };
}

/** Disciplinas e atividades da conta conectada. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await requireUser(env.DB, request);
  return json(await currentData(env.DB, user.id));
};

/**
 * Salva os dados. `version` é a versão que o aparelho tinha; se outro aparelho
 * salvou antes, responde 409 com a versão atual para não apagar nada.
 */
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const user = await requireUser(env.DB, request);
  const body = await readJson<{ data?: unknown; version?: unknown }>(request);
  const data = parseStudyData(body.data);
  const version = typeof body.version === 'number' && Number.isInteger(body.version) ? body.version : -1;
  if (!data || version < 0) throw new HttpError(400, 'Dados inválidos.');

  const text = JSON.stringify(data);
  const now = new Date().toISOString();
  const result =
    version === 0
      ? await env.DB.prepare(
          'INSERT INTO study_data (user_id, data, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT (user_id) DO NOTHING',
        )
          .bind(user.id, text, now)
          .run()
      : await env.DB.prepare(
          'UPDATE study_data SET data = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?',
        )
          .bind(text, now, user.id, version)
          .run();

  if (result.meta.changes !== 1) {
    return json({ error: 'Seus dados foram alterados em outro aparelho.', ...(await currentData(env.DB, user.id)) }, { status: 409 });
  }
  return json({ version: version + 1 });
};
