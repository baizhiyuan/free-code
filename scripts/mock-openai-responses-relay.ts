type MockRelayScenario = 'text' | 'tool-call'

export type MockRelayRequest = {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
}

export type MockRelayServer = {
  baseUrl: string
  requests: MockRelayRequest[]
  stop: () => Promise<void>
}

type MockRelayOptions = {
  host?: string
  port?: number
  scenario?: MockRelayScenario
}

function createSseStream(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
}

function buildStreamEvents(
  scenario: MockRelayScenario,
  model: string,
): unknown[] {
  const responseId = 'resp_mock_1'

  if (scenario === 'tool-call') {
    return [
      {
        type: 'response.created',
        response: { id: responseId, status: 'in_progress', model, output: [] },
      },
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: {
          id: 'fc_mock_1',
          type: 'function_call',
          status: 'in_progress',
          call_id: 'call_mock_1',
          name: 'shell',
          arguments: '',
        },
      },
      {
        type: 'response.function_call_arguments.delta',
        item_id: 'fc_mock_1',
        output_index: 0,
        delta: '{"cmd":"pwd"}',
      },
      {
        type: 'response.function_call_arguments.done',
        item_id: 'fc_mock_1',
        output_index: 0,
        arguments: '{"cmd":"pwd"}',
      },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          id: 'fc_mock_1',
          type: 'function_call',
          status: 'completed',
          call_id: 'call_mock_1',
          name: 'shell',
          arguments: '{"cmd":"pwd"}',
        },
      },
      {
        type: 'response.completed',
        response: {
          id: responseId,
          status: 'completed',
          model,
          output: [
            {
              id: 'fc_mock_1',
              type: 'function_call',
              status: 'completed',
              call_id: 'call_mock_1',
              name: 'shell',
              arguments: '{"cmd":"pwd"}',
            },
          ],
        },
      },
    ]
  }

  return [
    {
      type: 'response.created',
      response: { id: responseId, status: 'in_progress', model, output: [] },
    },
    {
      type: 'response.output_text.delta',
      delta: 'mock relay text response',
      output_index: 0,
      content_index: 0,
    },
    {
      type: 'response.completed',
      response: {
        id: responseId,
        status: 'completed',
        model,
        output: [
          {
            id: 'msg_mock_1',
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: 'mock relay text response',
                annotations: [],
              },
            ],
          },
        ],
      },
    },
  ]
}

function buildJsonResponse(scenario: MockRelayScenario, model: string): unknown {
  if (scenario === 'tool-call') {
    return {
      id: 'resp_mock_1',
      object: 'response',
      status: 'completed',
      model,
      output: [
        {
          id: 'fc_mock_1',
          type: 'function_call',
          status: 'completed',
          call_id: 'call_mock_1',
          name: 'shell',
          arguments: '{"cmd":"pwd"}',
        },
      ],
    }
  }

  return {
    id: 'resp_mock_1',
    object: 'response',
    status: 'completed',
    model,
    output: [
      {
        id: 'msg_mock_1',
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: 'mock relay text response',
            annotations: [],
          },
        ],
      },
    ],
  }
}

export async function startMockOpenAIResponsesRelay(
  options: MockRelayOptions = {},
): Promise<MockRelayServer> {
  const requests: MockRelayRequest[] = []
  const host = options.host ?? '127.0.0.1'
  const scenario = options.scenario ?? 'text'

  const server = Bun.serve({
    hostname: host,
    port: options.port ?? 0,
    fetch: async request => {
      const url = new URL(request.url)
      if (request.method !== 'POST' || url.pathname !== '/v1/responses') {
        return new Response('Not found', { status: 404 })
      }

      const body = await request.json()
      requests.push({
        method: request.method,
        path: url.pathname,
        headers: Object.fromEntries(request.headers.entries()),
        body,
      })

      const model =
        typeof body === 'object' &&
        body !== null &&
        typeof (body as { model?: unknown }).model === 'string'
          ? ((body as { model: string }).model ?? 'gpt-5.4')
          : 'gpt-5.4'
      const stream =
        typeof body === 'object' &&
        body !== null &&
        Boolean((body as { stream?: unknown }).stream)

      if (stream) {
        return new Response(createSseStream(buildStreamEvents(scenario, model)), {
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
          },
        })
      }

      return Response.json(buildJsonResponse(scenario, model))
    },
  })

  return {
    baseUrl: `http://${server.hostname}:${server.port}`,
    requests,
    stop: async () => {
      await server.stop(true)
    },
  }
}

async function main(): Promise<void> {
  const scenario = (process.env.MOCK_RELAY_SCENARIO as MockRelayScenario) ?? 'text'
  const server = await startMockOpenAIResponsesRelay({ scenario })
  console.log(server.baseUrl)

  await new Promise<void>(resolve => {
    const shutdown = async () => {
      process.off('SIGINT', shutdown)
      process.off('SIGTERM', shutdown)
      await server.stop()
      resolve()
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  })
}

if (import.meta.main) {
  await main()
}
