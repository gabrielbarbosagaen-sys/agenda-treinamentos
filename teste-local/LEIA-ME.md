# Teste local (sem Supabase)

Roda o app no seu computador com um banco de dados de mentira, já preenchido com exemplos.
Serve só para experimentar: **os dados somem ao fechar a janela** e nada é publicado.

## Como abrir

1. Dê dois cliques em **`Testar.bat`** (nesta pasta). Precisa do Node.js instalado.
2. Na primeira vez ele instala o que precisa (leva alguns segundos).
3. O navegador abre duas abas:
   - **Painel:** <http://localhost:5599/admin.html>
   - **Página de inscrição:** <http://localhost:5599/index.html?t=gestao-agil-de-projetos-ab12>
4. Para encerrar, feche a janela preta.

## Login do painel (só vale neste teste)

- E-mail: `admin@teste.com`
- Senha: `senha123`

## Dados de exemplo

- 20 colaboradores (matrículas `01001` a `01020`), em 3 unidades. Ex.: **Eduarda Rocha**, matrícula **01005**.
- Treinamento **Gestão Ágil de Projetos** (identificação por nome + matrícula), com 3 turmas.
  A primeira já está lotada e tem 1 pessoa na lista de espera.

## Roteiro sugerido

1. Na página de inscrição, procure "Eduarda", digite a matrícula `01005` e escolha uma turma.
2. Tente trocar de turma e entrar na lista de espera.
3. No painel, abra o treinamento e veja a pessoa em **Inscritos e presença**.
4. Cancele alguém da turma lotada e veja o 1º da lista de espera ser confirmado sozinho.
5. Crie um treinamento novo, teste outro modo de identificação (ex.: "Nome livre") e cadastre turmas.
6. Em **Colaboradores**, baixe o modelo, preencha algumas linhas e importe.
7. Teste **Pendentes**, **Exportar Excel** e **QR Code**.

> Para ver como fica no celular: no navegador, aperte F12 e clique no ícone de celular/tablet.
