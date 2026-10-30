# ProfileAI prompt dataset

Every AI prompt in the codebase, extracted from source. 179 records, about 312K characters.

| File | What it is |
|---|---|
| `prompts.jsonl` | One prompt per line (the training-friendly format) |
| `prompts.json` | The same records, pretty-printed for reading |
| `extract.js` | Regenerates the dataset: `node datasets/ai-prompts/extract.js datasets/ai-prompts datasets/ai-prompts/source-files.txt` |
| `source-files.txt` | The files that were scanned |

## Record fields

- `id`: stable id made from the file and line
- `feature`: resume_tailoring, job_match_score, resume_review, resume_enhancement, resume_writing_rules, cover_letter, profile_coach, screening_interview, agent, apply_pilot, and others
- `role`:
  - `system`: a system prompt
  - `user`: a user message
  - `fragment`: a reusable block that gets composed into other prompts (writing rules, role blocks, voice and tone)
- `source_file`, `line`, `builder`: where the prompt lives, and the function or constant that builds it
- `prompt`: the prompt text. Runtime values appear as `{{expression}}`, for example `{{profileData.title}}`. Constants defined in the same file are inlined. Shared constants imported from other files stay as placeholders, and each of those also has its own record.
- `variables`: the placeholders the prompt fills at runtime
- `also_in`: other places with the identical prompt. `aiService.js` copies several prompts from `services/ai/prompts/*.js`, and each copy is kept only once here.
- `is_test_script`: true for prompts in `backend/scripts/` (manual phone-call test scripts)

## Notes

- `buildTailoringPrompt.prompt` includes the whole `MASTER_TAILORING_PROMPT` inline, so that text appears in both records.
- The `*BlockingList` records hold the feedback lines that the audit sends back to the model on the rewrite pass. At runtime only the lines for checks that failed are sent.
- These are prompt templates only, with no model outputs. Fine-tuning needs input/output pairs. You can get them by rendering these templates with real inputs and pairing each one with the output it produced.
