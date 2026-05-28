import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  getDocs,
} from "firebase/firestore";

// ─── FIREBASE ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBIQHMSfVtCbe_yI-qNWLdGkIfa15FmL8g",
  authDomain: "lista-mercado-4a277.firebaseapp.com",
  projectId: "lista-mercado-4a277",
  storageBucket: "lista-mercado-4a277.firebasestorage.app",
  messagingSenderId: "238886722797",
  appId: "1:238886722797:web:f29f78e5916d1386a700e4",
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ─── ESTRUTURA DO FIREBASE ────────────────────────────────────────────────────
// listas_v4/{id}                     → { name, createdAt }
// listas_v4/{id}/itens/{id}          → { name, category, done, createdAt }
// categorias_v1/{id}                 → { label, color, order, createdAt }
// historico_v1/{id}                  → { name, items[], archivedAt }
// catalogo_v1/{id}                   → { name, category, createdAt }  ← NOVO

// ─── CATEGORIAS PADRÃO ───────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: "hortifruti", label: "🥦 Hortifruti", color: "#22c55e", order: 0 },
  { id: "carnes",     label: "🥩 Carnes",     color: "#ef4444", order: 1 },
  { id: "laticinios", label: "🧀 Laticínios", color: "#f59e0b", order: 2 },
  { id: "padaria",    label: "🍞 Padaria",    color: "#f97316", order: 3 },
  { id: "bebidas",    label: "🥤 Bebidas",    color: "#3b82f6", order: 4 },
  { id: "limpeza",    label: "🧹 Limpeza",    color: "#a855f7", order: 5 },
  { id: "higiene",    label: "🪥 Higiene",    color: "#06b6d4", order: 6 },
  { id: "congelados", label: "🧊 Congelados", color: "#64748b", order: 7 },
  { id: "mercearia",  label: "🛒 Mercearia",  color: "#a16207", order: 8 },
  { id: "outros",     label: "📦 Outros",     color: "#6b7280", order: 99 },
];

const EMOJI_OPTIONS = ["🛍","🥗","🍖","🧴","🍷","🫙","🥛","🍫","🌾","🧆","🍜","🫒","🍳","🧃","🧂","🥚","🍕","🍦","🌿","📦","🐾","🧹","🪴","🎂","🫐","🍓"];
const COLOR_OPTIONS  = ["#22c55e","#ef4444","#f59e0b","#f97316","#3b82f6","#a855f7","#06b6d4","#64748b","#a16207","#6b7280","#ec4899","#14b8a6","#84cc16","#f43f5e","#8b5cf6","#0ea5e9"];

const uid = () => Math.random().toString(36).slice(2, 10);
const loadStorage = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const saveStorage = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ─── CSS ──────────────────────────────────────────────────────────────────────
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow-x: hidden; }
  input, button { font-family: inherit; }
  ::-webkit-scrollbar { display: none; }
  @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeUp  { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
`;

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({ children, onClose, center = false, surfaceColor, fullscreen = false }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: fullscreen ? "flex-end" : center ? "center" : "flex-end", justifyContent: "center", padding: center ? 20 : 0, animation: "fadeIn 0.2s ease-out", backdropFilter: "blur(5px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: surfaceColor, width: "100%", maxWidth: 520, borderRadius: fullscreen ? "24px 24px 0 0" : center ? 24 : "24px 24px 0 0", padding: 0, animation: "slideUp 0.3s ease-out", boxShadow: "0 -4px 48px rgba(0,0,0,0.5)", maxHeight: fullscreen ? "92dvh" : undefined, display: fullscreen ? "flex" : undefined, flexDirection: fullscreen ? "column" : undefined }}>
        {children}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(() => loadStorage("mkt_dark", true));

  const [lists,      setLists]      = useState([]);
  const [itens,      setItens]      = useState({});
  const [categories, setCategories] = useState([]);
  const [historico,  setHistorico]  = useState([]);
  const [catalogo,   setCatalogo]   = useState([]); // ← NOVO
  const [loading,    setLoading]    = useState(true);

  const [screen,   setScreen]   = useState("home");
  const [activeId, setActiveId] = useState(null);

  // Modais
  const [showListModal,     setShowListModal]     = useState(false);
  const [showItemModal,     setShowItemModal]     = useState(false);
  const [showCatModal,      setShowCatModal]      = useState(false);
  const [showCatalogoModal, setShowCatalogoModal] = useState(false); // catálogo completo
  const [showPickerModal,   setShowPickerModal]   = useState(false); // selecionar do catálogo
  const [confirmDelete,     setConfirmDelete]     = useState(null);
  const [confirmDelCat,     setConfirmDelCat]     = useState(null); // confirma excluir item catálogo

  // Form lista
  const [listName,   setListName]   = useState("");
  const [editListId, setEditListId] = useState(null);

  // Form item avulso
  const [editItemId, setEditItemId] = useState(null);
  const [itemName,   setItemName]   = useState("");
  const [itemCat,    setItemCat]    = useState("outros");
  const itemNameRef = useRef();

  // Form catálogo
  const [editCatalogoId,   setEditCatalogoId]   = useState(null);
  const [catalogoName,     setCatalogoName]     = useState("");
  const [catalogoCat,      setCatalogoCat]      = useState("outros");
  const [showCatalogoForm, setShowCatalogoForm] = useState(false);
  const catalogoNameRef = useRef();

  // Picker: itens selecionados do catálogo
  const [pickerSearch,    setPickerSearch]    = useState("");
  const [pickerSelected,  setPickerSelected]  = useState(new Set());
  const [pickerFilterCat, setPickerFilterCat] = useState("todas");

  // Form categoria
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🛍");
  const [newCatColor, setNewCatColor] = useState("#22c55e");

  // ── Firebase: listas ──────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "listas_v4"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setLists(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // ── Firebase: categorias ──────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "categorias_v1"), orderBy("order", "asc"));
    return onSnapshot(q, async (snap) => {
      if (snap.empty) {
        const batch = writeBatch(db);
        DEFAULT_CATEGORIES.forEach((c) => batch.set(doc(db, "categorias_v1", c.id), { label: c.label, color: c.color, order: c.order, createdAt: Date.now() }));
        await batch.commit();
      } else {
        setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    });
  }, []);

  // ── Firebase: histórico ───────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "historico_v1"), orderBy("archivedAt", "desc"));
    return onSnapshot(q, (snap) => setHistorico(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  // ── Firebase: catálogo ────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "catalogo_v1"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => setCatalogo(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  // ── Firebase: itens da lista ativa ────────────────────────────────────────
  useEffect(() => {
    if (!activeId) return;
    const q = query(collection(db, "listas_v4", activeId, "itens"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setItens((prev) => ({ ...prev, [activeId]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
    });
  }, [activeId]);

  // ── Firebase: resumo para a home ──────────────────────────────────────────
  useEffect(() => {
    if (lists.length === 0) return;
    const unsubs = lists.map((list) =>
      onSnapshot(query(collection(db, "listas_v4", list.id, "itens")), (snap) => {
        setItens((prev) => ({ ...prev, [list.id]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [lists.map((l) => l.id).join(",")]);

  useEffect(() => { saveStorage("mkt_dark", dark); }, [dark]);

  // ── Tema ──────────────────────────────────────────────────────────────────
  const T = {
    bg:       dark ? "#0f1117" : "#f0f4f8",
    surface:  dark ? "#1a1d27" : "#ffffff",
    surface2: dark ? "#22263a" : "#f1f5f9",
    border:   dark ? "#2e3248" : "#e2e8f0",
    text:     dark ? "#e2e8f0" : "#0f172a",
    muted:    dark ? "#64748b" : "#94a3b8",
    accent:   "#6ee7b7",
    accent2:  "#818cf8",
    danger:   "#f87171",
  };

  const card         = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, marginBottom: 12 };
  const fab          = { position: "fixed", bottom: 24, right: 20, background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 20, padding: "14px 24px", color: "#0f1117", fontSize: 16, fontWeight: 700, boxShadow: "0 8px 28px rgba(110,231,183,.4)", cursor: "pointer", zIndex: 10 };
  const inputStyle   = { width: "100%", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, fontSize: 16, padding: "12px 14px", outline: "none", marginBottom: 12 };
  const btnPrimary   = { flex: 1, padding: "13px 0", background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 14, color: "#0f1117", fontSize: 15, fontWeight: 700, cursor: "pointer" };
  const btnSecondary = { flex: 1, padding: "13px 0", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 14, color: T.muted, fontSize: 15, cursor: "pointer" };
  const btnDanger    = { flex: 1, padding: "13px 0", background: T.danger + "22", border: `1px solid ${T.danger}55`, borderRadius: 14, color: T.danger, fontSize: 15, fontWeight: 700, cursor: "pointer" };
  const iconBtn      = { background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: "4px 8px", color: T.muted };
  const sectionLabel = { fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8, display: "block" };

  const getCat      = (id) => categories.find((c) => c.id === id) || { label: "📦 Outros", color: "#6b7280" };
  const activeList  = lists.find((l) => l.id === activeId);
  const activeItens = itens[activeId] || [];

  // ── Ações: listas ─────────────────────────────────────────────────────────
  const openNewList  = () => { setListName(""); setEditListId(null); setShowListModal(true); };
  const openEditList = (list, e) => { e.stopPropagation(); setListName(list.name); setEditListId(list.id); setShowListModal(true); };
  const saveList = async () => {
    if (!listName.trim()) return;
    if (editListId) {
      await setDoc(doc(db, "listas_v4", editListId), { name: listName.trim() }, { merge: true });
    } else {
      await setDoc(doc(db, "listas_v4", uid()), { name: listName.trim(), createdAt: Date.now() });
    }
    setShowListModal(false);
  };
  const archiveList = async (list, e) => {
    e.stopPropagation();
    const snap  = await getDocs(collection(db, "listas_v4", list.id, "itens"));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    await setDoc(doc(db, "historico_v1", uid()), { name: list.name, items, archivedAt: Date.now() });
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "listas_v4", list.id));
    await batch.commit();
  };
  const deleteListPermanently = async (id) => {
    const snap  = await getDocs(collection(db, "listas_v4", id, "itens"));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "listas_v4", id));
    await batch.commit();
    setConfirmDelete(null);
    if (screen === "list") setScreen("home");
  };

  // ── Ações: itens avulsos ──────────────────────────────────────────────────
  const openAddItem = () => {
    setEditItemId(null); setItemName(""); setItemCat("outros");
    setShowItemModal(true);
    setTimeout(() => itemNameRef.current?.focus(), 120);
  };
  const openEditItem = (item) => {
    setEditItemId(item.id); setItemName(item.name); setItemCat(item.category || "outros");
    setShowItemModal(true);
    setTimeout(() => itemNameRef.current?.focus(), 120);
  };
  const saveItem = async () => {
    if (!itemName.trim() || !activeId) return;
    const id = editItemId || uid();
    await setDoc(doc(db, "listas_v4", activeId, "itens", id), { name: itemName.trim(), category: itemCat, done: false, ...(editItemId ? {} : { createdAt: Date.now() }) }, { merge: true });
    setShowItemModal(false);
  };
  const toggleItem = async (item) => {
    await setDoc(doc(db, "listas_v4", activeId, "itens", item.id), { done: !item.done }, { merge: true });
  };
  const deleteItem = async (itemId) => {
    await deleteDoc(doc(db, "listas_v4", activeId, "itens", itemId));
  };
  const clearDone = async () => {
    const batch = writeBatch(db);
    activeItens.filter((i) => i.done).forEach((i) => batch.delete(doc(db, "listas_v4", activeId, "itens", i.id)));
    await batch.commit();
  };

  // ── Ações: catálogo ───────────────────────────────────────────────────────
  const openNewCatalogo = () => {
    setEditCatalogoId(null); setCatalogoName(""); setCatalogoCat("outros");
    setShowCatalogoForm(true);
    setTimeout(() => catalogoNameRef.current?.focus(), 120);
  };
  const openEditCatalogo = (item) => {
    setEditCatalogoId(item.id); setCatalogoName(item.name); setCatalogoCat(item.category || "outros");
    setShowCatalogoForm(true);
    setTimeout(() => catalogoNameRef.current?.focus(), 120);
  };
  const saveCatalogo = async () => {
    if (!catalogoName.trim()) return;
    const id = editCatalogoId || uid();
    await setDoc(doc(db, "catalogo_v1", id), { name: catalogoName.trim(), category: catalogoCat, ...(editCatalogoId ? {} : { createdAt: Date.now() }) }, { merge: true });
    setCatalogoName(""); setCatalogoCat("outros"); setEditCatalogoId(null);
    setShowCatalogoForm(false);
  };
  const deleteCatalogo = async (id) => {
    await deleteDoc(doc(db, "catalogo_v1", id));
    setConfirmDelCat(null);
  };

  // ── Picker: adicionar do catálogo à lista ─────────────────────────────────
  const openPicker = () => {
    setPickerSearch(""); setPickerSelected(new Set()); setPickerFilterCat("todas");
    setShowPickerModal(true);
  };

  // toque único → adiciona direto (se não duplica)
  const pickerAddOne = async (catItem) => {
    const jaExiste = activeItens.some((i) => i.name.toLowerCase() === catItem.name.toLowerCase());
    if (jaExiste) return;
    await setDoc(doc(db, "listas_v4", activeId, "itens", uid()), { name: catItem.name, category: catItem.category, done: false, createdAt: Date.now() });
  };

  // confirmar seleção múltipla
  const pickerConfirm = async () => {
    const batch = writeBatch(db);
    const nomesNaLista = new Set(activeItens.map((i) => i.name.toLowerCase()));
    catalogo
      .filter((c) => pickerSelected.has(c.id) && !nomesNaLista.has(c.name.toLowerCase()))
      .forEach((c) => {
        batch.set(doc(db, "listas_v4", activeId, "itens", uid()), { name: c.name, category: c.category, done: false, createdAt: Date.now() });
      });
    await batch.commit();
    setShowPickerModal(false);
  };

  const togglePickerSelect = (id) => {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Ações: categorias ─────────────────────────────────────────────────────
  const createCategory = async () => {
    if (!newCatLabel.trim()) return;
    await setDoc(doc(db, "categorias_v1", uid()), { label: `${newCatEmoji} ${newCatLabel.trim()}`, color: newCatColor, order: Date.now(), createdAt: Date.now() });
    setNewCatLabel(""); setNewCatEmoji("🛍"); setNewCatColor("#22c55e");
    setShowCatModal(false);
  };
  const deleteCategory = async (id) => {
    if (id === "outros") return;
    await deleteDoc(doc(db, "categorias_v1", id));
  };

  // ── Histórico ─────────────────────────────────────────────────────────────
  const duplicateArchived = async (list) => {
    const newId = uid();
    const batch = writeBatch(db);
    batch.set(doc(db, "listas_v4", newId), { name: list.name + " (cópia)", createdAt: Date.now() });
    (list.items || []).forEach((item) => batch.set(doc(db, "listas_v4", newId, "itens", uid()), { name: item.name, category: item.category, done: false, createdAt: Date.now() }));
    await batch.commit();
    setScreen("home");
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  // Catálogo agrupado por categoria (para o modal)
  const catalogoFiltrado = catalogo
    .filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(pickerSearch.toLowerCase());
      const matchCat    = pickerFilterCat === "todas" || c.category === pickerFilterCat;
      return matchSearch && matchCat;
    });

  const catalogoGrouped = categories
    .map((cat) => ({ cat, items: catalogoFiltrado.filter((c) => (c.category || "outros") === cat.id) }))
    .filter((g) => g.items.length > 0);

  const nomesNaLista = new Set(activeItens.map((i) => i.name.toLowerCase()));

  return (
    <div style={{ background: T.bg, minHeight: "100dvh", color: T.text }}>
      <style>{BASE_CSS}</style>

      {/* ── HEADER ── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "14px 20px", position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", gap: 10 }}>
        {screen !== "home" && (
          <button onClick={() => setScreen("home")} style={{ ...iconBtn, fontSize: 22 }}>←</button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: T.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", marginBottom: 1 }}>🛒 Mercado Compartilhado</div>
          <div style={{ fontSize: 19, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {screen === "home"       && "Minhas Listas"}
            {screen === "list"       && (activeList?.name || "")}
            {screen === "history"    && "Histórico"}
            {screen === "categories" && "Categorias"}
          </div>
          {screen === "list" && (() => {
            const done  = activeItens.filter((i) => i.done).length;
            const total = activeItens.length;
            return <div style={{ fontSize: 11, color: T.muted }}>{total - done} restante(s) · {done} comprado(s)</div>;
          })()}
        </div>

        {screen === "home" && (
          <>
            {/* Botão catálogo */}
            <button onClick={() => setShowCatalogoModal(true)} title="Catálogo de itens" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "7px 10px", fontSize: 14, cursor: "pointer" }}>🗂</button>
            <button onClick={() => setScreen("categories")} title="Categorias" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "7px 10px", fontSize: 14, cursor: "pointer" }}>🏷</button>
            <button onClick={() => setScreen("history")} title="Histórico" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "7px 10px", fontSize: 14, cursor: "pointer" }}>
              📚{historico.length > 0 ? ` ${historico.length}` : ""}
            </button>
          </>
        )}
        {screen === "list" && activeList && (
          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(activeList); }} title="Excluir lista" style={{ background: T.danger + "18", border: `1px solid ${T.danger}44`, borderRadius: 10, padding: "7px 10px", fontSize: 14, cursor: "pointer" }}>🗑</button>
        )}
        <button onClick={() => setDark((d) => !d)} style={{ ...iconBtn, fontSize: 20 }}>{dark ? "☀️" : "🌙"}</button>
      </div>

      {/* Barra de progresso */}
      {screen === "list" && (() => {
        const total = activeItens.length;
        const done  = activeItens.filter((i) => i.done).length;
        const pct   = total > 0 ? (done / total) * 100 : 0;
        return <div style={{ height: 3, background: T.surface2 }}><div style={{ height: "100%", width: pct + "%", background: `linear-gradient(90deg, ${T.accent2}, ${T.accent})`, transition: "width .5s ease" }} /></div>;
      })()}

      {/* ── CONTEÚDO ── */}
      <div style={{ padding: "16px 16px 120px" }}>

        {loading && screen === "home" && (
          <div style={{ textAlign: "center", padding: "60px 20px", opacity: .5 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 15, color: T.muted }}>Carregando...</div>
          </div>
        )}

        {/* ════ HOME ════ */}
        {screen === "home" && !loading && (
          <>
            {lists.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", opacity: .5 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>📝</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Nenhuma lista ainda</div>
                <div style={{ fontSize: 14, color: T.muted }}>Toque em "+ Nova lista" para começar</div>
              </div>
            )}
            {lists.map((list, idx) => {
              const its   = itens[list.id] || [];
              const total = its.length;
              const done  = its.filter((x) => x.done).length;
              const pct   = total > 0 ? (done / total) * 100 : 0;
              return (
                <div key={list.id} style={{ ...card, cursor: "pointer", animation: "fadeUp .3s ease both", animationDelay: idx * 40 + "ms" }} onClick={() => { setActiveId(list.id); setScreen("list"); }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{list.name}</div>
                      <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{total === 0 ? "Lista vazia" : `${total - done} restante(s) de ${total}`}</div>
                    </div>
                    <div style={{ display: "flex" }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => openEditList(list, e)} style={iconBtn}>✏️</button>
                      <button onClick={(e) => archiveList(list, e)} title="Arquivar" style={iconBtn}>📦</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(list); }} title="Excluir" style={{ ...iconBtn, color: T.danger }}>🗑</button>
                    </div>
                  </div>
                  {total > 0 && (
                    <div style={{ marginTop: 12, height: 3, background: T.surface2, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct + "%", background: pct === 100 ? T.accent : `linear-gradient(90deg, ${T.accent2}, ${T.accent})`, borderRadius: 2, transition: "width .5s" }} />
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={openNewList} style={fab}>+ Nova lista</button>
          </>
        )}

        {/* ════ LISTA DE ITENS ════ */}
        {screen === "list" && (() => {
          const pending = activeItens.filter((i) => !i.done);
          const done    = activeItens.filter((i) => i.done);
          const orderedGroups = categories
            .map((c) => ({ cat: c, items: pending.filter((i) => (i.category || "outros") === c.id) }))
            .filter((g) => g.items.length > 0);

          const ItemRow = ({ item }) => {
            const cat = getCat(item.category);
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: `1px solid ${T.border}`, opacity: item.done ? .35 : 1, transition: "opacity .3s" }}>
                <button onClick={() => toggleItem(item)} style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, border: `2px solid ${item.done ? cat.color : T.border}`, background: item.done ? cat.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f1117", fontSize: 15, cursor: "pointer", transition: "all .2s" }}>
                  {item.done ? "✓" : ""}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 500, textDecoration: item.done ? "line-through" : "none", color: item.done ? T.muted : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                </div>
                {!item.done && <button onClick={() => openEditItem(item)} style={iconBtn}>✏️</button>}
                <button onClick={() => deleteItem(item.id)} style={{ ...iconBtn, color: T.danger }}>🗑</button>
              </div>
            );
          };

          return (
            <>
              {activeItens.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", opacity: .5 }}>
                  <div style={{ fontSize: 52, marginBottom: 12 }}>🛒</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Lista vazia</div>
                  <div style={{ fontSize: 14, color: T.muted }}>Adicione itens pelo catálogo ou manualmente</div>
                </div>
              )}

              {orderedGroups.map(({ cat, items: catItems }) => (
                <div key={cat.id} style={{ marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 4px 6px" }}>
                    <div style={{ width: 3, height: 18, background: cat.color, borderRadius: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: cat.color }}>{cat.label}</span>
                  </div>
                  {catItems.map((item) => <ItemRow key={item.id} item={item} />)}
                </div>
              ))}

              {done.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 4px 6px" }}>
                    <span style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>✓ Comprados ({done.length})</span>
                    <button onClick={clearDone} style={{ background: "none", border: "none", color: T.danger, fontSize: 12, cursor: "pointer" }}>Limpar</button>
                  </div>
                  {done.map((item) => <ItemRow key={item.id} item={item} />)}
                </div>
              )}

              {/* FABs da lista: catálogo + manual */}
              <div style={{ position: "fixed", bottom: 24, right: 20, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end", zIndex: 10 }}>
                <button onClick={openAddItem} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "11px 18px", color: T.text, fontSize: 14, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,.2)", cursor: "pointer" }}>
                  ✏️ Item manual
                </button>
                <button onClick={openPicker} style={{ ...fab, position: "relative", bottom: "auto", right: "auto" }}>
                  🗂 Do catálogo
                </button>
              </div>
            </>
          );
        })()}

        {/* ════ HISTÓRICO ════ */}
        {screen === "history" && (
          <>
            {historico.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", opacity: .5 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>📚</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Nenhuma lista arquivada</div>
                <div style={{ fontSize: 14, color: T.muted }}>Listas arquivadas aparecem aqui</div>
              </div>
            )}
            {historico.map((list, idx) => {
              const total = list.items?.length || 0;
              const done  = list.items?.filter((x) => x.done).length || 0;
              return (
                <div key={list.id} style={{ ...card, animation: "fadeUp .3s ease both", animationDelay: idx * 40 + "ms" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{list.name}</div>
                      <div style={{ fontSize: 12, color: T.muted }}>{total} itens · {done} comprados · {new Date(list.archivedAt).toLocaleDateString("pt-PT")}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {(list.items || []).slice(0, 5).map((it, i) => { const cat = getCat(it.category); return <span key={i} style={{ fontSize: 11, background: cat.color + "22", color: cat.color, borderRadius: 999, padding: "2px 9px", border: `1px solid ${cat.color}44` }}>{it.name}</span>; })}
                        {total > 5 && <span style={{ fontSize: 11, color: T.muted }}>+{total - 5} mais</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 12, flexShrink: 0 }}>
                      <button onClick={() => duplicateArchived(list)} style={{ background: T.accent2 + "22", border: `1px solid ${T.accent2}44`, color: T.accent2, borderRadius: 10, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>Duplicar</button>
                      <button onClick={() => deleteDoc(doc(db, "historico_v1", list.id))} style={{ background: T.danger + "18", border: `1px solid ${T.danger}44`, color: T.danger, borderRadius: 10, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>Remover</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ════ CATEGORIAS ════ */}
        {screen === "categories" && (
          <>
            {categories.map((cat, idx) => (
              <div key={cat.id} style={{ ...card, display: "flex", alignItems: "center", gap: 14, animation: "fadeUp .3s ease both", animationDelay: idx * 30 + "ms" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: cat.color + "30", border: `2px solid ${cat.color}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{cat.label.split(" ")[0]}</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{cat.label}</span>
                </div>
                {cat.id !== "outros" ? <button onClick={() => deleteCategory(cat.id)} style={{ ...iconBtn, color: T.danger }}>🗑</button> : <span style={{ fontSize: 11, color: T.muted, background: T.surface2, borderRadius: 999, padding: "2px 10px" }}>padrão</span>}
              </div>
            ))}
            <button onClick={() => setShowCatModal(true)} style={fab}>+ Nova categoria</button>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: CATÁLOGO COMPLETO (gerenciar)
      ══════════════════════════════════════════════════════════════════════ */}
      {showCatalogoModal && (
        <Modal onClose={() => { setShowCatalogoModal(false); setShowCatalogoForm(false); }} fullscreen surfaceColor={T.surface}>
          {/* Header do modal */}
          <div style={{ padding: "20px 20px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>🗂 Catálogo de Itens</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{catalogo.length} item(ns) cadastrado(s)</div>
            </div>
            <button onClick={() => { setShowCatalogoModal(false); setShowCatalogoForm(false); }} style={{ ...iconBtn, fontSize: 22 }}>✕</button>
          </div>

          {/* Lista de itens do catálogo */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
            {catalogo.length === 0 && !showCatalogoForm && (
              <div style={{ textAlign: "center", padding: "40px 20px", opacity: .5 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🗂</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Catálogo vazio</div>
                <div style={{ fontSize: 13, color: T.muted }}>Cadastre itens para usar nas suas listas</div>
              </div>
            )}

            {/* Agrupado por categoria */}
            {categories.map((cat) => {
              const catItems = catalogo.filter((c) => (c.category || "outros") === cat.id);
              if (catItems.length === 0) return null;
              return (
                <div key={cat.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0 6px" }}>
                    <div style={{ width: 3, height: 16, background: cat.color, borderRadius: 2 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: cat.color }}>{cat.label}</span>
                  </div>
                  {catItems.map((item) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{item.name}</div>
                      <button onClick={() => openEditCatalogo(item)} style={iconBtn}>✏️</button>
                      <button onClick={() => setConfirmDelCat(item)} style={{ ...iconBtn, color: T.danger }}>🗑</button>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Form novo/editar item do catálogo */}
            {showCatalogoForm && (
              <div style={{ background: T.surface2, borderRadius: 16, padding: 16, marginTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{editCatalogoId ? "Editar item" : "Novo item"}</div>
                <input ref={catalogoNameRef} value={catalogoName} onChange={(e) => setCatalogoName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveCatalogo()} placeholder="Nome do item..." style={inputStyle} />
                <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>Categoria</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {categories.map((c) => (
                    <button key={c.id} onClick={() => setCatalogoCat(c.id)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 11, border: `1px solid ${catalogoCat === c.id ? c.color : T.border}`, background: catalogoCat === c.id ? c.color + "22" : T.surface, color: catalogoCat === c.id ? c.color : T.muted, cursor: "pointer" }}>{c.label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setShowCatalogoForm(false); setEditCatalogoId(null); }} style={{ ...btnSecondary, fontSize: 14 }}>Cancelar</button>
                  <button onClick={saveCatalogo} style={{ ...btnPrimary, fontSize: 14 }}>{editCatalogoId ? "Salvar ✓" : "Adicionar ✓"}</button>
                </div>
              </div>
            )}
          </div>

          {/* Botão novo item */}
          {!showCatalogoForm && (
            <div style={{ padding: "12px 20px 24px", borderTop: `1px solid ${T.border}` }}>
              <button onClick={openNewCatalogo} style={{ ...btnPrimary, width: "100%", flex: "none" }}>+ Novo item no catálogo</button>
            </div>
          )}
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: PICKER — selecionar do catálogo para a lista
      ══════════════════════════════════════════════════════════════════════ */}
      {showPickerModal && (
        <Modal onClose={() => setShowPickerModal(false)} fullscreen surfaceColor={T.surface}>
          {/* Header */}
          <div style={{ padding: "20px 20px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, fontSize: 18, fontWeight: 800 }}>Adicionar do catálogo</div>
              <button onClick={() => setShowPickerModal(false)} style={{ ...iconBtn, fontSize: 22 }}>✕</button>
            </div>
            {/* Busca */}
            <input
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="🔍 Buscar item..."
              style={{ ...inputStyle, marginBottom: 10 }}
              autoFocus
            />
            {/* Filtro por categoria */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
              <button onClick={() => setPickerFilterCat("todas")} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, border: `1px solid ${pickerFilterCat === "todas" ? T.accent : T.border}`, background: pickerFilterCat === "todas" ? T.accent + "22" : T.surface2, color: pickerFilterCat === "todas" ? T.accent : T.muted, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Todas</button>
              {categories.map((c) => (
                <button key={c.id} onClick={() => setPickerFilterCat(c.id)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, border: `1px solid ${pickerFilterCat === c.id ? c.color : T.border}`, background: pickerFilterCat === c.id ? c.color + "22" : T.surface2, color: pickerFilterCat === c.id ? c.color : T.muted, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{c.label}</button>
              ))}
            </div>
          </div>

          {/* Lista do catálogo */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px" }}>
            {catalogoGrouped.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", opacity: .5 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                <div style={{ fontSize: 14, color: T.muted }}>Nenhum item encontrado</div>
              </div>
            )}
            {catalogoGrouped.map(({ cat, items: catItems }) => (
              <div key={cat.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0 6px" }}>
                  <div style={{ width: 3, height: 16, background: cat.color, borderRadius: 2 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: cat.color }}>{cat.label}</span>
                </div>
                {catItems.map((item) => {
                  const jaEsta    = nomesNaLista.has(item.name.toLowerCase());
                  const selected  = pickerSelected.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => !jaEsta && togglePickerSelect(item.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 4px", borderBottom: `1px solid ${T.border}`, opacity: jaEsta ? .35 : 1, cursor: jaEsta ? "default" : "pointer" }}
                    >
                      {/* Checkbox de seleção múltipla */}
                      <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${selected ? cat.color : T.border}`, background: selected ? cat.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f1117", fontSize: 13, flexShrink: 0, transition: "all .15s" }}>
                        {selected ? "✓" : ""}
                      </div>
                      <div style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>
                        {item.name}
                        {jaEsta && <span style={{ fontSize: 11, color: T.muted, marginLeft: 8 }}>já na lista</span>}
                      </div>
                      {/* Toque rápido → adiciona direto */}
                      {!jaEsta && (
                        <button
                          onClick={(e) => { e.stopPropagation(); pickerAddOne(item); }}
                          title="Adicionar direto"
                          style={{ background: cat.color + "22", border: `1px solid ${cat.color}44`, color: cat.color, borderRadius: 8, padding: "4px 10px", fontSize: 18, cursor: "pointer" }}
                        >+</button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Botão confirmar seleção múltipla */}
          {pickerSelected.size > 0 && (
            <div style={{ padding: "12px 20px 24px", borderTop: `1px solid ${T.border}` }}>
              <button onClick={pickerConfirm} style={{ ...btnPrimary, width: "100%", flex: "none" }}>
                Adicionar {pickerSelected.size} item(ns) selecionado(s) ✓
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* ══ MODAL: NOVA LISTA ══ */}
      {showListModal && (
        <Modal onClose={() => setShowListModal(false)} surfaceColor={T.surface}>
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>{editListId ? "Renomear lista" : "Nova lista"}</div>
            <input value={listName} onChange={(e) => setListName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveList()} placeholder="Ex: Semana, Churrasco, Mês..." autoFocus style={inputStyle} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowListModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={saveList} style={btnPrimary}>{editListId ? "Salvar ✓" : "Criar ✓"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: ITEM MANUAL ══ */}
      {showItemModal && (
        <Modal onClose={() => setShowItemModal(false)} surfaceColor={T.surface}>
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>{editItemId ? "Editar item" : "Item manual"}</div>
            <label style={sectionLabel}>Nome do item *</label>
            <input ref={itemNameRef} value={itemName} onChange={(e) => setItemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveItem()} placeholder="Ex: Leite, Frango, Detergente..." style={inputStyle} />
            <label style={{ ...sectionLabel, marginBottom: 10 }}>Categoria</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {categories.map((c) => (
                <button key={c.id} onClick={() => setItemCat(c.id)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, border: `1px solid ${itemCat === c.id ? c.color : T.border}`, background: itemCat === c.id ? c.color + "22" : T.surface2, color: itemCat === c.id ? c.color : T.muted, cursor: "pointer", transition: "all .15s" }}>{c.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowItemModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={saveItem} style={btnPrimary}>{editItemId ? "Salvar ✓" : "Adicionar ✓"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: NOVA CATEGORIA ══ */}
      {showCatModal && (
        <Modal onClose={() => setShowCatModal(false)} center surfaceColor={T.surface}>
          <div style={{ padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Nova categoria</div>
            <label style={sectionLabel}>Nome</label>
            <input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder="Ex: Açougue, Pet Shop, Frios..." autoFocus style={inputStyle} />
            <label style={sectionLabel}>Emoji</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, maxHeight: 130, overflowY: "auto", padding: 4 }}>
              {EMOJI_OPTIONS.map((e) => (<button key={e} onClick={() => setNewCatEmoji(e)} style={{ width: 38, height: 38, borderRadius: 10, border: `2px solid ${newCatEmoji === e ? T.accent : T.border}`, background: newCatEmoji === e ? T.accent + "22" : T.surface2, fontSize: 18, cursor: "pointer" }}>{e}</button>))}
            </div>
            <label style={sectionLabel}>Cor</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {COLOR_OPTIONS.map((c) => (<button key={c} onClick={() => setNewCatColor(c)} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: `3px solid ${newCatColor === c ? T.text : "transparent"}`, cursor: "pointer" }} />))}
            </div>
            <div style={{ background: T.surface2, borderRadius: 12, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: T.muted }}>Preview:</span>
              <span style={{ fontSize: 13, background: newCatColor + "22", color: newCatColor, borderRadius: 999, padding: "3px 12px", border: `1px solid ${newCatColor}44` }}>{newCatEmoji} {newCatLabel || "Nome da categoria"}</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowCatModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={createCategory} style={btnPrimary}>Criar ✓</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: CONFIRMAR EXCLUSÃO LISTA ══ */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} center surfaceColor={T.surface}>
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🗑</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Excluir lista?</div>
            <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.5, marginBottom: 20 }}>A lista <strong style={{ color: T.text }}>"{confirmDelete.name}"</strong> será excluída permanentemente.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={btnSecondary}>Cancelar</button>
              <button onClick={() => deleteListPermanently(confirmDelete.id)} style={btnDanger}>Excluir</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: CONFIRMAR EXCLUSÃO ITEM CATÁLOGO ══ */}
      {confirmDelCat && (
        <Modal onClose={() => setConfirmDelCat(null)} center surfaceColor={T.surface}>
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🗑</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Remover do catálogo?</div>
            <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.5, marginBottom: 20 }}><strong style={{ color: T.text }}>"{confirmDelCat.name}"</strong> será removido do catálogo. Itens já nas listas não são afetados.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelCat(null)} style={btnSecondary}>Cancelar</button>
              <button onClick={() => deleteCatalogo(confirmDelCat.id)} style={btnDanger}>Remover</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}