# GEM & CLAUDE PM Pro — Design System & Code Guideline
> Version 1.0 · Binding cho tất cả code từ S13 trở đi  
> Mọi PR vi phạm guideline này sẽ bị reject

---

## 1. Triết lý nền tảng

**Một cách duy nhất.** Mọi pattern UI/UX phải có 1 cách làm và chỉ 1.  
Khi không chắc → đọc file này trước khi code.

---

## 2. Component Library — BẮT BUỘC dùng, không tự tạo

### 2.1 Modal & Form
```tsx
// ✅ ĐÚNG — duy nhất, không ngoại lệ
import ModalForm, { FormRow, FormGrid, FormSection, 
                    inputCls, selectCls, 
                    BtnCancel, BtnSubmit } from './ModalForm';

<ModalForm
  open={showXxxForm}
  onClose={() => setShowXxxForm(false)}
  title="Tiêu đề rõ ràng"
  subtitle="Mô tả ngắn hành động"
  icon={<SomeIcon size={18}/>}
  color="emerald"   // emerald | blue | violet | amber | rose | orange | teal | slate
  width="md"        // sm(448px) | md(576px) | lg(672px) | xl(896px)
  footer={<>
    <BtnCancel onClick={() => setShowXxxForm(false)} />
    <BtnSubmit label="Lưu" onClick={handleSave} />
  </>}
>
  <FormSection title="Nhóm trường">
    <FormGrid cols={2}>
      <FormRow label="Tên trường" required>
        <input className={inputCls} placeholder="..." />
      </FormRow>
    </FormGrid>
  </FormSection>
</ModalForm>

// ❌ SAI — không dùng
<div className="fixed inset-0 bg-black/50 z-50 ...">  // custom modal
{showForm && (<div className="bg-slate-50 border ..."> // inline form
```

### 2.2 Thông báo (Notification)
```tsx
// ✅ ĐÚNG
import { useNotification } from './NotificationEngine';
const { ok, err, warn, info } = useNotification();
ok('Đã lưu thành công!');
err('Không tìm thấy dữ liệu!');

// ❌ SAI — cấm tuyệt đối
alert('...');
window.alert('...');
confirm('...');
```

### 2.3 Data persistence
```tsx
// ✅ ĐÚNG — qua db.ts duy nhất
import { db } from './db';
const data = await db.get<MyType[]>('collection_key', projectId, []);
await db.set('collection_key', projectId, data);

// ❌ SAI — truy cập thẳng localStorage
localStorage.getItem('gem_...');
localStorage.setItem('gem_...');
```

### 2.4 Load/Save pattern — BẮT BUỘC dùng `dbLoaded` flag

**Vấn đề:** `useEffect` auto-save chạy ngay khi mount với INIT data (trước khi `db.get` hoàn thành)
→ ghi đè data thật trên Supabase bằng data mặc định rỗng → mất data.

**MaterialsDashboard làm ĐÚNG** — `save()` là `useCallback`, chỉ gọi trong user action handler, không tự chạy khi mount.

**Pattern chuẩn cho dashboard có auto-save:**
```tsx
// ✅ ĐÚNG — dùng dbLoaded flag
const [items, setItems] = useState<MyType[]>([]);
const [dbLoaded, setDbLoaded] = useState(false); // BẮT BUỘC khi có auto-save useEffect

useEffect(() => {
  setDbLoaded(false); // reset khi projectId thay đổi
  db.get<MyType[]>('collection', projectId, []).then(data => {
    setItems(data);
    setDbLoaded(true); // load xong → cho phép auto-save
  });
}, [projectId]);

// Auto-save CHỈ chạy sau khi dbLoaded = true
useEffect(() => { if (dbLoaded) db.set('collection', projectId, items); }, [items]);

// ✅ CŨNG ĐÚNG — save trong handler (như MaterialsDashboard)
const save = useCallback((data: MyType[]) => db.set('collection', projectId, data), [projectId]);
// Gọi save() trong handleSave(), không dùng useEffect

// ❌ SAI — auto-save không có guard → race condition khi mount
useEffect(() => { db.set('collection', projectId, items); }, [items]);
```

**Rule:** Nếu dùng `useEffect` để auto-save → **bắt buộc có `dbLoaded` guard**.  
Nếu save trong handler (onClick, onSubmit) → không cần guard.

### 2.4 In ấn / PDF
```tsx
// ✅ ĐÚNG
import { usePrint } from './PrintService';
const { printComponent, printSupervisionLog } = usePrint();
// ... render {printComponent} ở cuối JSX

// ❌ SAI
window.print();  // không dùng trực tiếp
```

---

## 3. CSS Tokens — BẮT BUỘC dùng constants, không hard-code

### 3.1 Input fields
```tsx
// ✅ ĐÚNG — import từ ModalForm.tsx
import { inputCls, selectCls } from './ModalForm';

// inputCls = "w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 
//             bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 
//             focus:border-emerald-400 placeholder:text-slate-300"

// selectCls = "w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 
//              bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"

// ❌ SAI — copy-paste className từng lần
<input className="w-full border border-slate-200 rounded-xl px-3 py-2..." />
```

### 3.2 Màu sắc
```tsx
// ✅ ĐÚNG — Tailwind tokens
className="bg-emerald-600 text-white hover:bg-emerald-700"
// ✅ OK — inline style với CSS variable hoặc design token từ roles.ts
style={{ color: ROLES[roleId].color }}

// ❌ SAI — hex hardcode trong JSX
style={{ color: '#7c3aed' }}   // dùng ROLES[roleId].color thay
style={{ background: '#059669' }}
```

### 3.3 Typography & Spacing
| Token | Class | Dùng khi |
|---|---|---|
| Label nhóm | `text-[10px] font-black text-slate-400 uppercase tracking-widest` | Section title |
| Label field | `text-[11px] font-bold text-slate-600 uppercase tracking-wide` | FormRow label |
| Body text | `text-xs text-slate-700` | Nội dung bảng, card |
| Caption | `text-[10px] text-slate-400` | Phụ chú, timestamp |
| Badge | `text-[9px] font-bold px-2 py-0.5 rounded-full` | Status badge |

---

## 4. State Management Patterns

### 4.1 Form state naming
```tsx
// ✅ Convention bắt buộc
const [showXxxForm, setShowXxxForm] = useState(false);  // boolean toggle
const [xxxForm, setXxxForm] = useState<Partial<XxxType>>({});  // form data
const [xxxList, setXxxList] = useState<XxxType[]>([]);  // list data
const [selectedXxx, setSelectedXxx] = useState<XxxType | null>(null);  // selection
const [xxxLoading, setXxxLoading] = useState(false);  // async state

// ❌ SAI — inconsistent naming
const [open, setOpen] = useState(false);     // quá generic
const [data, setData] = useState({});        // không rõ type
const [form, setForm] = useState(null);      // không rõ mục đích
```

### 4.2 WorkspaceActionBar trigger pattern
```tsx
// ✅ Khi cần mở form từ WorkspaceActionBar
useEffect(() => {
  const handler = (e: Event) => {
    const { actionId } = (e as CustomEvent).detail;
    if (actionId === 'ACTION_ID') {
      setActiveTab('tab_name');
      setTimeout(() => setShowXxxForm(true), 200);
    }
  };
  window.addEventListener('gem:open-action', handler);
  return () => window.removeEventListener('gem:open-action', handler);
}, []);
```

### 4.3 Sub-tab navigation từ WorkspaceActionBar
```tsx
// ✅ Đọc sessionStorage trên mount
const [activeTab, setActiveTab] = useState<TabType>(() => {
  const saved = sessionStorage.getItem('gem_action_subtab');
  const valid: TabType[] = ['tab1', 'tab2', 'tab3'];
  if (saved && valid.includes(saved)) {
    sessionStorage.removeItem('gem_action_subtab');
    return saved as TabType;
  }
  return 'overview';
});
```

---

## 5. Component Structure — BẮT BUỘC

### 5.1 Dashboard component template
```tsx
// ✅ Structure chuẩn cho mọi dashboard
import type { DashboardProps } from './types';

export default function XxxDashboard({ project, projectId, ctx, readOnly }: DashboardProps) {
  // 1. Hooks
  const { ok, err, info } = useNotification();
  const { printComponent, printXxx } = usePrint();
  
  // 2. State — nhóm theo chức năng
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Form states
  const [showXxxForm, setShowXxxForm] = useState(false);
  const [xxxForm, setXxxForm] = useState<Partial<XxxType>>({});
  
  // Data states
  const [xxxList, setXxxList] = useState<XxxType[]>([]);
  
  // 3. Data loading
  useEffect(() => {
    db.get<XxxType[]>('xxx_key', projectId, []).then(setXxxList);
  }, [projectId]);
  
  // 4. gem:open-action listener
  useEffect(() => { /* ... */ }, []);
  
  // 5. Handlers
  const handleSaveXxx = () => { /* ... */ };
  
  // 6. Render
  return (
    <div className="space-y-6">
      {/* Tabs */}
      {/* Tab content */}
      
      {/* Modals — LUÔN ở cuối, sau tất cả tab content */}
      <ModalForm open={showXxxForm} ...>...</ModalForm>
      
      {/* Print overlay */}
      {printComponent}
    </div>
  );
}
```

### 5.2 Modal placement rule
**Modal LUÔN render ở cuối component return, sau tất cả tab content.**  
Không bao giờ đặt modal bên trong tab block.  
Lý do: modal dùng `fixed inset-0` và cần render bất kể tab nào đang active.

---

## 6. Form Design Rules

### 6.1 Required fields cho mọi form nghiệp vụ
Tất cả form tạo document đều PHẢI có:
- **Người lập / Người đề xuất** (`nguoiLap`, `nguoiDeXuat`)
- **Chức vụ** (`chucVu`)
- **Người nhận / Người thực hiện** (`nguoiNhan`) — nếu có transfer
- **Ngày** (`ngay`) — default = today

### 6.2 Validation
```tsx
// ✅ Validate trước khi save, dùng notifErr
const handleSave = () => {
  if (!form.nguoiLap?.trim()) { err('Vui lòng nhập người lập!'); return; }
  if (!form.field?.trim()) { err('Vui lòng nhập [tên field]!'); return; }
  // ... save logic
};

// ❌ SAI
if (!form.field) return;  // silent fail
alert('...');              // dùng notifErr
```

---

## 7. Approval & Workflow

```tsx
// ✅ Tạo document vào ApprovalQueue
import { seedApprovalDocs } from './approvalEngine';
import type { SeedVoucherInput } from './approvalEngine';

const input: SeedVoucherInput = {
  docType: 'WAREHOUSE_EXIT',  // từ DocType trong roles.ts
  title: `Phiếu xuất kho — ${code}`,
  amount: totalAmount,
  projectId,
  createdBy: ctx?.userId || 'current_user',
  payload: { ...documentData },
};
const { docId } = await seedApprovalDocs([input]);
```

---

## 8. AI Integration (Gemini)

```tsx
// ✅ ĐÚNG — dùng qua gemini.ts wrapper
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';

const model = genAI.getGenerativeModel({
  model: GEM_MODEL,  // 'gemini-3-flash-preview'
  systemInstruction: 'System prompt...',
  generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
});
const result = await model.generateContent('prompt');

// GEM_MODEL_QUALITY = 'gemini-3-flash-preview' (dùng cho QA/QC, báo cáo chất lượng cao)
// KHÔNG dùng model string trực tiếp — luôn qua constants

// ❌ SAI
new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-2.0-flash' })
```

---

## 9. Collection Registry (db.ts)

Trước khi thêm collection mới:
1. Kiểm tra COLLECTION REGISTRY trong `db.ts` — collection đã có chưa?
2. Nếu chưa → thêm vào registry trong `db.ts` với comment owner module
3. Naming: `module_doctype` — ví dụ: `mat_vouchers`, `qs_payments`, `hse_incidents`

---

## 10. Pre-commit Checklist

Trước khi push code mới, tự review:

- [ ] Không có `alert()` / `confirm()` — dùng `notifErr` / `notifOk`
- [ ] Không có `localStorage.getItem/setItem` trực tiếp — dùng `db.ts`
- [ ] Không có `<div className="fixed inset-0...">` custom — dùng `ModalForm`
- [ ] Tất cả form có đủ trường: `nguoiLap`, `chucVu`, `nguoiNhan`, `ngay`
- [ ] Modal đặt ở cuối component return, không trong tab block
- [ ] Form state naming: `showXxxForm`, `xxxForm`, `xxxList`
- [ ] Input dùng `inputCls` / `selectCls` từ ModalForm.tsx
- [ ] Màu sắc dùng Tailwind tokens, không hard-code hex
- [ ] Collection key đăng ký trong `db.ts` registry
- [ ] AI model dùng `GEM_MODEL` / `GEM_MODEL_QUALITY` constants
- [ ] Nếu có `useEffect` auto-save → **bắt buộc có `dbLoaded` guard** (xem section 2.4)

---

## 11. Migration Backlog (những gì cần refactor từ S13+)

### Priority 1 — phải fix trước khi build feature mới
| File | Vấn đề | Action |
|---|---|---|
| 16 files | `alert()` → `notifErr/ok` | Replace tất cả |
| ContractDashboard, HRWorkspace, HSEWorkspace | Direct localStorage | Migrate sang db.ts |
| EquipmentDashboard | Custom `Modal` component riêng | Merge vào ModalForm |

### Priority 2 — clean up trong S13
| File | Vấn đề | Action |
|---|---|---|
| 24 files | Custom modal overlay | Kiểm tra từng modal — nếu là form thì migrate ModalForm, nếu là view-only detail thì giữ (detail view không phải form) |
| QaQcDashboard, ProjectDashboard | `project: any` | Migrate sang `DashboardProps` |

### Priority 3 — S14+
| Item | Action |
|---|---|
| 44 input CSS variants | Standardize về `inputCls` |
| 37 button variants | Standardize — `BtnSubmit`, `BtnCancel`, outline pattern |
| WorkspaceActionBar → Smart Sidebar | Theo roadmap S13–14 |

---

## 12. File Structure Convention

```
src/
├── App.tsx                    # Entry, routing, global state
├── components/
│   ├── types.ts               # Shared types — source of truth
│   ├── db.ts                  # Data layer — source of truth
│   ├── permissions.ts         # Permission engine — source of truth
│   ├── roles.ts               # Role definitions — source of truth
│   ├── workflows.ts           # Workflow steps — source of truth
│   ├── gemini.ts              # AI client — source of truth
│   ├── ModalForm.tsx          # UI primitive — source of truth
│   ├── PrintService.tsx       # Print — source of truth
│   ├── NotificationEngine.tsx # Toast — source of truth
│   ├── approvalEngine.ts      # Approval logic — source of truth
│   └── [Feature]Dashboard.tsx # Feature modules — dùng primitives trên
```

---

*Guideline này là living document — cập nhật khi có pattern mới được thống nhất.*  
*Mọi thay đổi guideline cần được review và đồng ý trước khi áp dụng.*
