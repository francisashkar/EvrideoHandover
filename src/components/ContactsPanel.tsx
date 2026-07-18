import { useState } from 'react'
import { X, Phone, Mail, Plus, Pencil, Trash2, Check, BookUser } from 'lucide-react'
import type { Contact, ContactInput, ContactsApi } from '../hooks/useContacts'

interface ContactsPanelProps {
  open: boolean
  onClose: () => void
  api: ContactsApi
}

const EMPTY: ContactInput = { name: '', role: '', phone: '', email: '', notes: '' }

export default function ContactsPanel({ open, onClose, api }: ContactsPanelProps) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<ContactInput>(EMPTY)

  if (!open) return null

  const startNew = () => {
    setForm(EMPTY)
    setEditingId('new')
  }

  const startEdit = (c: Contact) => {
    setForm({ name: c.name, role: c.role, phone: c.phone, email: c.email, notes: c.notes })
    setEditingId(c.id)
  }

  const save = () => {
    if (!form.name.trim()) return
    if (editingId === 'new') api.addContact(form)
    else if (editingId) api.updateContact(editingId, form)
    setEditingId(null)
    setForm(EMPTY)
  }

  const field = (key: keyof ContactInput, placeholder: string, dir?: 'ltr') => (
    <input
      type="text"
      value={form[key]}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      placeholder={placeholder}
      dir={dir}
      className="h-9 w-full rounded-lg border border-noc-border bg-noc-bg/40 px-2.5 text-sm text-noc-t1 placeholder-noc-t4 outline-none focus:border-noc-accent"
    />
  )

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-b-2xl border border-t-0 border-noc-border bg-noc-panel shadow-2xl sm:top-8 sm:rounded-2xl sm:border-t">
        <div className="flex items-center justify-between border-b border-noc-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-noc-t1">
            <BookUser className="h-5 w-5 text-noc-accent" />
            ספר טלפונים — אסקלציה
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={startNew}
              className="flex items-center gap-1 rounded-full bg-noc-gradient px-3 py-1.5 text-xs font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> איש קשר
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2 hover:text-noc-t1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {editingId && (
            <div className="mb-3 space-y-2 rounded-xl border border-noc-accent/50 bg-noc-panel2 p-3">
              <div className="grid grid-cols-2 gap-2">
                {field('name', 'שם *')}
                {field('role', 'תפקיד / חברה')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {field('phone', 'טלפון', 'ltr')}
                {field('email', 'אימייל', 'ltr')}
              </div>
              {field('notes', 'הערות (למשל: זמין רק עד 22:00)')}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={save}
                  disabled={!form.name.trim()}
                  className="flex items-center gap-1 rounded-full bg-noc-accent px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" /> שמירה
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-full border border-noc-border px-3 py-1.5 text-xs font-bold text-noc-t2 hover:bg-noc-panel3"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {api.contacts.length === 0 && !editingId ? (
            <p className="py-10 text-center text-xs text-noc-t4">
              אין אנשי קשר עדיין — הוסיפו את הספקים והכוננים שלכם
            </p>
          ) : (
            <div className="space-y-2">
              {api.contacts.map((c) => (
                <div
                  key={c.id}
                  className="group flex items-start justify-between gap-3 rounded-xl border border-noc-border bg-noc-panel2 px-3.5 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-noc-t1">
                      {c.name}
                      {c.role && <span className="ms-2 text-xs font-normal text-noc-t3">{c.role}</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          dir="ltr"
                          className="flex items-center gap-1 font-semibold text-noc-accent hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          dir="ltr"
                          className="flex items-center gap-1 text-noc-accent2 hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </a>
                      )}
                    </div>
                    {c.notes && <p className="mt-1 text-[11px] text-noc-t3">{c.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(c)}
                      title="עריכה"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-noc-accent/15 hover:text-noc-accent"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => api.deleteContact(c.id)}
                      title="מחיקה"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-noc-t4 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
