import { afterEach, describe, expect, it } from 'bun:test'

import {
  startMockOpenAIResponsesRelay,
  type MockRelayServer,
} from './mock-openai-responses-relay.ts'

const activeServers: MockRelayServer[] = []

afterEach(async () => {
  while (activeServers.length > 0) {
    const server = activeServers.pop()
    if (server) {
      await server.stop()
    }
  }
})

describe('startMockOpenAIResponsesRelay', () => {
  it('streams a text response without chatgpt-specific headers', async () => {
    const server = await startMockOpenAIResponsesRelay({ scenario: 'text' })
    activeServers.push(server)

    const response = await fetch(`${server.baseUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.4',
        stream: true,
        input: 'hello',
      }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')

    const body = await response.text()
    expect(body).toContain('"type":"response.output_text.delta"')
    expect(body).toContain('mock relay text response')
    expect(body).toContain('data: [DONE]')

    expect(server.requests).toHaveLength(1)
    expect(server.requests[0]?.headers['chatgpt-account-id']).toBeUndefined()
    expect(server.requests[0]?.headers.originator).toBeUndefined()
  })

  it('returns a tool-call response body for non-stream requests', async () => {
    const server = await startMockOpenAIResponsesRelay({ scenario: 'tool-call' })
    activeServers.push(server)

    const response = await fetch(`${server.baseUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.4',
        stream: false,
        input: [{ role: 'user', content: 'run a tool' }],
      }),
    })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toMatchObject({
      model: 'gpt-5.4',
      output: [
        {
          type: 'function_call',
          name: 'shell',
          arguments: '{"cmd":"pwd"}',
        },
      ],
    })
  })
})
