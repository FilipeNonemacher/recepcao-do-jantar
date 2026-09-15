# Recepção do Jantar

Aplicativo Expo/React Native para cadastrar e localizar convidados de um evento.

## Testar durante o desenvolvimento

```powershell
npm install
npm start
```

Para conferir as regras e o código:

```powershell
npm test
npm run check
```

Os dados desta primeira versão ficam no armazenamento local do aparelho. O contrato `GuestRepository`, em `src/data/guestRepository.ts`, isola o armazenamento para que o repositório sincronizado seja conectado na próxima etapa.

## Publicar no GitHub Pages

O projeto possui uma automação em `.github/workflows/deploy-pages.yml`. Ela verifica, compila e publica o aplicativo quando há uma atualização na branch `main`. O caminho correto do repositório é detectado automaticamente.

No GitHub, abra **Settings → Pages** e selecione **GitHub Actions** em **Source**. Consulte `INSTRUCOES-PARA-PUBLICAR.md` para a publicação e `CONFIGURACAO-SUPABASE.md` para ligar a sincronização.
