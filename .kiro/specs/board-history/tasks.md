# Implementation Plan: Board History

## Overview

Implementação do sistema de histórico do Retro Board com captura automática de snapshots diários, navegação via calendário, visualização e edição de snapshots históricos com isolamento completo do board ativo. A stack utiliza Next.js API Routes, Supabase PostgreSQL (JSONB), react-day-picker e broadcast channels separados.

## Tasks

- [x] 1. Setup de banco de dados e tipos
  - [x] 1.1 Criar arquivo de migração SQL para a tabela `board_snapshots`
    - Criar `supabase/migrations/001_board_snapshots.sql` com a DDL da tabela `board_snapshots` (id UUID PK, session_token TEXT FK, reference_date DATE, snapshot_data JSONB, created_at TIMESTAMPTZ)
    - Incluir constraint UNIQUE(session_token, reference_date) e índice composto em (session_token, reference_date DESC)
    - _Requirements: 1.3, 1.4, 6.1_

  - [x] 1.2 Atualizar `lib/types/database.ts` com tipos da tabela `board_snapshots` e interface `SnapshotData`
    - Adicionar definição da tabela `board_snapshots` no type `Database` (Row, Insert, Update)
    - Criar interfaces `SnapshotData`, `SnapshotCard` e `SnapshotActionCard`
    - Criar type alias `BoardSnapshot` para conveniência
    - _Requirements: 1.1, 1.4_

  - [x] 1.3 Criar `lib/snapshot-utils.ts` com funções utilitárias
    - Implementar `calculateReferenceDate(now?: Date): string` — retorna a data de referência (dia anterior no fuso America/Sao_Paulo) no formato YYYY-MM-DD
    - Implementar `formatDateBrasilia(isoDate: string): string` — converte data ISO para formato DD/MM/AAAA no fuso America/Sao_Paulo
    - Implementar `sortSnapshotCards(cards: SnapshotCard[]): SnapshotCard[]` — ordena por votos desc, created_at desc
    - Usar `date-fns` (já instalado) e `Intl.DateTimeFormat` com timezone `America/Sao_Paulo`
    - _Requirements: 5.1, 5.2, 5.3, 3.1_

  - [ ]\* 1.4 Escrever property tests para `calculateReferenceDate`
    - **Property 4: Cálculo da data de referência**
    - **Validates: Requirements 5.1, 5.3**

  - [ ]\* 1.5 Escrever property tests para `formatDateBrasilia`
    - **Property 5: Formatação de datas em Brasília**
    - **Validates: Requirements 2.4, 3.2, 5.2, 5.5**

  - [ ]\* 1.6 Escrever property tests para `sortSnapshotCards`
    - **Property 7: Ordenação dos cards no snapshot**
    - **Validates: Requirements 3.1**

- [x] 2. API de captura de snapshots (cron)
  - [x] 2.1 Criar `app/api/snapshots/capture/route.ts` — endpoint POST para captura agendada
    - Validar header `Authorization` contra variável de ambiente `CRON_SECRET`
    - Calcular `reference_date` usando `calculateReferenceDate()`
    - Buscar todas as sessões, para cada uma buscar cards + action_cards
    - Inserir snapshot com `ON CONFLICT (session_token, reference_date) DO NOTHING` para sessões com pelo menos 1 card
    - Implementar timeout global de 120s via `AbortController`
    - Retornar contadores `{ captured, skipped, errors }`
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 5.1, 5.3, 6.3_

  - [x] 2.2 Criar `vercel.json` com configuração do cron job
    - Agendar `/api/snapshots/capture` para `0 3 * * *` (03:00 UTC = 00:00 BRT)
    - _Requirements: 1.1, 5.1_

  - [ ]\* 2.3 Escrever property tests para captura de snapshots
    - **Property 1: Completude da captura**
    - **Validates: Requirements 1.1**

  - [ ]\* 2.4 Escrever property tests para sessões vazias
    - **Property 2: Sessões vazias não geram snapshot**
    - **Validates: Requirements 1.2**

  - [ ]\* 2.5 Escrever property tests para idempotência
    - **Property 3: Idempotência da captura**
    - **Validates: Requirements 1.3**

- [x] 3. Checkpoint - Verificar base do sistema
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. APIs de consulta de snapshots
  - [x] 4.1 Criar `app/api/snapshots/dates/route.ts` — GET com datas disponíveis
    - Receber `session_token` como query param
    - Consultar `board_snapshots` filtrando por session_token, retornando array de `reference_date` ordenado desc
    - Retornar `{ dates: string[] }` no formato YYYY-MM-DD
    - Validar que session_token foi fornecido (400 caso contrário)
    - _Requirements: 2.1, 2.3, 3.3_

  - [x] 4.2 Criar `app/api/snapshots/[date]/route.ts` — GET com dados do snapshot de um dia
    - Receber `session_token` como query param e `date` do path param
    - Validar formato da data (YYYY-MM-DD), retornar 400 se inválido
    - Buscar snapshot por session_token + reference_date
    - Retornar 404 se não encontrado
    - Aplicar `sortSnapshotCards` nos cards antes de retornar
    - Retornar `{ snapshot: { id, reference_date, snapshot_data, created_at } }`
    - _Requirements: 3.1, 3.3, 5.5_

- [x] 5. APIs de edição de snapshots
  - [x] 5.1 Criar `app/api/snapshots/[date]/cards/route.ts` — POST/PATCH/DELETE para editar cards do snapshot
    - POST: adicionar card ao snapshot (gerar UUID, validar texto não-vazio, max 500 chars, max 100 cards/coluna)
    - PATCH: atualizar text e/ou column_type de card existente no snapshot
    - DELETE: remover card do snapshot pelo id
    - Usar `SELECT ... FOR UPDATE` para serializar escritas concorrentes no mesmo snapshot
    - Aplicar suporte tanto para cards regulares quanto action_cards no mesmo endpoint
    - Broadcast da alteração no canal `retro-history:{token}:{date}` via Supabase
    - _Requirements: 4.1, 4.2, 4.5, 6.1, 6.5_

  - [x] 5.2 Criar `app/api/snapshots/[date]/cards/vote/route.ts` — POST para votar em cards do snapshot
    - Receber `card_id`, `voter_id` e `session_token`
    - Implementar toggle de voto (adicionar voter se não existe, remover se já votou)
    - Atualizar campo `votes` e array `voters` do card no JSONB
    - Usar `SELECT ... FOR UPDATE` para serializar escritas
    - Broadcast da alteração no canal de histórico
    - _Requirements: 4.1, 4.2_

  - [ ]\* 5.3 Escrever property tests para validação de edição
    - **Property 11: Validação de edição no modo histórico**
    - **Validates: Requirements 4.1**

  - [ ]\* 5.4 Escrever property tests para isolamento bidirecional
    - **Property 8: Isolamento bidirecional de dados**
    - **Validates: Requirements 1.4, 4.2, 6.1**

- [x] 6. Checkpoint - Verificar APIs completas
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Componentes de UI
  - [x] 7.1 Criar `components/board/history-calendar.tsx` — componente de calendário com react-day-picker
    - Aceitar props: `sessionToken`, `onSelectDate`, `onExitHistory`, `isHistoryMode`, `selectedDate`
    - No mount, buscar datas disponíveis via `GET /api/snapshots/dates?session_token=...`
    - Usar `DayPicker` com `mode="single"`, `locale` pt-BR via date-fns
    - Aplicar `modifiers={{ hasSnapshot: snapshotDates }}` para highlight visual
    - Desabilitar dias sem snapshot via prop `disabled`
    - Limitar navegação ao mês corrente via `toMonth` (sem meses futuros)
    - Exibir botão "Voltar ao board atual" quando `isHistoryMode === true`
    - Tratar estado de loading e erro (com botão "Tentar novamente")
    - Exibir mensagem quando não há snapshots disponíveis
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 3.4_

  - [x] 7.2 Criar `components/board/history-banner.tsx` — banner sticky do modo histórico
    - Aceitar props: `date: Date`, `onExit: () => void`
    - Renderizar com `sticky top-0 z-50` e fundo amber/yellow para alta visibilidade
    - Exibir texto: "📅 Visualizando snapshot de {dd/mm/aaaa} — Alterações serão salvas neste dia histórico"
    - Incluir botão "Voltar ao board atual"
    - Não incluir botão de fechar (não-dispensável)
    - Usar `formatDateBrasilia` para formatar a data
    - _Requirements: 3.2, 4.4_

  - [ ]\* 7.3 Escrever property tests para dias selecionáveis no calendário
    - **Property 6: Dias selecionáveis correspondem a snapshots existentes**
    - **Validates: Requirements 2.1, 3.3**

- [x] 8. Integração no BoardClient
  - [x] 8.1 Atualizar `app/board/[token]/board-client.tsx` — adicionar estado e lógica do modo histórico
    - Adicionar estados: `historyMode`, `historyDate`, `historyCards`, `historyActionCards`, `historySnapshotId`
    - Criar handler `handleSelectHistoryDate(date)`: setar historyMode=true, fetch snapshot via API, popular historyCards/historyActionCards
    - Criar handler `handleExitHistory()`: setar historyMode=false, limpar estado de histórico
    - Condicionar renderização: quando `historyMode === true`, usar `historyCards` em vez de `cards` do realtime
    - Condicionar operações de card: quando `historyMode`, rotear POST/PATCH/DELETE para `/api/snapshots/[date]/cards` e votos para `/api/snapshots/[date]/cards/vote`
    - Exibir toast (sonner) com duração de 5s ao salvar edição no modo histórico: "Alteração salva no snapshot de {dd/mm/aaaa}"
    - _Requirements: 3.1, 3.4, 3.5, 4.1, 4.2, 4.3, 4.5_

  - [x] 8.2 Integrar `HistoryCalendar` no sidebar do BoardClient
    - Importar e renderizar `HistoryCalendar` no sidebar direito (abaixo de ParticipantsPanel)
    - Passar props: sessionToken, onSelectDate, onExitHistory, isHistoryMode, selectedDate
    - _Requirements: 2.1, 2.2, 3.4_

  - [x] 8.3 Integrar `HistoryBanner` na área do board
    - Renderizar `HistoryBanner` condicionalmente quando `historyMode === true`, acima do grid de colunas
    - Passar props: date (historyDate), onExit (handleExitHistory)
    - _Requirements: 3.2, 4.4_

- [x] 9. Isolamento de realtime no modo histórico
  - [x] 9.1 Implementar canal de broadcast separado para histórico no BoardClient
    - Ao entrar no modo histórico, criar subscription no canal `retro-history:{token}:{date}` via Supabase
    - Escutar eventos de broadcast nesse canal para atualizar `historyCards`/`historyActionCards` em tempo real
    - Ao sair do modo histórico, cancelar subscription do canal de histórico
    - Garantir que eventos do canal principal `retro:{token}` são ignorados quando `historyMode === true` (não atualizar renderização)
    - _Requirements: 3.5, 4.2, 6.2, 6.5_

  - [ ]\* 9.2 Escrever property tests para isolamento de realtime
    - **Property 9: Eventos realtime ignorados no modo histórico**
    - **Validates: Requirements 3.5**

  - [ ]\* 9.3 Escrever property tests para broadcast isolado
    - **Property 10: Broadcast isolado — histórico não afeta board ativo**
    - **Validates: Requirements 6.5**

- [x] 10. Checkpoint final - Verificar integração completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de corretude definidas no design
- O projeto já possui `react-day-picker`, `date-fns` e `sonner` como dependências — não é necessário instalar pacotes adicionais
- A lib `fast-check` precisa ser instalada caso os property tests sejam implementados
- O endpoint de captura deve ser protegido via `CRON_SECRET` (variável de ambiente a configurar)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.2"] },
    { "id": 2, "tasks": ["1.4", "1.5", "1.6", "2.1"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "4.1", "4.2"] },
    { "id": 4, "tasks": ["5.1", "5.2"] },
    { "id": 5, "tasks": ["5.3", "5.4", "7.1", "7.2"] },
    { "id": 6, "tasks": ["7.3", "8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3"] }
  ]
}
```
