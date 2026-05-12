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
  orderBy 
} from "firebase/firestore";

// ─── CONFIGURAÇÃO FIREBASE (MANTIDA) ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBIQHMSfVtCbe_yI-qNWLdGkIfa15FmL8g",
  authDomain: "lista-mercado-4a277.firebaseapp.com",
  projectId: "lista-mercado-4a277",
  storageBucket: "lista-mercado-4a277.firebasestorage.app",
  messagingSenderId: "238886722797",
  appId: "1:238886722797:web:f29f78e5916d1386a700e4"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const DEFAULT_CATEGORIES = [
  { id: "hortifruti", label: "🥦 Hortifruti", color: "#22c55e" },
  { id: "carnes",     label: "🥩 Carnes",      color: "#ef4444" },
  { id: "laticinios", label: "🧀 Laticínios", color: "#f59e0b" },
  { id: "padaria",    label: "🍞 Padaria",    color: "#f97316" },
  { id: "bebidas",    label: "🥤 Bebidas",    color: "#3b82f6" },
  { id: "limpeza",    label: "🧹 Limpeza",    color: "#a855f7" },
  { id: "higiene",    label: "🪥 Higiene",    color: "#06b6d4" },
  { id: "congelados", label: "🧊 Congelados", color: "#64748b" },
  { id: "mercearia",  label: "🛒 Mercearia",  color: "#a16207" },
  { id: "outros",     label: "📦 Outros",      color: "#6b7280" },
];

const EMOJI_OPTIONS = ["🛍","🥗","🍖","🧴","🍷","🫙","🥛","🍫","🌾","🧆","🍜","🫒","🍳","🧃","🧂","🥚","🍕","🍦","🌿","📦"];
const COLOR_OPTIONS = ["#22c55e","#ef4444","#f59e0b","#f97316","#3b82f6","#a855f7","#06b6d4","#64748b","#a16207","#6b7280","#ec4899","#14b8a6","#84cc16","#f43f5e","#8b5cf6","#0ea5e9"];

const uid = () => Math.random().toString(36).slice(2, 10);
const loadStorage = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const saveStorage = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ─── CSS ATUALIZADO (RESPONSIVIDADE TOTAL) ──────────────────────────────────
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow-x: hidden; }
  input, button, select { font-family: inherit; }
  ::-webkit-scrollbar { display: none; }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

export default function App() {
  const [dark, setDark]           = useState(() => loadStorage("mkt_dark", true));
  const [lists, setLists]         = useState([]); 
  const [archived, setArchived]   = useState(() => loadStorage("mkt_archived", []));
  const [categories, setCategories] = useState(() => loadStorage("mkt_categories", DEFAULT_CATEGORIES));
  const [screen, setScreen]       = useState("home"); 
  const [activeId, setActiveId]   = useState(null);
  const [groupBy, setGroupBy]     = useState(false);

  // Estados dos Modais (Item e Categoria)
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCatModal, setShowCatModal]   = useState(false);
  const [editItemId, setEditItemId]       = useState(null);
  const [itemName, setItemName]           = useState("");
  const [itemQty, setItemQty]             = useState("");
  const [itemCat, setItemCat]             = useState("outros");
  const itemNameRef = useRef();

  const [newCatLabel, setNewCatLabel]     = useState("");
  const [newCatEmoji, setNewCatEmoji]     = useState("🛍");

  useEffect(() => {
    const q = query(collection(db, "listas_v3"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => { saveStorage("mkt_dark", dark); }, [dark]);
  useEffect(() => { saveStorage("mkt_categories", categories); }, [categories]);

  const T = {
    bg:       dark ? "#0f1117" : "#f8fafc",
    surface:  dark ? "#1a1d27" : "#ffffff",
    surface2: dark ? "#22263a" : "#f1f5f9",
    border:   dark ? "#2e3248" : "#e2e8f0",
    text:     dark ? "#e2e8f0" : "#0f172a",
    muted:    dark ? "#64748b" : "#94a3b8",
    accent:   "#6ee7b7",
    accent2:  "#818cf8",
    danger:   "#f87171",
  };

  const card         = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 12 };
  const fab          = { position: "fixed", bottom: 24, right: 20, background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 20, padding: "14px 22px", color: "#0f1117", fontSize: 16, fontWeight: 700, boxShadow: "0 8px 24px rgba(110,231,183,.35)", cursor: "pointer", zIndex: 10 };
  const inputStyle   = { width: "100%", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, fontSize: 16, padding: "12px 14px", outline: "none", marginBottom: 12 };
  const btnPrimary   = { width: "100%", padding: 14, background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 14, color: "#0f1117", fontSize: 16, fontWeight: 700, cursor: "pointer" };
  const btnSecondary = { width: "100%", padding: 14, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 14, color: T.muted, fontSize: 15, cursor: "pointer" };
  const iconBtn      = { background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: "4px 6px" };

  const activeList = lists.find((l) => l.id === activeId);
  const getCat = (id) => categories.find((c) => c.id === id) || DEFAULT_CATEGORIES[9];

  const syncToFirebase = async (list) => { await setDoc(doc(db, "listas_v3", list.id), list); };

  const openItemModal = (item = null) => {
    if (item) {
      setEditItemId(item.id); setItemName(item.name); setItemQty(item.qty || ""); setItemCat(item.category || "outros");
    } else {
      setEditItemId(null); setItemName(""); setItemQty(""); setItemCat("outros");
    }
    setShowItemModal(true);
    setTimeout(() => itemNameRef.current?.focus(), 100);
  };

  const saveItem = () => {
    if (!itemName.trim() || !activeList) return;
    const newItem = { id: editItemId || uid(), name: itemName.trim(), qty: itemQty.trim(), category: itemCat, done: false };
    const items = activeList.items || [];
    const newItems = editItemId ? items.map(i => i.id === editItemId ? { ...newItem, done: i.done } : i) : [...items, newItem];
    syncToFirebase({ ...activeList, items: newItems });
    setShowItemModal(false);
  };

  const titles = { home: "Minhas Listas", list: activeList?.name || "", history: "Histórico", categories: "Categorias" };

  return (
    <div style={{ background: T.bg, minHeight: "100dvh", color: T.text, maxWidth: "100%", margin: "0" }}>
      <style>{BASE_CSS}</style>

      {/* HEADER AJUSTADO À LARGURA TOTAL */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "16px 20px", position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", gap: 12 }}>
        {screen !== "home" && (
          <button onClick={() => setScreen("home")} style={{ ...iconBtn, fontSize: 22, color: T.muted }}>←</button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 2 }}>🛒 Mercado Compartilhado</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{titles[screen]}</div>
          {screen === "list" && activeList && (
            <div style={{ fontSize: 12, color: T.muted }}>
              {activeList.items?.filter(i => !i.done).length} restante(s) · {activeList.items?.filter(i => i.done).length} comprado(s)
            </div>
          )}
        </div>
        
        {screen === "home" && (
          <>
            <button onClick={() => setScreen("categories")} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 10px", fontSize: 14 }}>🏷️</button>
            <button onClick={() => setScreen("history")} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 10px", fontSize: 14 }}>📚</button>
          </>
        )}
        {screen === "list" && (
          <button onClick={() => setGroupBy(!groupBy)} style={{ background: groupBy ? T.accent2 + "22" : T.surface2, border: `1px solid ${groupBy ? T.accent2 : T.border}`, borderRadius: 10, padding: "6px 10px", color: groupBy ? T.accent2 : T.muted, fontSize: 12 }}> Agrupar </button>
        )}
        <button onClick={() => setDark(!dark)} style={{ ...iconBtn, fontSize: 20 }}>{dark ? "☀️" : "🌙"}</button>
      </div>

      <div style={{ padding: "20px 20px 120px", width: "100%" }}>
        {screen === "home" && lists.map(list => (
           <div key={list.id} style={{ ...card, cursor: "pointer" }} onClick={() => { setActiveId(list.id); setScreen("list"); }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{list.name}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{list.items?.length || 0} itens</div>
           </div>
        ))}

        {screen === "list" && activeList && (() => {
          // Lógica para jogar comprados ao final da lista
          const pending = (activeList.items || []).filter(i => !i.done);
          const done = (activeList.items || []).filter(i => i.done);
          const sortedItems = [...pending, ...done];

          return sortedItems.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
               <button onClick={() => {
                  const newItems = activeList.items.map(i => i.id === item.id ? { ...i, done: !i.done } : i);
                  syncToFirebase({ ...activeList, items: newItems });
               }} style={{ width: 28, height: 28, borderRadius: 8, border: `2px solid ${getCat(item.category).color}`, background: item.done ? getCat(item.category).color : "transparent", color: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
                 {item.done ? "✓" : ""}
               </button>
               <div style={{ flex: 1, textDecoration: item.done ? "line-through" : "none", opacity: item.done ? 0.4 : 1 }}>
                 {item.name} {item.qty && <span style={{ color: T.muted, fontSize: 13 }}>({item.qty})</span>}
                 {!groupBy && <div style={{ fontSize: 11, color: getCat(item.category).color, marginTop: 2 }}>{getCat(item.category).label}</div>}
               </div>
               <button onClick={() => openItemModal(item)} style={{ ...iconBtn, color: T.muted }}>✏️</button>
               <button onClick={() => syncToFirebase({ ...activeList, items: activeList.items.filter(i => i.id !== item.id) })} style={{ ...iconBtn, color: T.danger }}>🗑</button>
            </div>
          ));
        })()}

        {screen === "history" && archived.map(list => (
          <div key={list.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{list.name}</div>
              <div style={{ fontSize: 12, color: T.muted }}>{new Date(list.archivedAt).toLocaleDateString()}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => {
                const nl = { ...list, id: uid(), name: list.name + " (cópia)", createdAt: Date.now(), archivedAt: undefined };
                syncToFirebase(nl); setScreen("home");
              }} style={{ background: T.accent2 + "22", border: "none", color: T.accent2, padding: "8px 12px", borderRadius: 10, fontSize: 13 }}>Duplicar</button>
              <button onClick={() => setArchived(prev => prev.filter(l => l.id !== list.id))} style={{ ...iconBtn, color: T.danger }}>🗑</button>
            </div>
          </div>
        ))}

        {screen === "categories" && categories.map(cat => (
          <div key={cat.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: cat.color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{cat.label.split(" ")[0]}</div>
            <div style={{ flex: 1, fontWeight: 600 }}>{cat.label}</div>
            {cat.id !== "outros" && <button onClick={() => setCategories(prev => prev.filter(c => c.id !== cat.id))} style={{ ...iconBtn, color: T.danger }}>🗑</button>}
          </div>
        ))}
      </div>

      {/* FABs MANTIDAS */}
      {screen === "home" && <button onClick={() => { const n = prompt("Nome da lista:"); if(n) syncToFirebase({id:uid(), name:n, items:[], createdAt:Date.now()}); }} style={fab}>+ Nova lista</button>}
      {screen === "list" && <button onClick={() => openItemModal()} style={fab}>+ Adicionar item</button>}
      {screen === "categories" && <button onClick={() => setShowCatModal(true)} style={fab}>+ Nova categoria</button>}

      {/* MODAL DE ITEM (SOBREPOSIÇÃO) */}
      {showItemModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", animation: "fadeIn 0.2s ease-out" }}>
          <div style={{ background: T.surface, width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, animation: "slideUp 0.3s ease-out" }}>
            <h3 style={{ marginBottom: 20 }}>{editItemId ? "Editar Item" : "Novo Item"}</h3>
            <input ref={itemNameRef} value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Nome do item *" style={inputStyle} />
            <input value={itemQty} onChange={e => setItemQty(e.target.value)} placeholder="Quantidade..." inputMode="numeric" style={inputStyle} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {categories.map(c => (
                <button key={c.id} onClick={() => setItemCat(c.id)} style={{ padding: "8px 14px", borderRadius: 12, fontSize: 12, border: `1px solid ${itemCat === c.id ? c.color : T.border}`, background: itemCat === c.id ? c.color + "22" : T.surface2, color: itemCat === c.id ? c.color : T.muted }}>{c.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}><button onClick={() => setShowItemModal(false)} style={btnSecondary}>Cancelar</button><button onClick={saveItem} style={btnPrimary}>Salvar ✓</button></div>
          </div>
        </div>
      )}

      {/* MODAL DE CATEGORIA (SOBREPOSIÇÃO) */}
      {showCatModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeIn 0.2s ease-out" }}>
          <div style={{ background: T.surface, width: "100%", borderRadius: 24, padding: 24 }}>
            <h3 style={{ marginBottom: 20 }}>Nova Categoria</h3>
            <input value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} placeholder="Nome da categoria..." style={inputStyle} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, maxHeight: 150, overflowY: "auto", marginBottom: 20, padding: 10, background: T.surface2, borderRadius: 16 }}>
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setNewCatEmoji(e)} style={{ fontSize: 24, background: newCatEmoji === e ? T.accent + "33" : "none", border: "none", borderRadius: 8, padding: 5 }}>{e}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}><button onClick={() => setShowCatModal(false)} style={btnSecondary}>Sair</button><button onClick={createCategory} style={btnPrimary}>Criar ✓</button></div>
          </div>
        </div>
      )}
    </div>
  );
}