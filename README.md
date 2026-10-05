# Recomeço — apoio para sair do vício em apostas

Site educativo e de apoio para pessoas viciadas em apostas (bets, cassinos online, "tigrinho", Aviator) e suas famílias.

## Funcionalidades

- **Avaliação em 8 etapas**: como começou, há quanto tempo aposta, frequência, tipo de jogo (esportiva, cassino, crash…), gasto mensal, dia a dia, dívidas, se esconde da família, arrependimento, se quer ajuda e as 9 perguntas do **PGSI** (Problem Gambling Severity Index). O backend calcula o nível de risco e devolve um **plano personalizado**.
- **Entenda o vício**: ciclo do vício, truques das plataformas e um **simulador** que mostra a casa sempre ganhando (1 jogador ou 1.000 jogadores).
- **Dados**: números do Banco Central, Instituto Locomotiva e The Lancet, gráfico de quanto a casa fica a cada R$ 100, checklist de sinais e **estatísticas anônimas em tempo real** de quem fez a avaliação.
- **Minha jornada**: contador de dias sem apostar, dinheiro preservado, meta de economia, conquistas e diário de humor (salvos no navegador).
- **Jogos sem apostas**: memória, cobrinha, quiz "Mito ou verdade", respiração guiada, jogo da velha e gerador de ideias do que fazer.
- **Mural anônimo** de mensagens de apoio e superação.
- **Botão "Estou com vontade de apostar"**: cronômetro de 10 minutos, passos práticos e contatos (CVV 188).
- Seção para a família, onde buscar ajuda, tema claro/escuro e layout responsivo.

## Tecnologias

- **Frontend**: HTML, CSS e JavaScript puros (sem frameworks).
- **Backend**: Java 21+ usando apenas o JDK (`com.sun.net.httpserver`), sem Maven nem dependências. Persistência em arquivos JSON Lines na pasta `data/`.

## Como rodar

Requer Java 21 ou superior.

```bash
# Windows
run.bat

# Linux / macOS
./run.sh
```

Acesse http://localhost:8080. Para outra porta, defina a variável `PORT`.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dados` | Dados educativos, ciclo do vício, sinais e legislação |
| GET | `/api/quiz` | Perguntas do quiz Mito ou verdade |
| GET | `/api/motivacao` | Frase motivacional aleatória |
| POST | `/api/avaliacao` | Envia o questionário e recebe o resultado + plano |
| GET | `/api/estatisticas` | Agregados anônimos das avaliações |
| GET | `/api/depoimentos` | Últimas 30 mensagens do mural |
| POST | `/api/depoimentos` | Publica uma mensagem anônima |

## Estrutura

```
recomeco/
├── backend/src/br/com/recomeco/
│   ├── Main.java              # servidor HTTP, rotas e arquivos estáticos
│   ├── AvaliacaoService.java  # validação, cálculo PGSI, plano e estatísticas
│   ├── DepoimentoService.java # mural de mensagens
│   ├── ConteudoService.java   # dados educativos, quiz e frases
│   ├── Storage.java           # persistência em JSON Lines
│   ├── Json.java              # parser/serializador JSON sem dependências
│   └── ValidacaoException.java
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/ (api, main, dados, avaliacao, jornada, jogos, mural)
├── run.bat / run.sh
└── data/ (criada ao rodar)
```

## Privacidade

A avaliação não pede nome, e-mail nem telefone, e o texto livre de desabafo fica só no navegador. O diário e o contador de dias também ficam salvos apenas no aparelho (localStorage).

## Aviso

Projeto educativo. Não substitui atendimento médico ou psicológico. Em sofrimento, ligue **188 (CVV)**; em emergência, **192 (SAMU)**.
