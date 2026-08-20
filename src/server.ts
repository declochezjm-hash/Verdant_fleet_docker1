import { createRequestHandler } from '@tanstack/react-start/server'
import { createRouter } from './router'

export default async function requestHandler(request: Request) {
  const url = new URL(request.url)
  if (url.pathname === '/api/chat/verdura') {
    const { handleVerduraChatRequest } = await import('../server/api/chat/verdura')
    return handleVerduraChatRequest(request)
  }
  return createRequestHandler({ createRouter, request })
}
