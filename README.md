# Recomeço: apoio para sair do vício em apostas

Site educativo e de apoio para pessoas viciadas em apostas (bets, cassinos online, "tigrinho", Aviator) e para as suas famílias.

## Funcionalidades

- **Avaliação logo na primeira visita**: uma janela convida a pessoa a fazer a avaliação antes de tudo. São 8 etapas: como começou, há quanto tempo aposta, frequência, tipo de jogo, gasto mensal, dia a dia, dívidas, se esconde da família, arrependimento, se quer ajuda e as 9 perguntas do **PGSI** (Problem Gambling Severity Index). O backend calcula o nível de risco e devolve um **plano personalizado**.
- **Avaliação salva por conta e por IP**: quem entra na conta vê o seu resultado em qualquer aparelho, com o **histórico da sua evolução**. Pelo IP, o site só lembra que a avaliação já foi feita (para não pedir de novo); o resultado de uma pessoa nunca aparece para outra que use a mesma rede.
- **Contas anônimas**: só apelido e senha, sem e-mail. A jornada, o diário, as vontades vencidas e os recordes dos jogos ficam sincronizados com a conta.
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

| Parte | Tecnologia | Função |
|---|---|---|
| Frontend | HTML, CSS e JavaScript puros | Interface do site |
| Backend principal | Java 21+ (só o JDK, `com.sun.net.httpserver`) | API, contas, sessões, avaliações, mural e arquivos do site |
| Serviço de análise | Python 3.10+ (só a biblioteca padrão) | Estatísticas detalhadas, comparação com a comunidade e moderação do mural |

O navegador fala só com o Java. O Java repassa as rotas `/api/analise/*` para o Python e pede a ele a revisão de cada mensagem do mural. Se o Python estiver desligado, o site continua funcionando: só a análise detalhada some e o mural usa a verificação básica do Java.

Os dados ficam em arquivos JSON Lines na pasta `data/`.

## Como rodar

Requer Java 21 ou superior e, de preferência, Python 3.10 ou superior.

```bash
# Windows
run.bat

# Linux / macOS
./run.sh
```

Os scripts compilam o Java, sobem o serviço Python na porta 8081 e o site em http://localhost:8080.

Variáveis de ambiente opcionais:

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `8080` | Porta do site (Java) |
| `ANALISE_URL` | `http://127.0.0.1:8081` | Endereço do serviço Python |
| `ANALISE_PORTA` | `8081` | Porta do serviço Python |
| `COOKIE_SEGURO` | (vazio) | Use `1` em produção com HTTPS |
| `CONFIAR_PROXY` | (vazio) | Use `1` atrás de um proxy reverso, para ler o IP de `X-Forwarded-For` |

### Testes do serviço Python

```bash
cd analise
python -m unittest -v
```

### Versão online (GitHub Pages)

O site também funciona sem servidor: https://policarpogustavo.github.io/recome-o_chegadeapostas/

Nesse modo, `frontend/js/offline.js` faz o papel da API dentro do navegador. A avaliação, o mural e as estatísticas ficam salvos apenas no aparelho de quem usa, e as contas ficam indisponíveis.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dados` | Dados educativos, ciclo do vício, sinais e legislação |
| GET | `/api/quiz` | Perguntas do quiz "Mito ou verdade" |
| GET | `/api/motivacao` | Frase motivacional aleatória |
| POST | `/api/avaliacao` | Envia o questionário e recebe o resultado e o plano |
| GET | `/api/avaliacao/minha` | Resultado e histórico da conta, ou se o IP já fez a avaliação |
| POST | `/api/avaliacao/vincular` | Leva para a conta uma avaliação feita antes do login |
| GET | `/api/estatisticas` | Agregados anônimos das avaliações |
| GET | `/api/depoimentos` | Últimas 30 mensagens do mural |
| POST | `/api/depoimentos` | Publica uma mensagem anônima |
| POST | `/api/auth/cadastro` | Cria uma conta (apelido e senha) |
| POST | `/api/auth/login` | Entra na conta |
| POST | `/api/auth/sair` | Sai da conta |
| GET | `/api/auth/eu` | Diz se há alguém logado |
| GET / PUT | `/api/usuario/dados` | Lê ou salva a jornada, o diário e os recordes |
| GET | `/api/analise/resumo` | Análise da comunidade (Python) |
| GET | `/api/analise/percentil?score=N` | Compara uma pontuação com as demais (Python) |
| GET | `/api/saude` | Diz se o Java e o Python estão no ar |

## Estrutura

```
recomeco/
├── backend/src/br/com/recomeco/
│   ├── Main.java              # servidor HTTP, rotas, cookies, limites e arquivos estáticos
│   ├── AvaliacaoService.java  # validação, cálculo PGSI, plano, histórico e estatísticas
│   ├── UsuarioService.java    # contas, senhas (PBKDF2), sessões e dados sincronizados
│   ├── DepoimentoService.java # mural de mensagens
│   ├── ConteudoService.java   # dados educativos, quiz e frases
│   ├── AnaliseCliente.java    # cliente HTTP do serviço Python
│   ├── Storage.java           # persistência em JSON Lines
│   ├── Json.java              # parser e serializador JSON sem dependências
│   └── ValidacaoException.java
├── analise/
│   ├── servico.py             # serviço de análise e moderação (Python)
│   └── test_servico.py        # testes
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/ (api, offline, conta, main, dados, avaliacao, jornada, jogos, mural)
├── run.bat / run.sh
└── data/ (criada ao rodar)
```

## Privacidade e segurança

- A avaliação não pede nome, e-mail nem telefone, e o texto livre de desabafo fica só no navegador.
- O IP nunca é gravado: o servidor guarda apenas um HMAC dele, com uma chave secreta gerada na primeira execução (`data/segredo.key`).
- Senhas são guardadas com PBKDF2 (210 mil iterações e sal aleatório). Os tokens de sessão ficam em cookie `HttpOnly` e `SameSite=Lax`, e no servidor só o hash deles é salvo.
- Toda escrita na API exige JSON, o que bloqueia formulários enviados por outros sites. Há limite de tentativas por IP, principalmente para login e cadastro.
- Ao sair da conta, os dados pessoais são apagados do aparelho e continuam guardados na conta.

## Aviso

Projeto educativo. Não substitui atendimento médico ou psicológico. Em sofrimento, ligue **188 (CVV)**; em emergência, **192 (SAMU)**.
