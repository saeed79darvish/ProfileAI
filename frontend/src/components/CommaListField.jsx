import React, { useEffect, useState } from 'react';
import { TextField } from '@mui/material';

/*
 * A text input that edits a list of words separated by commas.
 *
 * The inputs this replaces re-split and re-joined on every keystroke, so a
 * trailing comma or space vanished the moment it was typed and a second skill
 * could never be entered. This keeps the raw text while it is being edited and
 * hands the parsed list up as it changes; when the list is changed from
 * outside (smart fill, a suggestion) the text follows it.
 */
const parse = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean);
const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

export default function CommaListField({ value, onChange, ...props }) {
  const list = Array.isArray(value) ? value : parse(value);
  const [draft, setDraft] = useState(list.join(', '));

  useEffect(() => {
    setDraft((current) => (sameList(parse(current), list) ? current : list.join(', ')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.join('\u0000')]);

  return (
    <TextField
      {...props}
      value={draft}
      onChange={(e) => { setDraft(e.target.value); onChange(parse(e.target.value)); }}
      onBlur={(e) => { setDraft(parse(e.target.value).join(', ')); props.onBlur?.(e); }}
    />
  );
}
