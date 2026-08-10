# Especificação de Produto — Retro Board

## Visão geral

Ferramenta web de retrospectiva Scrum colaborativa em tempo real, sem autenticação, baseada em sessões públicas identificadas por token na URL. Qualquer pessoa com o link participa instantaneamente. O objetivo central é que o time saia de cada retro com ações claras, rastreáveis e revisadas na sprint seguinte.

## 1. Identidade do participante

No primeiro acesso ao app, antes de qualquer sessão, o navegador gera um `participantId` único e salva em localStorage sob a chave `retro_participant_id`. Esse ID persiste indefinidamente.

O nome do participante é salvo em localStorage sob a chave `retro_participant_name` ao confirmar a entrada em qualquer sessão. Em acessos futuros o campo de nome já vem preenchido. O usuário pode alterar antes de confirmar — o novo nome substitui o valor salvo.

| Chave                    | Valor                            | Quando gravado                          |
| ------------------------ | -------------------------------- | --------------------------------------- |
| `retro_participant_id`   | string único gerado uma vez      | Primeiro acesso ao app                  |
| `retro_participant_name` | string com o nome (max 20 chars) | Ao confirmar entrada em qualquer sessão |
| `retro_recent_emojis`    | até 16 emojis usados recentemente | Ao reagir a um card                    |

## 2. Sessão e URL

O token é o único identificador da sessão. Tem 6 caracteres alfanuméricos em maiúsculas, gerado aleatoriamente no momento da criação. O servidor verifica se o token já existe antes de confirmar a criação.

A URL da sessão segue o formato `/board/[TOKEN]`. O botão "Copiar link" copia a URL completa com o token.

## 3. Tela de entrada

Exibida apenas quando não há token válido na URL. Contém um único campo de nome (máximo 20 caracteres) e duas ações: criar nova sessão ou entrar em sessão existente colando ou digitando o token de 6 caracteres.

## 4. Colunas

O board tem quatro colunas fixas:

| Coluna | Cor     | Título              |
| ------ | ------- | ------------------- |
| Bom    | Verde   | O que foi bom       |
| Ruim   | Rosa    | O que pode melhorar |
| Ideias | Azul    | Ideias              |
| Ações  | Amarelo | Ações               |

A coluna Ações tem comportamento distinto — não tem votação, agrupamento nem reações.

## 5. Cards — colunas Bom, Ruim e Ideias

**Cards são anônimos.** O nome do autor NÃO é exibido no card. Cada card contém apenas texto e contador de votos com botão de votação.

O botão alterna entre votar e remover voto. Cada participante vota uma única vez por card, rastreado pelo `participantId`. Votar no próprio card é permitido.

**Exclusão:** O autor do card pode deletá-lo (identificado internamente pelo `author_id`), mas o nome não é visível para outros participantes.

A ordenação dentro de cada coluna é por votos decrescente. Cards com mesmo número de votos são ordenados por `createdAt` decrescente.

**Edição:** Qualquer participante pode editar o texto de um card (máximo 500 caracteres).

**Reações:** Cada card aceita reações com emoji, escolhidos em um seletor completo (estilo Slack) com busca por palavra-chave em português, navegação por categorias e lista de "usados recentemente" — persistida por navegador em `localStorage` sob a chave `retro_recent_emojis`.

Cada participante reage uma vez por emoji e clicar no chip de novo remove a reação. Os chips são ordenados por quantidade de reações decrescente. As reações são independentes da votação e não influenciam a ordenação dos cards.

O servidor aceita qualquer emoji (valida que o valor começa com um pictograma, não contém letras/números/espaços e tem no máximo 16 code units), limitado a 30 emojis distintos por card.

### 5.1 Agrupamento de cards relacionados

Arrastar um card e soltá-lo sobre outro card agrupa os dois. Se o card alvo já pertence a um grupo, o card arrastado entra nesse grupo; se ambos já tinham grupos, os grupos são fundidos. Cards agrupados assumem a coluna do card alvo.

O grupo é renderizado como um bloco com:

- Título opcional editável (máximo 60 caracteres), exibido como "Grupo sem nome" quando vazio
- Contagem de cards e soma dos votos de todos os cards do grupo
- Botão de desagrupar todos; cada card do grupo também pode sair individualmente

A ordenação da coluna considera o grupo como um item único, usando a soma dos votos e o `createdAt` mais recente entre seus cards. Um grupo que fica com apenas um card é desfeito automaticamente.

Internamente, `group_id` e `group_label` são gravados em cada card do grupo (denormalizados), de modo que o realtime já existente propaga as mudanças.

### 5.2 Revelação anti-viés

Enquanto o timer está **rodando**, os cards dos outros participantes ficam ocultos (exibem "Oculto até a revelação", sem texto, votos ou reações). Os cards do próprio participante permanecem visíveis.

Em qualquer outro estado do timer (configurando, pausado, expirado) os cards são visíveis para todos.

Enquanto o timer roda, o header exibe um botão "Revelar cards" que libera a visualização para todos ao mesmo tempo (e "Ocultar cards" para voltar atrás). O estado é persistido em `sessions.cards_revealed` e é resetado para oculto sempre que o timer passa a rodar.

Limites e validações:

- Máximo de 100 cards por coluna — campo de adição é desabilitado ao atingir o limite, servidor rejeita com `column_full`
- Máximo de 500 caracteres por card — contador visual no cliente, rejeitado no servidor com `invalid_payload`
- Texto vazio — bloqueado no cliente, rejeitado no servidor com `invalid_payload`

## 6. Cards — coluna Ações

Cards de Ação têm um único campo: texto (obrigatório, máximo 500 caracteres). Não têm votação nem responsável — **ações são do time**, não de uma pessoa. A ordenação é por `createdAt` decrescente.

Qualquer participante pode editar ou excluir uma ação, já que a ação pertence ao time. O nome do autor não é exibido.

Cards de Ação podem ser criados manualmente ou via fluxo de sugestão da IA (seção 9).

## 7. Tempo real

A comunicação em tempo real usa Supabase Realtime (broadcast + presence). O servidor mantém o estado no banco de dados.

Ao entrar no board, o cliente carrega o estado via server-side rendering e se conecta ao canal de broadcast. A cada mutação, o cliente envia ao servidor via HTTP, o servidor persiste e o cliente propaga via broadcast para os demais.

## 8. Timer

O timer fica visível no sidebar para todos os participantes. É sincronizado em tempo real.

**Estados:**

- **Configurando** — estado inicial. Campo numérico com minutos (padrão: 5). O valor é propagado em tempo real para todos ao ser alterado. Botão "Iniciar".
- **Rodando** — exibe MM:SS decrementando. Botões "Pausar" e "+1 min".
- **Pausado** — tempo congelado. Botões "Retomar" e "+1 min".
- **Expirado** — display vermelho em 00:00. Som de alerta (3 beeps via Web Audio API, sem fallback se bloqueado). Botão "+1 min" (volta a rodar a partir de 1:00).

Não é possível reiniciar o timer com novo valor — apenas adicionar +1 minuto.

Ao encerrar a retro, o timer é resetado para configurando com 5 minutos.

## 9. Fluxo de sugestão via IA externa

O sistema **não chama nenhuma API de IA diretamente**. O fluxo é intermediado pelo facilitador:

1. **Gerar prompt** — O sistema monta um prompt com todos os cards agrupados por coluna (ordenados por votos). O participante copia via "Copiar Prompt".
2. **Uso externo** — O facilitador cola em qualquer IA (ChatGPT, Claude, Gemini, etc.) e obtém JSON.
3. **Colar retorno** — O sistema valida o JSON colado. Se inválido, retorna `invalid_ai_payload`. Se válido, cria sugestões pendentes visíveis para todos.
4. **Aprovação/rejeição** — Cada sugestão tem botões aprovar/rejeitar. Ao aprovar, vira card na coluna Ações. Ao rejeitar, é removida.

Formato JSON esperado:

```json
[
  {
    "id": "1",
    "text": "descrição da ação"
  }
]
```

## 10. Presença

O header exibe quantos participantes estão online e seus nomes (via Supabase Presence).

## 11. Encerramento da retro

Qualquer participante pode encerrar a retro. O servidor atomicamente:

- Copia cards da coluna Ações para `prev_actions`
- Deleta todos os cards das quatro colunas
- Descarta sugestões pendentes
- Reseta timer para configurando (5 min)

Na próxima retro com o mesmo token, as ações anteriores aparecem em modal "Ações da Sprint Anterior" com checkbox de conclusão.

O produto mantém apenas a sprint imediatamente anterior. Ao encerrar uma nova retro, as `prevActions` existentes são substituídas.

## 12. Persistência

- Banco: Supabase PostgreSQL
- Tabelas: `sessions`, `cards`, `action_cards`, `suggestions`, `prev_actions`, `board_snapshots`
- Realtime: Supabase Realtime (broadcast + presence)
- RLS: Acesso público (sem autenticação)

Colunas específicas das features do board:

| Tabela     | Coluna                        | Uso                                            |
| ---------- | ----------------------------- | ---------------------------------------------- |
| `cards`    | `group_id` / `group_label`    | Agrupamento de cards relacionados (seção 5.1)  |
| `cards`    | `reactions` (jsonb)           | `{ "🔥": ["participantId", ...] }`             |
| `sessions` | `cards_revealed` (boolean)    | Revelação anti-viés (seção 5.2)                |

As migrações ficam em `supabase/migrations/`.

## 13. Códigos de erro

| Código                  | Descrição                                      |
| ----------------------- | ---------------------------------------------- |
| `session_not_found`     | Token não corresponde a nenhuma sessão         |
| `column_full`           | Coluna atingiu o limite de 100 cards           |
| `invalid_payload`       | Payload inválido ou fora dos limites           |
| `invalid_ai_payload`    | JSON da IA não corresponde ao formato esperado |
| `timer_already_running` | Timer já está em execução                      |
| `timer_not_running`     | Timer não está no estado válido para a ação    |
| `timer_invalid_value`   | Valor de minutos inválido                      |

## 14. Fora de escopo

- Autenticação e controle de acesso
- Distinção de papéis entre participantes
- Responsável nominal em ações
- Emojis customizados (upload de imagem, como no Slack)
- Export de dados
- Notificações
- Moderação de conteúdo
- Colunas configuráveis
