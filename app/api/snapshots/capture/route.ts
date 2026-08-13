import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateReferenceDate } from "@/lib/snapshot-utils";
import type {
  SnapshotData,
  SnapshotCard,
  SnapshotActionCard,
} from "@/lib/types/database";

export const maxDuration = 120;

// Margem de segurança: aborta antes do limite da plataforma para conseguir
// responder com o que já foi capturado em vez de ser morto no meio.
const TIMEOUT_MS = 110_000;

// Tokens por lote nos deletes — o filtro `in.(...)` viaja na URL.
const DELETE_CHUNK = 200;

// O PostgREST devolve no máximo 1000 linhas por request e trunca em silêncio,
// então a leitura precisa paginar até acabar.
const PAGE_SIZE = 1000;

async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const all: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Erro ao buscar ${label}: ${error.message}`);
    }

    const rows = data ?? [];
    all.push(...rows);

    if (rows.length < PAGE_SIZE) {
      return all;
    }
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function groupByToken<T extends { session_token: string }>(
  rows: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.session_token);
    if (list) {
      list.push(row);
    } else {
      map.set(row.session_token, [row]);
    }
  }
  return map;
}

export async function POST() {
  const startedAt = Date.now();
  const expired = () => Date.now() - startedAt > TIMEOUT_MS;

  let captured = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const supabase = await createClient();
    const referenceDate = calculateReferenceDate();

    // Busca todos os cards e action_cards de uma vez, paginando.
    // Substitui duas queries por sessão.
    const [allCards, allActionCards] = await Promise.all([
      fetchAll(
        (from, to) => supabase.from("cards").select("*").range(from, to),
        "cards",
      ),
      fetchAll(
        (from, to) => supabase.from("action_cards").select("*").range(from, to),
        "action_cards",
      ),
    ]);

    const cardsByToken = groupByToken(allCards);
    const actionCardsByToken = groupByToken(allActionCards);

    // Só interessam as sessões que têm algum conteúdo; as demais seriam
    // puladas de qualquer forma.
    const tokens = [
      ...new Set([...cardsByToken.keys(), ...actionCardsByToken.keys()]),
    ];

    const { count: sessionCount, error: sessionsError } = await supabase
      .from("sessions")
      .select("token", { count: "exact", head: true });

    if (sessionsError) {
      throw new Error(`Erro ao buscar sessões: ${sessionsError.message}`);
    }

    skipped = Math.max((sessionCount ?? tokens.length) - tokens.length, 0);

    if (tokens.length === 0) {
      return NextResponse.json({ captured: 0, skipped, errors });
    }

    const rows = tokens.map((token) => {
      const snapshotData: SnapshotData = {
        cards: (cardsByToken.get(token) ?? []).map(
          (card): SnapshotCard => ({
            id: card.id,
            column_type: card.column_type,
            text: card.text,
            author: card.author,
            author_id: card.author_id,
            votes: card.votes,
            voters: card.voters,
            group_id: card.group_id ?? null,
            group_label: card.group_label ?? null,
            reactions: card.reactions ?? {},
            created_at: card.created_at,
          }),
        ),
        actionCards: (actionCardsByToken.get(token) ?? []).map(
          (action): SnapshotActionCard => ({
            id: action.id,
            text: action.text,
            responsible: action.responsible,
            author: action.author,
            author_id: action.author_id,
            created_at: action.created_at,
          }),
        ),
      };

      return {
        session_token: token,
        reference_date: referenceDate,
        snapshot_data: snapshotData,
      };
    });

    if (expired()) {
      throw new Error("Timeout: captura abortada antes da gravação");
    }

    // ON CONFLICT DO NOTHING: o `select()` devolve apenas as linhas realmente
    // inseridas, então sabemos exatamente quais boards podem ser limpos.
    // Sessão que já tinha snapshot do dia não é limpa — evita destruir cards
    // novos numa reexecução.
    const { data: inserted, error: insertError } = await supabase
      .from("board_snapshots")
      .upsert(rows, {
        onConflict: "session_token,reference_date",
        ignoreDuplicates: true,
      })
      .select("session_token");

    if (insertError) {
      throw new Error(`Erro ao inserir snapshots: ${insertError.message}`);
    }

    const capturedTokens = (inserted ?? []).map((row) => row.session_token);
    captured = capturedTokens.length;
    skipped += tokens.length - captured;

    if (capturedTokens.length === 0) {
      return NextResponse.json({ captured, skipped, errors });
    }

    // Limpa o board das sessões que acabaram de virar snapshot.
    for (const table of ["cards", "action_cards", "suggestions"] as const) {
      for (const batch of chunk(capturedTokens, DELETE_CHUNK)) {
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .in("session_token", batch);

        if (deleteError) {
          errors.push(`Erro ao limpar ${table}: ${deleteError.message}`);
        }
      }
    }

    return NextResponse.json({ captured, skipped, errors });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno do servidor";
    console.error("Erro na captura de snapshots:", message);

    return NextResponse.json(
      { captured, skipped, errors: [...errors, message] },
      { status: 500 },
    );
  }
}
