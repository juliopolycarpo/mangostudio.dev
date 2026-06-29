---
title: "Referência da CLI"
sidebarLabel: "Referência da CLI"
lang: "pt"
slug: "reference/cli"
groupId: "reference"
groupTitle: "Referência"
order: 10
sourcePath: "docs/pt-br/reference/cli.md"
sourceUrl: "https://github.com/juliopolycarpo/mangostudio/blob/5490f9a050c73225da1673d7dce7f6f1300b548c/docs/pt-br/reference/cli.md"
sourceCommit: "5490f9a050c73225da1673d7dce7f6f1300b548c"
---

# Referência da CLI

O MangoStudio é distribuído como um binário único que também funciona como CLI
para rodar e gerenciar um servidor local. Os mesmos comandos funcionam no binário
instalado (`mangostudio`) e a partir do código-fonte
(`bun run apps/api/src/index.ts <command>`).

> 🇺🇸 [English version](/en/docs/reference/cli)

## Canais de instalação

Escolha qualquer canal de distribuição — cada um entrega o mesmo binário
pré-compilado e sidecar do frontend. Veja a
[matriz de instalação do README](/en/docs/quickstart#install) ou:

| Canal              | Ponto de entrada                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm / bun          | `mangostudio` — veja [`packages/cli/README.md`](https://github.com/juliopolycarpo/mangostudio/blob/5490f9a050c73225da1673d7dce7f6f1300b548c/packages/cli/README.md)                             |
| Homebrew           | `brew install juliopolycarpo/tap/mangostudio`                                                                                                                                                   |
| Shell / PowerShell | `install.sh` / `install.ps1` do GitHub Releases                                                                                                                                                 |
| Scoop              | `juliopolycarpo/scoop-bucket` → `scoop install mangostudio`                                                                                                                                     |
| Cargo              | `cargo install mangostudio` — veja [`packages/cargo-shim/README.md`](https://github.com/juliopolycarpo/mangostudio/blob/5490f9a050c73225da1673d7dce7f6f1300b548c/packages/cargo-shim/README.md) |
| Docker             | `ghcr.io/juliopolycarpo/mangostudio` — veja [`deployment.md`](/docs/operations/deployment#docker)                                                                                               |
| Manual             | Baixe arquivos de plataforma do GitHub Releases e verifique `SHA256SUMS`                                                                                                                        |

## Comandos

| Comando                            | Descrição                                                  |
| ---------------------------------- | ---------------------------------------------------------- |
| `mangostudio`                      | Imprime ajuda e a lista de comandos.                       |
| `serve [host\|port\|host:port]`    | Inicia o servidor em foreground (padrão `localhost:3001`). |
| `serve [host\|port\|host:port] -d` | Inicia o servidor em background (detached) e retorna.      |
| `status`                           | Mostra se um servidor está rodando e seus detalhes.        |
| `stop`                             | Encerra graciosamente o servidor em execução (SIGTERM).    |
| `killserver`                       | Força encerramento do servidor (SIGKILL).                  |
| `doctor`                           | Executa diagnósticos de ambiente e configuração.           |
| `version`, `--version`, `-v`       | Imprime a versão embutida do MangoStudio.                  |

## Exemplos

```bash
mangostudio serve              # foreground em localhost:3001
mangostudio serve 3000         # foreground em localhost:3000
mangostudio serve 127.0.0.1 -d # background em 127.0.0.1:3001
mangostudio serve lan:3000 -d  # background em 0.0.0.0:3000
mangostudio --version
mangostudio status
mangostudio stop
```

Para detalhes de modo background, instância única, arquivos de runtime, códigos
de saída e configuração, consulte a
[versão completa em inglês](/en/docs/reference/cli).
