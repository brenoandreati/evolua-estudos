import { json } from '../../server/http';

/** Rotas /api que não existem respondem 404 (e não a página do site). */
export const onRequest: PagesFunction = () => json({ error: 'Rota não encontrada.' }, { status: 404 });
