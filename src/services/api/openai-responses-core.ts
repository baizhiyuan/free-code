export type OpenAIResponsesRequestConfig = {
  url: string
  authorization: string
  extraHeaders?: Record<string, string>
}

export type OpenAIResponsesTranslationResult = {
  requestBody: Record<string, unknown>
  model: string
}

export type OpenAIResponsesCoreConfig = {
  resolveRequestConfig:
    | (() => OpenAIResponsesRequestConfig)
    | (() => Promise<OpenAIResponsesRequestConfig>)
  translateAnthropicRequest: (
    anthropicBody: Record<string, unknown>,
  ) => OpenAIResponsesTranslationResult
  translateStream: (response: Response, model: string) => Promise<Response>
}

async function parseAnthropicRequestBody(
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  try {
    const bodyText =
      init?.body instanceof ReadableStream
        ? await new Response(init.body).text()
        : typeof init?.body === 'string'
          ? init.body
          : '{}'
    return JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    return {}
  }
}

function createOpenAIErrorResponse(
  status: number,
  errorText: string,
): Response {
  return new Response(
    JSON.stringify({
      type: 'error',
      error: {
        type: 'api_error',
        message: `OpenAI Responses API error (${status}): ${errorText}`,
      },
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export function createOpenAIResponsesFetch(
  config: OpenAIResponsesCoreConfig,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)

    if (!url.includes('/v1/messages')) {
      return globalThis.fetch(input, init)
    }

    const anthropicBody = await parseAnthropicRequestBody(init)
    const { requestBody, model } = config.translateAnthropicRequest(anthropicBody)
    const requestConfig = await config.resolveRequestConfig()

    const response = await globalThis.fetch(requestConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${requestConfig.authorization}`,
        ...(requestConfig.extraHeaders ?? {}),
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      return createOpenAIErrorResponse(response.status, await response.text())
    }

    return config.translateStream(response, model)
  }
}
