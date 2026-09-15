# Como publicar e testar

## Arquivos corretos

Envie o conteúdo desta pasta `aplicativo` para a raiz de um repositório no GitHub. Na raiz devem aparecer, entre outros:

- `.github`
- `assets`
- `public`
- `src`
- `App.tsx`
- `app.json`
- `app.config.js`
- `package.json`
- `package-lock.json`

Não envie a pasta `node_modules`; ela é grande e será criada automaticamente durante a publicação.

## Publicação

1. Crie um repositório no GitHub, por exemplo `recepcao-do-jantar`.
2. Descompacte o pacote recebido e coloque todo o conteúdo da pasta na raiz do repositório.
3. Confirme que a branch principal se chama `main`.
4. Abra **Settings → Pages** no repositório.
5. Em **Build and deployment → Source**, escolha **GitHub Actions**.
6. Abra a aba **Actions**. A tarefa “Publicar aplicativo no GitHub Pages” fará os testes e a publicação.
7. Ao terminar, o endereço será semelhante a `https://SEU-USUARIO.github.io/recepcao-do-jantar/`.

O pacote já está conectado ao projeto Supabase fornecido. Consulte `CONFIGURACAO-SUPABASE.md` para conferir o banco e o login compartilhado.

## Instalar no aparelho

### iPhone ou iPad

Abra o endereço no Safari, toque em **Compartilhar**, escolha **Adicionar à Tela de Início**, ative **Abrir como App da Web** e toque em **Adicionar**.

### Android

Abra o endereço no Chrome, abra o menu e escolha **Instalar app** ou **Adicionar à tela inicial**.

## Estado deste pacote de teste

Cadastro, busca, edição, exclusão, login, cache local e sincronização em tempo real estão implementados. Sem as duas credenciais do Supabase configuradas no GitHub, o aplicativo abre em “Modo local de teste”. Com as credenciais e o arquivo SQL aplicados, todos os aparelhos autenticados usam a mesma lista central.
