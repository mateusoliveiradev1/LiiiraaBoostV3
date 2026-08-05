---
status: resolved
trigger: "A migration aprovada do Neon staging falha após conectar porque o adaptador PostgreSQL assume um único QueryResult para um arquivo SQL com múltiplas instruções."
created: 2026-08-05T16:12:00-03:00
updated: 2026-08-05T16:19:00-03:00
---

# Debug: resultado múltiplo do pg durante migration

## Symptoms

- expected: `db:migrate` aplica `0001_control_plane.sql` atomicamente e retorna versão, hash e quantidade de tabelas.
- actual: a conexão é aceita, a migration falha e a transação é revertida.
- error: `Cannot read properties of undefined (reading 'length')` dentro da normalização de resultados do adaptador.
- timeline: primeira execução real contra o banco Neon staging em 2026-08-05; os testes em memória não exercitavam a forma de retorno multi-statement do `pg`.
- reproduction: executar `pnpm --filter @liiiraa/api db:migrate` com a URL aprovada do banco vazio `liiiraa_staging`.

## Current Focus

- hypothesis: Confirmada — `pg.Pool.query` retorna `QueryResult[]` para o arquivo SQL multi-statement; o adaptador lia `result.rows.length` como se fosse um único resultado.
- test: regressão normaliza resultado único e lista multi-statement; migration real e replay idempotente executados no Neon.
- expecting: Confirmado — lista agregada sem perder rows/rowCount; primeira execução `applied: true`, replay `applied: false`.
- next_action: Commitar e publicar a correção com CI pulado até os demais secrets do staging estarem configurados.
- reasoning_checkpoint:
  hypothesis: "O array retornado pelo pg não possui a propriedade rows; o fallback result.rows.length causa exatamente a exceção observada."
  confirming_evidence: "A migration envia o arquivo 0001_control_plane.sql inteiro em uma chamada query; node-postgres retorna múltiplos QueryResult para múltiplas instruções."
  falsification_test: "A hipótese será falsa se uma regressão com QueryResult[] passar sem a correção ou se a migration continuar falhando com outro erro após a normalização."
  fix_rationale: "Normalizar a resposta documentada single-or-array no limite do adaptador preserva a API interna e evita parsing inseguro de SQL."
  blind_spots: "Nenhum para esta causa; o deploy completo ainda depende do serviço Render e dos demais secrets externos."
- tdd_checkpoint:
  test_file: "packages/control-plane-adapters/src/postgres/database.test.ts"
  test_name: "normalizes multi-statement pg results"
  status: "green"
  failure_output: "RED: 2/2 falharam com normalizePostgresResult is not a function; GREEN: 2/2 passaram."

## Evidence

- timestamp: 2026-08-05T16:12:00-03:00
  checked: packages/control-plane-adapters/src/postgres/database.ts
  found: PgPool.query e normalizeResult aceitam apenas PgQueryResult; o fallback acessa result.rows.length.
  implication: Um array de resultados produz exatamente a leitura de `rows` indefinido observada.
- timestamp: 2026-08-05T16:12:30-03:00
  checked: packages/control-plane-adapters/src/postgres/migrate.ts
  found: A migration executa todo o arquivo SQL em uma única chamada transaction.query(migrationSql).
  implication: O caminho real ativa a resposta multi-statement que o teste em memória não modelava.
- timestamp: 2026-08-05T16:13:00-03:00
  checked: Neon liiiraa_staging após falha
  found: A transação abortou antes do ledger final; o runner reportou falha e não houve sucesso parcial declarado.
  implication: É seguro corrigir e repetir a migration idempotente aprovada.
- timestamp: 2026-08-05T16:17:00-03:00
  checked: packages/control-plane-adapters/src/postgres/database.test.ts
  found: RED 2/2 falhou antes da correção; GREEN 2/2 passou após admitir e agregar PgQueryResult ou PgQueryResult[].
  implication: A regressão reproduz e protege a forma de retorno que causou a falha real.
- timestamp: 2026-08-05T16:18:00-03:00
  checked: migration 0001_control_plane no banco Neon liiiraa_staging
  found: Primeira aplicação retornou applied true, versão 0001_control_plane, 18 tabelas e checksum b222d7e053f161e0d69376d6ee7264b98f43c68bf0505c66486da06b3aee2ee4.
  implication: O schema revisado foi aplicado integralmente após a correção.
- timestamp: 2026-08-05T16:18:30-03:00
  checked: replay da mesma migration no Neon
  found: Replay retornou applied false com o mesmo checksum e 18 tabelas.
  implication: Idempotência e vínculo ao checksum foram comprovados no banco real.
- timestamp: 2026-08-05T16:19:00-03:00
  checked: Neon describe_branch para liiiraa_staging
  found: Ledger, 17 tabelas de domínio, índices e funções de auditoria aparecem no schema public.
  implication: A inspeção externa confirma o relatório do runner sem depender apenas da saída local.

## Eliminated

- hypothesis: A URL ou política de staging rejeitou a conexão.
  evidence: O diagnóstico avançou até a normalização do retorno de uma query e produziu erro JavaScript posterior à admissão.

## Resolution

- root_cause: "node-postgres retorna uma lista de QueryResult para SQL multi-statement; normalizeResult aceitava somente um resultado e acessava rows indefinido."
- fix: "O adaptador agora aceita PgQueryResult ou PgQueryResult[], agrega rowCount/rows numa única fronteira e o teste de migration do deploy inclui a regressão."
- verification: "RED 2/2, GREEN 2/2; suíte PostgreSQL 15 aprovados/3 live ignorados; Neon aplicou 0001 com 18 tabelas e replay idempotente applied false no mesmo checksum."
- files_changed:
  - packages/control-plane-adapters/src/postgres/database.ts
  - packages/control-plane-adapters/src/postgres/database.test.ts
  - apps/api/package.json
  - .planning/debug/postgres-multi-result.md
