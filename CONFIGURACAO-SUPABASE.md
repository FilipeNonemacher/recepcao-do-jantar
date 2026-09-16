# Configuração do banco central sincronizado

O aplicativo usa Supabase para banco central, login e atualizações em tempo real. O GitHub Pages continua responsável apenas pelas telas.

## 1. Criar o projeto

1. Entre em https://supabase.com/dashboard.
2. Crie ou escolha uma organização.
3. Clique em **New project**.
4. Use o nome `recepcao-do-jantar`.
5. Escolha o plano Free e a região mais próxima do Brasil disponível.
6. Crie uma senha forte para o banco e guarde-a em local seguro.
7. Aguarde a criação terminar.

## 2. Criar a tabela protegida

1. No projeto, abra **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `supabase/schema.sql` deste pacote.
4. Copie todo o conteúdo, cole no editor e clique em **Run**.

O script cria ou atualiza as tabelas `guests` e `event_layouts`, valida nome, função, acompanhantes e mesa, ativa a proteção por linha, bloqueia visitantes não autenticados e habilita as atualizações em tempo real. Se o banco já existir, execute novamente o arquivo completo para adicionar o campo `guest_role` e a planta editável; os convidados antigos receberão a função **Convidado**.

## 3. Criar o acesso da recepção

1. Abra **Authentication → Users**.
2. Escolha **Add user** e crie um único usuário com e-mail e senha, por exemplo `recepcao@seuevento.com`.
3. Marque o usuário como confirmado, se essa opção aparecer.
4. Desative novas inscrições públicas nas configurações de autenticação.
5. Não ative **Single session per user**. Todos os celulares e iPads precisam manter sessões simultâneas com o mesmo usuário.

Passe esse mesmo e-mail e senha para os integrantes da recepção. O botão **Sair** do aplicativo encerra somente a sessão do aparelho atual.

## 4. Copiar as duas informações públicas

Abra as configurações de API do projeto ou o botão **Connect** e copie:

- **Project URL**
- **Publishable key**

Não copie nem exponha a chave `service_role` ou qualquer chave secreta administrativa.

## 5. Ligação com o aplicativo

O pacote entregue já contém a Project URL e a Publishable key fornecidas pelo responsável. Não é necessário cadastrar segredos no GitHub para a primeira publicação.

Se o projeto Supabase for trocado no futuro, defina `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` durante a compilação para substituir os valores atuais.

## 6. Validar a sincronização

1. Abra o endereço publicado em dois aparelhos ou em dois navegadores.
2. Entre com o acesso da recepção nos dois.
3. Cadastre um convidado no primeiro.
4. O convidado deve aparecer no segundo automaticamente.
5. Edite a mesa no segundo e confirme a mudança no primeiro.
6. Abra a aba **Mapa**, mova uma mesa, salve e confirme a mudança no segundo aparelho.
7. Pesquise um convidado e toque no nome para conferir o destaque da mesa na planta.
8. Desligue a internet de um deles e confirme que a última lista e o último mapa continuam disponíveis para consulta. Alterações ficam bloqueadas enquanto o banco não puder ser alcançado.

## Segurança

- A lista não fica gravada no repositório do GitHub.
- O visitante sem login não consegue consultar ou alterar convidados.
- As regras do banco permitem operações somente para usuários autenticados.
- A Publishable key pode ser usada pelo aplicativo porque a segurança está nas regras do banco. A `service_role` nunca deve entrar no aplicativo ou no GitHub Pages.
