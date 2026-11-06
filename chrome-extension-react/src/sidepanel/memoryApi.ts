import type { AnswerCatalog, LearnedItem, LearnPayload } from '../answerMemory';

/** Thin wrappers over the background worker's answer memory handlers. */

export interface MemoryFactInput { value: string; note?: string }

export async function getCatalog(): Promise<AnswerCatalog | null> {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'MEMORY_CATALOG' });
    return r?.catalog?.facts ? (r.catalog as AnswerCatalog) : null;
  } catch {
    return null;
  }
}

export async function saveFact(id: string, value: string): Promise<boolean> {
  try {
    const r = await chrome.runtime.sendMessage({
      type: 'MEMORY_SAVE',
      data: { answerFacts: { [id]: { value } } },
    });
    return !!r?.success;
  } catch {
    return false;
  }
}

/** Remember an answer the person just gave. Resolves to the stored item, or null when nothing was kept. */
export async function learnedSave(payload: LearnPayload): Promise<LearnedItem | null> {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'LEARNED_SAVE', data: payload });
    return r?.success && r.item ? (r.item as LearnedItem) : null;
  } catch {
    return null;
  }
}

export async function learnedList(fresh = false): Promise<{ ok: true; items: LearnedItem[] } | { ok: false; error: string }> {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'LEARNED_LIST', data: { fresh } });
    if (r?.success) return { ok: true, items: Array.isArray(r.items) ? r.items : [] };
    return { ok: false, error: r?.error || 'Could not load your answers.' };
  } catch {
    return { ok: false, error: 'Could not load your answers.' };
  }
}

export async function learnedEdit(id: string, answer: string): Promise<{ ok: true; item?: LearnedItem } | { ok: false; error: string }> {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'LEARNED_EDIT', data: { id, answer } });
    return r?.success ? { ok: true, item: r.item } : { ok: false, error: r?.error || 'Could not save that change.' };
  } catch {
    return { ok: false, error: 'Could not save that change.' };
  }
}

export async function learnedDelete(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'LEARNED_DELETE', data: { id } });
    return r?.success ? { ok: true } : { ok: false, error: r?.error || 'Could not delete that.' };
  } catch {
    return { ok: false, error: 'Could not delete that.' };
  }
}

/** Blob to base64 so it can cross the extension message boundary. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const url = String(reader.result || '');
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export async function transcribe(blob: Blob): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const audioBase64 = await blobToBase64(blob);
    const r = await chrome.runtime.sendMessage({
      type: 'MEMORY_TRANSCRIBE',
      data: { audioBase64, mimeType: blob.type || 'audio/webm' },
    });
    if (r?.success && typeof r.text === 'string') return { ok: true, text: r.text };
    return { ok: false, error: r?.error || 'Could not turn that into text. You can type it instead.' };
  } catch {
    return { ok: false, error: 'Could not turn that into text. You can type it instead.' };
  }
}

export interface ExperienceProposal {
  bullets: string[];
  roleIndex: number | null;
  roleCandidates: Array<{ index: number; title: string; company: string }>;
  followUp: string | null;
}

export async function experienceFromSpeech(transcript: string): Promise<{ ok: true; data: ExperienceProposal } | { ok: false; error: string }> {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'EXPERIENCE_FROM_SPEECH', data: { transcript } });
    if (r?.success) {
      return { ok: true, data: { bullets: r.bullets || [], roleIndex: r.roleIndex ?? null, roleCandidates: r.roleCandidates || [], followUp: r.followUp || null } };
    }
    return { ok: false, error: r?.error || 'Could not write the bullets. Please try again.' };
  } catch {
    return { ok: false, error: 'Could not write the bullets. Please try again.' };
  }
}

export async function appendExperience(roleIndex: number, bullets: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await chrome.runtime.sendMessage({ type: 'EXPERIENCE_APPEND', data: { roleIndex, bullets } });
    return r?.success ? { ok: true } : { ok: false, error: r?.error || 'Could not add that to your experience.' };
  } catch {
    return { ok: false, error: 'Could not add that to your experience.' };
  }
}
