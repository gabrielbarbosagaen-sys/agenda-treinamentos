# Agenda de Treinamentos — Escritório de Projetos

App web para criar treinamentos com várias turmas (data, horário, local e vagas) e enviar um link
para os colaboradores escolherem a turma em que vão participar.

- **Página de inscrição** (`index.html`): o colaborador se identifica, vê as turmas com as vagas disponíveis e escolhe.
- **Painel administrativo** (`admin.html`): cria treinamentos e turmas, importa colaboradores, convida, acompanha
  inscritos e pendentes, marca presença e exporta para Excel.

Hospedagem: **GitHub Pages** (as páginas) + **Supabase** (banco de dados e login do painel). Os dois são gratuitos.

---

## Funcionalidades

| Recurso | Como funciona |
|---|---|
| Identificação configurável | Por treinamento: **nome + matrícula**, **só o nome**, **só a matrícula** ou **nome livre** (nome + telefone, sem cadastro). |
| Colaboradores pré-cadastrados | Importados de planilha Excel (matrícula, nome, unidade, setor, cargo). Reimporte sempre que houver mudanças. |
| Convites | Por unidade/setor/cargo, por lista de matrículas coladas ou um a um. Pode deixar o treinamento aberto a todos. |
| Vagas | Cada turma tem o seu limite. Duas pessoas não conseguem pegar a mesma última vaga. |
| Lista de espera | Quando a turma lota, a pessoa entra na fila. Se alguém cancelar (ou você aumentar as vagas), o 1º da fila é confirmado automaticamente. |
| Troca e cancelamento | O próprio colaborador troca ou cancela até X horas antes (padrão 24h, configurável). Depois disso, só o administrador. |
| Pendentes | Mostra quem foi convidado e ainda não escolheu turma. Copia a lista ou uma mensagem pronta para WhatsApp. |
| Presença | Marque presente ou falta por pessoa (ou todos de uma vez) e imprima a lista de assinatura. |
| Excel | Exporta turmas, inscritos, pendentes e cancelamentos de cada treinamento. |
| QR Code | Gera o QR Code do link para imprimir em murais ou enviar por WhatsApp/e-mail. |
| Agenda | O colaborador pode adicionar o treinamento à agenda do celular. |
| Visual | Tema claro e escuro, pensado para celular e computador. Nome, cor e logo configuráveis. |

---

## Passo a passo para colocar no ar

### 1. Criar o banco no Supabase

1. Crie uma conta em <https://supabase.com> e clique em **New project**.
   Escolha um nome, uma senha forte para o banco e a região **South America (São Paulo)**.
2. Abra o arquivo [`supabase/schema.sql`](supabase/schema.sql) e, **na última linha**, troque
   `SEU-EMAIL-AQUI@exemplo.com` pelo e-mail que vai acessar o painel.
3. No Supabase, vá em **SQL Editor → New query**, cole o conteúdo inteiro do `schema.sql` e clique em **Run**.
   Deve aparecer "Success".
4. Vá em **Authentication → Users → Add user → Create new user**. Use o **mesmo e-mail** do passo 2, defina uma
   senha e marque **Auto Confirm User**.
5. Recomendado: em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**.
   Assim ninguém consegue criar conta sozinho (o painel já bloqueia quem não está na lista de admins, mas isso
   reforça a segurança).
6. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.

> Para adicionar outro administrador: crie o usuário (passo 4) e rode no SQL Editor:
> `insert into admins (email) values ('outro@email.com');`

### 2. Configurar o app

Abra [`js/config.js`](js/config.js) e preencha:

```js
SUPABASE_URL: 'https://xxxxxxxx.supabase.co',   // Project URL
SUPABASE_ANON_KEY: 'eyJhbGciOi...',              // chave anon public
EMPRESA: 'Escritório de Projetos',              // nome exibido no topo
SUBTITULO: 'Agenda de treinamentos',
LOGO_URL: '',                                    // opcional: caminho de uma imagem de logo
COR_PRIMARIA: '#4353e8',                          // cor principal (a paleta é gerada a partir dela)
```

A chave **anon** é pública por natureza e pode ficar no GitHub: o banco só deixa o público usar as funções de
inscrição. Nunca coloque a chave **service_role** neste arquivo.

### 3. Publicar no GitHub Pages

1. Crie um repositório em <https://github.com/new> (ex.: `treinamentos`). Para usar o GitHub Pages grátis, ele
   precisa ser **público**.
2. Envie todos os arquivos desta pasta (pelo site: **Add file → Upload files** e arraste tudo; ou pelo `git`).
3. No repositório, vá em **Settings → Pages**, em **Source** escolha **Deploy from a branch**, branch `main`,
   pasta `/ (root)`, e salve.
4. Em 1 a 2 minutos o app estará em `https://SEU-USUARIO.github.io/treinamentos/`.
5. Volte ao Supabase em **Authentication → URL Configuration** e coloque esse endereço em **Site URL**
   (necessário para o "Esqueci minha senha" funcionar).

### 4. Usar

1. Acesse `https://SEU-USUARIO.github.io/treinamentos/admin.html` e entre com o e-mail e a senha.
2. **Colaboradores → Baixar modelo**, preencha no Excel e use **Importar planilha**.
3. **Treinamentos → + Novo treinamento**: nome, forma de identificação, prazo para troca, lista de espera.
4. Na aba **Turmas**, cadastre as datas, horários, locais e vagas (use **Duplicar** para agilizar).
5. Na aba **Convidados**, convide por unidade/setor ou cole as matrículas.
6. Clique em **Copiar link** (ou **QR Code**) e envie para os colaboradores.
7. Acompanhe pelas abas **Inscritos e presença** e **Pendentes**; no dia, marque a presença.

---

## Bom saber

- **Projeto gratuito do Supabase "dorme" após 7 dias sem nenhum acesso.** Com o app em uso isso não acontece. Se
  pausar, entre no painel do Supabase e clique em **Restore project**.
- Os horários são gravados com fuso horário: cadastre as turmas no horário local e todos verão o horário certo.
- Excluir um colaborador apaga também o histórico dele. Para quem saiu da empresa, prefira desmarcar **Ativo**
  (ou reimportar a planilha marcando "Inativar colaboradores que não estão na planilha").
- No modo **só o nome**, qualquer pessoa com o link pode escolher qualquer nome. Para treinamentos obrigatórios,
  prefira **nome + matrícula**.

## Estrutura dos arquivos

```
index.html            página de inscrição (link enviado aos colaboradores)
admin.html            painel administrativo
js/config.js          configuração (Supabase, nome da empresa, cor)
js/public.js          lógica da página de inscrição
js/admin.js           lógica do painel
js/common.js          funções compartilhadas
css/style.css         visual
supabase/schema.sql   tabelas, regras de segurança e funções do banco
```
