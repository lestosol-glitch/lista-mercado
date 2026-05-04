import { useState, useEffect, useRef } from "react";

// ─── CATEGORIAS PADRÃO ────────────────────────────────────────────────────────
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

const EMOJI_OPTIONS = ["🛍","🥗","🍖","🧴","🍷","🫙","🥛","🍫","🌾","🧆","🍜","🫒","🍳","🧃","🧂","🥚","🍕","🍦","🌿","📦"];
const COLOR_OPTIONS = ["#22c55e","#ef4444","#f59e0b","#f97316","#3b82f6","#a855f7","#06b6d4","#64748b","#a16207","#6b7280","#ec4899","#14b8a6","#84cc16","#f43f5e","#8b5cf6","#0ea5e9"];

const uid = () => Math.random().toString(36).slice(2, 10);
const loadStorage = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const saveStorage = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  input, button, select { font-family: inherit; }
  ::-webkit-scrollbar { display: none; }
`;

export default function App() {
  const [dark, setDark]           = useState(() => loadStorage("mkt_dark", true));
  const [lists, setLists]         = useState(() => loadStorage("mkt_lists", []));
  const [archived, setArchived]   = useState(() => loadStorage("mkt_archived", []));
  const [categories, setCategories] = useState(() => loadStorage("mkt_categories", DEFAULT_CATEGORIES));
  const [screen, setScreen]       = useState("home"); // home | list | history | categories
  const [activeId, setActiveId]   = useState(null);

  useEffect(() => { saveStorage("mkt_dark", dark); }, [dark]);
  useEffect(() => { saveStorage("mkt_lists", lists); }, [lists]);
  useEffect(() => { saveStorage("mkt_archived", archived); }, [archived]);
  useEffect(() => { saveStorage("mkt_categories", categories); }, [categories]);

  const getCat = (id) => categories.find((c) => c.id === id) || DEFAULT_CATEGORIES[9];

  // ── Tema ──────────────────────────────────────────────────────────────────
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

  // ── Estilos reutilizáveis ─────────────────────────────────────────────────
  const card         = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 12 };
  const fab          = { position: "fixed", bottom: 24, right: 20, background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 20, padding: "14px 22px", color: "#0f1117", fontSize: 16, fontWeight: 700, boxShadow: "0 8px 24px rgba(110,231,183,.35)", cursor: "pointer" };
  const inputStyle   = { width: "100%", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, fontSize: 16, padding: "12px 14px", outline: "none", marginBottom: 12 };
  const btnPrimary   = { width: "100%", padding: 14, background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, border: "none", borderRadius: 14, color: "#0f1117", fontSize: 16, fontWeight: 700, cursor: "pointer" };
  const btnSecondary = { width: "100%", padding: 14, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 14, color: T.muted, fontSize: 15, cursor: "pointer" };
  const iconBtn      = { background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: "4px 6px" };

  // ── Navegação ─────────────────────────────────────────────────────────────
  const activeList = lists.find((l) => l.id === activeId);
  const openList   = (id) => { setActiveId(id); setScreen("list"); };

  const updateList  = (id, newItems) => setLists((prev) => prev.map((l) => l.id === id ? { ...l, items: newItems } : l));
  const archiveList = (id) => {
    const list = lists.find((l) => l.id === id);
    if (list) setArchived((prev) => [{ ...list, archivedAt: Date.now() }, ...prev]);
    setLists((prev) => prev.filter((l) => l.id !== id));
  };
  const duplicateList = (list) => {
    const nl = { ...list, id: uid(), name: list.name + " (cópia)", createdAt: Date.now(), archivedAt: undefined, items: (list.items || []).map((i) => ({ ...i, id: uid(), done: false })) };
    setLists((prev) => [nl, ...prev]);
    setScreen("home");
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ESTADO: HOME
  // ══════════════════════════════════════════════════════════════════════════
  const [showNewList,  setShowNewList]  = useState(false);
  const [newListName,  setNewListName]  = useState("");
  const [editListId,   setEditListId]   = useState(null);
  const [editListName, setEditListName] = useState("");

  const createList = () => {
    if (!newListName.trim()) return;
    const nl = { id: uid(), name: newListName.trim(), items: [], createdAt: Date.now() };
    setLists((prev) => [nl, ...prev]);
    setNewListName(""); setShowNewList(false);
    openList(nl.id);
  };

  const saveRename = (id) => {
    if (!editListName.trim()) return;
    setLists((prev) => prev.map((l) => l.id === id ? { ...l, name: editListName.trim() } : l));
    setEditListId(null);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ESTADO: ITENS
  // ══════════════════════════════════════════════════════════════════════════
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItemId,  setEditItemId]  = useState(null);
  const [itemName,    setItemName]    = useState("");
  const [itemQty,     setItemQty]     = useState("");
  const [itemCat,     setItemCat]     = useState("outros");
  const [groupBy,     setGroupBy]     = useState(false);
  const itemNameRef = useRef();

  const openAddItem = () => {
    setItemName(""); setItemQty(""); setItemCat("outros");
    setEditItemId(null); setShowAddItem(true);
    setTimeout(() => itemNameRef.current?.focus(), 50);
  };

  const openEditItem = (item) => {
    setItemName(item.name); setItemQty(item.qty || ""); setItemCat(item.category || "outros");
    setEditItemId(item.id); setShowAddItem(true);
    setTimeout(() => itemNameRef.current?.focus(), 50);
  };

  const saveItem = () => {
    if (!itemName.trim() || !activeList) return;
    const newItem = { id: editItemId || uid(), name: itemName.trim(), qty: itemQty.trim(), category: itemCat, done: false };
    const items = activeList.items || [];
    updateList(activeList.id, editItemId
      ? items.map((i) => i.id === editItemId ? { ...newItem, done: i.done } : i)
      : [...items, newItem]
    );
    setShowAddItem(false);
  };

  const toggleItem = (listId, itemId) => {
    const items = lists.find((l) => l.id === listId)?.items || [];
    updateList(listId, items.map((i) => i.id === itemId ? { ...i, done: !i.done } : i));
  };
  const deleteItem = (listId, itemId) => {
    const items = lists.find((l) => l.id === listId)?.items || [];
    updateList(listId, items.filter((i) => i.id !== itemId));
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ESTADO: CATEGORIAS
  // ══════════════════════════════════════════════════════════════════════════
  const [showNewCat,  setShowNewCat]  = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🛍");
  const [newCatColor, setNewCatColor] = useState("#22c55e");

  const createCategory = () => {
    if (!newCatLabel.trim()) return;
    const nc = { id: uid(), label: `${newCatEmoji} ${newCatLabel.trim()}`, color: newCatColor };
    // insere antes de "outros"
    setCategories((prev) => {
      const sem = prev.filter((c) => c.id !== "outros");
      const outros = prev.find((c) => c.id === "outros") || DEFAULT_CATEGORIES[9];
      return [...sem, nc, outros];
    });
    setNewCatLabel(""); setNewCatEmoji("🛍"); setNewCatColor("#22c55e");
    setShowNewCat(false);
  };

  const deleteCategory = (id) => {
    if (id === "outros") return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setLists((prev) => prev.map((l) => ({
      ...l,
      items: (l.items || []).map((i) => i.category === id ? { ...i, category: "outros" } : i),
    })));
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  const titles = { home: "Minhas Listas", list: activeList?.name || "", history: "Histórico", categories: "Categorias" };

  return (
    <div style={{ background: T.bg, minHeight: "100dvh", color: T.text, maxWidth: 480, margin: "0 auto" }}>
      <style>{BASE_CSS}</style>

      {/* ── HEADER ── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "16px 20px", position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", gap: 12 }}>
        {screen !== "home" && (
          <button onClick={() => setScreen("home")} style={{ ...iconBtn, fontSize: 22, color: T.muted }}>←</button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 2 }}>🛒 Mercado</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{titles[screen]}</div>
          {screen === "list" && activeList && (() => {
            const items = activeList.items || [];
            const done  = items.filter((i) => i.done).length;
            return <div style={{ fontSize: 12, color: T.muted }}>{items.length - done} restante(s) · {done} comprado(s)</div>;
          })()}
        </div>
        {screen === "home" && (
          <>
            <button onClick={() => setScreen("categories")} title="Gerenciar categorias" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 10px", color: T.muted, fontSize: 14, cursor: "pointer" }}>🏷</button>
            <button onClick={() => setScreen("history")} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 10px", color: T.muted, fontSize: 13, cursor: "pointer" }}>
              📚{archived.length > 0 ? ` (${archived.length})` : ""}
            </button>
          </>
        )}
        {screen === "list" && (
          <button onClick={() => setGroupBy((g) => !g)} style={{ background: groupBy ? T.accent2 + "22" : T.surface2, border: `1px solid ${groupBy ? T.accent2 : T.border}`, borderRadius: 10, padding: "6px 10px", color: groupBy ? T.accent2 : T.muted, fontSize: 12, cursor: "pointer" }}>
            🏷 Agrupar
          </button>
        )}
        <button onClick={() => setDark((d) => !d)} style={{ ...iconBtn, fontSize: 20 }}>{dark ? "☀️" : "🌙"}</button>
      </div>

      {/* Barra de progresso */}
      {screen === "list" && activeList && (() => {
        const items = activeList.items || [];
        const pct   = items.length > 0 ? (items.filter((i) => i.done).length / items.length) * 100 : 0;
        return <div style={{ height: 3, background: T.surface2 }}><div style={{ height: "100%", width: pct + "%", background: `linear-gradient(90deg, ${T.accent2}, ${T.accent})`, transition: "width .4s" }} /></div>;
      })()}

      {/* ════════════════════════════════════════════════════════════
          TELA: HOME
      ════════════════════════════════════════════════════════════ */}
      {screen === "home" && (
        <div style={{ padding: "20px 20px 120px" }}>
          {lists.length === 0 && !showNewList && (
            <div style={{ textAlign: "center", padding: "60px 20px", opacity: .5 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Nenhuma lista ainda</div>
              <div style={{ fontSize: 14, color: T.muted }}>Toque em "+ Nova lista" para começar</div>
            </div>
          )}

          {lists.map((list) => {
            const total = list.items?.length || 0;
            const done  = list.items?.filter((x) => x.done).length || 0;
            const pct   = total > 0 ? (done / total) * 100 : 0;
            return (
              <div key={list.id} style={{ ...card, cursor: "pointer" }} onClick={() => openList(list.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editListId === list.id ? (
                      <input value={editListName} onClick={(e) => e.stopPropagation()} onChange={(e) => setEditListName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveRename(list.id); if (e.key === "Escape") setEditListId(null); }} onBlur={() => saveRename(list.id)} autoFocus style={{ ...inputStyle, marginBottom: 0, fontSize: 17, fontWeight: 700 }} />
                    ) : (
                      <>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{list.name}</div>
                        <div style={{ fontSize: 12, color: T.muted }}>{total === 0 ? "Lista vazia" : `${total - done} restante(s) de ${total}`}</div>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex" }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setEditListId(list.id); setEditListName(list.name); }} style={{ ...iconBtn, color: T.muted }}>✏️</button>
                    <button onClick={() => archiveList(list.id)} style={{ ...iconBtn, color: T.danger }}>📦</button>
                  </div>
                </div>
                {total > 0 && (
                  <div style={{ marginTop: 12, height: 3, background: T.surface2, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: pct === 100 ? T.accent : `linear-gradient(90deg, ${T.accent2}, ${T.accent})`, borderRadius: 2, transition: "width .4s" }} />
                  </div>
                )}
              </div>
            );
          })}

          {showNewList && (
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Nova lista</div>
              <input value={newListName} onChange={(e) => setNewListName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createList()} placeholder="Ex: Semana, Churrasco, Mês..." autoFocus style={inputStyle} />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowNewList(false)} style={{ ...btnSecondary, flex: 1, width: "auto" }}>Cancelar</button>
                <button onClick={createList} style={{ ...btnPrimary, flex: 2 }}>Criar ✓</button>
              </div>
            </div>
          )}

          {!showNewList && <button onClick={() => setShowNewList(true)} style={fab}>+ Nova lista</button>}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TELA: LISTA DE ITENS
      ════════════════════════════════════════════════════════════ */}
      {screen === "list" && activeList && (() => {
        const items   = activeList.items || [];
        const pending = items.filter((i) => !i.done);
        const done    = items.filter((i) => i.done);
        const grouped = {};
        pending.forEach((i) => { const k = i.category || "outros"; if (!grouped[k]) grouped[k] = []; grouped[k].push(i); });

        const ItemRow = ({ item }) => {
          const cat = getCat(item.category);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}`, opacity: item.done ? .4 : 1, transition: "opacity .3s" }}>
              <button onClick={() => toggleItem(activeList.id, item.id)} style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, border: `2px solid ${item.done ? cat.color : T.border}`, background: item.done ? cat.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f1117", fontSize: 16, cursor: "pointer", transition: "all .2s" }}>
                {item.done ? "✓" : ""}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 500, textDecoration: item.done ? "line-through" : "none", color: item.done ? T.muted : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
                  {item.qty && <span style={{ fontSize: 12, color: T.muted }}>{item.qty}</span>}
                  {!groupBy && <span style={{ fontSize: 11, background: cat.color + "22", color: cat.color, borderRadius: 999, padding: "1px 7px", border: `1px solid ${cat.color}44` }}>{cat.label}</span>}
                </div>
              </div>
              {!item.done && <button onClick={() => openEditItem(item)} style={{ ...iconBtn, color: T.muted }}>✏️</button>}
              <button onClick={() => deleteItem(activeList.id, item.id)} style={{ ...iconBtn, color: T.danger }}>🗑</button>
            </div>
          );
        };

        return (
          <div style={{ padding: "0 20px 120px" }}>
            {items.length === 0 && !showAddItem && (
              <div style={{ textAlign: "center", padding: "60px 20px", opacity: .5 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Lista vazia</div>
                <div style={{ fontSize: 14, color: T.muted }}>Toque em + para adicionar o primeiro item</div>
              </div>
            )}

            {!groupBy ? (
              <>
                {pending.map((item) => <ItemRow key={item.id} item={item} />)}
                {done.length > 0 && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0 4px" }}>
                      <span style={{ fontSize: 12, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>Comprados ({done.length})</span>
                      <button onClick={() => updateList(activeList.id, items.filter((i) => !i.done))} style={{ background: "none", border: "none", color: T.danger, fontSize: 12, cursor: "pointer" }}>Limpar</button>
                    </div>
                    {done.map((item) => <ItemRow key={item.id} item={item} />)}
                  </>
                )}
              </>
            ) : (
              <>
                {Object.entries(grouped).map(([catId, catItems]) => {
                  const cat = getCat(catId);
                  return (
                    <div key={catId} style={{ marginTop: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 3, height: 18, background: cat.color, borderRadius: 2 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: cat.color }}>{cat.label}</span>
                      </div>
                      {catItems.map((item) => <ItemRow key={item.id} item={item} />)}
                    </div>
                  );
                })}
                {done.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>✓ Comprados</span>
                      <button onClick={() => updateList(activeList.id, items.filter((i) => !i.done))} style={{ background: "none", border: "none", color: T.danger, fontSize: 12, cursor: "pointer" }}>Limpar</button>
                    </div>
                    {done.map((item) => <ItemRow key={item.id} item={item} />)}
                  </div>
                )}
              </>
            )}

            {/* Formulário adicionar/editar item */}
            {showAddItem && (
              <div style={{ ...card, marginTop: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{editItemId ? "Editar item" : "Novo item"}</div>

                <input
                  ref={itemNameRef}
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveItem()}
                  placeholder="Nome do item *"
                  style={inputStyle}
                />

                {/* Teclado numérico ativado via inputMode */}
                <input
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                  placeholder="Quantidade (ex: 2, 500g, 1 caixa...)"
                  inputMode="numeric"
                  style={inputStyle}
                />

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>Categoria</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {categories.map((c) => (
                      <button key={c.id} onClick={() => setItemCat(c.id)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, border: `1px solid ${itemCat === c.id ? c.color : T.border}`, background: itemCat === c.id ? c.color + "22" : T.surface2, color: itemCat === c.id ? c.color : T.muted, cursor: "pointer" }}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowAddItem(false)} style={{ ...btnSecondary, flex: 1, width: "auto" }}>Cancelar</button>
                  <button onClick={saveItem} style={{ ...btnPrimary, flex: 2 }}>{editItemId ? "Salvar ✓" : "Adicionar ✓"}</button>
                </div>
              </div>
            )}

            {!showAddItem && (
              <button onClick={openAddItem} style={{ ...fab, borderRadius: "50%", padding: 0, width: 60, height: 60, fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            )}
          </div>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════
          TELA: HISTÓRICO
      ════════════════════════════════════════════════════════════ */}
      {screen === "history" && (
        <div style={{ padding: "20px 20px 120px" }}>
          {archived.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", opacity: .5 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Nenhuma lista arquivada</div>
              <div style={{ fontSize: 14, color: T.muted }}>Listas arquivadas aparecem aqui</div>
            </div>
          )}
          {archived.map((list) => {
            const total = list.items?.length || 0;
            const done  = list.items?.filter((x) => x.done).length || 0;
            return (
              <div key={list.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{list.name}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{total} itens · {done} comprados · {new Date(list.archivedAt).toLocaleDateString("pt-PT")}</div>
                  </div>
                  <button onClick={() => duplicateList(list)} style={{ background: T.accent2 + "22", border: `1px solid ${T.accent2}44`, color: T.accent2, borderRadius: 10, padding: "6px 14px", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
                    Duplicar
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {list.items?.slice(0, 5).map((it) => {
                    const cat = getCat(it.category);
                    return <span key={it.id} style={{ fontSize: 11, background: cat.color + "22", color: cat.color, borderRadius: 999, padding: "2px 8px", border: `1px solid ${cat.color}44` }}>{it.name}</span>;
                  })}
                  {(list.items?.length || 0) > 5 && <span style={{ fontSize: 11, color: T.muted }}>+{list.items.length - 5} mais</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TELA: CATEGORIAS
      ════════════════════════════════════════════════════════════ */}
      {screen === "categories" && (
        <div style={{ padding: "20px 20px 120px" }}>

          {categories.map((cat) => (
            <div key={cat.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: cat.color + "33", border: `2px solid ${cat.color}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                {cat.label.split(" ")[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{cat.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: cat.color }} />
                  <span style={{ fontSize: 12, color: T.muted }}>{cat.color}</span>
                </div>
              </div>
              {cat.id !== "outros" ? (
                <button onClick={() => deleteCategory(cat.id)} style={{ ...iconBtn, color: T.danger }} title="Excluir">🗑</button>
              ) : (
                <span style={{ fontSize: 11, color: T.muted, padding: "2px 8px", background: T.surface2, borderRadius: 999 }}>padrão</span>
              )}
            </div>
          ))}

          {showNewCat ? (
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Nova categoria</div>

              <div style={{ fontSize: 12, color: T.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>Nome</div>
              <input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder="Ex: Açougue, Frios, Pet Shop..." autoFocus style={inputStyle} />

              <div style={{ fontSize: 12, color: T.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>Emoji</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {EMOJI_OPTIONS.map((e) => (
                  <button key={e} onClick={() => setNewCatEmoji(e)} style={{ width: 38, height: 38, borderRadius: 10, border: `2px solid ${newCatEmoji === e ? T.accent : T.border}`, background: newCatEmoji === e ? T.accent + "22" : T.surface2, fontSize: 18, cursor: "pointer" }}>{e}</button>
                ))}
              </div>

              <div style={{ fontSize: 12, color: T.muted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>Cor</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {COLOR_OPTIONS.map((c) => (
                  <button key={c} onClick={() => setNewCatColor(c)} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: `3px solid ${newCatColor === c ? T.text : "transparent"}`, cursor: "pointer", transition: "border .15s" }} />
                ))}
              </div>

              {/* Preview */}
              <div style={{ background: T.surface2, borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: T.muted }}>Preview:</span>
                <span style={{ fontSize: 13, background: newCatColor + "22", color: newCatColor, borderRadius: 999, padding: "3px 12px", border: `1px solid ${newCatColor}44` }}>
                  {newCatEmoji} {newCatLabel || "Nome da categoria"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowNewCat(false)} style={{ ...btnSecondary, flex: 1, width: "auto" }}>Cancelar</button>
                <button onClick={createCategory} style={{ ...btnPrimary, flex: 2 }}>Criar ✓</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowNewCat(true)} style={fab}>+ Nova categoria</button>
          )}
        </div>
      )}
    </div>
  );
}
