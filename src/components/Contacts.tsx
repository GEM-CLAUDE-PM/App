import React, { useState, useEffect, useRef } from 'react';
import {
  Building2, Phone, Mail, MessageCircle, Search, MapPin,
  UserCircle, Plus, Camera, UploadCloud, X, Edit3, Trash2,
  Save, Filter, LayoutGrid, List, Globe, CreditCard,
  FileText, ChevronDown, ChevronUp, Tag, Sparkles,
  CheckCircle2, Clock, Image as ImageIcon,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type ContactType = 'client' | 'contractor' | 'supplier' | 'consultant' | 'other';

interface BankAccount {
  bankName: string;
  accountNo: string;
  accountName: string;
}

interface Interaction {
  id: string;
  date: string;
  note: string;
}

interface Contact {
  id: string;
  company: string;
  type: ContactType;
  role: string;
  contactPerson: string;
  position: string;
  phone: string;
  email: string;
  address: string;
  website?: string;
  projectIds: string[];
  bank?: BankAccount;
  note?: string;
  interactions: Interaction[];
  avatar?: string;        // base64 hoặc URL
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'gem_contacts';

const TYPE_META: Record<ContactType, { label: string; color: string; bg: string; dot: string }> = {
  client:     { label: 'Chủ đầu tư',    color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200',  dot: 'bg-violet-500'  },
  contractor: { label: 'Nhà thầu',      color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',      dot: 'bg-blue-500'    },
  supplier:   { label: 'Nhà cung cấp',  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',    dot: 'bg-amber-500'   },
  consultant: { label: 'Tư vấn',        color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200',dot: 'bg-emerald-500' },
  other:      { label: 'Khác',          color: 'text-slate-700',  bg: 'bg-slate-50 border-slate-200',    dot: 'bg-slate-400'   },
};

const DEFAULT_CONTACTS: Contact[] = [
  {
    id: 'c1', company: 'Tập đoàn Đầu tư BĐS Alpha', type: 'client',
    role: 'Chủ đầu tư', contactPerson: 'Phạm Thị D', position: 'Giám đốc Ban QLDA',
    phone: '0933445566', email: 'ptd@alphagroup.vn',
    address: '789 Lê Lợi, Q.1, TP.HCM', website: 'https://alphagroup.vn',
    projectIds: ['p1', 'p2'],
    bank: { bankName: 'Vietcombank', accountNo: '1234567890', accountName: 'TAP DOAN DAU TU BDS ALPHA' },
    note: 'Ưu tiên liên hệ qua email. Họp định kỳ thứ Sáu hàng tuần.',
    interactions: [
      { id: 'i1', date: '2026-03-05', note: 'Họp triển khai gói thầu móng DA Alpha.' },
      { id: 'i2', date: '2026-03-01', note: 'Gửi hồ sơ thanh toán đợt 2.' },
    ],
    createdAt: '2026-01-01',
  },
  {
    id: 'c2', company: 'Công ty CP Xây dựng Hòa Bình', type: 'contractor',
    role: 'Tổng thầu thi công', contactPerson: 'Nguyễn Văn A', position: 'Chỉ huy trưởng',
    phone: '0901234567', email: 'nva@hoabinh.com',
    address: '123 Nguyễn Đình Chiểu, Q.3, TP.HCM', website: 'https://hbcorp.vn',
    projectIds: ['p1'],
    bank: { bankName: 'BIDV', accountNo: '9876543210', accountName: 'CONG TY CP XAY DUNG HOA BINH' },
    note: 'Nhà thầu chính DA Alpha. Hiện đang thi công móng.',
    interactions: [
      { id: 'i3', date: '2026-03-06', note: 'Xử lý vi phạm HSE tại tầng 5.' },
    ],
    createdAt: '2026-01-01',
  },
  {
    id: 'c3', company: 'Công ty TNHH Thép Việt', type: 'supplier',
    role: 'Nhà cung cấp Thép CB300', contactPerson: 'Trần Thị B', position: 'GĐ Kinh doanh',
    phone: '0987654321', email: 'ttb@thepviet.vn',
    address: 'KCN Phú Mỹ 1, BR-VT', website: '',
    projectIds: ['p1', 'p3'],
    bank: { bankName: 'Techcombank', accountNo: '1122334455', accountName: 'CONG TY TNHH THEP VIET' },
    note: 'Thép CB300 — giao trong 5 ngày sau đặt hàng. Chiết khấu 2% nếu TT sớm.',
    interactions: [],
    createdAt: '2026-01-15',
  },
  {
    id: 'c4', company: 'Công ty Tư vấn Thiết kế KT X', type: 'consultant',
    role: 'Tư vấn giám sát', contactPerson: 'Lê Văn C', position: 'Trưởng đoàn TVGS',
    phone: '0912345678', email: 'lvc@tuvanx.com',
    address: '456 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM', website: 'https://tuvanx.com',
    projectIds: ['p2'],
    bank: undefined,
    note: '',
    interactions: [
      { id: 'i4', date: '2026-03-04', note: 'Ký biên bản nghiệm thu hoàn thiện nội thất tầng 3-5.' },
    ],
    createdAt: '2026-01-20',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return `c${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

function getInitials(name: string) {
  return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
}

function getAvatarBg(type: ContactType) {
  const map: Record<ContactType, string> = {
    client: 'bg-violet-100 text-violet-600',
    contractor: 'bg-blue-100 text-blue-600',
    supplier: 'bg-amber-100 text-amber-600',
    consultant: 'bg-emerald-100 text-emerald-600',
    other: 'bg-slate-100 text-slate-600',
  };
  return map[type];
}

// ── Avatar component ──────────────────────────────────────────────────────────
function Avatar({ contact, size = 'md' }: { contact: Contact; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-11 h-11 text-sm';
  if (contact.avatar) {
    return <img src={contact.avatar} alt={contact.company}
      className={`${dim} rounded-xl object-cover shrink-0`} />;
  }
  return (
    <div className={`${dim} rounded-xl flex items-center justify-center font-bold shrink-0 ${getAvatarBg(contact.type)}`}>
      {getInitials(contact.company)}
    </div>
  );
}

// ── Type badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: ContactType }) {
  const m = TYPE_META[type];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${m.bg} ${m.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ── Form modal ────────────────────────────────────────────────────────────────
interface FormProps { contact?: Contact | null; onSave: (c: Contact) => void; onClose: () => void; projects?: any[]; }

const EMPTY_FORM = (): Omit<Contact, 'id' | 'createdAt' | 'interactions'> => ({
  company: '', type: 'contractor', role: '', contactPerson: '', position: '',
  phone: '', email: '', address: '', website: '', projectIds: [],
  bank: { bankName: '', accountNo: '', accountName: '' },
  note: '', avatar: '',
});

function ContactModal({ contact, onSave, onClose, projects = [] }: FormProps) {
  const isEdit = !!contact;
  const [form, setForm] = useState(contact
    ? { company: contact.company, type: contact.type, role: contact.role,
        contactPerson: contact.contactPerson, position: contact.position,
        phone: contact.phone, email: contact.email, address: contact.address,
        website: contact.website || '', projectIds: contact.projectIds,
        bank: contact.bank || { bankName: '', accountNo: '', accountName: '' },
        note: contact.note || '', avatar: contact.avatar || '' }
    : EMPTY_FORM()
  );
  const [tab, setTab] = useState<'basic' | 'bank' | 'note'>('basic');
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setBank = (k: keyof BankAccount, v: string) =>
    setForm(f => ({ ...f, bank: { ...f.bank!, [k]: v } }));
  const toggleProject = (id: string) =>
    set('projectIds', form.projectIds.includes(id)
      ? form.projectIds.filter(x => x !== id)
      : [...form.projectIds, id]);

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set('avatar', ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (!form.company.trim()) return;
    onSave({
      ...form,
      id: contact?.id || uid(),
      createdAt: contact?.createdAt || new Date().toISOString().slice(0, 10),
      interactions: contact?.interactions || [],
    });
  }

  const valid = form.company.trim().length > 0;
  const activePjs = (projects || []).filter((p:any) => p.type === 'in_progress');

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <h3 className="font-bold text-slate-800">{isEdit ? 'Chỉnh sửa liên hệ' : 'Thêm đối tác / liên hệ mới'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400"><X size={16}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0">
          {([['basic','Thông tin'], ['bank','Ngân hàng'], ['note','Ghi chú']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-all border-b-2 ${
                tab === k ? 'text-emerald-700 border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}>{l}</button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {tab === 'basic' && <>
            {/* Avatar upload */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {form.avatar
                  ? <img src={form.avatar} className="w-16 h-16 rounded-xl object-cover border border-slate-200"/>
                  : <div className={`w-16 h-16 rounded-xl flex items-center justify-center font-bold text-lg ${getAvatarBg(form.type)}`}>
                      {form.company ? getInitials(form.company) : <Building2 size={24}/>}
                    </div>
                }
                <button onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-emerald-600 text-white rounded-full
                    flex items-center justify-center hover:bg-emerald-700 transition-colors shadow-sm">
                  <Camera size={11}/>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile}/>
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-1">Ảnh đại diện / logo</p>
                <button onClick={() => fileRef.current?.click()}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                  <UploadCloud size={12}/> Tải ảnh lên
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Tên công ty / Tổ chức *</label>
                <input value={form.company} onChange={e => set('company', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                  placeholder="Tên công ty..."/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Loại đối tác</label>
                <select value={form.type} onChange={e => set('type', e.target.value as ContactType)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                  {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Vai trò cụ thể</label>
                <input value={form.role} onChange={e => set('role', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                  placeholder="VD: Tổng thầu thi công..."/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Người liên hệ</label>
                <input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                  placeholder="Họ tên..."/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Chức vụ</label>
                <input value={form.position} onChange={e => set('position', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                  placeholder="Chức vụ..."/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Điện thoại</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                  placeholder="09xx..."/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                  placeholder="email@..."/>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Địa chỉ</label>
                <input value={form.address} onChange={e => set('address', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                  placeholder="Địa chỉ công ty..."/>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Website</label>
                <input value={form.website} onChange={e => set('website', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                  placeholder="https://..."/>
              </div>

              {/* Project links */}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Liên kết dự án</label>
                <div className="flex flex-wrap gap-2">
                  {activePjs.map(p => (
                    <button key={p.id} onClick={() => toggleProject(p.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        form.projectIds.includes(p.id)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                      }`}>
                      {form.projectIds.includes(p.id) && <CheckCircle2 size={10} className="inline mr-1"/>}
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>}

          {tab === 'bank' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Thông tin tài khoản ngân hàng để thanh toán / đối chiếu</p>
              {[
                { k: 'bankName' as const,    label: 'Tên ngân hàng',    placeholder: 'Vietcombank, BIDV...' },
                { k: 'accountNo' as const,   label: 'Số tài khoản',     placeholder: '0123456789' },
                { k: 'accountName' as const, label: 'Tên chủ tài khoản',placeholder: 'TEN CHU TAI KHOAN' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">{f.label}</label>
                  <input value={form.bank?.[f.k] || ''} onChange={e => setBank(f.k, e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                    placeholder={f.placeholder}/>
                </div>
              ))}
            </div>
          )}

          {tab === 'note' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Ghi chú nội bộ</label>
              <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={6}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300 resize-none"
                placeholder="Ghi chú về đối tác, điều khoản đặc biệt, lưu ý khi liên hệ..."/>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Huỷ
          </button>
          <button onClick={handleSave} disabled={!valid}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold
              hover:bg-emerald-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            <Save size={14}/>{isEdit ? 'Lưu thay đổi' : 'Thêm liên hệ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Interaction log ───────────────────────────────────────────────────────────
function InteractionLog({ contact, onUpdate }: { contact: Contact; onUpdate: (c: Contact) => void }) {
  const [note, setNote] = useState('');
  function addNote() {
    if (!note.trim()) return;
    const updated: Contact = {
      ...contact,
      interactions: [
        { id: uid(), date: new Date().toISOString().slice(0, 10), note: note.trim() },
        ...contact.interactions,
      ],
    };
    onUpdate(updated);
    setNote('');
  }
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Lịch sử tương tác</p>
      <div className="flex gap-2 mb-3">
        <input value={note} onChange={e => setNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addNote()}
          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
          placeholder="Thêm ghi chú tương tác..."/>
        <button onClick={addNote}
          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors">
          <Plus size={12}/>
        </button>
      </div>
      <div className="space-y-2 max-h-28 overflow-y-auto">
        {contact.interactions.length === 0
          ? <p className="text-[10px] text-slate-400 italic">Chưa có ghi chú nào.</p>
          : contact.interactions.map(i => (
            <div key={i.id} className="flex gap-2 items-start">
              <span className="text-[10px] text-slate-400 whitespace-nowrap mt-0.5 font-mono">{i.date}</span>
              <p className="text-xs text-slate-600 leading-relaxed">{i.note}</p>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── Contact Card (grid view) ──────────────────────────────────────────────────
function ContactCard({ contact, onEdit, onDelete, onUpdate, projects = [] }: {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (c: Contact) => void;
  projects?: any[];
}) {
  const [expanded, setExpanded] = useState(false);
  const linkedProjects = (projects || []).filter((p:any) => contact.projectIds?.includes(p.id));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col group">
      {/* Top */}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Avatar contact={contact} size="md"/>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">{contact.company}</h3>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={onEdit}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <Edit3 size={12}/>
                </button>
                <button onClick={onDelete}
                  className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors">
                  <Trash2 size={12}/>
                </button>
              </div>
            </div>
            <TypeBadge type={contact.type}/>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <UserCircle size={12} className="text-slate-400 shrink-0"/>
            <span className="font-medium truncate">{contact.contactPerson}</span>
            {contact.position && <span className="text-slate-400 truncate">· {contact.position}</span>}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Phone size={12} className="text-slate-400 shrink-0"/>
            <a href={`tel:${contact.phone}`} className="hover:text-emerald-600 transition-colors">{contact.phone}</a>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Mail size={12} className="text-slate-400 shrink-0"/>
            <a href={`mailto:${contact.email}`} className="hover:text-emerald-600 transition-colors truncate">{contact.email}</a>
          </div>
          {linkedProjects.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <Tag size={12} className="text-slate-400 shrink-0 mt-0.5"/>
              <div className="flex flex-wrap gap-1">
                {linkedProjects.map(p => (
                  <span key={p.id} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[10px] font-medium">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {contact.website && (
            <div className="flex items-center gap-2 text-xs">
              <Globe size={12} className="text-slate-400 shrink-0"/>
              <a href={contact.website} target="_blank" rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate">{contact.website.replace('https://', '')}</a>
            </div>
          )}
          {contact.bank?.accountNo && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CreditCard size={12} className="text-slate-400 shrink-0"/>
              <span className="truncate">{contact.bank.bankName} · {contact.bank.accountNo}</span>
            </div>
          )}
          {contact.note && (
            <div className="flex items-start gap-2 text-xs text-slate-500">
              <FileText size={12} className="text-slate-400 shrink-0 mt-0.5"/>
              <p className="line-clamp-2 italic">{contact.note}</p>
            </div>
          )}
        </div>

        {/* Expand interaction log */}
        <button onClick={() => setExpanded(v => !v)}
          className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
          <Clock size={10}/>
          {contact.interactions.length} tương tác
          {expanded ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
        </button>

        {expanded && <InteractionLog contact={contact} onUpdate={onUpdate}/>}
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 flex gap-2 mt-auto">
        <a href={`https://zalo.me/${contact.phone}`} target="_blank" rel="noopener noreferrer"
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors">
          <MessageCircle size={13}/> Zalo
        </a>
        <a href={`tel:${contact.phone}`}
          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors">
          <Phone size={13}/> Gọi
        </a>
        <a href={`mailto:${contact.email}`}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors">
          <Mail size={13}/> Email
        </a>
      </div>
    </div>
  );
}

// ── Table Row (list view) ─────────────────────────────────────────────────────
function ContactRow({ contact, onEdit, onDelete, projects = [] }: {
  contact: Contact; onEdit: () => void; onDelete: () => void; projects?: any[];
}) {
  const linkedProjects = (projects || []).filter((p:any) => contact.projectIds?.includes(p.id));
  return (
    <tr className="hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar contact={contact} size="sm"/>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{contact.company}</p>
            <p className="text-xs text-slate-400 truncate">{contact.role}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <TypeBadge type={contact.type}/>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <p className="text-sm text-slate-700 font-medium">{contact.contactPerson}</p>
        <p className="text-xs text-slate-400">{contact.position}</p>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <a href={`tel:${contact.phone}`} className="text-sm text-slate-700 hover:text-emerald-600 block">{contact.phone}</a>
        <a href={`mailto:${contact.email}`} className="text-xs text-slate-400 hover:text-emerald-600 block truncate max-w-[160px]">{contact.email}</a>
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        <div className="flex flex-wrap gap-1">
          {linkedProjects.map(p => (
            <span key={p.id} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[10px] font-medium">
              {p.name}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1 items-center">
          <a href={`https://zalo.me/${contact.phone}`} target="_blank" rel="noopener noreferrer"
            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Zalo">
            <MessageCircle size={13}/>
          </a>
          <a href={`tel:${contact.phone}`}
            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Gọi điện">
            <Phone size={13}/>
          </a>
          <button onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all">
            <Edit3 size={13}/>
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
            <Trash2 size={13}/>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ══ MAIN ══════════════════════════════════════════════════════════════════════
import { db } from './db';

export default function Contacts({ projects = [] }: { projects?: any[] }) {
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState<ContactType | 'all'>('all');
  const [viewMode, setViewMode]       = useState<'grid' | 'list'>('grid');
  const [showModal, setShowModal]     = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [showGemScan, setShowGemScan] = useState(false);

  // ── Load / save via db.ts ─────────────────────────────────────────────────
  useEffect(() => {
    db.get<Contact[]>('contacts', 'global', DEFAULT_CONTACTS).then(setContacts);
  }, []);

  useEffect(() => {
    if (contacts.length > 0) db.set('contacts', 'global', contacts);
  }, [contacts]);

  // ── Listen for Taskbar quick-add ────────────────────────────────────────────
  useEffect(() => {
    const handler = () => openAdd();
    window.addEventListener('gem:add-contact', handler);
    return () => window.removeEventListener('gem:add-contact', handler);
  }, []);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  function saveContact(c: Contact) {
    setContacts(prev => prev.find(x => x.id === c.id) ? prev.map(x => x.id === c.id ? c : x) : [...prev, c]);
    setShowModal(false); setEditContact(null);
  }
  function deleteContact(id: string) {
    if (!confirm('Xoá liên hệ này?')) return;
    setContacts(prev => prev.filter(c => c.id !== id));
  }
  function openEdit(c: Contact) { setEditContact(c); setShowModal(true); }
  function openAdd() { setEditContact(null); setShowModal(true); }

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.company.toLowerCase().includes(q)
      || c.contactPerson.toLowerCase().includes(q)
      || c.phone.includes(q) || c.email.toLowerCase().includes(q);
    const matchType = filterType === 'all' || c.type === filterType;
    return matchSearch && matchType;
  });

  const counts = Object.keys(TYPE_META).reduce((acc, k) => {
    acc[k as ContactType] = contacts.filter(c => c.type === k).length;
    return acc;
  }, {} as Record<ContactType, number>);

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-2xl font-bold text-slate-800 leading-tight">Danh bạ đối tác</h2>
          <p className="text-xs text-slate-500 mt-0.5">{contacts.length} liên hệ · {(projects||[]).filter((p:any)=>p.type==='in_progress').length} dự án đang chạy</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* GEM Scan */}
          <button onClick={() => setShowGemScan(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 border border-emerald-200 bg-emerald-50
              text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-colors">
            <Sparkles size={12}/> Scan Namecard
          </button>
          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode==='grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutGrid size={13}/> Card
            </button>
            <button onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode==='list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <List size={13}/> Bảng
            </button>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl
              text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus size={13}/> Thêm liên hệ
          </button>
        </div>
      </div>

      {/* ── GEM SCAN BANNER ────────────────────────────────────────────────── */}
      {showGemScan && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-4 items-start">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-white"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800 mb-1">Nàng GEM · Scan Namecard</p>
            <p className="text-xs text-emerald-700 leading-relaxed mb-3">
              Dạ anh, đưa danh thiếp ra trước camera hoặc tải ảnh lên — em sẽ tự động đọc và điền thông tin liên hệ cho anh nghen!
            </p>
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors">
                <Camera size={12}/> Chụp ảnh
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-50 transition-colors">
                <UploadCloud size={12}/> Tải file lên
              </button>
            </div>
          </div>
          <button onClick={() => setShowGemScan(false)} className="text-emerald-400 hover:text-emerald-600 p-1">
            <X size={16}/>
          </button>
        </div>
      )}

      {/* ── SEARCH + STATS ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all placeholder:text-slate-400"
              placeholder="Tìm tên công ty, người liên hệ, SĐT..."/>
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterType('all')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filterType==='all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              Tất cả <span className="ml-1 opacity-70">{contacts.length}</span>
            </button>
            {(Object.entries(TYPE_META) as [ContactType, typeof TYPE_META[ContactType]][]).map(([v, m]) => (
              <button key={v} onClick={() => setFilterType(v)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  filterType===v ? `${m.bg} ${m.color} border` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {m.label} <span className="ml-1 opacity-70">{counts[v]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── GRID VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
              <UserCircle size={44} className="text-slate-200 mx-auto mb-3"/>
              <p className="text-slate-500 font-medium">Không tìm thấy liên hệ nào</p>
              <button onClick={openAdd} className="mt-3 text-sm text-emerald-600 font-semibold hover:underline">
                + Thêm liên hệ mới
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(c => (
                <ContactCard key={c.id} contact={c}
                  onEdit={() => openEdit(c)}
                  onDelete={() => deleteContact(c.id)}
                  onUpdate={updated => setContacts(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  projects={projects}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── LIST VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <UserCircle size={44} className="text-slate-200 mx-auto mb-3"/>
              <p className="text-slate-500 font-medium">Không tìm thấy liên hệ nào</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Công ty</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden md:table-cell">Loại</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden lg:table-cell">Liên hệ</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden md:table-cell">Liên lạc</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden xl:table-cell">Dự án</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <ContactRow key={c.id} contact={c}
                    onEdit={() => openEdit(c)}
                    onDelete={() => deleteContact(c.id)}
                    projects={projects}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── MODAL ──────────────────────────────────────────────────────────── */}
      {showModal && (
        <ContactModal
          contact={editContact}
          onSave={saveContact}
          onClose={() => { setShowModal(false); setEditContact(null); }}
          projects={projects}
        />
      )}
    </div>
  );
}
