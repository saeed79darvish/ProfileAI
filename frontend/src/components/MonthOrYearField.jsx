import { TextField, InputAdornment, Button } from '@mui/material';
import { toIsoMonth } from '@/utils/dateRange';

/**
 * A date the person may only know to the year.
 *
 * <input type="month"> cannot show "2021", so the editor padded it to
 * "2021-01" to have something to display — and the first edit saved that
 * January onto a resume where nobody had said January. A bare year now stays a
 * year, shown as one, and a month is only added when the person adds it.
 *
 * Same props as the TextField it replaces; `onChange` receives an event-like
 * `{ target: { value } }` so call sites do not change.
 */
const YEAR_ONLY = /^\d{1,4}$/;

export default function MonthOrYearField({ value, onChange, helperText, disabled, ...props }) {
  const raw = String(value ?? '').trim();

  if (YEAR_ONLY.test(raw) && !disabled) {
    const emit = (next) => onChange({ target: { value: next } });
    return (
      <TextField
        {...props}
        type="text"
        value={raw}
        onChange={(e) => emit(e.target.value.replace(/\D/g, '').slice(0, 4))}
        inputProps={{ inputMode: 'numeric', maxLength: 4, 'aria-label': `${props.label || 'Date'} (year)` }}
        helperText={helperText || 'Year only'}
        InputProps={{
          endAdornment: raw.length === 4 ? (
            <InputAdornment position="end">
              <Button
                size="small"
                onClick={() => emit(`${raw}-01`)}
                sx={{ textTransform: 'none', minWidth: 'auto', fontSize: 12, fontWeight: 600, color: '#4f46e5' }}
              >
                Add month
              </Button>
            </InputAdornment>
          ) : undefined,
        }}
      />
    );
  }

  return (
    <TextField
      {...props}
      type="month"
      value={toIsoMonth(raw)}
      onChange={onChange}
      disabled={disabled}
      helperText={helperText}
    />
  );
}
