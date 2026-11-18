export type NoteProduct = {
  id: string; title: string; description: string; contents: string; kind: 'note' | 'bundle';
  price_paise: number; cover_url: string; published: boolean; sort_order: number;
  checkout_url?: string; delivery_instructions?: string; updated_at?: string;
};
export type NoteRequest = {
  id: string; product_id: string; user_id?: string; status: 'pending' | 'purchased' | 'rejected';
  delivery_status: 'pending' | 'delivered'; title_snapshot: string; price_paise: number;
  created_at: string; updated_at: string; product?: NoteProduct;
};
export const notesPrice = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const notesStatus = (r?: NoteRequest) => r?.status === 'purchased' ? 'Purchased' : r?.status === 'pending' ? 'Pending verification' : r?.status === 'rejected' ? 'Not verified' : '';
