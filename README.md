# Recomeço: apoio para sair do vício em apostas

Site educativo e de apoio para pessoas viciadas em apostas (bets, cassinos online, "tigrinho", Aviator) e para as suas famílias.

## Funcionalidades

- **Avaliação logo na primeira visita**: uma janela convida a pessoa a fazer a avaliação antes de tudo. São 8 etapas: como começou, há quanto tempo aposta, frequência, tipo de jogo, gasto mensal, dia a dia, dívidas, se esconde da família, arrependimento, se quer ajuda e as 9 perguntas do **PGSI** (Problem Gambling Severity Index). O backend calcula o nível de risco e devolve um **plano personalizado**.
- **Avaliação salva por conta e por IP**: quem entra na conta vê o seu resultado em qualquer aparelho, com o **histórico da sua evolução**. Pelo IP, o site só lembra que a avaliação já foi feita (para não pedir de novo); o resultado de uma pessoa nunca aparece para outra que use a mesma rede.
- **Contas anônimas**: só apelido e senha, sem e-mail. A jornada, o diário, as vontades vencidas e os recordes dos jogos ficam sincronizados com a conta. A pessoa pode **baixar todos os seus dados** ou **apagar a conta** quando quiser.
- **Comparação com a comunidade**: depois da avaliação, a pessoa vê como a sua pontuação se compara às demais (serviço Python).
- **Entenda o vício**: ciclo do vício, truques das plataformas e um **simulador** que mostra a casa sempre ganhando (1 jogador ou 1.000 jogadores).
- **Dados**: números do Banco Central, III LENAD, AMB, Instituto Locomotiva e The Lancet, estatísticas anônimas em tempo real e uma **análise detalhada** por faixa de idade e sinais mais comuns entre quem está em risco.
- **Minha jornada**: contador de dias sem apostar, dinheiro preservado, meta de economia, conquistas comemoradas com confete e diário de humor.
- **Jogos sem apostas**, todos com sons suaves (que podem ser desligados) e um contador de **tempo longe das apostas** com meta diária de 15 minutos:
  - Memória com três níveis, sequência de acertos e estrelas;
  - Cobrinha com níveis, velocidade crescente, estrela bônus e obstáculos;
  - **Bolhas** (novo): estoure o que faz bem e desvie das armadilhas das apostas;
  - Quiz "Mito ou verdade" com 20 perguntas, tempo por pergunta, pontos e sequência;
  - Respiração guiada com três técnicas e meta de ciclos;
  - Jogo da velha com três níveis de dificuldade;
  - Ideias do que fazer agora, por categoria, com contador de ideias colocadas em prática.
- **Mural anônimo** com moderação: bloqueia links, telefones, e-mails, CPF, palavrões e divulgação de apostas.
- **Botão "Estou com vontade de apostar"**: cronômetro de 10 minutos, passos práticos e contatos (CVV 188).
- Seção para a família, onde buscar ajuda, tema claro ou escuro e layout responsivo.

## Arquitetura

| Parte | Tecnologia | Onde roda | Função |
|---|---|---|---|
| Frontend | HTML, CSS e JavaScript puros | GitHub Pages | Interface do site |
| Backend principal | Java 21+ (JDK + driver JDBC do Postgres) | Render (Docker) | API, contas, sessões, avaliações, mural |
| Serviço de análise | Python 3.10+ (só a biblioteca padrão) | Mesmo container do Java | Estatísticas detalhadas, comparação com a comunidade e moderação do mural |
| Banco | Postgres | Supabase | Todos os dados (o disco do Render gratuito é apagado a cada reinício) |

O navegador fala só com o Java. O Java repassa ao Python, só dentro do container, os pedidos de análise e de moderação. O Python não acessa o banco: para cada análise, o Java envia apenas os campos anônimos das avaliações (faixa etária, pontuação, nível, data, sinais e gasto), sem hash de IP nem id de conta. Se o Python cair, o site continua funcionando sem a análise detalhada, e o mural usa a verificação básica do Java.

A persistência fica atrás da interface `Storage`, com duas implementações:
- `PostgresStorage`: usada quando `DATABASE_URL` existe. Mantém uma cópia em memória para leituras e grava cada alteração primeiro no banco. Pressupõe uma única instância do servidor, que é o caso do Render gratuito.
- `ArquivoStorage`: JSON Lines na pasta `data/`, para desenvolvimento sem banco.

### Conexão do site com o servidor

`frontend/js/config.js` define o endereço da API:

| Onde o site está aberto | API usada |
|---|---|
| GitHub Pages (`*.github.io`) | `API_PRODUCAO` (URL do Render) |
| `localhost` em outra porta (ex.: Live Server na 5501) | `http://localhost:8080` |
| Servido pelo próprio Java (`localhost:8080` ou o endereço do Render) | mesma origem |
| Arquivo aberto direto do disco | nenhuma (modo offline) |

O Render gratuito desliga depois de 15 minutos sem acesso e leva cerca de um minuto para acordar. Por isso, ao abrir a página, o site chama `/api/saude`:

- Se a resposta demorar, aparece a mensagem "Conectando ao servidor…", e os conteúdos fixos (dados, quiz e frases) já são mostrados pela versão local.
- Se o servidor não responder em 90 segundos, o site passa para o **modo offline** (`frontend/js/offline.js`). Nele, a avaliação, o mural e as estatísticas ficam só no aparelho, e as contas ficam indisponíveis até a página ser recarregada com o servidor no ar.
- Depois de conectado, uma falha de rede vira uma mensagem de erro. O site não troca para o modo offline sozinho, para que nada seja salvo só no aparelho sem a pessoa perceber.

## Como rodar localmente

Requer Java 21 ou superior e, de preferência, Python 3.10 ou superior.

```bash
# Windows
run.bat

# Linux / macOS
./run.sh
```

Os scripts baixam o driver do Postgres para `backend/lib/` (só na primeira vez, conferindo o SHA-256), compilam o Java e sobem o serviço Python na porta 8081 e o site em http://localhost:8080.

- **Sem `.env`:** os dados ficam em arquivos na pasta `data/`.
- **Com Postgres:** copie `.env.example` para `.env` e preencha `DATABASE_URL` e `IP_HMAC_SEGREDO`. Pode ser o próprio Supabase ou um Postgres local com `?sslmode=disable`. Crie as tabelas antes, com `backend/schema.sql`.

Para usar o Live Server do VS Code (porta 5501) no lugar da página servida pelo Java, deixe o `run.bat`/`run.sh` rodando. O site vai chamar a API em `localhost:8080`, e essa origem já está liberada no CORS por padrão.

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | (vazio: usa `data/`) | Conexão com o Postgres. Aceita a URI do Supabase (`postgresql://...`) ou uma URL JDBC. Usa TLS por padrão. |
| `IP_HMAC_SEGREDO` | (gerado em `data/segredo.key`) | Chave do HMAC do IP (64 caracteres hex). Obrigatória com banco. |
| `CORS_ORIGENS` | localhost e 127.0.0.1 nas portas 8080 e 5501 | Origens que podem chamar a API, separadas por vírgula |
| `PORT` | `8080` | Porta do site (Java) |
| `ANALISE_URL` | `http://127.0.0.1:8081` | Endereço do serviço Python |
| `ANALISE_PORTA` / `ANALISE_HOST` | `8081` / `127.0.0.1` | Onde o Python ouve |
| `DB_POOL` | `3` | Conexões simultâneas com o banco |
| `CONFIAR_PROXY` | (vazio) | `1` atrás de proxy reverso: lê o IP do último valor de `X-Forwarded-For` (o Dockerfile já liga) |
| `EXIGIR_BANCO` | (vazio) | `1` impede o servidor de subir sem `DATABASE_URL` (o Dockerfile já liga) |

Segredos ficam só no `.env` (fora do Git) e nas variáveis de ambiente do Render.

### Migrar dados locais para o banco

Se você tem uma pasta `data/` com dados de antes, depois de rodar `backend/schema.sql` no banco:

```bash
# com DATABASE_URL definida (por exemplo, pelo .env)
java -cp "backend/out:backend/lib/*" br.com.recomeco.Migrar data      # Linux/macOS
java -cp "backend\out;backend\lib\*" br.com.recomeco.Migrar data      # Windows
```

Tabelas que já têm registros são puladas. As sessões não são migradas, então quem estava logado precisa entrar de novo.

### Testes do serviço Python

```bash
cd analise
python -m unittest -v
```

## Publicação

- **Banco:** projeto no Supabase. Rode `backend/schema.sql` no SQL Editor e use a string de conexão do *Session pooler*, porque a conexão direta do Supabase é só IPv6 e o Render não tem saída IPv6.
- **Backend:** Web Service no Render criado a partir deste repositório, usando o `Dockerfile`. As variáveis `DATABASE_URL`, `IP_HMAC_SEGREDO` e `CORS_ORIGENS` são configuradas no painel do Render.
- **Frontend:** GitHub Pages, como antes. A URL do Render vai em `frontend/js/config.js` (`API_PRODUCAO`) e no `connect-src` do Content-Security-Policy, no `frontend/index.html`.
- **Manter o banco ativo:** o Supabase gratuito pausa projetos sem uso por 7 dias. A Action `.github/workflows/manter-ativo.yml` chama `/api/saude`, que consulta o banco, a cada 3 dias. Configure a variável `RECOMECO_API_URL` do repositório. O GitHub desativa Actions agendadas em repositórios sem commits por 60 dias; se isso acontecer, reative na aba Actions.

## API

As rotas que exigem login recebem o token no header `Authorization: Bearer <token>`. O token é devolvido no cadastro e no login e vale por 30 dias.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dados` | Dados educativos, ciclo do vício, sinais e legislação |
| GET | `/api/quiz` | Perguntas do quiz "Mito ou verdade" |
| GET | `/api/motivacao` | Frase motivacional aleatória |
| POST | `/api/avaliacao` | Envia o questionário e recebe o resultado e o plano |
| GET | `/api/avaliacao/minha` | Resultado e histórico da conta, ou se o IP já fez a avaliação |
| POST | `/api/avaliacao/vincular` | Leva para a conta uma avaliação feita antes do login |
| GET | `/api/estatisticas` | Agregados anônimos das avaliações (a partir de 5 avaliações) |
| GET | `/api/depoimentos` | Últimas 30 mensagens do mural |
| POST | `/api/depoimentos` | Publica uma mensagem anônima |
| POST | `/api/auth/cadastro` | Cria uma conta (apelido e senha) e devolve o token |
| POST | `/api/auth/login` | Entra na conta e devolve o token |
| POST | `/api/auth/sair` | Encerra a sessão do token enviado |
| GET | `/api/auth/eu` | Diz se o token pertence a uma sessão válida |
| GET / PUT | `/api/usuario/dados` | Lê ou salva a jornada, o diário e os recordes |
| GET | `/api/usuario/exportar` | Baixa em JSON tudo o que o servidor guarda sobre a conta |
| DELETE | `/api/usuario` | Apaga a conta e todos os dados ligados a ela (pede `{"senha": "..."}`) |
| GET | `/api/analise/resumo` | Análise da comunidade (Python) |
| GET | `/api/analise/percentil?score=N` | Compara uma pontuação com as demais (Python) |
| GET | `/api/saude` | Diz se o Java, o Python e o banco estão no ar (503 se o banco não responde) |

## Estrutura

```
recomeco/
├── backend/
│   ├── schema.sql                 # tabelas do Postgres (schema "recomeco")
│   └── src/br/com/recomeco/
│       ├── Main.java              # servidor HTTP, rotas, CORS, token, limites e arquivos estáticos
│       ├── AvaliacaoService.java  # validação, cálculo PGSI, plano, histórico e estatísticas
│       ├── UsuarioService.java    # contas, senhas (PBKDF2-SHA512), sessões, exportação e exclusão
│       ├── DepoimentoService.java # mural de mensagens
│       ├── ConteudoService.java   # dados educativos, quiz e frases
│       ├── AnaliseCliente.java    # cliente HTTP do serviço Python
│       ├── Storage.java           # interface de persistência
│       ├── PostgresStorage.java   # persistência no Postgres
│       ├── ArquivoStorage.java    # persistência em JSON Lines (desenvolvimento)
│       ├── Banco.java             # conexão e pool de conexões com o Postgres
│       ├── Tabela.java            # mapeamento entre registros e colunas
│       ├── Migrar.java            # copia data/*.jsonl para o banco
│       ├── Json.java              # parser e serializador JSON sem dependências
│       └── ValidacaoException.java
├── analise/
│   ├── servico.py                 # serviço de análise e moderação (Python)
│   └── test_servico.py            # testes
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/ (config, api, offline, conta, main, dados, avaliacao, jornada, jogos, mural)
├── .github/workflows/manter-ativo.yml
├── Dockerfile / start.sh          # imagem do Render (Java + Python)
├── .env.example
└── run.bat / run.sh
```

## Privacidade e segurança

Os dados tratados aqui (vício em apostas) podem ser considerados dados de saúde pela LGPD.

- **Avaliação:** não pede nome, e-mail nem telefone. O texto livre de desabafo fica só no navegador.
- **IP:** nunca é gravado. O servidor guarda apenas um HMAC dele, com uma chave secreta (`IP_HMAC_SEGREDO`).
- **Senhas:** PBKDF2-HMAC-SHA512 com 210 mil iterações e sal aleatório. Contas no formato antigo (SHA-256) ganham o hash novo no próximo login.
- **Sessões:**
  - token aleatório de 256 bits, enviado no header `Authorization`, nunca na URL nem em cookie;
  - no servidor fica só o SHA-256 do token;
  - a sessão vale por 30 dias, e as vencidas são apagadas de hora em hora.
- **CORS:** só as origens de `CORS_ORIGENS` podem chamar a API pelo navegador. Toda escrita exige JSON, e há limite de tentativas por IP, principalmente nas rotas com senha.
- **Acesso aos dados:** cada pessoa só acessa os dados da própria conta. As estatísticas e a análise da comunidade escondem grupos com menos de 5 avaliações, para não revelar as respostas de ninguém.
- **Direitos do titular:** na janela da conta, a pessoa pode baixar todos os seus dados em JSON ou apagar a conta, com a jornada, o diário, os recordes e as avaliações. As mensagens do mural são anônimas e não ficam ligadas à conta.
- **Banco:**
  - todas as consultas usam `PreparedStatement`;
  - a conexão usa TLS;
  - as tabelas ficam no schema `recomeco`, com RLS ligado e sem acesso para os papéis públicos da Data API do Supabase.
- **Sem rastreamento:** o site não usa analytics nem rastreadores. Ao sair da conta, os dados pessoais são apagados do aparelho e continuam guardados na conta.

## Aviso

Projeto educativo. Não substitui atendimento médico ou psicológico. Em sofrimento, ligue **188 (CVV)**; em emergência, **192 (SAMU)**.
