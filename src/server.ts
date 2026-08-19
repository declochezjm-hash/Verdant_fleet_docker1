import { createRequestHandler } from '@tanstack/react-start/server'
import { createRouter } from './router'
import { handleVerduraChatRequest } from '../server/api/chat/verdura'

export default async function requestHandler(request: Request) {
  const url = new URL(request.url)
  if (url.pathname === '/api/chat/verdura') {
    return handleVerduraChatRequest(request)
  }
  return createRequestHandler({ createRouter, request })
}
