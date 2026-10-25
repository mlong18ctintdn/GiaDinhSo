'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Plus } from 'lucide-react';
import { api, post, ApiError } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { Family, Member, Role } from '@/lib/types';
import { Button, cn } from './ui';
import LanguageSelect from './LanguageSelect';
import OwnerAccount from './family/OwnerAccount';
import { AVATARS, ROLES } from '@/lib/members';


export default function Onboarding() {
  const { t } = useTranslation();
  const { code, members, setCode, setMemberId, setMembers } = useApp();
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('parent');
  const [avatar, setAvatar] = useState(AVATARS[2]);

  /** Friendly message plus the technical reason, so a broken setup is obvious (see /api/health). */
  const reason = (e: unknown) => {
    const why = e instanceof ApiError ? e.detail || e.message : e instanceof Error ? e.message : '';
    return why && !/^http_\d+$/.test(why) ? `${t('common.error')} (${why})` : t('common.error');
  };

  useEffect(() => {
    const invited = new URLSearchParams(window.location.search).get('code'); // invite link: /?code=K9P3RZ
    if (invited) setInput(invited.toUpperCase().slice(0, 6));
  }, []);

  useEffect(() => {
    if (!code) return;
    api<{ family: Family; members: Member[] }>(`/api/families/${code}`)
      .then((r) => setMembers(r.members))
      .catch(() => setCode(null));
  }, [code, setMembers, setCode]);

  async function create() {
    setBusy(true);
    setErr('');
    try {
      const r = await post<{ family: Family }>('/api/families', {});
      setCode(r.family.family_code);
    } catch (e) {
      setErr(reason(e));
    }
    setBusy(false);
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ family: Family }>(`/api/families/${input.trim().toUpperCase()}`);
      setCode(r.family.family_code);
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 404 ? t('onb.notFound') : reason(e));
    }
    setBusy(false);
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code) return;
    setBusy(true);
    try {
      const r = await post<{ member: Member }>('/api/members', { code, name, role, avatar });
      setMembers([...members, r.member]);
      setMemberId(r.member.id);
    } catch (e) {
      setErr(reason(e));
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-4 pb-12">
      <div className="flex justify-end pt-2">
        <LanguageSelect />
      </div>
      <header className="text-center">
        <Home className="mx-auto mb-2 text-accent" size={44} aria-hidden />
        <h1 className="text-3xl font-bold">{t('app.name')}</h1>
        <p className="mt-1 text-muted">{t('app.tagline')}</p>
      </header>

      {!code ? (
        <>
          <section className="card flex flex-col gap-3">
            <h2 className="text-xl font-bold">{t('onb.create')}</h2>
            <p className="text-muted">{t('onb.createHint')}</p>
            <Button onClick={create} disabled={busy}>
              <Plus size={18} /> {t('onb.create')}
            </Button>
          </section>
          <form onSubmit={join} className="card flex flex-col gap-3">
            <label htmlFor="code" className="text-xl font-bold">
              {t('onb.haveCode')}
            </label>
            <input
              id="code"
              className="field text-center text-2xl font-bold uppercase tracking-[0.3em]"
              maxLength={6}
              placeholder="K9P3RZ"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
            />
            <Button type="submit" variant="outline" disabled={busy || input.trim().length !== 6}>
              {t('onb.join')}
            </Button>
          </form>
        </>
      ) : (
        <>
          <section className="card text-center">
            <p className="text-muted">{t('onb.familyCode')}</p>
            <p className="text-4xl font-bold tracking-[0.3em]">{code}</p>
            <p className="mt-1 text-sm text-muted">{t('onb.shareHint')}</p>
          </section>

          {members.length > 0 && (
            <section className="card">
              <h2 className="mb-3 text-xl font-bold">{t('onb.whoAreYou')}</h2>
              <ul className="grid grid-cols-2 gap-3">
                {members.map((m) => (
                  <li key={m.id}>
                    <Button variant="outline" className="h-full w-full flex-col" onClick={() => setMemberId(m.id)}>
                      <span className="text-3xl" aria-hidden>
                        {m.avatar}
                      </span>
                      <span>{m.name}</span>
                      <span className="text-sm font-normal text-muted">{t(`role.${m.role}`)}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <form onSubmit={addMember} className="card flex flex-col gap-4">
            <h2 className="text-xl font-bold">{t('onb.addMember')}</h2>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">{t('onb.name')}</span>
              <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </label>
            <fieldset>
              <legend className="mb-1 font-semibold">{t('onb.role')}</legend>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <label
                    key={r}
                    className={cn(
                      'cursor-pointer rounded-theme border-2 p-2 text-center font-semibold',
                      role === r ? 'border-accent bg-bg' : 'border-border',
                    )}
                  >
                    <input type="radio" name="role" className="sr-only" checked={role === r} onChange={() => setRole(r)} />
                    {t(`role.${r}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 font-semibold">{t('onb.avatar')}</legend>
              <div className="flex flex-wrap gap-2">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={avatar === a}
                    onClick={() => setAvatar(a)}
                    className={cn('h-12 w-12 rounded-full border-2 text-2xl', avatar === a ? 'border-accent bg-bg' : 'border-border')}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </fieldset>
            <Button type="submit" disabled={busy || !name.trim()}>
              {t('onb.enter')}
            </Button>
          </form>
        </>
      )}
      {!code && <OwnerAccount onOpen={(c) => setCode(c)} />}
      {err && (
        <p role="alert" className="text-center font-semibold text-red-600">
          {err}
        </p>
      )}
    </main>
  );
}
