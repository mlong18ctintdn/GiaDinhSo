'use client';
import { useState } from 'react';
import { Copy, LogOut, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, post, ApiError } from '@/lib/api';
import { AVATARS, ROLES } from '@/lib/members';
import { useApp } from '@/lib/store';
import type { Member, Role } from '@/lib/types';
import { Button, Modal, cn } from '../ui';
import OwnerAccount from './OwnerAccount';

/** Family code, invite link, members (add, edit, delete) and the owner account. */
export default function FamilyPanel({ refresh }: { refresh: () => void }) {
  const { t } = useTranslation();
  const { code, members, memberId, access, logout, setMemberId } = useApp();
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const canManage = !access.owned || access.isOwner;
  const link = typeof window !== 'undefined' ? `${window.location.origin}/?code=${code}` : '';

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: t('app.name'), text: t('family.inviteText', { code }), url: link }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function remove(m: Member) {
    if (!window.confirm(t('family.confirmDelete', { name: m.name }))) return;
    setErr('');
    try {
      await api(`/api/members?code=${code}&id=${m.id}`, { method: 'DELETE' });
      if (m.id === memberId) setMemberId(null);
      refresh();
    } catch (e) {
      setErr(e instanceof ApiError && e.message === 'forbidden' ? t('family.managed') : t('common.error'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{t('onb.familyCode')}</p>
          <p className="text-3xl font-bold tracking-[0.3em]">{code}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(code ?? ''); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            <Copy size={16} /> {copied ? t('family.copied') : t('common.copy')}
          </Button>
          <Button variant="outline" onClick={share}><Share2 size={16} /> {t('family.invite')}</Button>
          <Button variant="outline" onClick={logout}><LogOut size={16} /> {t('family.leave')}</Button>
        </div>
      </section>

      <section className="card flex flex-col gap-3" aria-labelledby="mem-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="mem-title" className="text-xl font-bold">{t('family.members')}</h2>
          <Button onClick={() => setEditing('new')}><Plus size={18} /> {t('family.add')}</Button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.id} className={cn('flex items-center gap-3 rounded-theme border-2 p-3', m.id === memberId ? 'border-accent' : 'border-border')}>
              <span className="text-3xl" aria-hidden>{m.avatar}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{m.name}</p>
                <p className="text-sm text-muted">{t(`role.${m.role}`)}</p>
              </div>
              {canManage && (
                <>
                  <button aria-label={t('family.edit')} onClick={() => setEditing(m)} className="rounded-full p-2 hover:bg-bg"><Pencil size={16} /></button>
                  <button aria-label={t('family.delete')} onClick={() => remove(m)} className="rounded-full p-2 hover:bg-bg"><Trash2 size={16} /></button>
                </>
              )}
            </li>
          ))}
        </ul>
        {!canManage && <p className="text-sm text-muted">{t('family.managed')}</p>}
        {err && <p role="alert" className="font-semibold text-red-600">{err}</p>}
      </section>

      <OwnerAccount onChanged={refresh} />
      <MemberForm member={editing} onClose={() => setEditing(null)} onSaved={refresh} />
    </div>
  );
}

function MemberForm({ member, onClose, onSaved }: { member: Member | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const { code } = useApp();
  const isNew = member === 'new';
  const m = member && member !== 'new' ? member : null;
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('parent');
  const [avatar, setAvatar] = useState(AVATARS[2]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const key = member === null ? null : isNew ? 'new' : (member as Member).id;
  if (key !== loadedFor) {
    setLoadedFor(key);
    setName(m?.name ?? '');
    setRole(m?.role ?? 'parent');
    setAvatar(m?.avatar ?? AVATARS[2]);
    setErr('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (isNew) await post('/api/members', { code, name, role, avatar });
      else await api('/api/members', { method: 'PATCH', body: JSON.stringify({ code, id: m!.id, name, role, avatar }) });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError && e.message === 'forbidden' ? t('family.managed') : t('common.error'));
    }
    setBusy(false);
  }

  return (
    <Modal open={member !== null} onClose={onClose} title={isNew ? t('family.add') : t('family.edit')}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t('onb.name')}</span>
          <input className="field" value={name} maxLength={40} required onChange={(e) => setName(e.target.value)} />
        </label>
        <fieldset>
          <legend className="mb-1 font-semibold">{t('onb.role')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <label key={r} className={cn('cursor-pointer rounded-theme border-2 p-2 text-center font-semibold', role === r ? 'border-accent bg-bg' : 'border-border')}>
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
              <button key={a} type="button" aria-pressed={avatar === a} onClick={() => setAvatar(a)} className={cn('h-12 w-12 rounded-full border-2 text-2xl', avatar === a ? 'border-accent bg-bg' : 'border-border')}>{a}</button>
            ))}
          </div>
        </fieldset>
        {err && <p role="alert" className="font-semibold text-red-600">{err}</p>}
        <Button type="submit" disabled={busy || !name.trim()}>{t('family.save')}</Button>
      </form>
    </Modal>
  );
}
