'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Mic, Square, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { post, PaywallError, ApiError } from '@/lib/api';
import { useApp, useMe } from '@/lib/store';
import type { Story } from '@/lib/types';
import { Button, Modal } from '../ui';
import VoiceButton from '../VoiceButton';

async function upload(code: string, file: Blob, name: string): Promise<string> {
  const fd = new FormData();
  fd.append('code', code);
  fd.append('file', file, name);
  const r = await fetch('/api/upload', { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'upload_failed');
  return j.url as string;
}

/** Add a story: text (typed or dictated), an optional photo and an optional voice note. */
export default function StoryForm({ year: initialYear, onClose }: { year: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const me = useMe();
  const { code, addStoryLocal } = useApp();
  const [year, setYear] = useState(new Date().getFullYear());
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const open = initialYear !== null;

  useEffect(() => {
    if (initialYear !== null) {
      setYear(initialYear);
      setTitle('');
      setContent('');
      setPhoto(null);
      setAudio(null);
      setErr('');
    }
  }, [initialYear]);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        setAudio(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
        stream.getTracks().forEach((tr) => tr.stop());
        setRecorder(null);
      };
      mr.start();
      setRecorder(mr);
    } catch {
      setErr(t('voice.unsupported'));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    if (!me) {
      setErr(t('tree.noProfile'));
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const [photo_url, audio_url] = await Promise.all([
        photo ? upload(code, photo, photo.name) : Promise.resolve(null),
        audio ? upload(code, audio, 'voice') : Promise.resolve(null),
      ]);
      const r = await post<{ story: Story }>('/api/stories', { code, year, title, content, author_name: me.name, photo_url, audio_url });
      // Count it on the tree at once. The server broadcast refreshes everyone else.
      addStoryLocal(r.story.year, r.story.author_name);
      onClose();
    } catch (e) {
      if (e instanceof PaywallError) onClose();
      else {
        const why = e instanceof ApiError ? e.detail || e.message : e instanceof Error ? e.message : '';
        setErr(why && !/^http_\d+$/.test(why) ? `${t('common.error')} (${why})` : t('common.error'));
      }
    }
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={t('tree.add')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t('tree.year')}</span>
          <input className="field" type="number" min={1900} max={new Date().getFullYear() + 1} value={year} onChange={(e) => setYear(Number(e.target.value))} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t('tree.storyTitle')}</span>
          <input className="field" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t('tree.content')}</span>
          <textarea className="field min-h-32" value={content} maxLength={4000} onChange={(e) => setContent(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <VoiceButton onText={(txt) => setContent((c) => (c ? `${c} ${txt}` : txt))} />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={18} /> {photo ? photo.name.slice(0, 18) : t('tree.photo')}
          </Button>
          {recorder ? (
            <Button type="button" variant="outline" onClick={() => recorder.stop()}>
              <Square size={18} /> {t('tree.stopRecord')}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={startRec}>
              <Mic size={18} /> {t('tree.record')}
            </Button>
          )}
        </div>
        {audio && (
          <div className="flex items-center gap-2">
            <audio controls src={URL.createObjectURL(audio)} className="min-w-0 flex-1" />
            <Button type="button" variant="ghost" aria-label={t('common.remove')} onClick={() => setAudio(null)}>
              <Trash2 size={18} />
            </Button>
          </div>
        )}
        {err && <p role="alert" className="font-semibold text-red-600">{err}</p>}
        <Button type="submit" disabled={saving || !title.trim()}>
          {saving ? t('common.loading') : t('tree.save')}
        </Button>
      </form>
    </Modal>
  );
}
