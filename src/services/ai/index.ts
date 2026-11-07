import { getSettings } from '@/stores/settings';

import { geminiProvider } from './gemini';
import { localProvider } from './local';
import { AiUnavailableError, type AiProvider } from './types';

export * from './types';
export { getGeminiKey, saveGeminiKey, testGeminiKey } from './gemini';
export { fluidsFromCatalog } from './local';

/** Picks the provider from settings: "auto" uses Gemini when a key is saved, else on-device. */
export function primaryProvider(): AiProvider {
  const { provider, hasKey } = getSettings().ai;
  if (provider === 'local') return localProvider;
  if (provider === 'gemini') return geminiProvider;
  return hasKey ? geminiProvider : localProvider;
}

/**
 * Runs an AI task on the preferred provider, falling back to the on-device provider when the
 * cloud is not configured or unreachable (the architecture supports both from day one).
 */
export async function runAi<T>(task: (p: AiProvider) => Promise<T>): Promise<{ result: T; provider: AiProvider }> {
  const primary = primaryProvider();
  try {
    return { result: await task(primary), provider: primary };
  } catch (e) {
    if (primary.id === 'local') throw e;
    const offline = e instanceof TypeError || (e instanceof Error && /network|abort|conectar/i.test(e.message));
    if (!(e instanceof AiUnavailableError) && !offline) throw e;
    return { result: await task(localProvider), provider: localProvider };
  }
}
