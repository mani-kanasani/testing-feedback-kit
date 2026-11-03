'use client';

// Filing a ticket: a title, what happened, what kind, the part of the app, how bad, and files. The page's first tab
// and the floating button both use it. A file that cannot be stored never loses the ticket.
import { useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { announceChange, messageOf, type FeedbackApi } from './api';
import { ClipIcon, CloseIcon, SendIcon, UploadIcon } from './icons';
import { FILE_TYPES, fileProblem, KINDS, LIMITS, MAX_FILES, megabytes, SEVERITIES, severityOf, type FeedbackSeverity, type Ticket, type TicketDraft } from './model';
import { Button, Notice } from './parts';

export interface Filed {
  ticket: Ticket;
  problems: string[];
}

export function TicketForm({
  api,
  areas,
  area,
  context,
  compact,
  onFiled,
  filedAs,
}: {
  api: FeedbackApi;
  areas: string[];
  /** The part of the app to start on, for example the page the floating button was pressed on. */
  area?: string;
  /** The page and device, when the floating button files it. */
  context?: { page: string; device: string };
  compact?: boolean;
  onFiled: (filed: Filed) => void;
  filedAs?: string;
}) {
  const startArea = area && areas.includes(area) ? area : areas.includes('Something else') ? 'Something else' : (areas[0] ?? 'Something else');
  const [draft, setDraft] = useState<TicketDraft>({ title: '', body: '', area: startArea, kind: 'bug', severity: 'medium' });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  const take = (list: FileList | null) => {
    if (!list) return;
    setFiles((was) => [...was, ...Array.from(list)].slice(0, MAX_FILES));
    if (picker.current) picker.current.value = '';
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      setProblem('Give the ticket a title: one line that says what it is.');
      titleRef.current?.focus();
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const good = files.filter((f) => fileProblem(f) === null);
      const skipped = files.map(fileProblem).filter((why): why is string => why !== null);
      const result = await api.fileTicket({ ...draft, page: context?.page ?? null, device: context?.device ?? null }, good);
      announceChange();
      onFiled({ ticket: result.ticket, problems: [...skipped, ...result.problems] });
      setDraft({ title: '', body: '', area: draft.area, kind: 'bug', severity: 'medium' });
      setFiles([]);
    } catch (err) {
      setProblem(messageOf(err));
    }
    setBusy(false);
  };

  return (
    <form className="fk-form" data-compact={compact || undefined} onSubmit={submit} noValidate>
      {problem && (
        <Notice tone="danger" title="It was not filed." live>
          <p>{problem}</p>
        </Notice>
      )}

      <div className="fk-field">
        <label className="fk-label" htmlFor={`${ids}-title`}>
          Title
        </label>
        <input
          ref={titleRef}
          id={`${ids}-title`}
          className="fk-input"
          value={draft.title}
          maxLength={LIMITS.title}
          placeholder="One line: what is wrong, or what you want"
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          aria-invalid={problem !== null && !draft.title.trim()}
          autoComplete="off"
        />
      </div>

      <div className="fk-field">
        <label className="fk-label" htmlFor={`${ids}-body`}>
          What happened
        </label>
        <textarea
          id={`${ids}-body`}
          className="fk-input fk-textarea"
          rows={compact ? 4 : 6}
          value={draft.body}
          maxLength={LIMITS.body}
          placeholder="What you did, what you saw, and what you expected. For a new feature: what it would let you do."
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
      </div>

      <fieldset className="fk-field fk-kinds">
        <legend className="fk-label">What kind</legend>
        <div className="fk-choice">
          {KINDS.map((k) => (
            <label key={k.value} className="fk-choice__item" data-kind={k.value}>
              <input type="radio" name={`${ids}-kind`} value={k.value} checked={draft.kind === k.value} onChange={() => setDraft({ ...draft, kind: k.value })} />
              <strong>{k.label}</strong>
              {!compact && <span>{k.hint}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="fk-row">
        <div className="fk-field">
          <label className="fk-label" htmlFor={`${ids}-area`}>
            Part of the app
          </label>
          <select id={`${ids}-area`} className="fk-input" value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="fk-field">
          <label className="fk-label" htmlFor={`${ids}-severity`}>
            How bad
          </label>
          <select id={`${ids}-severity`} className="fk-input" value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as FeedbackSeverity })}>
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="fk-help">{severityOf(draft.severity).hint}</p>
        </div>
      </div>

      <div className="fk-field">
        <p className="fk-label">Screenshots or a screen recording</p>
        <div
          className="fk-drop"
          data-dragging={dragging || undefined}
          onDragOver={(e: DragEvent) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e: DragEvent) => {
            e.preventDefault();
            setDragging(false);
            take(e.dataTransfer.files);
          }}
        >
          <UploadIcon size={18} />
          <span>Drop pictures, a PDF or a video here, or</span>
          <Button size="small" onClick={() => picker.current?.click()} icon={<ClipIcon size={14} />}>
            Choose files
          </Button>
          <input ref={picker} type="file" multiple hidden accept={FILE_TYPES.join(',')} onChange={(e) => take(e.target.files)} />
        </div>
        <p className="fk-help">Optional. Up to {MAX_FILES} files, 50 MB each.</p>
        {files.length > 0 && (
          <ul className="fk-files">
            {files.map((f, i) => {
              const why = fileProblem(f);
              return (
                <li key={`${f.name}-${i}`} data-bad={why !== null || undefined}>
                  <ClipIcon size={14} />
                  <span className="fk-files__name">{f.name}</span>
                  <span className="fk-meta">{why ?? megabytes(f.size)}</span>
                  <button type="button" className="fk-icon-btn" aria-label={`Take ${f.name} off`} onClick={() => setFiles((was) => was.filter((_, j) => j !== i))}>
                    <CloseIcon size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {context && <p className="fk-help fk-context">Filed from {context.page}, {context.device}. Nothing else about your browser is sent.</p>}

      <div className="fk-form__go">
        <Button type="submit" variant="primary" disabled={busy} icon={<SendIcon size={16} />}>
          {busy ? 'Filing it' : 'File the ticket'}
        </Button>
        {filedAs && <span className="fk-meta">Filed as {filedAs}</span>}
      </div>
    </form>
  );
}
