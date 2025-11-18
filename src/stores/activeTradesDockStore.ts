import { create } from 'zustand';

interface DockCardState {
  id: string;
  order: number;
  x?: number; // pixel offset for drag (desktop)
  y?: number; // pixel offset for drag (desktop)
}

interface ActiveTradesDockStore {
  collapsedMobile: boolean;
  draggingId: string | null;
  cards: DockCardState[]; // ordering & transient drag state
  setCollapsedMobile: (v: boolean) => void;
  ensureCards: (tradeIds: string[]) => void;
  startDrag: (id: string) => void;
  updateDragPos: (id: string, x: number, y: number) => void;
  endDrag: (id: string, dropIndex: number) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
}

export const useActiveTradesDockStore = create<ActiveTradesDockStore>((set, get) => ({
  collapsedMobile: true,
  draggingId: null,
  cards: [],
  setCollapsedMobile: (v) => set({ collapsedMobile: v }),
  ensureCards: (tradeIds) => {
    set((state) => {
      const existingIds = new Set(state.cards.map(c => c.id));
      const newCards: DockCardState[] = [];
      tradeIds.forEach((id) => {
        if (!existingIds.has(id)) {
          newCards.push({ id, order: state.cards.length + newCards.length });
        }
      });
      const filtered = state.cards.filter(c => tradeIds.includes(c.id));
      return { cards: [...filtered, ...newCards].sort((a,b) => a.order - b.order) };
    });
  },
  startDrag: (id) => set({ draggingId: id }),
  updateDragPos: (id, x, y) => set((state) => ({
    cards: state.cards.map(c => c.id === id ? { ...c, x, y } : c)
  })),
  endDrag: (id, dropIndex) => set((state) => {
    const cards = [...state.cards];
    const dragged = cards.find(c => c.id === id);
    if (!dragged) return { draggingId: null, cards: state.cards };
    // reset transient positions
    dragged.x = undefined;
    dragged.y = undefined;
    // reorder by adjusting order values
    const currentIndex = cards.indexOf(dragged);
    if (dropIndex < 0) dropIndex = 0;
    if (dropIndex >= cards.length) dropIndex = cards.length - 1;
    if (currentIndex !== dropIndex) {
      cards.splice(currentIndex, 1);
      cards.splice(dropIndex, 0, dragged);
      cards.forEach((c, i) => c.order = i);
    }
    return { draggingId: null, cards };
  }),
  reorder: (from, to) => set((state) => {
    const cards = [...state.cards];
    if (from < 0 || to < 0 || from >= cards.length || to >= cards.length) return { cards };
    const [item] = cards.splice(from, 1);
    cards.splice(to, 0, item);
    cards.forEach((c, i) => c.order = i);
    return { cards };
  })
}));
