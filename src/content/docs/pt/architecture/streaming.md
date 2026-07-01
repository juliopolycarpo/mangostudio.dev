---
title: "Arquitetura De Streaming"
sidebarLabel: "Arquitetura De Streaming"
lang: "pt"
slug: "architecture/streaming"
groupId: "architecture"
groupTitle: "Arquitetura"
order: 20
sourcePath: "docs/pt-br/architecture/streaming.md"
sourceUrl: "https://github.com/juliopolycarpo/mangostudio/blob/c8a260ecd3cf98c5fb630b756a93afe762cb2af8/docs/pt-br/architecture/streaming.md"
sourceCommit: "c8a260ecd3cf98c5fb630b756a93afe762cb2af8"
---

# Arquitetura De Streaming

As respostas do chat são entregues via Server-Sent Events (SSE) sobre uma única conexão HTTP. O frontend consome o stream usando `ReadableStream` da Fetch API e mapeia os eventos para atualizações de UI.

## Catálogo De Eventos SSE

Todos os eventos estendem `StreamChunk`, uma union discriminada pela propriedade `type`:

| Evento                       | Direção         | Finalidade                                          |
| ---------------------------- | --------------- | --------------------------------------------------- |
| `user_message_id`            | Server → Client | ID da mensagem do usuário persistida no turno       |
| `thinking_start`             | Server → Client | Modelo inicia reasoning/thinking                    |
| `thinking`                   | Server → Client | Deltas de tokens de reasoning                       |
| `text`                       | Server → Client | Deltas de texto do modelo                           |
| `tool_call_started`          | Server → Client | Modelo inicia uma chamada de tool                   |
| `tool_call_completed`        | Server → Client | Argumentos da tool foram recebidos por completo     |
| `tool_result`                | Server → Client | Resultado da execução da tool                       |
| `image_generation_started`   | Server → Client | Geração de imagem iniciada (via tool)               |
| `image_generation_completed` | Server → Client | Imagem gerada com sucesso                           |
| `image_generation_failed`    | Server → Client | Falha na geração de imagem                          |
| `context_info`               | Server → Client | Uso de tokens e status da janela de contexto        |
| `fallback_notice`            | Server → Client | Notificação de degradação da continuação            |
| `continuation_transition`    | Server → Client | Transição de modo de continuação                    |
| `system_event`               | Server → Client | Marcadores de timeline (ex.: loop de tool esgotado) |
| `done`                       | Server → Client | Turno concluído                                     |
| `error`                      | Server → Client | Erro fatal                                          |

## Ciclo De Vida Dos Eventos

Um turno típico com chamada de tools:

```
user_message_id
thinking_start
thinking (deltas...)
tool_call_started
  tool_call_arguments_delta (deltas...)
tool_call_completed
tool_result (um por tool call)
  assistant_text_delta (deltas...)
context_info
done
```

Se a continuação degrada, por exemplo quando o provedor ou modelo mudou:

```
fallback_notice
continuation_transition (recovered: false)
  ... eventos normais ...
continuation_transition (recovered: true)
done
```

## Formato Wire Do SSE

```
: keepalive

data: {"type":"user_message_id","messageId":"msg_abc123","done":false}

data: {"type":"text","text":"Hello","done":false}

data: {"type":"done","messageId":"msg_def456","done":true}
```

- Cada evento é enquadrado como `data: <JSON>\n\n`.
- Um comentário keepalive (`: keepalive\n\n`) é enviado a cada 15 segundos para evitar timeouts em proxies.
- Todo evento carrega um campo `done`; o evento final usa `done: true`.
- Os eventos são encerrados por uma linha em branco dupla.

## Implementação No Servidor

### Rota (`respond-stream-routes.ts`)

`POST /api/respond/stream` com body validado por `RespondStreamBodySchema`:

```typescript
{
  chatId: string;
  prompt: string;
  thinkingEnabled?: boolean;
  reasoningEffort?: string;
  toolIntent?: boolean;
  modelId?: string;
  attachmentIds?: string[];
}
```

**Validações prévias** que retornam erro HTTP antes dos headers SSE:

1. Verificação de ownership do chat → 404.
2. Validação de conteúdo, como prompt não vazio e attachments disponíveis → 400.
3. Resolução do modelo, garantindo que provedor exista e modelo esteja disponível → 503/400.

**Resposta SSE** define headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.

### Orquestrador (`stream-text-turn.ts`)

O async generator principal que dirige o turno:

1. **Setup** — Persiste a mensagem do usuário, resolve modelo/provedor e compõe prompt rules.
2. **Decisão de continuação** — Consulta `chats.lastProviderState` para decidir entre continuação por cursor ou replay.
3. **Loop agentic** — Chama `provider.generateAgentTurnStream()` em iterações:
   - Encaminha todos os eventos do provedor como eventos SSE.
   - Ao receber tool calls, executa tools e devolve os resultados.
   - Em `turn_completed`, calcula o snapshot de contexto, persiste o estado e produz `done`.
4. **Fallback** — Se o provedor não suportar streaming agentic, cai para `generateTextStream()` ou `generateText()`.

## Consumo No Frontend

### Camada De Serviço (`generation-service.ts`)

Streaming bruto baseado em `fetch` usando `ReadableStream`:

```typescript
const response = await fetch('/api/respond/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
  credentials: 'include',
  signal, // AbortSignal para cancelamento
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value, { stream: true });
  // Divide por \n e faz parse das linhas que começam com "data: "
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      const chunk = JSON.parse(line.slice(6));
      onChunk(chunk); // StreamChunk
    }
  }
}
```

### Hook (`use-chat-stream.ts`)

Hook React que gerencia o ciclo de vida do stream:

- `isGenerating` / `setIsGenerating` — Toggle do estado de carregamento.
- `handleStop()` — Aborta o stream via `AbortController`.
- `contextInfo` / `fallbackNotice` — Estado rastreado para notificações de contexto/degradação.
- `contextCache` — Cache cross-chat das informações de contexto.

## Tratamento De Erros

- **Erros pré-stream** — Retornam respostas HTTP JSON padrão com códigos tipados.
- **Erros do stream** — `SSEErrorEvent` com `done: true`: `{ type: 'error', error: string, done: true }`.
- **Perda de conexão** — O frontend detecta `reader.read()` retornando `done: true` sem um evento `done` anterior e exibe um erro de fallback.
- **Abort** — A interrupção acionada pelo usuário envia `AbortSignal`; o servidor faz a limpeza via `AbortController` passado ao generator.

## Eventos De Continuação

Veja [`continuation.md`](/docs/architecture/continuation) para a arquitetura completa de continuação. Eventos principais de streaming:

- **`fallback_notice`** — Emitido quando a continuação degrada, como mudança de provedor/modelo/prompt ou cursor expirado. O frontend exibe uma toast notification.
- **`continuation_transition`** — Persistido em message parts. Carrega `recovered: false` durante o turno e é alterado para `recovered: true` em caso de sucesso.
- **`context_info`** — Razão de uso de tokens e severidade. O frontend atualiza o context ring e pode mostrar o callout de compactação.
