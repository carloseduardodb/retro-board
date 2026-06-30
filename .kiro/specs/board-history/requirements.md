# Requirements Document

## Introduction

Funcionalidade de histórico para o Retro Board que permite salvar snapshots diários do estado do board automaticamente à meia-noite no horário de Brasília (America/Sao_Paulo). Os usuários podem navegar por um calendário para visualizar e editar estados passados do board. Dias em que o board permaneceu vazio não geram snapshots.

## Glossary

- **Sistema_Snapshot**: Serviço responsável por capturar e armazenar o estado do board em um ponto no tempo
- **Calendário_Histórico**: Componente de interface que exibe os dias com snapshots disponíveis e permite navegação temporal
- **Snapshot**: Cópia completa do estado do board (cards de todas as colunas) em um determinado dia
- **Board**: Painel de retrospectiva contendo cards nas colunas Bom, Ruim, Ideias e Ações
- **Horário_Brasília**: Fuso horário America/Sao_Paulo (UTC-3, ou UTC-2 em horário de verão)
- **Dia_Ativo**: Dia com pelo menos um card no board no momento da captura do snapshot
- **Modo_Histórico**: Estado da interface quando o usuário está visualizando um snapshot de um dia anterior

## Requirements

### Requisito 1: Captura automática de snapshot à meia-noite

**User Story:** Como membro do time, eu quero que o estado do board seja salvo automaticamente todo dia à meia-noite no horário de Brasília, para que eu tenha um histórico do progresso da retrospectiva.

#### Critérios de Aceitação

1. WHEN o relógio marca meia-noite (00:00:00) no Horário_Brasília, THE Sistema_Snapshot SHALL capturar o estado completo do board de cada sessão existente, incluindo todos os cards das colunas Bom, Ruim, Ideias e Ações com seus respectivos textos, votos, ordenação e responsáveis, registrando a data de referência como o dia que está se encerrando (dia anterior à meia-noite)
2. WHEN o relógio marca meia-noite no Horário_Brasília AND o board de uma sessão não possui nenhum card em nenhuma das quatro colunas (Bom, Ruim, Ideias e Ações), THE Sistema_Snapshot SHALL ignorar a captura para aquela sessão e não armazenar snapshot para aquele dia
3. THE Sistema_Snapshot SHALL associar cada snapshot ao token da sessão e à data de referência (dia que se encerrou) no Horário_Brasília, garantindo no máximo um snapshot por sessão por data de referência de forma que execuções duplicadas do processo de captura para a mesma data não gerem snapshots redundantes
4. WHEN um snapshot é capturado, THE Sistema_Snapshot SHALL armazenar os dados como uma cópia imutável independente do estado atual do board, de modo que alterações futuras nos cards do board não afetem snapshots anteriores
5. IF a meia-noite no Horário_Brasília não existir devido à transição de horário de verão (adiantamento do relógio), THEN THE Sistema_Snapshot SHALL executar a captura no primeiro instante válido do novo dia (tipicamente 01:00:00) utilizando a data do dia anterior como referência
6. IF o processo de captura não completar dentro de 120 segundos após o horário agendado, THEN THE Sistema_Snapshot SHALL abortar a execução atual, registrar o erro e permitir nova tentativa na próxima execução sem corromper dados existentes

### Requisito 2: Exibição do calendário de histórico

**User Story:** Como membro do time, eu quero ver um calendário mostrando quais dias têm snapshots disponíveis, para que eu possa navegar pelo histórico do board.

#### Critérios de Aceitação

1. THE Calendário_Histórico SHALL exibir um componente de calendário mensal na interface do board onde os dias com snapshots disponíveis são apresentados em estado interativo (clicável) e os dias sem snapshots são apresentados em estado não-interativo (não-clicável e visualmente atenuado)
2. THE Calendário_Histórico SHALL fornecer controles de navegação que permitam ao usuário avançar e retroceder entre meses para visualizar datas anteriores, sem permitir navegação para meses futuros além do mês corrente no Horário_Brasília
3. WHEN o usuário abre o Calendário_Histórico, THE Calendário_Histórico SHALL carregar a lista de datas com snapshots disponíveis para a sessão atual em no máximo 3 segundos e exibir o mês corrente no Horário_Brasília como visualização inicial
4. THE Calendário_Histórico SHALL exibir datas no Horário_Brasília independentemente do fuso horário local do navegador do usuário
5. IF a sessão atual não possui nenhum snapshot disponível, THEN THE Calendário_Histórico SHALL exibir o calendário do mês corrente com todos os dias em estado não-interativo e uma mensagem indicando que não há histórico disponível

### Requisito 3: Visualização de snapshot histórico

**User Story:** Como membro do time, eu quero selecionar um dia no calendário e ver os cards do board naquele dia, para que eu possa revisar o histórico da retrospectiva.

#### Critérios de Aceitação

1. WHEN o usuário seleciona um dia com snapshot disponível no Calendário_Histórico, THE Board SHALL exibir os cards salvos naquele snapshot nas suas respectivas colunas (Bom, Ruim, Ideias e Ações), ordenados por votos decrescente e em caso de empate por data de criação decrescente, substituindo a visualização dos cards atuais
2. WHILE o board está em Modo_Histórico, THE Board SHALL exibir um indicador visual persistente informando a data do snapshot sendo visualizado no formato dd/mm/aaaa no Horário_Brasília
3. THE Calendário_Histórico SHALL apresentar os dias sem snapshot disponível como não selecionáveis, impedindo interação do usuário com essas datas
4. WHILE o board está em Modo_Histórico, THE Calendário_Histórico SHALL exibir um botão visível de retorno que, quando acionado pelo usuário, encerra o Modo_Histórico e restaura a visualização do estado atual do board
5. WHILE o board está em Modo_Histórico, THE Board SHALL ignorar atualizações em tempo real de outros participantes no board ativo, exibindo exclusivamente os dados do snapshot selecionado até que o usuário saia do Modo_Histórico

### Requisito 4: Edição de snapshot histórico

**User Story:** Como membro do time, eu quero poder editar os cards de um snapshot histórico, para que eu possa corrigir ou complementar informações de dias anteriores.

#### Critérios de Aceitação

1. WHILE o board está em Modo_Histórico, THE Board SHALL permitir que o usuário adicione, edite, remova e vote em cards do snapshot sendo visualizado, aplicando as mesmas regras de validação do board ativo (máximo de 500 caracteres por card, máximo de 100 cards por coluna, texto não-vazio obrigatório)
2. WHEN o usuário realiza uma alteração em um card no Modo_Histórico, THE Sistema_Snapshot SHALL persistir a alteração no snapshot daquele dia específico sem afetar o estado atual do board nem outros snapshots, e SHALL propagar a alteração em tempo real para outros participantes que estejam visualizando o mesmo snapshot
3. WHEN o usuário realiza uma alteração no Modo_Histórico, THE Board SHALL exibir uma notificação temporária por 5 segundos indicando que a alteração foi salva no snapshot do dia selecionado e não no board atual
4. WHILE o board está em Modo_Histórico, THE Board SHALL exibir um banner não-dispensável e fixo no topo da área visível (visível independentemente da rolagem) informando a data do snapshot sendo editado e que todas as alterações serão salvas nesse dia histórico
5. IF ocorrer uma falha ao persistir uma alteração no Modo_Histórico, THEN THE Board SHALL exibir uma mensagem de erro indicando que a alteração não foi salva e SHALL manter o conteúdo editado pelo usuário no campo para permitir nova tentativa

### Requisito 5: Fuso horário de referência

**User Story:** Como membro do time, eu quero que todas as operações de histórico utilizem o horário de Brasília como referência, para que o time tenha uma referência temporal consistente.

#### Critérios de Aceitação

1. THE Sistema_Snapshot SHALL utilizar o fuso horário America/Sao_Paulo para determinar a virada de dia (00:00:00 local) para captura de snapshots, aplicando automaticamente o offset vigente (UTC-3 ou UTC-2) conforme definido pela base de dados IANA do sistema
2. THE Calendário_Histórico SHALL exibir todas as datas de referência no formato DD/MM/AAAA usando o fuso horário America/Sao_Paulo, independentemente do fuso horário configurado no navegador do usuário
3. WHEN o snapshot é capturado, THE Sistema_Snapshot SHALL registrar a data de referência como o dia calendário que está se encerrando no Horário_Brasília (ou seja, se a captura ocorre à meia-noite do dia 15, a data de referência registrada é dia 14)
4. IF a transição de horário de verão fizer com que meia-noite local seja pulada ou repetida, THEN THE Sistema_Snapshot SHALL executar a captura exatamente uma vez utilizando o instante UTC equivalente à primeira ocorrência de 00:00:00 no fuso America/Sao_Paulo daquele dia
5. THE Calendário_Histórico SHALL converter todas as datas armazenadas para America/Sao_Paulo antes da exibição, de modo que um usuário em qualquer fuso horário visualize a mesma data de referência para o mesmo snapshot

### Requisito 6: Integridade e isolamento dos dados

**User Story:** Como membro do time, eu quero que o histórico funcione de forma isolada do board ativo, para que a navegação no histórico não interfira no funcionamento normal da retrospectiva.

#### Critérios de Aceitação

1. THE Sistema_Snapshot SHALL armazenar snapshots em registros separados dos dados do board ativo, de modo que operações de criação, edição, exclusão ou votação de cards no board ativo não modifiquem nenhum campo dos snapshots existentes
2. WHILE um ou mais participantes estão visualizando o board no estado atual, THE Board SHALL permitir que outros participantes naveguem por snapshots históricos de forma independente, sem alterar a visualização, os dados nem o estado de tempo real dos participantes que permanecem no board ativo
3. IF ocorrer uma falha durante a captura do snapshot, THEN THE Sistema_Snapshot SHALL descartar quaisquer dados parciais da captura falha, preservar integralmente os snapshots anteriores e os dados do board ativo, registrar o erro, e executar uma nova tentativa na próxima captura agendada à meia-noite no Horário_Brasília
4. THE Sistema_Snapshot SHALL manter os snapshots disponíveis e acessíveis enquanto o registro da sessão existir no banco de dados, sem aplicar expiração automática por tempo
5. WHILE um participante está em Modo_Histórico, THE Board SHALL garantir que as alterações realizadas por esse participante no snapshot visualizado não sejam propagadas via broadcast para os demais participantes nem afetem a visualização do board ativo de nenhum outro participante
