import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  collectionGroup,
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
// listas_v4/{listaId}              → { name, createdAt }
// listas_v4/{listaId}/itens/{itemId} → { name, category, done, order, createdAt }
//
// Cada item é um documento separado.
// Assim você e a Débora podem editar ao mesmo tempo SEM conflito.

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id: "hortifruti", label: "🥦 Hortifruti", color: "#22c55e" },
  { id: "carnes",     label: "🥩 Carnes",     color: "#ef4444" },
  { id: "laticinios", label: "🧀 Laticínios", color: "#f59e0b" },
  { id: "padaria",    label: "🍞 Padaria",    color: "#f97316" },
  { id: "bebidas",    label: "🥤 Bebidas",    color: "#3b82f6" },
  { id: "limpeza",    label: "🧹 Limpeza",    color: "#a855f7" },
  { id: "higiene",    label: "🪥 Higiene",    color: "#06b6d4" },
  { id: "congelados", label: "🧊 Congelados", color: "#64748b" },
  { id: "mercearia",  label: "🛒 Mercearia",  color: "#a16207" },
  { id: "outros",     label: "📦 Outros",     color: "#6b7280" },
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
function Modal({ children, onClose, center = false, surfaceColor }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.78)",
        display: "flex",
        alignItems: center ? "center" : "flex-end",
        justifyContent: "center",
        padding: center ? 20 : 0,
        animation: "fadeIn 0.2s ease-out",
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: surfaceColor,
          width: "100%", maxWidth: 520,
          borderRadius: center ? 24 : "24px 24px 0 0",
          padding: 24, paddingBottom: center ? 24 : 36,
          animation: center ? "fadeUp 0.25s ease-out" : "slideUp 0.3s ease-out",
          boxShadow: "0 -4px 48px rgba(0,0,0,0.5)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark]             = useState(() => loadStorage("mkt_dark", true));
  const [lists, setLists]           = useState([]);
  const [itens, setItens]           = useState({}); // { listaId: [itens...] }
  const [loadingLists, setLoadingLists] = useState(true);
  const [archived, setArchived]     = useState(() => loadStorage("mkt_archived", []));
  const [categories, setCategories] = useState(() => loadStorage("mkt_categories", DEFAULT_CATEGORIES));
  const [screen, setScreen]         = useState("home");
  const [activeId, setActiveId]     = useState(null);

  // Modais
  const [showListModal, setShowListModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCatModal,  setShowCatModal]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Form lista
  const [listName, setListName]     = useState("");
  const [editListId, setEditListId] = useState(null);

  // Form item
  const [editItemId, setEditItemId] = useState(null);
  const [itemName, setItemName]     = useState("");
  const [itemCat, setItemCat]       = useState("outros");
  const itemNameRef = useRef();

  // Form categoria
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🛍");
  const [newCatColor, setNewCatColor] = useState("#22c55e");

  // ── Firebase: escuta listas ────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "listas_v4"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setLists(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingLists(false);
    });
    return () => unsub();
  }, []);

  // ── Firebase: escuta itens da lista ativa em tempo real ───────────────────
  useEffect(() => {
    if (!activeId) return;
    const q = query(
      collection(db, "listas_v4", activeId, "itens"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setItens((prev) => ({
        ...prev,
        [activeId]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      }));
    });
    return () => unsub();
  }, [activeId]);

  useEffect(() => { saveStorage("mkt_dark", dark); },             [dark]);
  useEffect(() => { saveStorage("mkt_categories", categories); }, [categories]);
  useEffect(() => { saveStorage("mkt_archived", archived); },     [archived]);

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

  // ── Estilos ───────────────────────────────────────────────────────────────
  const card         = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, marginBottom: 12 };
  const fab          = { position: "fixed", bottom: 24, right: 20, background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 20, padding: "14px 24px", color: "#0f1117", fontSize: 16, fontWeight: 700, boxShadow: "0 8px 28px rgba(110,231,183,.4)", cursor: "pointer", zIndex: 10 };
  const inputStyle   = { width: "100%", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, fontSize: 16, padding: "12px 14px", outline: "none", marginBottom: 12 };
  const btnPrimary   = { flex: 1, padding: "13px 0", background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 14, color: "#0f1117", fontSize: 15, fontWeight: 700, cursor: "pointer" };
  const btnSecondary = { flex: 1, padding: "13px 0", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 14, color: T.muted, fontSize: 15, cursor: "pointer" };
  const btnDanger    = { flex: 1, padding: "13px 0", background: T.danger + "22", border: `1px solid ${T.danger}55`, borderRadius: 14, color: T.danger, fontSize: 15, fontWeight: 700, cursor: "pointer" };
  const iconBtn      = { background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: "4px 8px", color: T.muted };
  const sectionLabel = { fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8, display: "block" };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getCat     = (id) => categories.find((c) => c.id === id) || DEFAULT_CATEGORIES[9];
  const activeList = lists.find((l) => l.id === activeId);
  const activeItens = itens[activeId] || [];

  // resumo para mostrar na home (conta itens do estado local)
  const getListSummary = (listId) => {
    const its = itens[listId] || [];
    return { total: its.length, done: its.filter((i) => i.done).length };
  };

  // ── Ações: listas ─────────────────────────────────────────────────────────
  const openNewList  = () => { setListName(""); setEditListId(null); setShowListModal(true); };
  const openEditList = (list, e) => { e.stopPropagation(); setListName(list.name); setEditListId(list.id); setShowListModal(true); };

  const saveList = async () => {
    if (!listName.trim()) return;
    if (editListId) {
      await setDoc(doc(db, "listas_v4", editListId), { name: listName.trim() }, { merge: true });
    } else {
      const id = uid();
      await setDoc(doc(db, "listas_v4", id), { name: listName.trim(), createdAt: Date.now() });
    }
    setShowListModal(false);
  };

  const archiveList = async (list, e) => {
    e.stopPropagation();
    // busca itens para salvar no histórico
    const snap = await getDocs(collection(db, "listas_v4", list.id, "itens"));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setArchived((prev) => [{ ...list, items, archivedAt: Date.now() }, ...prev]);
    // apaga itens e lista
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "listas_v4", list.id));
    await batch.commit();
  };

  const deleteListPermanently = async (id) => {
    const snap = await getDocs(collection(db, "listas_v4", id, "itens"));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "listas_v4", id));
    await batch.commit();
    setConfirmDelete(null);
    if (screen === "list") setScreen("home");
  };

  // ── Ações: itens (cada um é documento separado) ───────────────────────────
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
    // setDoc com merge: true → só atualiza os campos passados, não apaga outros
    await setDoc(
      doc(db, "listas_v4", activeId, "itens", id),
      {
        name: itemName.trim(),
        category: itemCat,
        done: false,
        createdAt: editItemId ? undefined : Date.now(),
      },
      { merge: true }
    );
    setShowItemModal(false);
  };

  const toggleItem = async (item) => {
    // atualiza SÓ o campo "done" — sem risco de conflito com outros campos
    await setDoc(
      doc(db, "listas_v4", activeId, "itens", item.id),
      { done: !item.done },
      { merge: true }
    );
  };

  const deleteItem = async (itemId) => {
    await deleteDoc(doc(db, "listas_v4", activeId, "itens", itemId));
  };

  const clearDone = async () => {
    const batch = writeBatch(db);
    activeItens.filter((i) => i.done).forEach((i) => {
      batch.delete(doc(db, "listas_v4", activeId, "itens", i.id));
    });
    await batch.commit();
  };

  // ── Ações: categorias ─────────────────────────────────────────────────────
  const createCategory = () => {
    if (!newCatLabel.trim()) return;
    const nc = { id: uid(), label: `${newCatEmoji} ${newCatLabel.trim()}`, color: newCatColor };
    setCategories((prev) => {
      const sem    = prev.filter((c) => c.id !== "outros");
      const outros = prev.find((c) => c.id === "outros") || DEFAULT_CATEGORIES[9];
      return [...sem, nc, outros];
    });
    setNewCatLabel(""); setNewCatEmoji("🛍"); setNewCatColor("#22c55e");
    setShowCatModal(false);
  };

  const deleteCategory = (id) => {
    if (id === "outros") return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  // ── Histórico: duplicar ───────────────────────────────────────────────────
  const duplicateArchived = async (list) => {
    const newId = uid();
    const batch = writeBatch(db);
    batch.set(doc(db, "listas_v4", newId), { name: list.name + " (cópia)", createdAt: Date.now() });
    (list.items || []).forEach((item) => {
      const itemId = uid();
      batch.set(doc(db, "listas_v4", newId, "itens", itemId), {
        name: item.name, category: item.category, done: false, createdAt: Date.now(),
      });
    });
    await batch.commit();
    setScreen("home");
  };

  // ── Subscrever itens de todas as listas para resumo na home ───────────────
  useEffect(() => {
    if (lists.length === 0) return;
    const unsubs = lists.map((list) => {
      const q = query(collection(db, "listas_v4", list.id, "itens"));
      return onSnapshot(q, (snap) => {
        setItens((prev) => ({
          ...prev,
          [list.id]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        }));
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [lists.map((l) => l.id).join(",")]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
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
            <button onClick={() => setScreen("categories")} title="Categorias" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "7px 10px", fontSize: 14, cursor: "pointer" }}>🏷</button>
            <button onClick={() => setScreen("history")} title="Histórico" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "7px 10px", fontSize: 14, cursor: "pointer" }}>
              📚{archived.length > 0 ? ` ${archived.length}` : ""}
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
        return (
          <div style={{ height: 3, background: T.surface2 }}>
            <div style={{ height: "100%", width: pct + "%", background: `linear-gradient(90deg, ${T.accent2}, ${T.accent})`, transition: "width .5s ease" }} />
          </div>
        );
      })()}

      {/* ── CONTEÚDO ── */}
      <div style={{ padding: "16px 16px 120px" }}>

        {loadingLists && screen === "home" && (
          <div style={{ textAlign: "center", padding: "60px 20px", opacity: .5 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 15, color: T.muted }}>Carregando listas...</div>
          </div>
        )}

        {/* ════ HOME ════ */}
        {screen === "home" && !loadingLists && (
          <>
            {lists.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", opacity: .5 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>📝</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Nenhuma lista ainda</div>
                <div style={{ fontSize: 14, color: T.muted }}>Toque em "+ Nova lista" para começar</div>
              </div>
            )}
            {lists.map((list, idx) => {
              const { total, done } = getListSummary(list.id);
              const pct = total > 0 ? (done / total) * 100 : 0;
              return (
                <div key={list.id} style={{ ...card, cursor: "pointer", animation: "fadeUp .3s ease both", animationDelay: idx * 40 + "ms" }}
                  onClick={() => { setActiveId(list.id); setScreen("list"); }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{list.name}</div>
                      <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
                        {total === 0 ? "Lista vazia" : `${total - done} restante(s) de ${total}`}
                      </div>
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
                <button
                  onClick={() => toggleItem(item)}
                  style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, border: `2px solid ${item.done ? cat.color : T.border}`, background: item.done ? cat.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f1117", fontSize: 15, cursor: "pointer", transition: "all .2s" }}
                >{item.done ? "✓" : ""}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 500, textDecoration: item.done ? "line-through" : "none", color: item.done ? T.muted : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </div>
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
                  <div style={{ fontSize: 14, color: T.muted }}>Toque em + para adicionar o primeiro item</div>
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

              <button onClick={openAddItem} style={{ ...fab, borderRadius: "50%", padding: 0, width: 60, height: 60, fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            </>
          );
        })()}

        {/* ════ HISTÓRICO ════ */}
        {screen === "history" && (
          <>
            {archived.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", opacity: .5 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>📚</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Nenhuma lista arquivada</div>
                <div style={{ fontSize: 14, color: T.muted }}>Listas arquivadas aparecem aqui</div>
              </div>
            )}
            {archived.map((list, idx) => {
              const total = list.items?.length || 0;
              const done  = list.items?.filter((x) => x.done).length || 0;
              return (
                <div key={list.id} style={{ ...card, animation: "fadeUp .3s ease both", animationDelay: idx * 40 + "ms" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{list.name}</div>
                      <div style={{ fontSize: 12, color: T.muted }}>{total} itens · {done} comprados · {new Date(list.archivedAt).toLocaleDateString("pt-PT")}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {(list.items || []).slice(0, 5).map((it) => {
                          const cat = getCat(it.category);
                          return <span key={it.id} style={{ fontSize: 11, background: cat.color + "22", color: cat.color, borderRadius: 999, padding: "2px 9px", border: `1px solid ${cat.color}44` }}>{it.name}</span>;
                        })}
                        {total > 5 && <span style={{ fontSize: 11, color: T.muted }}>+{total - 5} mais</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 12, flexShrink: 0 }}>
                      <button onClick={() => duplicateArchived(list)} style={{ background: T.accent2 + "22", border: `1px solid ${T.accent2}44`, color: T.accent2, borderRadius: 10, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>Duplicar</button>
                      <button onClick={() => setArchived((prev) => prev.filter((l) => l.id !== list.id))} style={{ background: T.danger + "18", border: `1px solid ${T.danger}44`, color: T.danger, borderRadius: 10, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>Remover</button>
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
                <div style={{ width: 44, height: 44, borderRadius: 12, background: cat.color + "30", border: `2px solid ${cat.color}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                  {cat.label.split(" ")[0]}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{cat.label}</span>
                </div>
                {cat.id !== "outros"
                  ? <button onClick={() => deleteCategory(cat.id)} style={{ ...iconBtn, color: T.danger }}>🗑</button>
                  : <span style={{ fontSize: 11, color: T.muted, background: T.surface2, borderRadius: 999, padding: "2px 10px" }}>padrão</span>
                }
              </div>
            ))}
            <button onClick={() => setShowCatModal(true)} style={fab}>+ Nova categoria</button>
          </>
        )}
      </div>

      {/* ══ MODAL: NOVA / EDITAR LISTA ══ */}
      {showListModal && (
        <Modal onClose={() => setShowListModal(false)} surfaceColor={T.surface}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>{editListId ? "Renomear lista" : "Nova lista"}</div>
          <input value={listName} onChange={(e) => setListName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveList()} placeholder="Ex: Semana, Churrasco, Mês..." autoFocus style={inputStyle} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowListModal(false)} style={btnSecondary}>Cancelar</button>
            <button onClick={saveList} style={btnPrimary}>{editListId ? "Salvar ✓" : "Criar ✓"}</button>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: NOVO / EDITAR ITEM ══ */}
      {showItemModal && (
        <Modal onClose={() => setShowItemModal(false)} surfaceColor={T.surface}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>{editItemId ? "Editar item" : "Novo item"}</div>
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
        </Modal>
      )}

      {/* ══ MODAL: NOVA CATEGORIA ══ */}
      {showCatModal && (
        <Modal onClose={() => setShowCatModal(false)} center surfaceColor={T.surface}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Nova categoria</div>
          <label style={sectionLabel}>Nome</label>
          <input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder="Ex: Açougue, Pet Shop, Frios..." autoFocus style={inputStyle} />
          <label style={sectionLabel}>Emoji</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, maxHeight: 130, overflowY: "auto", padding: 4 }}>
            {EMOJI_OPTIONS.map((e) => (
              <button key={e} onClick={() => setNewCatEmoji(e)} style={{ width: 38, height: 38, borderRadius: 10, border: `2px solid ${newCatEmoji === e ? T.accent : T.border}`, background: newCatEmoji === e ? T.accent + "22" : T.surface2, fontSize: 18, cursor: "pointer" }}>{e}</button>
            ))}
          </div>
          <label style={sectionLabel}>Cor</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {COLOR_OPTIONS.map((c) => (
              <button key={c} onClick={() => setNewCatColor(c)} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: `3px solid ${newCatColor === c ? T.text : "transparent"}`, cursor: "pointer", transition: "border .15s" }} />
            ))}
          </div>
          <div style={{ background: T.surface2, borderRadius: 12, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: T.muted }}>Preview:</span>
            <span style={{ fontSize: 13, background: newCatColor + "22", color: newCatColor, borderRadius: 999, padding: "3px 12px", border: `1px solid ${newCatColor}44` }}>
              {newCatEmoji} {newCatLabel || "Nome da categoria"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowCatModal(false)} style={btnSecondary}>Cancelar</button>
            <button onClick={createCategory} style={btnPrimary}>Criar ✓</button>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: CONFIRMAR EXCLUSÃO ══ */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} center surfaceColor={T.surface}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🗑</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Excluir lista?</div>
            <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
              A lista <strong style={{ color: T.text }}>"{confirmDelete.name}"</strong> será excluída permanentemente.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setConfirmDelete(null)} style={btnSecondary}>Cancelar</button>
            <button onClick={() => deleteListPermanently(confirmDelete.id)} style={btnDanger}>Excluir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
